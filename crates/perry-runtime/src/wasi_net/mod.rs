//! WASI stream transport for the shared Perry net ABI (p2 sockets, or on p1
//! the host's listener fds plus the `supa_net` imports; see `perry_wasi_net.c`).
//!
//! The C shim owns socket layouts and WASI imports. This module owns nonblocking
//! handles and native byte queues; the existing extension sink owns JS values.
//! Completions are delivered after releasing every state borrow, so sinks can
//! submit more work or close handles safely.

use std::cell::RefCell;
use std::collections::{HashMap, VecDeque};
use std::ffi::{CStr, CString};
use std::net::SocketAddr;
use std::path::Path;
use std::time::{Duration, Instant};

#[path = "../turnloop_net/abi.rs"]
pub mod abi;
#[path = "../turnloop_net/errors.rs"]
pub(crate) mod errors;
#[path = "../turnloop_net/sink.rs"]
mod sink;
pub mod transport;
pub use errors::NodeError;
pub use sink::{
    register_link_sink, register_sink, sink_installed, NetCompletion, SinkFn, MAX_LINK_ROUTES,
    MAX_SUBSYSTEMS,
};
pub use transport::{TransportCore, TransportPayload, TRANSPORT_CORE_WORDS};
// The completion kinds, for an in-tree subsystem (as `turnloop_net` exports).
pub use sink::{
    NET_ACCEPT, NET_CLOSED, NET_CONNECT, NET_DATA, NET_EOF, NET_ERROR, NET_FLAG_HANDLE_PARTS,
    NET_FLAG_LINK, NET_FLAG_PLAINTEXT, NET_FLAG_STALE, NET_SHUTDOWN, NET_TIMER, NET_WROTE,
};
type NetResult<T> = Result<T, NodeError>;

extern "C" {
    fn perry_wasi_tcp_open(
        host: *const i8,
        port: u16,
        listening: i32,
        backlog: i32,
        reuse_port: i32,
        nodelay: i32,
        pending: *mut i32,
    ) -> i32;
    fn perry_wasi_socket_nonblock(fd: i32) -> i32;
    fn perry_wasi_socket_connect_ready(fd: i32) -> i32;
    fn perry_wasi_socket_accept(fd: i32, nodelay: i32) -> i32;
    fn perry_wasi_socket_read(fd: i32, bytes: *mut u8, len: u32) -> i32;
    fn perry_wasi_socket_write(fd: i32, bytes: *const u8, len: u32) -> i32;
    fn perry_wasi_socket_shutdown(fd: i32) -> i32;
    fn perry_wasi_socket_close(fd: i32) -> i32;
    fn perry_wasi_socket_address(
        fd: i32,
        peer: i32,
        text: *mut i8,
        cap: u32,
        port: *mut u16,
    ) -> i32;
    fn perry_wasi_poll(fds: *const i32, kinds: *const u8, n: u32, timeout_ns: u64) -> i32;
    fn perry_wasi_signal_fd() -> i32;
    fn perry_wasi_stream_read(fd: i32, bytes: *mut u8, len: u32) -> i32;
}

