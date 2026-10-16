//! wasm32 replacement for the linker-section discovery of runtime-declared
//! layout descriptors, atoms and image strings.
//!
//! rustc accepts only plain byte lists in a wasm custom section and wasm-ld
//! synthesizes no `__start_`/`__stop_` bounds, so the section scan the other
//! targets use cannot run. Each declaration instead registers its address from
//! an `.init_array` constructor (`wasm_register!`), which wasm-ld runs from
//! `__wasm_call_ctors` before `main`. The program-emitted descriptors codegen
//! writes for native targets are not emitted for wasm triples, so these are
//! the only records.
use super::layout_desc::{PerryLayoutDesc, StaticAtom};
use std::sync::Mutex;

static LAYOUTS: Mutex<Vec<usize>> = Mutex::new(Vec::new());
static ATOMS: Mutex<Vec<usize>> = Mutex::new(Vec::new());
/// `(start, end)` of every immutable image string.
static IMAGES: Mutex<Vec<(usize, usize)>> = Mutex::new(Vec::new());

fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

pub(crate) fn register_layout(desc: *mut PerryLayoutDesc) {
    lock(&LAYOUTS).push(desc as usize);
}

pub(crate) fn register_atom(atom: *const StaticAtom) {
    lock(&ATOMS).push(atom as usize);
}

pub(crate) fn register_image(start: usize, len: usize) {
    lock(&IMAGES).push((start, start + len));
}

pub(crate) fn layouts() -> Vec<*mut PerryLayoutDesc> {
    lock(&LAYOUTS).iter().map(|&a| a as *mut _).collect()
}

pub(crate) fn atoms() -> Vec<*mut StaticAtom> {
    lock(&ATOMS).iter().map(|&a| a as *mut _).collect()
}

/// The `(start, end)` of the image string whose bytes contain `addr`.
pub(crate) fn image_range(addr: usize) -> Option<(usize, usize)> {
    lock(&IMAGES)
        .iter()
        .copied()
        .find(|&(start, end)| addr >= start && addr < end)
}

/// Run `$body` from an `.init_array` constructor.
macro_rules! wasm_ctor {
    ($body:expr) => {
        const _: () = {
            extern "C" fn ctor() {
                $body
            }
            #[used]
            #[link_section = ".init_array"]
            static CTOR: extern "C" fn() = ctor;
        };
    };
}
pub(crate) use wasm_ctor;
