#!/usr/bin/env bash
# Linker wrapper: cc with lld. Used for Perry itself via
# CARGO_TARGET_<TRIPLE>_LINKER (RUSTFLAGS would replace .cargo/config.toml).
exec cc -fuse-ld=lld -B"${LLVM_SYS_221_PREFIX:-/usr/lib/llvm-22}/bin" "$@"