struct Write {
    bytes: Vec<u8>,
    offset: usize,
    user: u64,
}
struct Handle {
    fd: i32,
    subsystem: u8,
    listener: bool,
    accepting: bool,
    connecting: bool,
    connected_event: bool,
    reading: bool,
    /// `read_once`: stop after one buffer until the caller rearms.
    read_once: bool,
    nodelay: bool,
    referenced: bool,
    /// Connected by host name: a failed lookup reads as `ENOTFOUND`.
    by_name: bool,
    writes: VecDeque<Write>,
    shutdown: Option<u64>,
    write_closed: bool,
    /// Owned by a link-routed `TransportCore` (id = the payload's cell): its
    /// completions carry `NET_FLAG_LINK` and go to the core's route.
    linked: bool,
    /// Incarnation of a linked handle, lent to the sink with its `Closed`.
    generation: u64,
}
impl Handle {
    fn new(fd: i32, subsystem: u8) -> Self {
        Self {
            fd,
            subsystem,
            listener: false,
            accepting: false,
            connecting: false,
            connected_event: false,
            reading: false,
            read_once: false,
            nodelay: false,
            referenced: true,
            by_name: false,
            writes: VecDeque::new(),
            shutdown: None,
            write_closed: false,
            linked: false,
            generation: 0,
        }
    }
    fn queued(&self) -> usize {
        self.writes.iter().map(|w| w.bytes.len() - w.offset).sum()
    }
}
impl Drop for Handle {
    fn drop(&mut self) {
        unsafe {
            perry_wasi_socket_close(self.fd);
        }
    }
}
struct Timer {
    subsystem: u8,
    deadline: Option<Instant>,
    /// A linked socket's deadline, keyed `cell | 1` (cells are 8-aligned).
    linked: bool,
}
enum Event {
    Completion(u8, NetCompletion, Vec<u8>),
    Accepted(u8, i64, i32),
}
#[derive(Default)]
struct State {
    handles: HashMap<i64, Handle>,
    timers: HashMap<i64, Timer>,
    events: VecDeque<Event>,
}
thread_local! { static STATE: RefCell<State> = RefCell::new(State::default()); }

fn would_block(result: i32) -> bool {
    result == -libc::EAGAIN || result == -libc::EWOULDBLOCK || result == -libc::EINTR
}
fn valid_registration(
    state: &State,
    id: i64,
    subsystem: u8,
    syscall: &'static str,
) -> NetResult<()> {
    if id <= 0
        || state.handles.contains_key(&id)
        || state.timers.contains_key(&id)
        || !sink_installed(subsystem)
    {
        return Err(errors::invalid_input(syscall));
    }
    Ok(())
}
fn initialize() {
    crate::stdlib_pump::js_register_aux_pump(pump);
    crate::stdlib_pump::js_register_aux_has_active(has_active);
}
pub fn available() -> bool {
    initialize();
    true
}

