# Standalone WASI support (#11375)

Perry's experimental `--target wasi` produces a WASIp2 component with its
runtime and collector in linear memory. It needs a WASI host with WebAssembly
exception handling enabled, and no JavaScript host. This is separate from the
browser `wasm`/`web` targets.

WASI components run on Windows through a host such as Wasmtime. This branch
was developed and tested on Windows x64 with Wasmtime 48.0.0, wasi-sdk 34,
the repository's pinned Rust toolchain, and LLVM 22. See
[Wasmtime platform support](https://docs.wasmtime.dev/stability-platform-support.html)
and [the agreed scope, #11375](https://github.com/PerryTS/perry/issues/11375).

## Implemented contracts

- Arguments, environment variables, standard output, and filesystem access
  through explicit directory preopens. Denied filesystem access raises a
  catchable error.
- UTC date operations. Local-time operations use the existing UTC fallback.
- Nested exceptions, catch/finally/rethrow, runtime-originated errors and
  errors crossing promise callbacks. Generated try blocks and the C runtime
  use LLVM's wasm SjLj lowering, modern wasm EH, and wasi-libc `libsetjmp`.
  Unwinding restores the GC shadow stack and async context. Locals visible
  after setjmp stay in volatile stack slots through optimization.
- Perry's collector, including moving collections. GC slot descriptors
  distinguish native 32-bit pointers from 64-bit tagged values, including
  object metadata, promises, errors, regexps, buffer owners and lazy JSON.
  Map/Set allocation classifiers account for allocation padding on ILP32.
- Runtime and generated closure ABIs agree on wasm indirect-call signatures,
  including class-method function objects. Tagged values retain all 64 bits
  when reflecting on objects and classifying native handles.
- Timers, cancellation and promise microtasks continue while sockets are
  active. The WASIp2 transport uses nonblocking wasi-libc sockets and a bounded
  event-loop wake deadline; callbacks run after transport borrows are released.
- DNS through wasi-libc's WASIp2 resolver, and TCP listen/accept/connect,
  read/write, write-side shutdown and close. The runtime static archive bundles
  the existing net extension and its callback bridges with one Rust allocator.
  Network denial produces the socket's normal asynchronous error event.
- `parallelMap`/`parallelFilter` run sequentially; `spawn` is deferred on the
  current agent with promise adoption and rejection. Captured references and
  pending results remain rooted. There are no parallel WASIp2 worker threads.
- Child process creation throws a catchable `ERR_NOT_SUPPORTED` error with
  `child_process is not supported on WASI`, including fork and async creation.

The net extension builds its rustls client path with WebPKI roots on WASI;
TLS interoperability is not established by the TCP acceptance probes. UDP
(`mod-dgram`), Unix-domain/named pipes, native addons, host process creation,
and general platform-specific Node/Bun APIs are outside the tested profile.
This is not a claim of complete Node API compatibility or Linux/macOS runtime
parity with the Windows measurements.

## Acceptance and CI

Verified on Windows x64 on 2026-10-08 with the standard release runtime build:
**18/18 acceptance**, **6/6 smoke**, and **10/10 Node comparisons** pass. Native
GC regressions pass **171 tests** (one existing ignored test); WASI codegen unit
tests pass **10/10**, the component-linker regression passes, and the six Python
harness tests pass. The no-default-features WASI runtime check, runtime ABI
self-test/table check, Node pin consistency and Actions topology check pass.


The acceptance fixtures exercise bytes/DataView, UTC dates, preopened files,
permission denial, arguments/environment, GC edges under forced evacuation,
tagged reflection, exceptions across runtime/callback boundaries, timers,
DNS, loopback TCP, timers plus GC during TCP, sequential thread fallbacks,
and unsupported child processes. The smoke suite adds classes, closures,
collections, iterators, values and exit status. Ten existing gap programs are
compared against the pinned Node 26.5.1 oracle, including advanced classes,
objects, JSON, regexp and async behavior.

The WASI codegen CI job runs the complete acceptance, smoke and ten-case gap
suites on Windows and Linux. It retains the existing compatibility routing and
`run-extended-tests` PR-label condition; it is not a required check on every PR.
The workflow changes are locally validated; remote CI has not been run from
this worktree. Local reports and per-case diagnostics are retained under
`.cache/wasi-*` and ignored by Git.

An additional repository GC root-holder inventory lint still fails on the
branch baseline: two unpinned test counters, the `TRACKED_HEADER_PROBES` verdict,
a stale `policy.rs` census pin, and two stale JSON tape entries. The current
branch reports the same issues, with no new inventory issue paths. The
`ephemeron.rs` pin affected by this change was separately reviewed and updated;
no scanner exemption was added for the WASI transport.

## WASI preview1 core modules (`--target wasip1`)

`--target wasip1` runs the same wasm32 lowering and link, but for a preview1
core module: objects are emitted for `wasm32-unknown-wasip1`, the link uses
wasi-sdk's `--target=wasm32-wasip1` and the module has no `cabi_realloc` export
or component adapter. It imports only `wasi_snapshot_preview1`. Build its
runtime archive with `scripts/wasi_build_runtime.sh wasm32-wasip1` (toolchain
variables `CC_wasm32_wasip1`, `AR_wasm32_wasip1`, `CFLAGS_wasm32_wasip1`) and
point `PERRY_RUNTIME_DIR` at `target/wasm32-wasip1/release`. Exceptions use
standard exnref exception handling, so run modules with
`wasmtime run -W exceptions=y app.wasm`. `.github/supa/wasi-probes.sh` compiles
and compares a probe set with node; `.github/supa/wasi-imports.py` rejects
imports outside the supa-wasm host subset.

wasm32 calls into the runtime go through `crates/perry-codegen/src/wasm32/runtime_abi.tsv`,
generated from the runtime's source by `python3 scripts/runtime_abi_check.py --emit-wasm-abi`.
Regenerate it whenever a runtime `extern "C"` signature changes; a symbol missing
from it, or a runtime-internal `extern` that declares a pointer as `i64`, is a wasm
signature mismatch (a link error, or a trap in place of the call).

### Networking on preview1 guests

A p1 module has no `bind`, `listen` or `connect`, so the supa-wasm host supplies
them. Programs that use `net`, `http`, `dns` or an npm client such as `pg` run
unchanged; the runtime (`perry_wasi_net.c`, `wasi_net/mod.rs`) maps them as follows.

- **Listening.** The host pre-opens listener sockets and names them in
  `SUPA_LISTEN_FDS` (comma separated fds, optionally `SUPA_LISTEN_ADDRS` with their
  bound addresses). Without it (wasmtime `-S tcplisten`) the runtime takes every
  stream socket it finds before the guest opens one. The rule is deliberately
  simple: **one Storage server on one host listener**. Each `server.listen()`
  claims the next unclaimed listener in order and ignores the requested port;
  `server.address().port` reports the host's bound address when
  `SUPA_LISTEN_ADDRS` names it, otherwise the requested one. A second `listen()`
  with no listener left fails with `EADDRNOTAVAIL`. Closing the server closes the
  host listener. Accepting uses `sock_accept` on that fd.
- **Outbound TCP and DNS.** `supa_net.tcp_connect` starts a non-blocking connect
  and `supa_net.sock_error` reports its result; failures map to Node codes
  (`ECONNREFUSED`, `ETIMEDOUT`, `EPIPE`, `ECONNRESET`). `dns.lookup` and
  connecting by name use `supa_net.resolve`; a failed lookup is `ENOTFOUND`.
  Lookups block the event loop while the host answers.
- **Idle.** With open sockets and nothing runnable the loop blocks in one
  `poll_oneoff` over the socket fds plus a relative monotonic clock for the next
  timer, so an idle server uses no CPU. Programs with only timers keep sleeping
  on the clock alone.
- **Signals.** When `SUPA_SIGNAL_FD` is set the loop also watches that stream; each
  byte is a signal number (1 HUP, 2 INT, 10 USR1, 12 USR2, 15 TERM) delivered to
  `process.on('SIGTERM' | 'SIGINT' | ...)`. Without a handler TERM and INT exit
  with 128 plus the signal number.
- **Import gating.** `supa_net` is imported only by modules whose program reaches
  the network code; wasm-ld drops the unreferenced imports from every other
  module. `.github/supa/wasi-imports.py` rejects `supa_net` unless called with
  `--allow-supa-net`, which a probe requests with `// network: yes`. Running a
  networking module under plain wasmtime needs `-W unknown-imports-trap`.
- **CI.** wasmtime 47 removed the legacy p1 implementation that `-S tcplisten`
  needs, so the server probes run under wasmtime 46.0.3 (`WASMTIME_P1`); the other
  probes use 49. Probes that need a service (a Postgres for `pg`) are compiled and
  import-checked in CI, and run under supa-host from the `wasi-probe-modules`
  artifact.

Known gaps for Storage: no TLS, no keep-alive or half-close validation (the
shutdown call sends FIN, reading after it is untested), no backpressure beyond the
host socket buffer, the peer address of an accepted socket is unknown, and one
request at a time per connection is the only tested shape.

## Reproducing on Windows

Configure the repository's pinned Rust and LLVM 22 toolchain first. Python
3.10+ is required. From the repository root in PowerShell:

```powershell
. ./scripts/wasi_toolchain.ps1
rustup target add wasm32-wasip2
cargo build --locked -p perry --no-default-features --features compile-cli,target-wasi
python scripts/wasi_build_runtime.py
python scripts/wasi_run.py target/debug/perry.exe --suite smoke --output .cache/wasi-smoke
python scripts/wasi_run.py target/debug/perry.exe --suite acceptance --output .cache/wasi-acceptance
python scripts/wasi_run.py target/debug/perry.exe --suite gap --node <path-to-pinned-node> --output .cache/wasi-gap
```

The checksum-pinned PowerShell installer supports Windows x64 and ARM64;
only x64 was tested. The runtime build uses standard release settings and
all runtime default features except the 64-bit-only allocator (`alloc-mimalloc`)
and UDP (`mod-dgram`), matching the WASI check profile. LLVM development headers
are needed to build the wasm exception-model target-options shim.

On Linux/macOS, configure tools with
`eval "$(./scripts/wasi_toolchain.sh)"`, then use the same Python commands with
the platform compiler path. Shell build/smoke entry points delegate to the
portable implementations. These instructions do not establish host parity.

Fixtures run in separate working directories. Filesystem probes explicitly
preopen their working directory. Networking probes grant `-S inherit-network=y`;
DNS also grants `-S allow-ip-name-lookup=y`. Denial fixtures grant neither.
Arguments follow the component path. GC fixtures set `PERRY_GC_FORCE_EVACUATE=1`
and `PERRY_GC_VERIFY_EVACUATION=1` in the guest environment.

Harness and ABI checks:

```powershell
python scripts/test_wasi_run.py
python scripts/runtime_abi_check.py --self-test
python scripts/runtime_abi_check.py --check-wasm-abi
python -X utf8 scripts/check_actions_topology.py
cargo test --locked -p perry --bin perry --no-default-features --features compile-cli,target-wasi links_a_wasip2_component -- --nocapture
```

`--filter` accepts repeatable fixture-name substrings. Compile failures,
timeouts, missing artifacts, oracle failures and output/exit mismatches fail
the run. `--output` preserves `report.json`, compilation logs, stdout and
stderr; without it the files are temporary. The historical `core` suite remains
available for quick diagnostics; CI gates the complete `acceptance` suite.
