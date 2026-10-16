//! Pure-Rust inflate state for wasm32, with the interface of the zlib-ng
//! `inflate_context.rs` the other targets use. flate2 allocates through the
//! global allocator, so the payload allocation ledger is not involved.

use perry_ffi::native_payload::buffer::BufferOwner;
use flate2::{Decompress, FlushDecompress, Status};
use std::io::{self, ErrorKind};

pub(super) struct Context(Decompress);

pub(super) struct Progress {
    pub consumed: usize,
    pub written: usize,
    pub ended: bool,
}

impl Context {
    pub(super) fn new(_owner: &BufferOwner, zlib_header: bool) -> io::Result<Self> {
        Ok(Self(Decompress::new(zlib_header)))
    }

    pub(super) fn step(&mut self, input: &[u8], output: &mut [u8]) -> io::Result<Progress> {
        let (in_before, out_before) = (self.0.total_in(), self.0.total_out());
        let status = self
            .0
            .decompress(input, output, FlushDecompress::None)
            .map_err(|error| io::Error::new(ErrorKind::InvalidData, error.to_string()))?;
        Ok(Progress {
            consumed: (self.0.total_in() - in_before) as usize,
            written: (self.0.total_out() - out_before) as usize,
            ended: status == Status::StreamEnd,
        })
    }
}