pub fn tcp_listen(
    id: i64,
    subsystem: u8,
    addr: SocketAddr,
    backlog: u32,
    reuse_port: bool,
    nodelay: bool,
) -> NetResult<SocketAddr> {
    initialize();
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        valid_registration(&state, id, subsystem, "listen")?;
        let host = CString::new(addr.ip().to_string()).unwrap();
        let mut pending = 0;
        let fd = unsafe {
            perry_wasi_tcp_open(
                host.as_ptr(),
                addr.port(),
                1,
                backlog.min(i32::MAX as u32) as i32,
                reuse_port as i32,
                nodelay as i32,
                &mut pending,
            )
        };
        if fd < 0 {
            return Err(errors::from_os(-fd, "listen"));
        }
        let mut handle = Handle::new(fd, subsystem);
        handle.listener = true;
        handle.nodelay = nodelay;
        state.handles.insert(id, handle);
        // Callers report this as `server.address()`. A p1 guest does not choose
        // its socket: the host announces a listener's address in
        // SUPA_LISTEN_ADDRS when it knows it, and otherwise the requested
        // address stands (an ephemeral port 0 stays 0).
        Ok(socket_address(fd, false).unwrap_or(addr))
    })
}
pub fn tcp_connect_host(
    id: i64,
    subsystem: u8,
    host: &str,
    port: u16,
    nodelay: bool,
) -> NetResult<()> {
    initialize();
    let host = CString::new(host).map_err(|_| errors::invalid_input("connect"))?;
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        valid_registration(&state, id, subsystem, "connect")?;
        let mut pending = 0;
        let fd = unsafe {
            perry_wasi_tcp_open(host.as_ptr(), port, 0, 0, 0, nodelay as i32, &mut pending)
        };
        if fd < 0 {
            return Err(errors::from_os(-fd, "connect"));
        }
        let mut handle = Handle::new(fd, subsystem);
        handle.connecting = pending != 0;
        handle.connected_event = true;
        handle.by_name = host.to_str().is_ok_and(|h| h.parse::<std::net::IpAddr>().is_err());
        state.handles.insert(id, handle);
        Ok(())
    })
}
pub fn pipe_listen(_: i64, _: u8, _: &Path, _: u32) -> NetResult<()> {
    Err(errors::unsupported("listen"))
}
pub fn pipe_connect(_: i64, _: u8, _: &Path) -> NetResult<()> {
    Err(errors::unsupported("connect"))
}
pub fn adopt_fd(id: i64, subsystem: u8, fd: i32) -> NetResult<()> {
    initialize();
    // Ownership is consumed even on registration failure.
    let handle = Handle::new(fd, subsystem);
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        valid_registration(&state, id, subsystem, "adopt")?;
        let result = unsafe { perry_wasi_socket_nonblock(fd) };
        if result < 0 {
            return Err(errors::from_os(-result, "adopt"));
        }
        state.handles.insert(id, handle);
        Ok(())
    })
}
fn with_handle<T>(
    id: i64,
    syscall: &'static str,
    f: impl FnOnce(&mut Handle) -> NetResult<T>,
) -> NetResult<T> {
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        f(state
            .handles
            .get_mut(&id)
            .ok_or_else(|| errors::from_os(libc::EBADF, syscall))?)
    })
}
pub fn accept_start(id: i64) -> NetResult<()> {
    with_handle(id, "accept", |h| {
        if !h.listener {
            return Err(errors::invalid_input("accept"));
        }
        h.accepting = true;
        Ok(())
    })
}
pub fn read_start(id: i64) -> NetResult<()> {
    with_handle(id, "read", |h| {
        h.reading = true;
        h.read_once = false;
        Ok(())
    })
}
/// Read one buffer; the caller rearms after consuming it, so downstream
/// backpressure leaves the socket unread without closing it.
pub fn read_once(id: i64) -> NetResult<()> {
    with_handle(id, "read", |h| {
        h.reading = true;
        h.read_once = true;
        Ok(())
    })
}
pub fn write(id: i64, bytes: Vec<u8>, user: u64) -> NetResult<usize> {
    with_handle(id, "write", |h| {
        if h.listener || h.write_closed {
            return Err(errors::from_os(libc::EPIPE, "write"));
        }
        h.writes.push_back(Write {
            bytes,
            offset: 0,
            user,
        });
        Ok(h.queued())
    })
}
pub fn shutdown(id: i64, user: u64) -> NetResult<()> {
    with_handle(id, "shutdown", |h| {
        if h.listener {
            return Err(errors::invalid_input("shutdown"));
        }
        if h.write_closed {
            return Err(errors::from_os(libc::EPIPE, "shutdown"));
        }
        h.write_closed = true;
        h.shutdown = Some(user);
        Ok(())
    })
}
pub fn close(id: i64) -> NetResult<()> {
    STATE.with(|state| {
        let mut state = state.borrow_mut();
        if let Some(h) = state.handles.remove(&id) {
            state.events.push_back(Event::Completion(
                h.subsystem,
                NetCompletion::closed(id),
                Vec::new(),
            ));
        }
        state.timers.remove(&id);
        Ok(())
    })
}
pub fn set_ref(id: i64, referenced: bool) -> NetResult<()> {
    with_handle(id, "ref", |h| {
        h.referenced = referenced;
        Ok(())
    })
}
pub fn queued_bytes(id: i64) -> usize {
    STATE.with(|s| s.borrow().handles.get(&id).map_or(0, Handle::queued))
}
pub fn is_live(id: i64) -> bool {
    STATE.with(|s| s.borrow().handles.contains_key(&id))
}
pub fn live_handles() -> usize {
    STATE.with(|s| s.borrow().handles.len())
}
pub fn transfer(id: i64, subsystem: u8) -> NetResult<()> {
    if !sink_installed(subsystem) {
        return Err(errors::invalid_input("transfer"));
    }
    with_handle(id, "transfer", |h| {
        h.subsystem = subsystem;
        Ok(())
    })
}
pub fn timer_arm(id: i64, subsystem: u8, delay_ms: u64) -> NetResult<()> {
    initialize();
    if !sink_installed(subsystem) {
        return Err(errors::invalid_input("timer"));
    }
    let deadline = Instant::now()
        .checked_add(Duration::from_millis(delay_ms))
        .ok_or_else(|| errors::invalid_input("timer"))?;
    STATE.with(|s| {
        s.borrow_mut().timers.insert(
            id,
            Timer {
                subsystem,
                deadline: Some(deadline),
                linked: false,
            },
        )
    });
    Ok(())
}
pub fn timer_cancel(id: i64) -> NetResult<()> {
    STATE.with(|s| s.borrow_mut().timers.remove(&id));
    Ok(())
}
pub fn timer_park(id: i64) -> NetResult<()> {
    STATE.with(|s| {
        if let Some(t) = s.borrow_mut().timers.get_mut(&id) {
            t.deadline = None;
        }
    });
    Ok(())
}
fn socket_address(fd: i32, peer: bool) -> Option<SocketAddr> {
    let mut text = [0i8; 64];
    let mut port = 0;
    let result = unsafe {
        perry_wasi_socket_address(fd, peer as i32, text.as_mut_ptr(), text.len() as u32, &mut port)
    };
    if result < 0 {
        return None;
    }
    let ip = unsafe { CStr::from_ptr(text.as_ptr()) }
        .to_str()
        .ok()?
        .parse()
        .ok()?;
    Some(SocketAddr::new(ip, port))
}
fn address(id: i64, peer: bool) -> Option<SocketAddr> {
    let fd = STATE.with(|s| s.borrow().handles.get(&id).map(|h| h.fd))?;
    socket_address(fd, peer)
}
/// The host resolves a connect target itself and reports a failed lookup as
/// `EHOSTUNREACH`; for a name that is libuv's `ENOTFOUND` (`-3008`).
fn connect_error(os: i32, by_name: bool) -> NodeError {
    if by_name && os == libc::EHOSTUNREACH {
        return NodeError {
            code: "ENOTFOUND",
            errno: -3008,
            syscall: "getaddrinfo",
        };
    }
    errors::from_os(os, "connect")
}
pub fn local_addr(id: i64) -> Option<SocketAddr> {
    address(id, false)
}
pub fn peer_addr(id: i64) -> Option<SocketAddr> {
    address(id, true)
}

