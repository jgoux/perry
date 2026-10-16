#!/usr/bin/env bash
# Collect diagnostics for a failed native run into <outdir>. usage: diagnose.sh <binary> <outdir>
set -uo pipefail
bin=$1; out=$2; mkdir -p "$out"
{ file "$bin"; ls -l "$bin"; readelf -h "$bin" | head -20; ldd "$bin"; } > "$out/binary-info.txt" 2>&1 || true
uname -a > "$out/uname.txt"; free -m >> "$out/uname.txt"; df -h >> "$out/uname.txt"
dmesg 2>/dev/null | tail -n 50 > "$out/dmesg.txt" || true
core=$(ls -t "$out"/core* /tmp/core* 2>/dev/null | head -1 || true)
if [ -n "$core" ]; then
  command -v gdb >/dev/null || sudo apt-get install -y -qq gdb >/dev/null 2>&1 || true
  gdb -batch -ex 'bt 60' -ex 'info registers' "$bin" "$core" > "$out/gdb-backtrace.txt" 2>&1 || true
fi
gzip -c "$bin" > "$out/native-binary.gz" || true
