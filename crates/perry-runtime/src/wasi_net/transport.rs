//! Link-routed transport cores for the WASI guest (NET-TRANSPORT-DESIGN P0).
//!
//! The native build drives these through turnloop. The WASI guest runs them on
//! the handle table in `super` (nonblocking fds, a byte queue per handle, one
//! `poll_oneoff` when the loop idles): a core is just the payload's route plus
//! flags, its handle is keyed by the payload cell (`link.0`), and every
//! completion is flagged `NET_FLAG_LINK` and delivered through [`deliver`],
//! which checks the cell is still alive first. The function shapes, the opaque
//! [`TransportCore`] block and the handle snapshot stay identical to
//! `turnloop_net/transport.rs`: `turnloop_net/abi.rs` is shared by `#[path]`
//! and a link-routed binding links against the same `js_perry_net_link_*`
//! symbols.
//!
//! Lifetime follows the native rules: an installed handle, and an armed
//! deadline, each hold one `link_ref` on the cell until their terminal
//! completion (`Closed`, `Timer`) has been delivered, so the sweep never
//! finalizes a payload with a completion still queued.

use std::cell::Cell;
use std::net::SocketAddr;
use std::path::Path;

use super::errors;
use super::sink;
use super::{NetCompletion, NetResult, NodeError, Timer, STATE};
use crate::native_payload::{self as np, OwnerLink};

/// Words of the opaque block perry-ffi reserves for a [`TransportCore`]
/// (`perry_ffi::turnloop_net::TransportCore`); folded into the ABI digest, so
/// it must equal perry-ffi's value.
pub const TRANSPORT_CORE_WORDS: usize = 39;

/// One socket or listener's transport state, owned by its payload.
#[repr(C, align(8))]
pub struct TransportCore {
    /// The incarnation of the installed handle (0 = none).
    generation: u64,
    route: u8,
    /// Node's `ref()` state, applied to every handle this core installs.
    referenced: bool,
    /// A deadline timer is armed (holding a ref).
    deadline: bool,
}

const _: () = assert!(
    std::mem::size_of::<TransportCore>() <= TRANSPORT_CORE_WORDS * 8
        && std::mem::align_of::<TransportCore>() <= 8,
    "TransportCore outgrew the opaque block perry-ffi reserves"
);

impl TransportCore {
    /// An idle core whose completions go to the link sink `route`.
    pub fn new(route: u8) -> Self {
        Self {
            generation: 0,
            route,
            referenced: true,
            deadline: false,
        }
    }

    /// The link sink this core's completions go to.
    pub fn route(&self) -> u8 {
        self.route
    }

    /// Move the socket to another link sink.
    pub fn set_route(&mut self, route: u8) {
        self.route = route;
    }
}

/// A family payload that owns a transport: the core first, so the runtime
/// reads it at offset 0 of the payload a link names.
#[repr(C)]
pub struct TransportPayload<E> {
    pub core: TransportCore,
    pub ext: E,
}

/// An ephemeral copy of the core's incarnation for checking, after JS
/// re-entry, that the socket the caller started with is still installed.
#[derive(Clone, Copy)]
pub(super) struct HandleSnapshot(u64);

pub(super) const HANDLE_SNAPSHOT_WORDS: usize = 4;
const _: () = assert!(
    std::mem::size_of::<HandleSnapshot>() <= HANDLE_SNAPSHOT_WORDS * 8
        && std::mem::align_of::<HandleSnapshot>() <= 8
);

pub(super) fn bad(syscall: &'static str) -> NodeError {
    errors::invalid_input(syscall)
}

fn not_found(syscall: &'static str) -> NodeError {
    errors::from_os(libc::EBADF, syscall)
}

thread_local! {
    /// Source of handle incarnations; never 0.
    static GENERATION: Cell<u64> = const { Cell::new(0) };
}

fn next_generation() -> u64 {
    GENERATION.with(|g| {
        g.set(g.get() + 1);
        g.get()
    })
}

/// The handle table key of a payload's socket (cells are 8-aligned, nonzero).
fn id_of(link: OwnerLink) -> i64 {
    link.0 as i64
}

/// The key of its deadline timer: distinct from every handle key.
fn timer_key(link: OwnerLink) -> i64 {
    link.0 as i64 | 1
}

fn hold(link: OwnerLink) {
    // SAFETY: the caller holds the payload (it is bound), so the cell is alive.
    unsafe { np::link_ref(link) };
}

fn release(link: OwnerLink) {
    // SAFETY: balances a `hold` whose resource just ended.
    unsafe { np::link_unref(link) };
}