extern "C" fn has_active() -> i32 {
    STATE.with(|s| {
        let s = s.borrow();
        i32::from(!s.events.is_empty() || s.handles.values().any(|h| h.referenced))
    })
}
/// How long the event loop may park, in ms: 0 when work is ready now, the
/// nearest timer deadline, or -1 for no deadline. The park itself (`park`) wakes
/// on socket readiness, so sockets need no polling interval.
pub(crate) fn next_wake_ms() -> f64 {
    STATE.with(|s| {
        let s = s.borrow();
        if !s.events.is_empty()
            || s.handles.values().any(|h| {
                (!h.connecting && h.connected_event) || (h.shutdown.is_some() && h.writes.is_empty())
            })
        {
            return 0.0;
        }
        let now = Instant::now();
        s.timers
            .values()
            .filter_map(|t| t.deadline)
            .map(|d| d.saturating_duration_since(now).as_secs_f64() * 1000.0)
            .fold(-1.0, |next: f64, d| if next < 0.0 || d < next { d } else { next })
    })
}

thread_local! { static SIGNAL_FD: std::cell::Cell<Option<i32>> = const { std::cell::Cell::new(None) }; }
/// The host's signal stream (`SUPA_SIGNAL_FD`), or -1.
fn signal_fd() -> i32 {
    SIGNAL_FD.with(|cell| match cell.get() {
        Some(fd) => fd,
        None => {
            let fd = unsafe { perry_wasi_signal_fd() };
            cell.set(Some(fd));
            fd
        }
    })
}
/// Reads the signals the host queued (one byte each) and delivers them.
pub(crate) fn drain_signals() {
    let fd = signal_fd();
    if fd < 0 {
        return;
    }
    let mut bytes = [0u8; 32];
    loop {
        let n = unsafe { perry_wasi_stream_read(fd, bytes.as_mut_ptr(), bytes.len() as u32) };
        if n <= 0 {
            return;
        }
        for &signal in &bytes[..n as usize] {
            crate::os::signal::wasi_deliver(signal);
        }
    }
}

