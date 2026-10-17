# Perry fork: patches carried on top of PerryTS/perry

This ledger lists every code patch that `supa/storage-ci` carries on top of upstream PerryTS/perry main.
Each entry records the symptom, root cause, fix, regression test and upstream status, so an upstream PR can be opened without re-deriving anything.
It also groups the patches into proposed upstream PRs and lists the fork-only commits that must not go upstream.

## How to keep this current

Every new fork fix commit adds a row to the summary table and a section below, in the same commit.
Ids (P01...) are stable and are never renumbered or reused; a patch that lands upstream keeps its id and gets its status updated.
Fork-only `ci:`/`chore:` commits go into "Not for upstream".

Conventions in this file:

- Shas are 9-character abbreviations of fork commits on `supa/storage-ci`; upstream shas are marked "upstream".
- "Cherry-pick" results come from `git cherry-pick -n <sha>` onto upstream main `1fd8ca2ae` (2026-10-17) in a throwaway worktree. Nothing was built or run, so "applies clean" means a clean textual merge only.
- "Upstream touched" lists upstream commits after the fork's last sync (`43a40d056`, 38 upstream commits) that changed the non-test source files the patch edits.
- "Upstream also affected" is "likely" when the patched pre-image is unchanged on upstream main but the bug was not reproduced there, and "unknown" when that inference is weak.
- Tests live in the same commit as their fix (the fork has no separate `test:` commits). Test paths are under `crates/` unless noted.

## Summary table

| id | commit | title | area | platform | test | applies to upstream main | PR group |
|----|--------|-------|------|----------|------|--------------------------|----------|
| P01 | 3a1bd4cd8 | fix(codegen): refresh guarded class-env slots after a CJS binding's initializer | codegen | all | integration | clean | PR-I |
| P02 | fc9f6cb62 | fix(codegen): register computed-member methods with the entry they define | codegen | all | integration | clean | PR-J |
| P03 | 78f00dedd | fix(codegen): load regex literal handles in worker programs | codegen, runtime | all (programs using Worker) | integration | clean | PR-L |
| P04 | 2d333eac4 | fix(codegen): accept the zero-width .alt_entry directive in stack-map blocks | codegen (gc_map) | Mach-O only | integration | clean | PR-O |
| P05 | 800781f0b | fix(runtime): accept image strings at the padded size codegen emits | runtime | all | integration + unit fixtures | CONFLICT (fixed upstream) | none: superseded |
| P06 | 2f01c61c4 | fix(runtime): reach the URLSearchParams probe for type-erased receivers | runtime | all | integration | CONFLICT (fixed upstream) | none: superseded |
| P07 | 83e19b5b8 | fix(codegen): keep linkonce_odr coalescing for helpers promoted under codegen units | codegen | all (PERRY_CODEGEN_UNITS>1) | integration | clean | PR-M |
| P08 | 150fc3c39 | fix(root_reload): stop declining large require closures on the cost cap | codegen (root_reload) | all | unit | clean | PR-P |
| P09 | 76d54d44a | fix(codegen): mark the hot-TLS thread-pointer read gc-leaf where it is emitted | codegen | Apple aarch64 only | unit (IR) | clean | PR-N |
| P10 | 7b5f84c69 | fix(hir): materialize a TypeScript enum used as a value | hir | all | hir + parity file | clean | PR-G |
| P11 | 066f57f15 | fix(hir): label a CommonJS module body frame with its file path | hir, runtime | all | hir + unit | clean | PR-K |
| P12 | 5e1f3ee20 | fix(codegen): register startup stubs through .init_array on ELF | codegen (stubs) | ELF/Linux only | unit | clean (`.github` hunks conflict) | PR-A |
| P13 | 0bbb806bf | fix(hir): construct undici agents through a require()d namespace local | hir | all | hir | clean | PR-H |
| P14 | 81525ce5d | fix(cjs-wrap): bind a required ES module package as its namespace | compile (cjs_wrap) | all | integration | clean | PR-E |
| P15 | 3f823e190 | fix(runtime): the unknown-receiver probe declines native URLSearchParams | runtime | all | unit | clean (fixed upstream) | none: superseded |
| P16 | 5ee46bdb0 | fix(compile): lower modules outside the entry directory under a unique name | compile | all | integration | clean | PR-F |
| P17 | 15c3bb6b7 | fix(runtime): keep subclasses of http.Agent as their own instances | runtime | all | integration | clean | PR-B |
| P18 | 8b5573edf | feat(runtime): PERRY_TRACE_THROW reports every thrown value at js_throw | runtime, compile env | all | integration | clean | PR-Q |
| P19 | 8fe4deaf2 | fix(runtime): give http.Agent subclass instances Node's options record | runtime | all | integration | clean after P17 (alone: test-file conflict) | PR-B |
| P20 | 71129cbe7 | fix(runtime): accept an fs write stream as a stream.pipeline stage | runtime | all | integration | clean | PR-D |
| P21 | 286f4ae58 | fix(http): pipe a server request's buffered body into its destination | perry-ext-http | all | integration | clean | PR-C |
| P22 | 248ec8347 | fix(http): route req.pipe to the server request's dispatcher | perry-ext-http | all | covered by P21's test | clean | PR-C |
| P23 | b416f00f7 | feat(runtime): register layouts, atoms and image ranges through init_array on wasm | runtime | wasm32 | integration (wasi probes) | not tried | PR-R |
| P24 | bd6269a6b | fix(runtime): make the wasm32 runtime compile for wasip1 | runtime, updater | wasm32 | build + wasi probes | not tried | PR-R |
| P25 | 20d4dc2cd | feat(stdlib): build a wasm32-wasip1 subset without openssl, zlib-ng or threads | stdlib, ext-zlib | wasm32 | build + wasi probes (crypto, zlib) | not tried | PR-R |
| P26 | c0d32ab8c | fix(runtime): compare the 47-bit address ceiling in u64 so wasm32 release builds compile | runtime | wasm32 | build | not tried | PR-R |
| P27 | 2f4a2a4f4 | feat(compile): add a wasip1 target that links a WASI preview1 core module | compile, codegen | wasm32 | wasi probes | not tried | PR-S |
| P28 | 9e0beba53 | fix(codegen): regenerate the wasm32 runtime ABI table, which had drifted from the runtime | codegen (wasm32) | wasm32 | `scripts/runtime_abi_check.py` | not tried | PR-S |
| P29 | c546aab14 | fix(codegen): cover macro-defined runtime entry points in the wasm32 ABI table | codegen (wasm32), scripts | wasm32 | `scripts/runtime_abi_check.py` | not tried | PR-S |
| P30 | f7c9d2b0b | fix(runtime): declare the array builtin entries at pointer width so wasm32 calls resolve | runtime | wasm32 | wasi probes + ABI check | not tried | PR-R |
| P31 | 5c4434bb7 | feat(wasip1): bundle perry-stdlib and the node ext crates into the wasm runtime | compile, runtime-static | wasm32 | wasi probes | not tried | PR-S |
| P32 | 0dac0c454 | fix(runtime): admit program-emitted image strings on wasm32 | runtime | wasm32 | wasi probes (path, url, fs) | not tried | PR-R |
| P33 | 202df7335 | feat(wasi): serve and connect over the host's supa_net sockets on wasip1 | runtime (wasi_net, signals) | wasm32 | wasi probes (http-server, net-echo, dns) | not tried | PR-T |
| P34 | baf2f1d91 | feat(wasip1): route the link transport through the host socket handles | runtime | wasm32 | wasi probes (http-server, net-echo, pg-client) | not tried | PR-T |
| P35 | 91629a4bd | fix(wasip1): report the bound listener address and wake the loop after dispatch | runtime (wasi_net) | wasm32 | wasi probes (http-server) | not tried | PR-T |
| P36 | d9bda55e5 | fix(wasip1): declare imported static methods at their producer's width | codegen | all (matters on wasm32) | wasi probes (Storage compile) | not tried | PR-U |
| P37 | 20bf06dc0 | fix(wasm32): keep calls out of setjmp frames so spill code stays linear | codegen (wasm32) | wasm32 | none (Storage compile only); possibly redundant after P38 | not tried | PR-U |
| P38 | f0a9e8a1d | fix(cjs): share one registry helper across a module's deferred requires | compile (cjs_wrap) | all (shrinks native output too) | Storage compile size (530 MB to 414 MB module) | not tried | PR-V |
| P39 | 28fa69faf | fix(wasm32): pass a JS body's callee as a pointer in indirect calls | codegen (wasm32) | wasm32 | wasi probe `closure-call-in-loop.js` + unit | not tried | PR-U |
| P40 | 3d45a1e6d | fix(runtime): register the standard descriptors for fs on WASI | runtime (fs) | wasm32 (WASI) | wasi probe `fs-stdio-fd.js` | not tried | PR-W |
| P41 | 5a0100769 | fix(runtime): report readableEnded only once the end event was emitted | runtime (node:stream) | all | unit + wasi probe `stream-readable-ended.js` | not tried | PR-X |
| P42 | 743236204 | fix(gc): trace an array's named-property holder as a pointer | gc (layout) | wasm32 | wasi probe `array-named-props-gc.js` | not tried | PR-Y |
| P43 | 4519a2f16 | fix(runtime): zero the DateCell padding on 32-bit targets | runtime (date) | wasm32 | wasi probe `date-cell-reuse.js` | not tried | PR-Z |
| P44 | 540a34fc2 | fix(net): an application's end() after the protocol layer's close is a no-op | net (payload socket) | all (seen on wasm32) | wasi probe `http-early-reply.js` | not tried | PR-AA |
| P45 | d9ebda76d | fix(dns): dispatch dns lookup and resolve exports reached through a CommonJS namespace | dns (`perry-runtime` native module dispatch) | all (seen on wasm32) | wasi probe `cjs-dns.js` | not tried | PR-AB |
| P46 | TBD | fix(hir): construct the global when a program class shares a name with a globalThis alias | hir (`lower/expr_new.rs`, `lower/context.rs`, destructuring) | all | wasi probe `headers-global-alias.js` | not tried | PR-AC |
| P47 | TBD | fix(runtime): start reading when a readable that is not flowing is piped | runtime (node:stream, `node_stream_readwrite.rs`) | all | wasi probe `stream-pipe-starts-read.js` | not tried | PR-AD |