/// Validate a submission's `(core, link)` pair as the native `bind` does.
///
/// # Safety
/// `link` came from `owner_link` on this thread and its cell is alive.
unsafe fn bind<'a>(
    core: *mut TransportCore,
    link: OwnerLink,
    syscall: &'static str,
) -> NetResult<&'a mut TransportCore> {
    if core.is_null() || link.0 == 0 || np::link_open_payload(link) != core.cast() {
        return Err(bad(syscall));
    }
    let c = &mut *core;
    if !sink::is_link_route(c.route) {
        return Err(bad(syscall));
    }
    Ok(c)
}

/// The OPEN core behind `link`, for dispatch.
unsafe fn core_of<'a>(link: OwnerLink) -> Option<&'a mut TransportCore> {
    let p = np::link_open_payload(link);
    (!p.is_null()).then(|| &mut *(p as *mut TransportCore))
}

pub(super) unsafe fn core_init(core: *mut TransportCore, route: u8) {
    // SAFETY: `core` is writable for `TRANSPORT_CORE_WORDS` words, 8-aligned.
    unsafe { std::ptr::write(core, TransportCore::new(route)) };
}

pub(super) unsafe fn core_drop(core: *mut TransportCore) {
    // SAFETY: `core` was initialized by `core_init` and is not used afterwards.
    unsafe { std::ptr::drop_in_place(core) };
}

pub(super) unsafe fn dispatch_plaintext(
    core: *mut TransportCore,
    link: OwnerLink,
    bytes: &[u8],
    eof: bool,
) -> NetResult<()> {
    let route = bind(core, link, "plaintext")?.route;
    let mut event = if eof {
        NetCompletion::eof(link.0 as i64)
    } else {
        NetCompletion::data(link.0 as i64, bytes)
    }
    .linked();
    event.flags |= sink::NET_FLAG_PLAINTEXT;
    sink::emit(route, event);
    Ok(())
}

pub(super) unsafe fn retained_bytes(_: *mut TransportCore, _: OwnerLink) -> usize {
    0
}

fn parts(generation: u64) -> [u32; 4] {
    [generation as u32, (generation >> 32) as u32, 0, 0]
}

pub(super) unsafe fn snapshot_handle_parts(
    core: *mut TransportCore,
    link: OwnerLink,
) -> Option<[u32; 4]> {
    let c = bind(core, link, "handle").ok()?;
    (c.generation != 0).then(|| parts(c.generation))
}

pub(super) unsafe fn snapshot_handle(
    core: *mut TransportCore,
    link: OwnerLink,
) -> Option<HandleSnapshot> {
    let c = bind(core, link, "handle").ok()?;
    (c.generation != 0).then_some(HandleSnapshot(c.generation))
}

pub(super) unsafe fn handle_matches(
    core: *mut TransportCore,
    link: OwnerLink,
    snapshot: HandleSnapshot,
) -> bool {
    bind(core, link, "handle").is_ok_and(|c| c.generation == snapshot.0)
}

pub(super) unsafe fn set_route(
    core: *mut TransportCore,
    link: OwnerLink,
    route: u8,
) -> NetResult<()> {
    let c = bind(core, link, "route")?;
    if !sink::is_link_route(route) {
        return Err(bad("route"));
    }
    c.set_route(route);
    Ok(())
}

/// Record a handle `super` just inserted for this core (+1 ref).
fn install(c: &mut TransportCore, link: OwnerLink, generation: u64) {
    c.generation = generation;
    if !c.referenced {
        STATE.with(|s| {
            if let Some(h) = s.borrow_mut().handles.get_mut(&id_of(link)) {
                h.referenced = false;
            }
        });
    }
    hold(link);
}

/// Mark the handle `super` just inserted as this core's, then install it.
fn adopt(c: &mut TransportCore, link: OwnerLink) {
    let generation = next_generation();
    STATE.with(|s| {
        if let Some(h) = s.borrow_mut().handles.get_mut(&id_of(link)) {
            h.linked = true;
            h.generation = generation;
        }
    });
    install(c, link, generation);
}

fn idle_or(c: &TransportCore, syscall: &'static str) -> NetResult<()> {
    if c.generation != 0 {
        return Err(bad(syscall));
    }
    Ok(())
}

pub(super) unsafe fn tcp_listen(
    core: *mut TransportCore,
    link: OwnerLink,
    addr: SocketAddr,
    backlog: u32,
    reuse_port: bool,
    nodelay: bool,
) -> NetResult<SocketAddr> {
    let c = bind(core, link, "listen")?;
    idle_or(c, "listen")?;
    let local = super::tcp_listen(id_of(link), c.route, addr, backlog, reuse_port, nodelay)?;
    adopt(c, link);
    Ok(local)
}