/// Sleep for at most `budget` in one `poll_oneoff`: until a socket the loop
/// waits on is ready, a signal arrives, or the budget (next timer) elapses.
/// Returns false, having done nothing, when there is nothing to wait on.
pub(crate) fn park(budget: Duration) -> bool {
    let signal = signal_fd();
    let mut fds = Vec::new();
    let mut kinds = Vec::new();
    STATE.with(|s| {
        for h in s.borrow().handles.values() {
            let mut kind = 0u8;
            if h.connecting || !h.writes.is_empty() {
                kind |= 2;
            }
            if h.reading || (h.listener && h.accepting) {
                kind |= 1;
            }
            if kind != 0 {
                fds.push(h.fd);
                kinds.push(kind);
            }
        }
    });
    if signal >= 0 {
        fds.push(signal);
        kinds.push(1);
    }
    if fds.is_empty() {
        return false;
    }
    let timeout = budget.as_nanos().min(u64::MAX as u128) as u64;
    unsafe { perry_wasi_poll(fds.as_ptr(), kinds.as_ptr(), fds.len() as u32, timeout) };
    true
}
fn completion(events: &mut VecDeque<Event>, h: &Handle, c: NetCompletion) {
    events.push_back(Event::Completion(
        h.subsystem,
        if h.linked { c.linked() } else { c },
        Vec::new(),
    ));
}