All 22 patches except P12's `.github` hunks, P05 and P06 cherry-pick cleanly.
A stack of every patch except P05 and P06, with P12 limited to `crates/`, also applies cleanly in sequence on `1fd8ca2ae`.

## Proposed upstream PRs

Ordered by value and independence. Each PR carries its patches' tests.

1. **PR-A ELF `.init_array` startup registration** (P12). Without it no startup registration runs on Linux: `new Function` is refused and the dyn-eval, regex, url and temporal engines are never installed. Prerequisite: none. Send only the `crates/perry-codegen/src/stubs.rs` hunk; drop the `.github/supa` hunks.
2. **PR-B `class X extends http.Agent` keeps its own instance and `options`** (P17, P19). Makes agentkeepalive-style subclasses work. Prerequisite: none; P19 needs P17.
3. **PR-C `IncomingMessage.pipe` on the server request** (P21, P22). `req.pipe(dest)` forwarded nothing and left the request hanging. Squash P22 into P21: P22 is the entry-point fix the P21 test needs. Prerequisite: none.
4. **PR-D `stream.pipeline` into an `fs.createWriteStream`** (P20). Every upload through `pipeline(src, fs.createWriteStream(path))` threw `ERR_INVALID_ARG_TYPE`. Prerequisite: none.
5. **PR-E `require()` of an ES module package returns its namespace** (P14). Matches Node 22 require(esm) for packages with named exports plus `export default`. Prerequisite: none.
6. **PR-F Unique module names outside the entry directory** (P16). Tagged-template call-site ids collided across same-named `index.js` files in `node_modules`. Prerequisite: none.
7. **PR-G Bare TypeScript enum in value position** (P10). `Object.values(E)`, `const e = E` threw `ReferenceError`. Prerequisite: none.
8. **PR-H `new <require("undici")>.Agent(...)`** (P13). esbuild CJS output threw `undefined is not a constructor`. Prerequisite: none.
9. **PR-I Guarded class-env refresh after a later `const`** (P01). Prerequisite: none.
10. **PR-J Computed-member registration links** (P02). One-predicate fix for an undefined `..._eclo$info` symbol. Prerequisite: none.
11. **PR-K CJS module body frame carries its file path** (P11). `Error.stack` prints `at Object.<anonymous> (<path>)`. Prerequisite: none; re-run the test first because upstream `f063a7d29` reworked `Error.stack` frame walking.
12. **PR-L Regex literals in programs that use `Worker`** (P03). Prerequisite: none.
13. **PR-M `weak_odr` for promoted `linkonce_odr` helpers under codegen units** (P07). Prerequisite: none.
14. **PR-N Mark the Apple arm64 hot-TLS asm gc-leaf where emitted** (P09). Prerequisite: none.
15. **PR-O `.alt_entry` in the stack-map rewriter on Mach-O** (P04). Prerequisite: none.
16. **PR-P root_reload cost cap** (P08). Last because the cap value was tuned from fork measurements and upstream reworked nearby code (`291142de3`). Prerequisite: none.
17. **PR-Q `PERRY_TRACE_THROW`** (P18). Judged generally useful, see its section. Low priority. Prerequisite: none.
18. **PR-R wasm32-wasip1 runtime builds** (P23, P24, P25, P26, P30, P32). The runtime and the stdlib subset compile for `wasm32-wasip1` and register their tables through `.init_array`. Prerequisite: none in the series, but PR-S and later need it. wasm/WASI-specific.
19. **PR-S `--target wasip1` and the bundled runtime** (P27, P28, P29, P31). The compile target, the regenerated ABI table and the single runtime archive. Prerequisite: PR-R. wasm/WASI-specific.
20. **PR-T WASI sockets over the host `supa_net` imports** (P33, P34, P35). Listen, accept, connect, DNS and signals on wasip1. Prerequisite: PR-R, PR-S. wasm/WASI-specific.
21. **PR-U wasm32 codegen lowering fixes** (P36, P37, P39). Indirect-call ABI, setjmp spill size and static-method declaration width. Prerequisite: PR-S. Re-check P37 first, see its section.
22. **PR-V Deferred CJS requires share one registry helper** (P38). Smaller output on every target. Prerequisite: none.
23. **PR-W `fs.write*` on stdio descriptors under WASI** (P40). Prerequisite: PR-R.
24. **PR-X `readableEnded` means the end event was emitted** (P41). Prerequisite: none.
25. **PR-Y GC traces an array's named-property holder as a pointer** (P42). Prerequisite: none.
26. **PR-Z A Date cell's padding is zeroed on 32-bit targets** (P43). Prerequisite: none.
27. **PR-AA An application's `end()` after the HTTP layer's close is a no-op** (P44). Prerequisite: none.
28. **PR-AB `dns.lookup`, `resolve*` and `reverse` work through a CommonJS `require`** (P45). Prerequisite: none.
29. **PR-AC `new Alias()` constructs the global an alias holds, not a same-named program class** (P46). Prerequisite: none.
30. **PR-AD `readable.pipe()` starts reading a stream that was not flowing** (P47). Prerequisite: none.

Not proposed: P05, P06, P15. Upstream fixed the same bugs independently (`4ed616f5e` for P05, `79aae9aa7` for P06 and P15); drop them at the next upstream sync and take upstream's versions.

## Patches

### P01 3a1bd4cd8 fix(codegen): refresh guarded class-env slots after a CJS binding's initializer
- Area / platform: codegen / all.
- Problem: a class method in a CommonJS module that assigns `exports` could not see a `const`/`let` declared after the class: `later is not a function`. No npm package is named in the commit.
- Root cause: such a class is a guarded class-environment class whose members read captured bindings from slot globals published at first evaluation, while the later binding was still in its dead zone (`undefined`). The refresh after the binding's initializer (`RegisterClassCaptures`) went through `store_class_env_slot`, which skips guarded classes.
- Fix: new `store_first_evaluation_slot` stores through for the first evaluation, which owns the guarded slots. Files: `perry-codegen/src/expr/class_env.rs`, `expr/static_field_meta.rs` (one call site).
- Test: same commit, `perry/tests/cjs_class_method_sees_later_const.rs::cjs_class_method_sees_later_const_and_let`.
- Upstream: cherry-pick clean. Upstream touched: none. `store_class_env_slot` still skips guarded classes and the call site is unchanged (upstream `4615a30f2` changed the same file but is already in the fork). Also affected: likely.
- Depends on: none. PR-I.
- Repro (module compiled via `compilePackages`; expected output `2 5 6`):
  ```js
  "use strict";
  class P { handle(n) { return later(n); } value() { return limit; } total() { return later(limit); } }
  exports.P = P;
  const later = (n) => n + 1;
  let limit = 5;
  ```

### P02 fc9f6cb62 fix(codegen): register computed-member methods with the entry they define
- Area / platform: codegen / all.
- Problem: a class with a generic computed member followed by a method using `super.x` failed to link with an undefined `..._eclo$info` symbol. Hit by agentkeepalive's `class Agent extends http.Agent`.
- Root cause: `lower_computed_member_registration` chose the explicit method-owner entry `<method>__eclo` from `body_needs_method_owner`, but that entry is only emitted when `body_needs_explicit_method_owner(body, fresh)` holds, which is false for a plain declaration.
- Fix: the registration uses the emitter's predicate. Files: `perry-codegen/src/expr/static_field_meta.rs` (3 lines).
- Test: same commit, `perry/tests/class_computed_member_before_super_method.rs::computed_member_before_super_method_links_and_runs`.
- Upstream: cherry-pick clean. Upstream touched: none. Another `body_needs_method_owner` use remains at `static_field_meta.rs:1304` upstream; the fork did not change it. Also affected: likely.
- Depends on: none. PR-J.
- Repro (expected `computed child>base:1`):
  ```ts
  const key = 'dyn' + 'amic';
  class Base { hello(x: number): string { return 'base:' + x; } }
  class Child extends Base {
    [key](): string { return 'computed'; }
    hello(x: number): string { return 'child>' + super.hello(x); }
  }
  const c: any = new Child();
  console.log(c.dynamic(), c.hello(1));
  ```

### P03 78f00dedd fix(codegen): load regex literal handles in worker programs
- Area / platform: codegen + runtime / all, programs that use `Worker` or thread agents.
- Problem: a regex literal threw `Invalid flags supplied to RegExp constructor` on first evaluation. pino triggered it through fastify.
- Root cause: worker programs keep string handle globals thread-local. The regex site descriptor stored the address of the pattern/flags handle globals, but under TLS `ptr @global` names the TLS descriptor, not the calling agent's slot, so the runtime read descriptor bytes as string headers.
- Fix: in worker programs codegen loads the handles itself and calls the new `js_regexp_literal_loaded`; other programs keep `js_regexp_literal`. Files: `perry-codegen/src/expr/regex_literal.rs`, `runtime_decls/strings.rs`, `perry-runtime/src/regex/literal.rs`.
- Test: same commit, `perry/tests/worker_program_regex_literal.rs::regex_literals_evaluate_in_a_worker_program`.
- Upstream: cherry-pick clean. Upstream touched: `291142de3`, `87bc47a58` (perf, no overlap in the hunks). Also affected: likely.
- Depends on: none. PR-L.
- Repro (expected `true:false,false:false,false:true`; `w.ts` is `postMessage(1);`):
  ```ts
  const worker = new Worker(new URL('./w.ts', import.meta.url));
  const re = /^a(b+)c$/gi; const re2 = /x\d+/u;
  console.log(['abbbc', 'ABC', 'x12'].map((t) => re.test(t) + ':' + re2.test(t)).join(','));
  worker.terminate().then(() => process.exit(0));
  ```