pub(super) unsafe fn pipe_listen(
    _: *mut TransportCore,
    _: OwnerLink,
    _: &Path,
    _: u32,
) -> NetResult<()> {
    Err(errors::unsupported("listen"))
}

pub(super) unsafe fn accept_start(core: *mut TransportCore, link: OwnerLink) -> NetResult<()> {
    bind(core, link, "accept")?;
    super::accept_start(id_of(link))
}

/// An accepted connection in flight to the sink (`NetCompletion::conn`).
struct AcceptSlot {
    fd: Option<i32>,
}

pub(super) unsafe fn install_accepted(
    core: *mut TransportCore,
    link: OwnerLink,
    completion: *const NetCompletion,
) -> NetResult<()> {
    let c = bind(core, link, "accept")?;
    idle_or(c, "accept")?;
    let Some(completion) = completion.as_ref() else {
        return Err(bad("accept"));
    };
    if completion.kind != sink::NET_ACCEPT
        || completion.flags & sink::NET_FLAG_LINK == 0
        || completion.conn == 0
    {
        return Err(bad("accept"));
    }
    let slot = &mut *(completion.conn as *mut AcceptSlot);
    let Some(fd) = slot.fd.take() else {
        return Err(bad("accept"));
    };
    // Consumes `fd` on every outcome.
    super::adopt_fd(id_of(link), c.route, fd)?;
    adopt(c, link);
    Ok(())
}

pub(super) unsafe fn tcp_connect(
    core: *mut TransportCore,
    link: OwnerLink,
    host: &str,
    port: u16,
    nodelay: bool,
) -> NetResult<()> {
    let c = bind(core, link, "connect")?;
    idle_or(c, "connect")?;
    super::tcp_connect_host(id_of(link), c.route, host, port, nodelay)?;
    adopt(c, link);
    Ok(())
}

pub(super) unsafe fn pipe_connect(
    _: *mut TransportCore,
    _: OwnerLink,
    _: &Path,
) -> NetResult<()> {
    Err(errors::unsupported("connect"))
}

pub(super) unsafe fn read_start(core: *mut TransportCore, link: OwnerLink) -> NetResult<()> {
    let c = bind(core, link, "read")?;
    if c.generation == 0 {
        return Err(not_found("read"));
    }
    super::read_start(id_of(link))
}

pub(super) unsafe fn write(
    core: *mut TransportCore,
    link: OwnerLink,
    bytes: Vec<u8>,
    user: u64,
) -> NetResult<usize> {
    let c = bind(core, link, "write")?;
    if c.generation == 0 {
        return Err(not_found("write"));
    }
    super::write(id_of(link), bytes, user)
}

pub(super) unsafe fn shutdown(core: *mut TransportCore, link: OwnerLink, user: u64) -> NetResult<()> {
    let c = bind(core, link, "shutdown")?;
    if c.generation == 0 {
        return Err(not_found("shutdown"));
    }
    super::shutdown(id_of(link), user)
}

/// Release the core's resources. Returns whether a `Closed` completion for
/// this link will follow (it releases the handle's ref); otherwise the binding
/// emits its own `close` event.
pub(super) unsafe fn close(core: *mut TransportCore, link: OwnerLink) -> NetResult<bool> {
    let c = bind(core, link, "close")?;
    deadline_cancel(core, link)?;
    if c.generation == 0 {
        return Ok(false);
    }
    let generation = std::mem::take(&mut c.generation);
    let id = id_of(link);
    let closed = STATE.with(|s| {
        let mut s = s.borrow_mut();
        let handle = s.handles.remove(&id)?;
        // Completions already queued for the closed incarnation are void.
        s.events.retain(|e| match e {
            super::Event::Completion(_, c, _) => c.id != id,
            super::Event::Accepted(_, server, fd) => {
                if *server == id {
                    // SAFETY: the queued connection is owned by this event.
                    unsafe { super::perry_wasi_socket_close(*fd) };
                }
                *server != id
            }
        });
        let bytes: Vec<u8> = parts(generation).iter().flat_map(|p| p.to_ne_bytes()).collect();
        let mut event = NetCompletion::closed(id).linked();
        event.flags |= sink::NET_FLAG_HANDLE_PARTS;
        event.data = bytes.as_ptr();
        event.len = bytes.len();
        s.events
            .push_back(super::Event::Completion(handle.subsystem, event, bytes));
        Some(())
    });
    if closed.is_none() {
        // The table lost the handle (never inserted): nothing will follow.
        release(link);
        return Ok(false);
    }
    Ok(true)
}