extern "C" fn pump() -> i32 {
    drain_signals();
    let mut events = STATE.with(|s| {
        let mut s = s.borrow_mut();
        let State {
            handles,
            timers,
            events,
        } = &mut *s;
        for (&id, h) in handles.iter_mut() {
            if h.connecting {
                let ready = unsafe { perry_wasi_socket_connect_ready(h.fd) };
                if ready == 0 {
                    continue;
                }
                h.connecting = false;
                if ready < 0 {
                    h.connected_event = false;
                    completion(
                        events,
                        h,
                        NetCompletion::error(
                            id,
                            0,
                            h.queued(),
                            connect_error(-ready, h.by_name),
                            true,
                        ),
                    );
                    continue;
                }
            }
            if h.connected_event {
                h.connected_event = false;
                completion(events, h, NetCompletion::connect(id));
            }
            if h.accepting {
                for _ in 0..32 {
                    let fd = unsafe { perry_wasi_socket_accept(h.fd, h.nodelay as i32) };
                    if would_block(fd) {
                        break;
                    }
                    if fd < 0 {
                        completion(
                            events,
                            h,
                            NetCompletion::error(id, 0, 0, errors::from_os(-fd, "accept"), false),
                        );
                        break;
                    }
                    events.push_back(Event::Accepted(h.subsystem, id, fd));
                }
            }
            while let Some(w) = h.writes.front_mut() {
                if w.offset != w.bytes.len() {
                    let remaining = &w.bytes[w.offset..];
                    let n = unsafe {
                        perry_wasi_socket_write(
                            h.fd,
                            remaining.as_ptr(),
                            remaining.len().min(i32::MAX as usize) as u32,
                        )
                    };
                    if would_block(n) || n == 0 {
                        break;
                    }
                    if n < 0 {
                        let user = w.user;
                        h.writes.pop_front();
                        completion(
                            events,
                            h,
                            NetCompletion::error(
                                id,
                                user,
                                h.queued(),
                                errors::from_os(-n, "write"),
                                true,
                            ),
                        );
                        break;
                    }
                    w.offset += n as usize;
                    if w.offset != w.bytes.len() {
                        break;
                    }
                }
                let w = h.writes.pop_front().unwrap();
                completion(
                    events,
                    h,
                    NetCompletion::wrote(id, w.user, w.bytes.len(), h.queued()),
                );
            }
            if h.writes.is_empty() {
                if let Some(user) = h.shutdown.take() {
                    let result = unsafe { perry_wasi_socket_shutdown(h.fd) };
                    completion(
                        events,
                        h,
                        if result < 0 {
                            NetCompletion::error(
                                id,
                                user,
                                0,
                                errors::from_os(-result, "shutdown"),
                                true,
                            )
                        } else {
                            NetCompletion::shutdown(id, user)
                        },
                    );
                }
            }
            if h.reading {
                for _ in 0..32 {
                    let mut bytes = vec![0u8; 16 * 1024];
                    let n = unsafe {
                        perry_wasi_socket_read(h.fd, bytes.as_mut_ptr(), bytes.len() as u32)
                    };
                    if would_block(n) {
                        break;
                    }
                    if n <= 0 {
                        h.reading = false;
                        completion(
                            events,
                            h,
                            if n == 0 {
                                NetCompletion::eof(id)
                            } else {
                                NetCompletion::error(
                                    id,
                                    0,
                                    h.queued(),
                                    errors::from_os(-n, "read"),
                                    true,
                                )
                            },
                        );
                        break;
                    }
                    bytes.truncate(n as usize);
                    let data = NetCompletion::data(id, &bytes);
                    events.push_back(Event::Completion(
                        h.subsystem,
                        if h.linked { data.linked() } else { data },
                        bytes,
                    ));
                    if h.read_once {
                        h.reading = false;
                        break;
                    }
                }
            }
        }
        let now = Instant::now();
        timers.retain(|&id, t| {
            if t.deadline.is_some_and(|d| d <= now) {
                let event = if t.linked {
                    NetCompletion::timer(id & !1).linked()
                } else {
                    NetCompletion::timer(id)
                };
                events.push_back(Event::Completion(t.subsystem, event, Vec::new()));
                false
            } else {
                true
            }
        });
        std::mem::take(events)
    });
    let count = events.len().min(i32::MAX as usize) as i32;
    while let Some(event) = events.pop_front() {
        match event {
            Event::Completion(subsystem, c, bytes) => {
                if c.flags & sink::NET_FLAG_LINK != 0 {
                    transport::deliver(subsystem, c, &bytes);
                } else if c.kind == sink::NET_CLOSED || c.kind == sink::NET_TIMER || is_live(c.id)
                {
                    sink::emit(subsystem, c);
                }
                drop(bytes); // The read payload stays alive through the sink call.
            }
            Event::Accepted(subsystem, server, fd) => {
                let linked = STATE.with(|s| s.borrow().handles.get(&server).map(|h| h.linked));
                let Some(linked) = linked else {
                    unsafe { perry_wasi_socket_close(fd) };
                    continue;
                };
                if linked {
                    transport::deliver_accept(subsystem, server, fd);
                    continue;
                }
                let handle = Handle::new(fd, subsystem);
                let Some(id) = sink::allocate_id(subsystem) else {
                    continue;
                };
                STATE.with(|s| s.borrow_mut().handles.insert(id, handle));
                sink::emit(subsystem, NetCompletion::accept(server, id, peer_addr(id)));
            }
        }
    }
    count
}