### P04 2d333eac4 fix(codegen): accept the zero-width .alt_entry directive in stack-map blocks
- Area / platform: codegen (gc_map) / Mach-O only (the directive is what LLVM emits on Mach-O).
- Problem: codegen failed with `unrecognised directive `.alt_entry` inside the stack-map block` for a module with GC safepoints and a literal family that gains a property after birth. ajv's `jtd-schema.js` hit it, which blocked compiling fastify.
- Root cause: the family's layout descriptor exports an `internal alias` of its `layout_id` word (`layout_desc.rs`). On Mach-O LLVM assembles an alias to `sym+offset` as `.alt_entry <alias>` plus an assignment after the stack-map block, and the rewriter refuses directives of unknown width; `.alt_entry` was missing from `is_zero_width_directive`.
- Fix: add `.alt_entry` to the zero-width list. Files: `perry-codegen/src/gc_map.rs` (1 line).
- Test: same commit, `perry/tests/layout_family_alias_stack_map.rs::family_layout_alias_with_stack_map_compiles_and_runs`.
- Upstream: cherry-pick clean. Upstream touched: none; `gc_map.rs` still has `is_zero_width_directive` without `.alt_entry`, and the `internal alias` is still emitted (`layout_desc.rs:635,673`). Also affected: likely on macOS.
- Depends on: none. PR-O.
- Repro:
  ```ts
  const shared = (root: boolean) => {
    const sch: any = { nullable: { type: "boolean" } };
    if (root) sch.definitions = { values: 1 };
    return sch;
  };
  const form = (root: boolean) => ({ optionalProperties: shared(root) });
  console.log(JSON.stringify([form(true), form(false)]));
  ```

### P05 800781f0b fix(runtime): accept image strings at the padded size codegen emits
- Area / platform: runtime / all.
- Problem: every string literal was rejected by natives that validate arguments through `try_read_string_header`: `URLSearchParams.get('a')` or `has('c')` with a literal saw a non-string.
- Root cause: an earlier upstream commit (`545aa7554`, named in the message) padded the emitted image string body to 8 and added an 8-byte property-atom hash trailer, but `addr_class/image.rs::header` still demanded the unpadded size.
- Fix: compute the expected size with `image_size()` (body rounded up to 8, plus 8). Files: `perry-runtime/src/value/addr_class/image.rs`, `image_tests.rs`.
- Test: same commit, `perry/tests/image_string_literal_native_args.rs::literal_arguments_reach_validating_natives`, plus updated fixtures in `image_tests.rs`.
- Upstream: cherry-pick CONFLICT in `image.rs` and `image_tests.rs`. Upstream fixed the same bug independently in `4ed616f5e` (2026-10-16, "Next.js startup: string images with the atom-hash trailer"): it checks `gc.size == image_string_gc_size(byte_len)` and the full image extent. That commit is not in the fork. Also affected: no.
- Depends on: none. Not for upstream (superseded); drop at the next sync.