pub(super) unsafe fn set_ref(
    core: *mut TransportCore,
    link: OwnerLink,
    referenced: bool,
) -> NetResult<()> {
    let c = bind(core, link, "")?;
    c.referenced = referenced;
    if c.generation != 0 {
        super::set_ref(id_of(link), referenced)?;
    }
    Ok(())
}

pub(super) unsafe fn queued_bytes(core: *mut TransportCore, link: OwnerLink) -> usize {
    match bind(core, link, "") {
        Ok(_) => super::queued_bytes(id_of(link)),
        Err(_) => 0,
    }
}

pub(super) unsafe fn local_addr(core: *mut TransportCore, link: OwnerLink) -> Option<SocketAddr> {
    let c = bind(core, link, "").ok()?;
    (c.generation != 0).then(|| super::local_addr(id_of(link))).flatten()
}

pub(super) unsafe fn peer_addr(core: *mut TransportCore, link: OwnerLink) -> Option<SocketAddr> {
    let c = bind(core, link, "").ok()?;
    (c.generation != 0).then(|| super::peer_addr(id_of(link))).flatten()
}

pub(super) unsafe fn deadline_arm(
    core: *mut TransportCore,
    link: OwnerLink,
    delay_ms: u64,
) -> NetResult<()> {
    let c = bind(core, link, "timer")?;
    let deadline = std::time::Instant::now()
        .checked_add(std::time::Duration::from_millis(delay_ms))
        .ok_or_else(|| bad("timer"))?;
    STATE.with(|s| {
        s.borrow_mut().timers.insert(
            timer_key(link),
            Timer {
                subsystem: c.route,
                deadline: Some(deadline),
                linked: true,
            },
        )
    });
    if !c.deadline {
        c.deadline = true;
        hold(link);
    }
    Ok(())
}

pub(super) unsafe fn deadline_park(core: *mut TransportCore, link: OwnerLink) -> NetResult<()> {
    bind(core, link, "timer")?;
    STATE.with(|s| {
        if let Some(t) = s.borrow_mut().timers.get_mut(&timer_key(link)) {
            t.deadline = None;
        }
    });
    Ok(())
}

pub(super) unsafe fn deadline_cancel(core: *mut TransportCore, link: OwnerLink) -> NetResult<()> {
    let c = bind(core, link, "timer")?;
    if std::mem::take(&mut c.deadline) {
        STATE.with(|s| s.borrow_mut().timers.remove(&timer_key(link)));
        release(link);
    }
    Ok(())
}

/// Deliver one link-flagged completion from the pump: only while the cell is
/// alive, to the core's current route. A terminal one releases its resource's
/// ref after the sink returns, so the cell stays pinned through the call.
pub(super) fn deliver(subsystem: u8, completion: NetCompletion, _bytes: &[u8]) {
    let link = OwnerLink(completion.id as usize);
    // SAFETY: a ref held for the resource this completion belongs to keeps the
    // cell alive; a finalized cell answers None and is never touched again.
    unsafe {
        if np::link_event_owner(link).is_none() {
            return;
        }
        let route = core_of(link).map_or(subsystem, |c| c.route);
        match completion.kind {
            sink::NET_CLOSED => {
                sink::emit(route, completion);
                release(link);
            }
            sink::NET_TIMER => {
                let Some(c) = core_of(link) else {
                    return;
                };
                if !std::mem::take(&mut c.deadline) {
                    // Cancelled or replaced after it fired.
                    return;
                }
                sink::emit(route, completion);
                release(link);
            }
            _ => {
                if super::is_live(completion.id) {
                    sink::emit(route, completion);
                }
            }
        }
    }
}

/// Offer an accepted connection to the listener's sink; one it does not
/// install is closed here.
pub(super) fn deliver_accept(subsystem: u8, server: i64, fd: i32) {
    let link = OwnerLink(server as usize);
    let mut slot = AcceptSlot { fd: Some(fd) };
    // SAFETY: as in `deliver`.
    unsafe {
        if np::link_event_owner(link).is_some() && super::is_live(server) {
            let route = core_of(link).map_or(subsystem, |c| c.route);
            let peer = super::socket_address(fd, true);
            sink::emit(
                route,
                NetCompletion::accept(server, &mut slot as *mut AcceptSlot as i64, peer).linked(),
            );
        }
        if let Some(fd) = slot.fd.take() {
            super::perry_wasi_socket_close(fd);
        }
    }
}
