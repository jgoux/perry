//! Link-routed transport cores for the WASI guest (NET-TRANSPORT-DESIGN P0).
//!
//! The native build drives these through turnloop. The WASI guest has no
//! turnloop driver yet, so every submission reports `ENOTSUP` with its syscall
//! name (Node's `err.code`/`err.syscall`) while the function shapes, the opaque
//! [`TransportCore`] block and the handle snapshot stay identical to
//! `turnloop_net/transport.rs`: `turnloop_net/abi.rs` is shared by `#[path]`
//! and a link-routed binding links against the same `js_perry_net_link_*`
//! symbols. A later slice routes these onto the WASI socket transport.

use std::net::SocketAddr;
use std::path::Path;

use super::errors;
use super::{NetResult, NodeError};
use crate::native_payload::OwnerLink;

/// Words of the opaque block perry-ffi reserves for a [`TransportCore`]
/// (`perry_ffi::turnloop_net::TransportCore`); folded into the ABI digest, so
/// it must equal perry-ffi's value.
pub const TRANSPORT_CORE_WORDS: usize = 39;

/// One socket or listener's transport state, owned by its payload. Idle on
/// every submission here, so it records only the route its sink is bound to.
#[repr(C, align(8))]
pub struct TransportCore {
    route: u8,
}

const _: () = assert!(
    std::mem::size_of::<TransportCore>() <= TRANSPORT_CORE_WORDS * 8
        && std::mem::align_of::<TransportCore>() <= 8,
    "TransportCore outgrew the opaque block perry-ffi reserves"
);

impl TransportCore {
    /// An idle core whose completions go to the link sink `route`.
    pub fn new(route: u8) -> Self {
        Self { route }
    }

    /// The link sink this core's completions go to.
    pub fn route(&self) -> u8 {
        self.route
    }
}

/// A family payload that owns a transport: the core first, so the runtime
/// reads it at offset 0 of the payload a link names.
#[repr(C)]
pub struct TransportPayload<E> {
    pub core: TransportCore,
    pub ext: E,
}

/// An ephemeral copy of the transport's capability for checking the
/// incarnation after JS re-entry. Nothing opens a handle here, so none is ever
/// produced and every snapshot a binding replays compares unequal.
#[derive(Clone, Copy)]
pub(super) struct HandleSnapshot(#[allow(dead_code)] u64);

pub(super) const HANDLE_SNAPSHOT_WORDS: usize = 4;
const _: () = assert!(
    std::mem::size_of::<HandleSnapshot>() <= HANDLE_SNAPSHOT_WORDS * 8
        && std::mem::align_of::<HandleSnapshot>() <= 8
);

pub(super) fn bad(syscall: &'static str) -> NodeError {
    errors::invalid_input(syscall)
}

fn unsupported<T>(syscall: &'static str) -> NetResult<T> {
    Err(errors::unsupported(syscall))
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
    _: *mut TransportCore,
    _: OwnerLink,
    _: &[u8],
    _: bool,
) -> NetResult<()> {
    unsupported("plaintext")
}

pub(super) unsafe fn retained_bytes(_: *mut TransportCore, _: OwnerLink) -> usize {
    0
}

pub(super) unsafe fn snapshot_handle_parts(
    _: *mut TransportCore,
    _: OwnerLink,
) -> Option<[u32; 4]> {
    None
}

pub(super) unsafe fn snapshot_handle(
    _: *mut TransportCore,
    _: OwnerLink,
) -> Option<HandleSnapshot> {
    None
}

pub(super) unsafe fn handle_matches(
    _: *mut TransportCore,
    _: OwnerLink,
    _: HandleSnapshot,
) -> bool {
    false
}

pub(super) unsafe fn set_route(_: *mut TransportCore, _: OwnerLink, _: u8) -> NetResult<()> {
    unsupported("route")
}

pub(super) unsafe fn tcp_listen(
    _: *mut TransportCore,
    _: OwnerLink,
    _: SocketAddr,
    _: u32,
    _: bool,
    _: bool,
) -> NetResult<SocketAddr> {
    unsupported("listen")
}

pub(super) unsafe fn pipe_listen(
    _: *mut TransportCore,
    _: OwnerLink,
    _: &Path,
    _: u32,
) -> NetResult<()> {
    unsupported("listen")
}

pub(super) unsafe fn accept_start(_: *mut TransportCore, _: OwnerLink) -> NetResult<()> {
    unsupported("accept")
}

pub(super) unsafe fn install_accepted(
    _: *mut TransportCore,
    _: OwnerLink,
    _: *const super::NetCompletion,
) -> NetResult<()> {
    unsupported("accept")
}

pub(super) unsafe fn tcp_connect(
    _: *mut TransportCore,
    _: OwnerLink,
    _: &str,
    _: u16,
    _: bool,
) -> NetResult<()> {
    unsupported("connect")
}

pub(super) unsafe fn pipe_connect(
    _: *mut TransportCore,
    _: OwnerLink,
    _: &Path,
) -> NetResult<()> {
    unsupported("connect")
}

pub(super) unsafe fn read_start(_: *mut TransportCore, _: OwnerLink) -> NetResult<()> {
    unsupported("read")
}

pub(super) unsafe fn write(
    _: *mut TransportCore,
    _: OwnerLink,
    _: Vec<u8>,
    _: u64,
) -> NetResult<usize> {
    unsupported("write")
}

pub(super) unsafe fn shutdown(_: *mut TransportCore, _: OwnerLink, _: u64) -> NetResult<()> {
    unsupported("shutdown")
}

/// There is never a driver resource to release, so no `Closed` completion
/// follows and the binding emits its own `close` event.
pub(super) unsafe fn close(_: *mut TransportCore, _: OwnerLink) -> NetResult<bool> {
    Ok(false)
}

pub(super) unsafe fn set_ref(_: *mut TransportCore, _: OwnerLink, _: bool) -> NetResult<()> {
    Ok(())
}

pub(super) unsafe fn queued_bytes(_: *mut TransportCore, _: OwnerLink) -> usize {
    0
}

pub(super) unsafe fn local_addr(_: *mut TransportCore, _: OwnerLink) -> Option<SocketAddr> {
    None
}

pub(super) unsafe fn peer_addr(_: *mut TransportCore, _: OwnerLink) -> Option<SocketAddr> {
    None
}

pub(super) unsafe fn deadline_arm(
    _: *mut TransportCore,
    _: OwnerLink,
    _: u64,
) -> NetResult<()> {
    unsupported("timer")
}

pub(super) unsafe fn deadline_park(_: *mut TransportCore, _: OwnerLink) -> NetResult<()> {
    unsupported("timer")
}

pub(super) unsafe fn deadline_cancel(_: *mut TransportCore, _: OwnerLink) -> NetResult<()> {
    unsupported("timer")
}
