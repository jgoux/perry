#!/usr/bin/env python3
"""Build the WASI runtime archive on any host with wasi-sdk configured.

Usage: wasi_build_runtime.py [wasm32-wasip2 | wasm32-wasip1]

wasm32-wasip2 (default) feeds `perry compile --target wasi`; wasm32-wasip1
feeds `--target wasip1`. The wasip1 toolchain variables are CC_wasm32_wasip1,
AR_wasm32_wasip1 and CFLAGS_wasm32_wasip1.
"""

import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent

# perry-stdlib features of the wasip1 bundle. Mirrors what the native
# no-auto Storage link selects: `compression-gzip` and `bundled-net/ws` are
# replaced by their ext crates, which the bundle links directly.
WASIP1_STDLIB_FEATURES = [
    "async-bridge", "bundled-events", "bundled-streams", "crypto", "http-server",
    "web-fetch", "external-http-client-pump", "external-http-server-pump",
    "external-net-pump", "external-net-tls", "external-tls-server",
    "external-ws-pump", "external-zlib-pump",
]


def main() -> int:
    target = sys.argv[1] if len(sys.argv) > 1 else "wasm32-wasip2"
    if target not in ("wasm32-wasip2", "wasm32-wasip1"):
        sys.exit(f"Unsupported target {target}")
    if not os.environ.get(f"CC_{target.replace('-', '_')}"):
        sys.exit("Configure wasi-sdk first (scripts/wasi_toolchain.ps1 or wasi_toolchain.sh)")
    metadata = json.loads(subprocess.check_output(
        ["cargo", "metadata", "--format-version", "1", "--no-deps", "--locked"], cwd=ROOT))
    runtime = next(p for p in metadata["packages"] if p["name"] == "perry-runtime")
    defaults = runtime["features"]["default"]
    # Same documented exclusion as wasi_check.sh: the 64-bit-only allocator.
    # All other defaults, including new ones, build. (turnloop UDP, `node:dgram`,
    # is not compiled for wasm32 at all; its install is a no-op there.)
    excluded = {"alloc-mimalloc"}
    if excluded - set(defaults):
        sys.exit("Stale WASI feature exclusions; update wasi_check.sh and this script")
    features = [f"perry-runtime/{f}" for f in defaults if f not in excluded]
    if target == "wasm32-wasip1":
        # One storage-capable bundle: the extension crates and the perry-stdlib
        # features Supabase Storage's native link selects (well-known routing
        # of http/https/net/tls/undici/zlib/ws plus crypto, events, streams and
        # fetch), all in this archive under one allocator.
        features += ["perry-runtime-static/wasi-node-modules"]
        features += [f"perry-stdlib/{f}" for f in WASIP1_STDLIB_FEATURES]
    features = ",".join(features)
    command = ["cargo", "build", "--locked", "--release", "-p", "perry-runtime-static",
               "--target", target, "--no-default-features", "--features", features,
               "--message-format=json-render-diagnostics"]
    # Size experiments: PERRY_WASI_RUNTIME_OPT_LEVEL (0-3, s, z) overrides the
    # release opt-level of the whole archive, perry-runtime's own override included.
    opt_level = os.environ.get("PERRY_WASI_RUNTIME_OPT_LEVEL", "")
    if opt_level:
        # Cargo takes the numeric levels as integers and only s and z as strings.
        value = opt_level if opt_level.isdigit() else f'"{opt_level}"'
        command += ["--config", f"profile.release.opt-level={value}",
                    "--config", f"profile.release.package.perry-runtime.opt-level={value}"]
    # Cargo may legitimately reuse a fresh archive. Observe the target
    # artifact message instead of requiring an mtime change on every build.
    required = {"perry_runtime"}
    live = set()
    with subprocess.Popen(command, cwd=ROOT, stdout=subprocess.PIPE, text=True) as process:
        for line in process.stdout:
            try:
                message = json.loads(line)
            except ValueError:
                continue
            if (message.get("reason") == "compiler-artifact"
                    and message["target"]["name"] in required):
                for filename in message.get("filenames", []):
                    archive = Path(filename)
                    if (target in archive.parts and archive.suffix == ".a"
                            and archive.is_file()):
                        print(f"WASI archive: {archive}", flush=True)
                        live.add(message["target"]["name"])
        status = process.wait()
    if status:
        return status
    if live != required:
        sys.exit(f"Cargo reported no {target} archives for {sorted(required - live)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