### P06 2f01c61c4 fix(runtime): reach the URLSearchParams probe for type-erased receivers
- Area / platform: runtime / all.
- Problem: reading a method off a type-erased URLSearchParams (for example an array element) returned `undefined`. Hit by pg-connection-string's `searchParams` use.
- Root cause: URLSearchParams is layout-born and premarked plain-ordinary, so `named_read_receiver_kind` classified it Ordinary and skipped the dynamic method probe.
- Fix: exclude the URLSearchParams layout from the Ordinary fast arm. Files: `perry-runtime/src/object/field_get_set/exotic_named_read.rs`.
- Test: same commit, `perry/tests/url_search_params_type_erased_methods.rs::type_erased_url_search_params_methods_are_callable` (runs pg-connection-string's parse and a type-erased `get()`).
- Upstream: cherry-pick CONFLICT in `exotic_named_read.rs`. Upstream fixed the same symptom in `79aae9aa7` (#12697, 2026-10-17): the URLSearchParams layout now names `%URLSearchParams.prototype%`, and `search_params_read`, its bound-method thunks and `NamedReadKind::Ordinary` are deleted. Upstream's gap test is `test-files/test_gap_12697_urlsearchparams_size_and_methods_inherited.ts`. Not in the fork.
- Depends on: none. Not for upstream (superseded).

### P07 83e19b5b8 fix(codegen): keep linkonce_odr coalescing for helpers promoted under codegen units
- Area / platform: codegen / all, only with `PERRY_CODEGEN_UNITS>1`. The error text in the test is the Mach-O spelling; the fix is target-neutral.
- Problem: link failed with duplicate symbols `perry_birth_class`, `perry_birth_empty_array`, `perry_array_index_normalize_i32` on large bundles.
- Root cause: `force_external` (unit promotion) dropped the linkage keyword of every define, so a `linkonce_odr` helper emitted by several modules became a strong external definition in each object.
- Fix: map `linkonce_odr` to `weak_odr` (still externally visible, linker may coalesce); `internal`/`private` are still dropped; the define-line dialect parser learns `weak_odr`. Files: `perry-codegen/src/function.rs`, `dialect/mod.rs`.
- Test: same commit, `perry/tests/codegen_units_shared_helper_linkage.rs::shared_linkonce_helpers_coalesce_across_codegen_units` (runs with `PERRY_CODEGEN_UNITS=2`).
- Upstream: cherry-pick clean. Upstream touched: `291142de3`. Also affected: likely.
- Depends on: none. PR-M.
- Repro: two modules that each define a small class and a loop pushing `new Pt(i, i).x` into an array, imported by a third module, built with `PERRY_CODEGEN_UNITS=2` (full sources in the test).

### P08 150fc3c39 fix(root_reload): stop declining large require closures on the cost cap
- Area / platform: codegen (root_reload) / all.
- Problem: the CJS wrapper threw `Cannot convert undefined or null to object` (Supabase Storage's semver `require` via pg-boss).
- Root cause: root_reload declines a whole function when `blocks * groups` exceeds `MAX_BLOCK_LOAD_PRODUCT` (8M), and a declined function keeps stale registers. The count included groups read only in their own builder block, and the bound was below the largest real function (28187 blocks x 570 walking groups = 16.1M). The closure derives its captured-module cell address once at entry, so after a minor GC it read a from-space copy.
- Fix: measure the cap only against groups with a use outside the root load's own block (answer unchanged, walk skipped for the rest) and raise the bound to 64M; the commit measures the walk at tens of ms. Files: `perry-codegen/src/root_reload.rs`, `root_reload_tests.rs`.
- Test: same commit, `root_reload_tests.rs::the_cap_does_not_count_groups_that_never_walk` (unit; no end-to-end repro).
- Upstream: cherry-pick clean. Upstream touched: `291142de3`. `MAX_BLOCK_LOAD_PRODUCT` is still `8_000_000` upstream (`root_reload.rs:299`). Also affected: unknown (needs a large closure and GC timing).
- Depends on: none. PR-P. The 64M value is a fork measurement; expect review discussion.
- Repro: none small; the trigger is a function with more than ~14k blocks.

### P09 76d54d44a fix(codegen): mark the hot-TLS thread-pointer read gc-leaf where it is emitted
- Area / platform: codegen / Apple aarch64 only (the `mrs $0, tpidrro_el0` hot-cache read).
- Problem: the whole compile failed in the LLVM verifier with `Cannot take the address of an inline asm!` for a body such as `return pool.close()`.
- Root cause: only `lower_roots_for_rs4gc` marked inline asm gc-leaf, and it runs only for bodies that reserve root slots. A slot-less body kept the asm unmarked; after inlining into a statepoint body, RS4GC wrapped the asm call in a `gc.statepoint`.
- Fix: mark the asm leaf at the emit site; the lowering skips lines that already carry the mark. Files: `perry-codegen/src/expr/hot_tls.rs`.
- Test: same commit, `lower_call/alloc_hot_tests.rs::the_hot_cache_read_is_marked_gc_leaf_in_bodies_without_root_slots` (checks IR for an `arm64-apple-macosx` target) and an updated `expr/property_get/front_contract_tests.rs`.
- Upstream: cherry-pick clean. Upstream touched: none; `hot_tls.rs` still emits the unmarked asm. Also affected: likely on Apple aarch64.
- Depends on: none. PR-N.

### P10 7b5f84c69 fix(hir): materialize a TypeScript enum used as a value
- Area / platform: hir / all.
- Problem: `Object.values(E)`, `Object.keys(E)`, `const e = E` or passing `E` as an argument threw `ReferenceError: E is not defined` at runtime. Found in Storage (`Object.values(ErrorCode)` at module init).
- Root cause: enums are folded away (`E.A` becomes `Expr::EnumMember`), so a bare `E` matched no local/function/class/import in `lower_ident_expr` and fell through to the unresolved-global lookup. The computed form `E[expr]` already materialized the object (#4509).
- Fix: the bare identifier builds the same object through the shared `enum_runtime_object_fields` (forward members plus numeric reverse entries). Each reference builds a fresh object, so `E === E` is false (stated in the commit). Files: `perry-hir/src/lower/expr_member.rs`, `lower_expr.rs`, `lower_expr/arm_ident.rs`, `lower_expr/helpers.rs`, `lower/mod.rs`.
- Test: same commit, `perry-hir/tests/enum_as_value_lowering.rs::bare_enum_identifier_materializes_the_enum_object` and `test-files/test_parity_enum_as_value.ts`.
- Upstream: cherry-pick clean. Upstream touched: none. Upstream still inlines the field construction in `expr_member.rs` and has no `enum_runtime_object_fields`. Also affected: likely.
- Depends on: none. PR-G.
- Repro: `enum S { A = "a", B = "b" }; console.log(Object.values(S));` (expected `[ 'a', 'b' ]`).

### P11 066f57f15 fix(hir): label a CommonJS module body frame with its file path
- Area / platform: hir + runtime / all.
- Problem: `Error.stack` printed `at __perry_cjs_factory (<anonymous>)` where Node prints `at Object.<anonymous> (/abs/file.js:L:C)`. fastify-plugin derives an anonymous plugin's name from the path in the caller's frame, and `match(fileNamePattern)[1]` threw `Cannot convert undefined or null to object`, aborting Storage at startup.
- Root cause: the factory's registered display name carried no file location.
- Fix: the factory's display name is `Object.<anonymous> (<source path>)` (set where the nested declaration lowers) and the frame renderer prints a name that already carries a location verbatim instead of appending `(<anonymous>)`. Line and column are still not provided. Files: `perry-hir/src/lower_decl/body_stmt/nested_fn_decl.rs`, `perry-runtime/src/error_stack_frames.rs`.
- Test: same commit, `perry-hir/tests/cjs_factory_frame_label.rs::the_module_body_frame_is_labelled_with_the_module_path` and `error_stack_frames.rs::a_module_body_frame_renders_its_own_location`.
- Upstream: cherry-pick clean. Upstream touched: `f063a7d29` ("Error.stack walks runtime frames by unwind table"), which edits `error_stack_frames.rs`; the merge is textually clean but the new frame walker may change what the test sees, so re-run it. Also affected: likely.
- Depends on: none. PR-K.
- Repro: in a CommonJS module, `console.log(new Error().stack)`; the top-level frame should read `Object.<anonymous> (<abs path>)`.

### P12 5e1f3ee20 fix(codegen): register startup stubs through .init_array on ELF
- Area / platform: codegen (stubs) / ELF only (Linux; the commit names glibc on aarch64, the tests build x86_64 and aarch64 objects). Mach-O and COFF keep `@llvm.global_ctors`.
- Problem: neither the feature-installer unit nor the static-shape-seed unit registered on Linux. `js_runtime_install_compiled` (dyn-eval, regex, url, temporal engines) was skipped and `new Function` threw `dynamic Function refused (AOT, dyn-eval feature off)`.
- Root cause: both units registered via `@llvm.global_ctors`; the in-process TargetMachine is built with `UseInitArray=false`, so on ELF LLVM lowered it to the legacy `.ctors` section, which glibc on aarch64 never runs.
- Fix: on ELF targets emit a pointer in `.init_array` (global so the section is writable, kept alive through `@llvm.used`). Files: `perry-codegen/src/stubs.rs`. The commit also changed `.github/supa/probes.sh` and `regressions.sh` (fork CI only; not for upstream).
- Test: same commit, unit tests in `stubs.rs`: `elf_startup_registration_lands_in_init_array` (both units, aarch64 and x86_64 ELF sections) and `non_elf_startup_registration_keeps_global_ctors`.
- Upstream: cherry-pick conflicts only in the two `.github/supa` files (they do not exist upstream); the `stubs.rs` hunk applies clean, including over upstream `37a30b076`, which adds a `registrations` parameter to the same file. Upstream `stubs.rs` still emits `@llvm.global_ctors` (lines 209 and 322) and `perry-codegen` has no `.init_array` handling. Also affected: yes. We verified upstream's Fastify README example fails on Linux without this patch (task brief; the fork CI probes `fastify-readme.js` and `fastify-npm.js` exercise it).
- Depends on: none. PR-A, first in the order. Cherry-pick with the `.github` paths excluded.
- Repro: build any program that calls `new Function('return 1')` for Linux without the patch.

### P13 0bbb806bf fix(hir): construct undici agents through a require()d namespace local
- Area / platform: hir / all.
- Problem: `new import_undici.Agent(...)` threw `undefined is not a constructor` at module init (Storage's cdn-cache-manager). esbuild's CJS output binds `var import_undici = require("undici")`.
- Root cause: only the bare `import { Agent }` form and a `const` namespace reached the native undici constructor rows; a `require()`d local stays a runtime local, so `new` became a dynamic `new` on the module's `Agent` property.
- Fix: remember locals initialised straight from `require("undici")` and route `new <local>.Agent|ProxyAgent(...)` (and `import * as` namespaces) to the same receiver-less native call. Files: `perry-hir/src/destructuring/var_decl.rs`, `lower/context_new.rs`, `lower/expr_new/member.rs`, `lower/lowering_context.rs`.
- Test: same commit, `perry-hir/tests/undici_namespace_agent_construction.rs::undici_namespace_agent_construction_uses_the_native_constructor` (asserts on HIR).
- Upstream: cherry-pick clean. Upstream touched: none. Also affected: likely.
- Depends on: none. PR-H.
- Repro: `var import_undici = require("undici"); const a = new import_undici.Agent({ connections: 1 });`.

### P14 81525ce5d fix(cjs-wrap): bind a required ES module package as its namespace
- Area / platform: compile (cjs_wrap) / all.
- Problem: `(0, import_globals.getGlobal)()` threw `value is not a function` at startup; `@platformatic/globals` exports named functions plus `export default getGlobal` (Storage).
- Root cause: the CJS wrap lowers `require("pkg")` to a hoisted default import, so for an ES module with `export default` the consumer read named exports off the default value. Node 22 returns the namespace.
- Fix: import the namespace when the resolved bare-package target has top-level `import`/`export` syntax (or is `.mjs`/`.mts`) and the spec is not deferred; CommonJS targets keep the default import. Files: `perry/src/commands/compile/cjs_wrap/wrap.rs`.
- Test: same commit, `perry/tests/cjs_require_esm_package_namespace.rs::require_of_esm_package_with_default_export_returns_the_namespace`.
- Upstream: cherry-pick clean. Upstream touched: `790ac5eea` ("prepare module sources ahead of the module walk"), clean over it. Also affected: likely.
- Depends on: none. PR-E.
- Repro (package has `"type": "module"`; expected `object function 42` then `global function`):
  ```js
  // node_modules/esm-pkg/lib/index.js
  export function getGlobal() { return 'global' }
  export const answer = 42
  export default getGlobal
  // main.js
  var import_esm = require("esm-pkg");
  console.log(typeof import_esm, typeof import_esm.getGlobal, import_esm.answer);
  console.log((0, import_esm.getGlobal)(), typeof import_esm.default);
  ```

### P15 3f823e190 fix(runtime): the unknown-receiver probe declines native URLSearchParams
- Area / platform: runtime / all.
- Problem: `typeof params.get` read `undefined` once the layout probe ran first on a URLSearchParams.
- Root cause: the probe treats an ordinary-layout record with the default prototype as walkable to `%Object.prototype%` and answers `undefined` for unknown keys; URLSearchParams has that shape but its methods and `size` come from a native fallback on the slow read.
- Fix: decline the declared URLSearchParams layout record (`native_method_layout`). Files: `perry-runtime/src/object/layout_probe.rs`.
- Test: same commit, `exotic_named_read_tests.rs::unknown_receiver_probe_declines_url_search_params_but_not_ordinary_objects` (unit).
- Upstream: cherry-pick clean textually. Upstream touched: `291142de3`, `1ff0343a1`, and `79aae9aa7` (not touching `layout_probe.rs`) which removes the mechanism this patch refers to (`exotic_named_read::search_params_read`, named in its doc comment). Fixed upstream, so also affected: no.
- Depends on: P06 (same symptom, same fix family). Not for upstream (superseded).

### P16 5ee46bdb0 fix(compile): lower modules outside the entry directory under a unique name
- Area / platform: compile (collect_modules) / all.
- Problem: in Storage ajv's `_`!${x}`` received the strings of a parameter destructuring, generated validator source read `if({(...)="", ){`, and the draft-07 meta schema compile threw. That aborted fastify's preReady hook loop and left later routes without hook arrays.
- Root cause: collection names a module by its path below the entry directory and fell back to the bare file name otherwise, so every `index.js` under `node_modules` shared a name. The per-module salt for tagged-template call-site ids derives from that name, so the first tagged template of two such modules collided.
- Fix: name such modules by their path relative to the entry directory with `..` segments (unique, independent of checkout location). Files: `perry/src/commands/compile/collect_modules.rs`, `collect_modules_helpers.rs` (`collection_module_name`).
- Test: same commit, `perry/tests/tagged_template_sites_outside_entry_dir.rs::first_tagged_template_of_same_named_modules_outside_the_entry_dir_stays_distinct`.
- Upstream: cherry-pick clean. Upstream touched: `790ac5eea`. Upstream `collect_modules.rs` still falls back to the bare `file_name()`. Also affected: likely.
- Depends on: none. PR-F.
- Repro: entry `src/main.js` importing `../lib/a/index.js` and `../lib/b/index.js`, each exporting a different tagged template result such as ``tag`alpha-${1}-end` ``; the second prints the first's strings.

### P17 15c3bb6b7 fix(runtime): keep subclasses of http.Agent as their own instances
- Area / platform: runtime / all.
- Problem: a subclass of `http.Agent` reached through a local alias lost its prototype methods and field writes: `getCurrentStatus()` read back `undefined` and Storage's agent metrics timer threw (agentkeepalive's `OriginalAgent`).
- Root cause: `super()` in a class extending the bound `http.Agent` export ran it as an ordinary call, building a native agent handle that the derived constructor returned instead of the subclass instance.
- Fix: construct the agent through the http dispatcher up front and alias the subclass instance to the handle, as `http.ServerResponse` already is. Files: `perry-runtime/src/object/native_this_alias.rs`.
- Test: same commit, `perry/tests/http_agent_subclass_keeps_its_own_surface.rs::two_level_subclass_of_aliased_http_agent_keeps_methods_and_fields`.
- Upstream: cherry-pick clean. Upstream touched: none. Also affected: likely.
- Depends on: none (P02 is a separate link fix needed to compile agentkeepalive's class). PR-B.
- Repro (expected `function {"n":1,"sockets":0} https: 5`):
  ```js
  const OriginalAgent = require('http').Agent;
  class A extends OriginalAgent {
    constructor(o) { super(o); this.n = 1; }
    getCurrentStatus() { return { n: this.n, sockets: Object.keys(this.sockets).length }; }
  }
  class B extends A { constructor(o) { super(o); this.protocol = 'https:'; } }
  const b = new B({ keepAlive: true, maxSockets: 5 });
  console.log(typeof b.getCurrentStatus, JSON.stringify(b.getCurrentStatus()), b.protocol, b.maxSockets);
  ```

### P18 8b5573edf feat(runtime): PERRY_TRACE_THROW reports every thrown value at js_throw
- Area / platform: runtime + compile env table / all.
- Problem: a throw that is caught and swallowed, or rethrown by a library, leaves no trace; only uncaught throws print. Debugging a startup failure inside a large bundle needs the original error at its throw site.
- Mechanism: `PERRY_TRACE_THROW=1` (also `on`, `true`) prints the thrown value (an Error's own stack included) and the native call chain resolved to JS function names, before any transport runs. Parsed once; with the knob off a throw pays one cached load. Files: `perry-runtime/src/exception.rs`, `perry/src/commands/compile/compile_env.rs` (adds the knob to `COMPILE_ENV_EXCLUSIONS`).
- Test: same commit, `perry/tests/trace_throw_reports_origin.rs::a_caught_throw_is_reported_only_when_the_knob_is_on`.
- Upstream: cherry-pick clean over five upstream commits touching the same files (`291142de3`, `bc84a76f0`, `80fce2644`, `37a30b076`, `e8f781e59`). Upstream has no `PERRY_TRACE_THROW`; it has the related knobs `PERRY_EH_TRACE` (personality invocations, `eh.rs`) and `PERRY_TRACE_ASYNC`. Not a bug fix, so "also affected" does not apply.
- Judgement: generally useful and small; it follows the existing `PERRY_TRACE_*` pattern, so propose it upstream as a separate low-priority PR.
- Depends on: none. PR-Q.

### P19 8fe4deaf2 fix(runtime): give http.Agent subclass instances Node's options record
- Area / platform: runtime / all.
- Problem: agentkeepalive's `HttpsAgent` reads `this.options.maxCachedSessions` and keeps its timeouts there; `this.options` was `undefined`, so the agent never finished constructing.
- Root cause: the subclass instance is aliased to a native agent handle that exposes `sockets`, `freeSockets`, `requests` and data properties but has no `options` record. Node's constructor stores `this.options` (noDelay defaults to true, path forced to null).
- Fix: install an own `options` object on the instance after the native handle is constructed, copied from the constructor arguments (`install_agent_options`). Files: `perry-runtime/src/object/native_this_alias.rs`.
- Test: same commit, `http_agent_subclass_keeps_its_own_surface.rs::subclass_of_aliased_http_agent_exposes_node_options_and_socket_tables`.
- Upstream: cherry-pick alone conflicts in the test file (created by P17); clean after P17. Upstream touched: none. Also affected: likely.
- Depends on: P17. PR-B.
- Repro (expected `0 8000 true null true 0 0 0`):
  ```js
  const OriginalAgent = require('http').Agent;
  class A extends OriginalAgent { constructor(o) { o = o || {}; o.timeout = 8000; super(o); } }
  class H extends A { constructor(o) { super(o); this.cache = this.options.maxCachedSessions; } }
  const h = new H({ maxCachedSessions: 0, keepAlive: true });
  const o = h.options;
  console.log(o.maxCachedSessions, o.timeout, o.noDelay, o.path, o.keepAlive, h.cache,
    Object.keys(h.freeSockets).length, Object.keys(h.requests).length);
  ```

### P20 71129cbe7 fix(runtime): accept an fs write stream as a stream.pipeline stage
- Area / platform: runtime / all.
- Problem: `stream.pipeline(src, fs.createWriteStream(path))` threw `ERR_INVALID_ARG_TYPE` for "body". Storage's file backend uploads through `pipeline(PassThrough, fs.createWriteStream(path))`, so every upload returned 500 and the orphaned write stream raised an unhandled ENOENT.
- Root cause: fs write streams are their own object type and carry none of the hidden classic-stream flags `pipeline` classified with, so the stream looked like an options object. Past that, the pipeline waited for `end` instead of `finish` on a writable last stage, attached completion listeners to the classic `_events` table the fs stream never reads, and finished the destination through classic finish state it lacks.
- Fix: recognise the stream (`is_fs_write_stream`) and route listeners and finishing through the stream's own `on`/`end`. Files: `perry-runtime/src/node_stream_pipe_dests.rs`, `node_stream_pipeline.rs`.
- Test: same commit, `perry/tests/pipeline_into_fs_write_stream.rs::promisified_pipeline_writes_a_passthrough_into_an_fs_write_stream`.
- Upstream: cherry-pick clean. Upstream touched: none; upstream has no `is_fs_write_stream`. Also affected: likely.
- Depends on: none. PR-D.
- Repro (expected `done hello world`):
  ```js
  const fs = require('fs'), os = require('os'), path = require('path'), stream = require('stream');
  const pipeline = require('util').promisify(stream.pipeline);
  const file = path.join(os.tmpdir(), 'perry-pipeline-fs-' + process.pid + '.bin');
  const body = new stream.PassThrough();
  const done = pipeline(body, fs.createWriteStream(file));
  body.write('hello '); body.write('world'); body.end();
  done.then(() => { console.log('done', fs.readFileSync(file, 'utf8')); fs.unlinkSync(file); });
  ```

### P21 286f4ae58 fix(http): pipe a server request's buffered body into its destination
- Area / platform: perry-ext-http / all.
- Problem: `req.pipe(dest)` on a server request moved no bytes, never ended `dest`, and returned `undefined`. Storage's `req.raw.pipe(new PassThrough())` plus `stream.pipeline(proxy, fs.createWriteStream(file))` therefore hung: `POST /object/...` timed out on the client.
- Root cause: the server `IncomingMessage` method dispatch knew `on`, `pause`, `resume`, `setEncoding` and a few others but no `pipe`, so it fell to the default arm. Only the client `IncomingMessage` implemented `pipe`.
- Fix: the handler runs once the body is buffered, so `pipe` writes the buffered body to `dest` as one chunk (honouring `setEncoding`), ends `dest` unless `options.end` is false, and returns `dest`; a body already delivered to a `data` listener is not sent twice; `pipe` is listed as a method of the request. Files: `perry-ext-http/src/client_events.rs`, `server/handle_dispatch.rs`, `server/request.rs`.
- Test: same commit, `perry/tests/incoming_message_pipe.rs::server_request_pipe_forwards_body_and_returns_dest`. This test only passes with P22.
- Upstream: cherry-pick clean. Upstream touched: none; `is_incoming_message_member` upstream has no `pipe`. Also affected: likely.
- Depends on: P22 for the test to pass. PR-C (squash with P22).
- Repro: `http.createServer((req, res) => { const p = new PassThrough(); const ret = req.pipe(p); ... })`, POST a body, expect `ret === p` and the body on `p` (full source in the test).

### P22 248ec8347 fix(http): route req.pipe to the server request's dispatcher
- Area / platform: perry-ext-http / all.
- Problem: after P21, `req.pipe(dest)` on an untyped request still moved no bytes. The test `server_request_pipe_forwards_body_and_returns_dest` hung 30 s in the fork's `regressions-linux` run and Storage's upload hung identically.
- Root cause: the entry point `js_ext_http_dispatch_method` only forwards a member to the incoming-message dispatcher when `is_incoming_message_member` names it, and `pipe` was not in the list.
- Fix: add `pipe` to `is_incoming_message_member`, which also makes `req.pipe` resolve as a function property. Files: `perry-ext-http/src/server/dispatch_ext.rs` (1 line).
- Test: none of its own; the P21 test covers it.
- Upstream: cherry-pick clean (alone and after P21). Upstream touched: none. Also affected: likely.
- Depends on: P21 (adds the dispatcher arm). PR-C; squash into P21 so the PR is green.

### P23 b416f00f7 feat(runtime): register layouts, atoms and image ranges through init_array on wasm
- Area / platform: runtime / wasm32.
- Problem: on wasm32 the runtime's static layout descriptors, atoms and string-image ranges need registering at startup.
- Root cause: the commit message does not record one; the diff replaces the registration path with `.init_array` entries on wasm.
- Fix: the runtime registers its layouts, atoms and image ranges from `.init_array` entries on wasm. Files: `perry-runtime/src/object/{layout_desc,layout_probe,mod,runtime_layouts,shapes_store,static_registry}.rs`, `runtime_layouts/stream_prototypes.rs`, `value/addr_class/image.rs`.
- Test: none of its own; every wasi probe depends on it.
- Upstream: not cherry-picked. Depends on: none. PR-R.

### P24 bd6269a6b fix(runtime): make the wasm32 runtime compile for wasip1
- Area / platform: runtime, updater / wasm32.
- Problem: `perry-runtime` did not build for `wasm32-wasip1`.
- Root cause: unix-only or pointer-width-dependent code (tty input, process streams, the net turnloop ABI, the thread pool) compiled unconditionally; the commit message records no detail.
- Fix: cfg-gated stubs and a wasm pool (`turnloop_pool_wasm.rs`), plus `wasi_net` transport scaffolding; 20 files.
- Test: the wasip1 runtime build in `wasi-linux`.
- Upstream: not cherry-picked. Depends on: none. PR-R.

### P25 20d4dc2cd feat(stdlib): build a wasm32-wasip1 subset without openssl, zlib-ng or threads
- Area / platform: stdlib, ext-zlib / wasm32.
- Problem: `perry-stdlib` and `perry-ext-zlib` could not build for wasip1 (openssl, zlib-ng and threads are unavailable).
- Fix: Cargo features select a subset without them (wide digest in `crypto/wide_digest.rs`, an inflate context for wasm in `inflate_context_wasm.rs`) and the worker pump is gated.
- Test: wasi probes `crypto-sha256`, `crypto-verify`, `zlib`.
- Upstream: not cherry-picked. Depends on: none. PR-R.

### P26 c0d32ab8c fix(runtime): compare the 47-bit address ceiling in u64 so wasm32 release builds compile
- Area / platform: runtime / wasm32.
- Problem: `addr >= 1 << 47` overflows `usize` on wasm32 and fails the release build.
- Fix: compare as `u64` in `builtin_proto_entries.rs` (1 line).
- Test: the wasm32 release build.
- Upstream: not cherry-picked. Depends on: none. PR-R.

### P27 2f4a2a4f4 feat(compile): add a wasip1 target that links a WASI preview1 core module
- Area / platform: compile, codegen / wasm32.
- Problem: no way to produce a module that runs on a WASI preview1 host.
- Fix: `--target wasip1` reuses the wasm32 lowering and the wasi link with the `wasm32-wasip1` triple, wasi-sdk's p1 sysroot and no `cabi_realloc` export; `scripts/wasi_build_runtime.sh` takes the runtime target. Docs in `docs/WASI_SUPPORT.md`.
- Test: wasi probes compared against node.
- Upstream: not cherry-picked. Depends on: P23-P26. PR-S.

### P28 9e0beba53 fix(codegen): regenerate the wasm32 runtime ABI table, which had drifted from the runtime
- Area / platform: codegen (wasm32) / wasm32.
- Problem: `wasm32/runtime_abi.tsv` no longer matched the runtime's entry points, so wasm calls were declared with the wrong widths.
- Fix: regenerated with `scripts/runtime_abi_check.py`.
- Test: `scripts/runtime_abi_check.py`.
- Upstream: not cherry-picked; the table churns, so regenerate on the upstream base instead of cherry-picking. Depends on: none. PR-S.

### P29 c546aab14 fix(codegen): cover macro-defined runtime entry points in the wasm32 ABI table
- Area / platform: codegen (wasm32), scripts / wasm32.
- Problem: the ABI check could not see entry points defined by macros (`closure_call_entry!`, `kind_entry!`, the array/string prototype entry macros), so rows for them were missing (222 added).
- Fix: `scan_macro_entries` in `scripts/runtime_abi_check.py` reads each macro family's fixed shape, and the table gains the rows.
- Test: `scripts/runtime_abi_check.py`.
- Upstream: not cherry-picked. Depends on: P28. PR-S.

### P30 f7c9d2b0b fix(runtime): declare the array builtin entries at pointer width so wasm32 calls resolve
- Area / platform: runtime / wasm32 (no change on 64-bit).
- Problem: array builtins declared `i64` pointers, so a wasm32 call to them had the wrong signature.
- Fix: a target-width integer `Wp` and a `wide_ty!` macro declare the entries at pointer width in `builtin_proto_entries.rs`.
- Test: wasi probes and the ABI check.
- Upstream: not cherry-picked. Depends on: none. PR-R.

### P31 5c4434bb7 feat(wasip1): bundle perry-stdlib and the node ext crates into the wasm runtime
- Area / platform: compile, runtime-static / wasm32.
- Problem: a storage-capable runtime needs perry-runtime, ext-net/http/undici/zlib/ws, http-server and the stdlib subset in one archive under one allocator.
- Fix: new `perry-runtime-static` crate, and a generated `.init_array` object registers the feature installers; `wasi_build_runtime.py` and the link step use it. 22 files.
- Test: wasi probes for crypto, zlib, events, streams, fs, path/url/util/os, AsyncLocalStorage, network modules and process basics.
- Upstream: not cherry-picked. Depends on: P25, P27. PR-S.

### P32 0dac0c454 fix(runtime): admit program-emitted image strings on wasm32
- Area / platform: runtime / wasm32.
- Problem: string readers that validate headers (`path.*`, `URLSearchParams`, fs paths) rejected every string literal.
- Root cause: literals emitted by codegen live in static data, but only the runtime's own strings were registered as image strings.
- Fix: bound the candidate range by `__data_end`; the header validation is unchanged. File: `value/addr_class/image.rs`.
- Test: wasi probes `path-url-util-os`, `fs`.
- Upstream: not cherry-picked. Depends on: P23. PR-R.

### P33 202df7335 feat(wasi): serve and connect over the host's supa_net sockets on wasip1
- Area / platform: runtime (wasi_net, signals, event pump) / wasm32.
- Fix: listener discovery (`SUPA_LISTEN_FDS` or tcplisten sockets), accept, connect through `supa_net.tcp_connect`, DNS through `supa_net.resolve`, errno-to-Node-code mapping, one `poll_oneoff` when idle with sockets, `server.address()`, and `SUPA_SIGNAL_FD` signals for `process.on`.
- Test: wasi probes `http-server`, `net-echo`, `dns-lookup` (added in 506e7d053).
- Upstream: not cherry-picked. Depends on: P24, P31. PR-T. The `supa_net` import module is specific to the supa-wasm host.

### P34 baf2f1d91 feat(wasip1): route the link transport through the host socket handles
- Area / platform: runtime / wasm32.
- Problem: servers and sockets built on the shared link ABI did not run on wasi.
- Fix: listen, accept, connect, read, write, shutdown and close drive the `supa_net` imports with one `poll_oneoff` per idle turn. Also lifts the all-f64 trampoline arity cap on wasm, where an exact-arity call is always correct (pg's protocol writer needs 18 arguments).
- Test: wasi probes `http-server`, `net-echo`, `pg-client`.
- Upstream: not cherry-picked. Depends on: P33. PR-T.

### P35 91629a4bd fix(wasip1): report the bound listener address and wake the loop after dispatch
- Area / platform: runtime (wasi_net) / wasm32.
- Problem: `server.address()` and the `'listening'` event had no address, and every request took a second.
- Root cause: a p1 guest cannot ask its host socket for its address; completions handed to the sinks did not wake the loop, so it parked on the idle cap.
- Fix: a listener keeps the announced or requested address; completions notify the loop.
- Test: wasi probe `http-server`.
- Upstream: not cherry-picked. Depends on: P34. PR-T.

### P36 d9bda55e5 fix(wasip1): declare imported static methods at their producer's width
- Area / platform: codegen / all (matters on wasm32).
- Problem: wasm-ld rejected the same symbol with two signatures.
- Root cause: cross-module static methods were declared with six double parameters; a wasm32 object records the function type, so a declaration wider than the definition conflicts.
- Fix: declare at the producer's declared width (6 only when the producer did not report it), and truncate extra call arguments to the declared count (already evaluated).
- Test: the Storage compile; no dedicated test.
- Upstream: not cherry-picked. Depends on: none. PR-U.

### P37 20bf06dc0 fix(wasm32): keep calls out of setjmp frames so spill code stays linear
- Area / platform: codegen (wasm32) / wasm32.
- Problem: one function reached 17 MB and the Storage module 530 MB, past the 7.6 MB function limit wasmtime enforces.
- Root cause: sjlj lowering carries every block-crossing SSA value through phis and spills them around each call, so inlined callees inside a try function blow up.
- Fix: `mark_call_noinline` marks call sites noinline inside setjmp functions (`wasm32/mod.rs`).
- Test: none; seen only as module size.
- Upstream: not cherry-picked. Depends on: none. PR-U.
- Still needed? Unverified. f0a9e8a1d (P38) removed the root cause of the 17 MB function (the quadratic require shim), so this is likely redundant for Storage. It still bounds spill growth for any large try function, but that has not been measured. A CI run of the Storage compile without it would settle it; it is not reverted.

### P38 f0a9e8a1d fix(cjs): share one registry helper across a module's deferred requires
- Area / platform: compile (cjs_wrap) / all targets: Behaviour is unchanged everywhere and each module gets smaller.
- Problem: a 3 KB barrel module with 16 requires produced a 17 MB function on wasm32; Storage's module was 530 MB.
- Root cause: the require shim inlined the path-registry call, its try/finally, the cycle warning and the child link into every deferred specifier case; a try makes the function a returns-twice frame, and the sjlj lowering threads every case's values through one dispatch loop, so the shim grew with the square of the specifier count.
- Fix: one helper per module holds that body and each case calls it; the import binding is read through a thunk because reading it can initialize the target. Files: `cjs_wrap/deferred_requires.rs`, `cjs_wrap/wrap.rs`.
- Test: size, measured on the Storage compile (530 MB to 414 MB). No dedicated test; a native size/behaviour check would suit upstream.
- Upstream: not cherry-picked. Depends on: none. PR-V.

### P39 28fa69faf fix(wasm32): pass a JS body's callee as a pointer in indirect calls
- Area / platform: codegen (wasm32) / wasm32.
- Problem: Storage trapped with `indirect call type mismatch` (ajv `eachItem`).
- Root cause: closure bodies are retyped to take the closure as a pointer so the runtime's `call_indirect` matches, but calls through a code pointer (loop-hoisted direct calls, method inline caches, native-argument-list entries) still passed the callee as `i64` and the length as `i64`.
- Fix: `retype_indirect_body_calls` in `wasm32/closure_abi.rs` rewrites those calls in the wasm32 lowering.
- Test: unit `indirect_body_calls_pass_the_callee_as_a_pointer` and wasi probe `closure-call-in-loop.js`.
- Upstream: not cherry-picked. Depends on: PR-S. PR-U.

### P40 3d45a1e6d fix(runtime): register the standard descriptors for fs on WASI
- Area / platform: runtime (fs) / wasm32 (WASI).
- Problem: `fs.writeSync(1, ...)` and `fs.write(1, ...)` threw EBADF; pino's sync stdout destination (sonic-boom) writes this way, so Storage's logger failed.
- Root cause: the fd registry seeded descriptors 0..=2 only under `cfg(unix)`.
- Fix: on WASI the registry wraps descriptors 0..=2 directly (no dup exists). File: `fs/mod.rs`.
- Test: wasi probe `fs-stdio-fd.js`.
- Upstream: not cherry-picked. Depends on: none. PR-W.

### P41 5a0100769 fix(runtime): report readableEnded only once the end event was emitted
- Area / platform: runtime (node:stream) / all.
- Problem: a `PassThrough` that was `end()`ed but not yet consumed reported `readableEnded === true` (node: `false`). Storage pipes a request into a proxy `PassThrough` and rejects the upload when `proxy.readableEnded` is true, so every small upload failed with "Request stream closed before upload could begin".
- Root cause: the public `readableEnded` getter read `Slot::ReadableEnded`, which `mark_stream_ended` sets when EOF is pushed (node's `ended`). Node's `readableEnded` is `endEmitted`.
- Fix: the prototype getter and `js_node_stream_method_readable_ended` read `Slot::EndEmitted`, and constructors initialise it to false. `Slot::ReadableEnded` keeps its internal meaning (EOF pushed). Files: `perry-runtime/src/node_stream.rs`, `node_stream/proto_methods.rs`, `node_stream_constructors.rs`.
- Test: the unit test `readable_lifecycle_flags_reflect_ended_state` now expects `false` after `push(null)` (it asserted the old behaviour); probe `.github/supa/wasi-probes/stream-readable-ended.js` (port to `crates/perry/tests` for upstream).
- Upstream: not cherry-picked. Depends on: none. PR-X.
- Not covered: a server `IncomingMessage` still reports `readableEnded` as `complete` and `closed` as undefined (perry-ext-http `handle_dispatch.rs`).

### P42 743236204 fix(gc): trace an array's named-property holder as a pointer
- Area / platform: gc (`gc/layout_slot_visit.rs`) / wasm32.
- Problem: Storage (ajv schema compilation, tagged templates) trapped nondeterministically with `out of bounds memory access` in `named_layout_holds_element_descriptors`; any program that keeps arrays with own named properties (tagged-template `strings.raw`, regexp `match` results, `arr.label = ...`) across a nursery collection could read a freed property holder.
- Root cause: the array's `named` word is a raw machine pointer. The layout visitor gave it a `u64` slot descriptor (only objects and closures got the pointer-width one). On wasm32 the pointer is four bytes inside an eight-byte-aligned header, followed by four padding bytes, so the `u64` read folded whatever the padding held into the address; the edge was then neither marked nor rewritten, and the holder was reclaimed or left at its old address once the array was evacuated. Native targets read the full pointer word and were unaffected.
- Fix: arrays use the pointer-width slot descriptor like objects and closures. File: `perry-runtime/src/gc/layout_slot_visit.rs`.
- Test: wasi probe `.github/supa/wasi-probes/array-named-props-gc.js` (traps without the fix, with and without `PERRY_GC_FORCE_EVACUATE=1`); port to `crates/perry/tests` for upstream.
- Upstream: not cherry-picked. Depends on: none. PR-Y.

### P43 4519a2f16 fix(runtime): zero the DateCell padding on 32-bit targets
- Area / platform: runtime (`date.rs`, `object/shape_rule3.rs`, `object/native_get.rs`) / wasm32.
- Problem: Storage trapped with `out of bounds memory access` in `Renderer.setLastModifiedHeader` (a Date formatted into a response header) after a rejected duplicate 5 MB upload followed by a download. The same sequence also trapped in `JSON.stringify` of an object holding a Date (`date_to_json_value` -> `try_data_lookup_key`), which is where the fault was traced. The failure needs the allocator to hand a Date the memory of a dead object, so it is intermittent.
- Root cause: a `DateCell` is `meta` (pointer-sized), then the timestamp at offset 8. On wasm32 the pointer is four bytes and four bytes of padding follow, which `alloc_date_cell` never wrote. The arena does not zero reused memory. The property-read paths treat the word at payload +4 as the object's ShapeId (the layout is `class_id`, `parent_class_id` = ShapeId, padding, `meta` on ILP32), so the padding is read as a ShapeId. When the previous occupant was an ordinary object, its ShapeId was still there, the Date was classified as an ordinary object, and the lookup dereferenced the object's overflow table and slots, which a Date cell does not have. On 64-bit targets that word is the high half of `meta`, which is null.
- Fix: the cell gets an explicit `_meta_padding: u32` field on 32-bit targets, and `alloc_date_cell` zeroes it. The size and the timestamp offset are unchanged (the existing const asserts hold). File: `perry-runtime/src/date.rs`.
- Test: wasi probe `.github/supa/wasi-probes/date-cell-reuse.js` allocates Dates into freed object memory and stringifies them (traps before the fix; prints `dates intact` after); port to `crates/perry/tests` for upstream.
- Upstream: not cherry-picked. Depends on: none. PR-Z.

### P44 540a34fc2 fix(net): an application's end() after the protocol layer's close is a no-op
- Area / platform: net (`perry-ext-net` `native_transport.rs`) / all targets; observed on wasm32.
- Problem: Storage died with an uncaught `Error [ERR_UNHANDLED_ERROR]: shutdown EPIPE` when a client sent a multi-MB upload that the server rejected (401/400) before reading the body. Storage answers with `Connection: close`, sets `socket.destroySoon = () => socket.end()`, and calls `socket.end()` again when the response finishes so it can keep draining the body.
- Root cause: the HTTP turnloop closes a finished connection with `native_transport::shutdown` (the same call WebSocket and HTTP/2 use), which shut the write side down without telling the Socket. The application's `socket.end()` then found `write_ended` still false and issued a second transport shutdown. On WASI the second shutdown fails with EPIPE, and `end()` reports a shutdown failure by destroying the socket with an `'error'`; a server connection has no `'error'` listener, so it was thrown as an uncaught exception. Node treats the second `end()` as a no-op, and ignores shutdown errors on a server socket anyway.
- Fix: `native_transport::shutdown` sets the Socket's `write_ended` flag before it shuts down, so a later `end()` coalesces with it (its callback joins `extra_end_users`) and `writableEnded` is true, as in Node. File: `perry-ext-net/src/native_transport.rs`. The probe harness learns `// request: METHOD PATH @bytes:N` (a body too big for the command line): `.github/supa/wasi-probes.sh`.
- Test: wasi probe `.github/supa/wasi-probes/http-early-reply.js` (a 401 before reading a 5 MB body, with Storage's half-close; the process exits 1 with the unhandled error before the fix, and answers the next request after it); port to `crates/perry/tests` for upstream.
- Upstream: not cherry-picked. Depends on: none. PR-AA.
- Not covered: the other order (the application's `end()` first, then the protocol layer's close) still gets the transport's duplicate-shutdown error, which the layers answer by destroying the connection without an `'error'`.

### P45 d9ebda76d fix(dns): dispatch dns lookup and resolve exports reached through a CommonJS namespace
- Area / platform: dns (`perry-runtime` `object/native_module_dispatch/dispatch_d_i.rs`, `dns/ffi.rs`) / all targets; observed on wasm32-wasip1.
- Problem: in a CommonJS file `const dns = require('node:dns'); dns.lookup('localhost', cb)` never called `cb` and the program exited 0 silently; the same held for `lookupService`, `resolve*`, `reverse`, `require('node:dns/promises').lookup(...)` and a destructured `const { lookup } = require('dns')` (the promise forms returned undefined, so `.then` threw). The ESM form `import * as dns from 'node:dns'` worked. Fastify's `listen({ host })` calls `dns.lookup(host, { all: true }, cb)` through `require('node:dns')` and only starts listening inside the callback, so a hostname listen hung. `net.connect({ host: 'localhost' })` and pg by hostname were not affected (they resolve inside the runtime).
- Root cause: Perry's CommonJS wrapper injects its own `require`, so `require('node:dns')` is a runtime call that returns a native-module namespace, not the static `NativeModuleRef` that `import * as dns` produces. Static `dns.lookup(...)` is bound at compile time through `NODE_DNS_ROWS` (`native_table/node_dns.rs`) to `js_dns_lookup` and friends. A member call on the runtime namespace instead goes through `nm_dispatch_dns`, which had arms only for `getServers`, `setServers` and the default result order; its `_ =>` arm returned undefined, so every other export was a silent no-op.
- Fix: `dns::dispatch_export` (`dns/ffi.rs`) maps each lookup/lookupService/resolve*/reverse export, callback and `dns/promises` form, to the same `js_dns_*` FFI the static table uses; `nm_dispatch_dns` calls it with the packed arguments before falling through to undefined. The router is reached through a pointer that `js_dns_install_exports` sets, which the entry prologue calls only when the program imports, requires or names (`getBuiltinModule`) `dns` / `dns/promises` (`ctx.uses_dns`, set in `collect_modules.rs`, emitted in `run_pipeline.rs`). Every CommonJS program pins all dispatch buckets through `createRequire`, so a direct reference would link the lookup FFIs, and with them the host's `supa_net.resolve` import, into every CommonJS module; the first attempt did, and `wasi-linux` failed its import hygiene check on `fs`, `fs-stdio-fd`, `path-url-util-os`, `stream-readable-ended` and `streams`. Docs: the "`dns` in CommonJS" limitation is removed from `docs/WASI_SUPPORT.md` and `wasi-probes.sh`.
- Test: wasi probe `.github/supa/wasi-probes/cjs-dns.js` (run as CommonJS: callback and promise lookup, `{ all: true }`, an IP literal, ENOTFOUND, `net.connect` by name; before the fix it prints only its first line and exits 0, after it matches node line for line); port to `crates/perry/tests` for upstream. It is compile-only in CI (needs a resolver) and runs locally under supa-host with `--listen 127.0.0.1:47123`.
- Upstream: not cherry-picked. Depends on: none. PR-AB.
- Not covered: instance methods of `new dns.Resolver()` reached through a CommonJS namespace were not re-tested.

### P46 TBD fix(hir): construct the global when a program class shares a name with a globalThis alias
- Area / platform: hir / all targets; seen on wasm32-wasip1.
- Problem: Storage's resumable upload endpoint (`POST /upload/resumable`) answered 500 `TypeError: append is not a function`. srvx's node adapter keeps `const NativeHeaders = globalThis.Headers` and declares its own `class Headers` that wraps a lazily built native one; reading the first request header ran `new NativeHeaders()`.
- Root cause: HIR records `const X = globalThis.Y` as a let-class alias (`let_class_aliases`, keyed by name) and lowers `new X()` to `Expr::New { class_name: "Y" }`. Codegen resolves that class by string, so a program class named `Y` declared in the same module captured the construction: `new NativeHeaders()` built the program's `Headers`, an object without `append`.
- Fix: `LoweringContext::global_class_aliases` marks the aliases whose initializer is a `globalThis` read (`register_global_class_alias`, used by the three destructuring paths and the `PropertyGet` arm in `alias_tracking.rs`; `register_let_class_alias` clears the mark when a name is rebound). `lower_new` lowers `new Alias()` to `global_property_new_dynamic` when the alias is such a global and the program also binds that global's name, so the value on `globalThis` is constructed. Files: `perry-hir/src/lower/{lowering_context,context_new,context,expr_new}.rs`, `perry-hir/src/destructuring/{pattern_binding,var_decl/alias_tracking}.rs`.
- Test: wasi probe `.github/supa/wasi-probes/headers-global-alias.js` (fails with `append is not a function` before the fix, matches node after); port to `crates/perry/tests` for upstream.
- Not covered: `new Wrapped.Headers()` (a member callee whose property is named like a global) still builds the native class, a separate bug found while writing the probe.
- Upstream: not cherry-picked. Depends on: none. PR-AC.

### P47 TBD fix(runtime): start reading when a readable that is not flowing is piped
- Area / platform: runtime node:stream / all targets; seen on wasm32-wasip1.
- Problem: `Readable.fromWeb(webStream).pipe(dest)` never delivered a byte and never ended; @tus/server pipes the request body this way (`Readable.fromWeb(body).pipe(PassThrough)`), so a TUS PATCH stored nothing.
- Root cause: `pipe_stream_to_destination` attached the destination, flushed already buffered chunks and marked the source flowing, but never called `_read`. Only `on('data')` scheduled a read (`schedule_readable_resume`). A stream whose data is produced by `_read` (fromWeb pulls its web source there) therefore sat idle with nothing buffered. Node's `pipe` calls `src.resume()` when the source is not flowing, which reads.
- Fix: `pipe_stream_to_destination` schedules `invoke_read_once` in a microtask (`schedule_read_after_pipe`), as resume's flow does, skipped when the stream was destroyed, paused again or has no destination left by then. The unit test `pipe_cleanup_does_not_swallow_destination_error` now gives its source a `read()`, since a bare Readable raises `ERR_METHOD_NOT_IMPLEMENTED` once a pipe reads it, as in Node. File: `perry-runtime/src/node_stream_readwrite.rs`.
- Test: wasi probe `.github/supa/wasi-probes/stream-pipe-starts-read.js` (fromWeb piped into a Writable and into a PassThrough; times out before the fix, prints 1500 for both after); port to `crates/perry/tests` for upstream. The probe carries `// network: yes` because a program naming the global `ReadableStream` links the net imports (pre-existing, independent of this fix).
- Not covered: the event order of `pipe` ('pause'/'close' relative to 'end') differs from Node, and a Readable whose `read()` pushes lazily still gets `_read` called once only (`hidden_read_invoked_key` is never reset on push).
- Upstream: not cherry-picked. Depends on: none. PR-AD.

## Not for upstream

Every other fork-only non-merge commit is CI, probes, a temporary diagnostic, or a Storage shim. None edits files outside `.github/` (checked with `git show --name-only`). There are 44 such commits, 23 fix/feat commits are the patches above, and the fork has no `test:` commits.

**Fork CI workflow, composite action and driver scripts** (`.github/workflows/supa-storage.yml`, `.github/actions/supa-rust-env`, `.github/supa/*.sh`; Blacksmith runner, sccache, lld, caches). Fork-specific infrastructure for supabase/perry.
`e8ac78fea` `ece6015bb` `297306927` `18b63cef3` `512996ccb` `0c3401687` `9d2cbde15` `8a051e924` `53423af73` `942a6fe56` `5b1438709`

**CI wiring of regression tests** (adds test names or log capture to `.github/supa/regressions.sh`; the tests themselves belong to the patches above).
`2f2aa9106` `28ec96b4c` `45f599068` `679c8489c` `972d69cfc` `c14ff7647` `0ab92cf1e`

**Probes** (`.github/supa/probes/*.js`, `probe.js`, `probes.sh`): fastify README/npm, ajv, cdn-cache-manager, ESM-from-CJS, http.Agent, upload-pipeline probes and their fixtures. They reproduce Storage-shaped failures and are not upstream tests. Candidates to reuse as upstream tests: `fastify-readme.js` (for PR-A) and `esm-from-cjs.js` (for PR-E), both after rewriting as `crates/perry/tests` cases.
`200a70f05` `4561dccb5` `6ccdadf95` `aa4e27a74` `6ffb0639a` `d9eefe30b` `c3cff7bc6` `5002c8b14` `5511ceefd` `723c309c3` `f0475a91a` `1ccc26071` `815c06f11` `b22beb087` `18f6e5fff` `763c3aa57`

**Temporary diagnostics** (fastify preParsing and ajv failure-site tracing, uncaught-throw return-path gdb tracing, and their removal; one of them is an empty commit that only re-ran the pipeline).
`de78dda9a` `edfe3727f` `84c7f28de` `b1c720155` `aa8c0218e` `b24de7373` `d559df970` `6a26fd5f0`

**Storage dependency shims** (`.github/supa/shims.sh`, `patch-find-my-way.cjs`). The first replaces the four `new Function` generated functions in find-my-way 9.7.0 with closures; it also deletes upstream's `.github/dependabot.yml` from the fork. It predates P12, and whether it is still needed on Linux is unverified. The second removes the earlier agentkeepalive shim now that P02, P17 and P19 make the real package run.
`da99fa8be` `7b9b592a3`

**wasip1 series since storage-ci** (`supa/wasip1`): CI wiring and diagnostics `ef0f3969f` `dd33cf711` `f96fd56bd` `e81da245e` `04a35b714` `5c07ca9f3` `e5558632d` `628f36abe` `367281739` `5defe7f9a` `74694d7d4` `37c69af62` `61aa2c6df` (`supa-storage.yml`, `.github/supa/*.sh`, the temporary diagnostic probes and the `SMOKE_BYTES` smoke input). The `test(wasi)` probe commits `506e7d053` and `ec19714e1` and the `docs:` commit `b3cce1633` (how the wasm32 ABI table is regenerated) go upstream with PR-T and PR-S respectively.

Merge commits (not counted): `1f3c775af` (merge of upstream main) and `03ef52d0f` (merge of `supa/upstream-sync`).

## Fork baseline

- Upstream reference: `refs/upstream-main` = `1fd8ca2ae` (2026-10-17), 38 commits ahead of the fork's last sync.
- Merge-base of `supa/storage-ci` with upstream main: `43a40d056` (2026-10-16, "perf: read-before-write check knows paths that cannot complete normally").
- Last upstream sync merge: `1f3c775af` (2026-10-16 15:12 +0200, "Merge PerryTS/perry main into supa/storage-ci"), whose second parent is `43a40d056`. `03ef52d0f` (2026-10-16 17:25 +0200) merged the fork's own `supa/upstream-sync` branch.
- Original fork point of the earlier patches (P01-P14): `5b76f8acc` (2026-10-15, "gc effects: regenerate macOS table for Object.create families"). The older branch `supa/storage` (an older tip) is an ancestor of `supa/storage-ci`.
- Fork tip: `supa/storage-ci` (tip, 2026-10-16); 68 fork-only commits, 66 non-merge.
- Ledger written: 2026-10-17.
