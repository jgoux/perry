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
    # Same documented exclusions as wasi_check.sh: turnloop UDP and the
    # 64-bit-only allocator. All other defaults, including new ones, build.
    excluded = {"mod-dgram", "alloc-mimalloc"}
    if excluded - set(defaults):
        sys.exit("Stale WASI feature exclusions; update wasi_check.sh and this script")
    features = ",".join(f"perry-runtime/{f}" for f in defaults if f not in excluded)
    command = ["cargo", "build", "--locked", "--release", "-p", "perry-runtime-static",
               "--target", target, "--no-default-features", "--features", features,
               "--message-format=json-render-diagnostics"]
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
