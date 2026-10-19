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
- A "Merge of upstream `2bbab8aff`" bullet in an entry records what the 2026-10-18 merge (`supa/upstream-merge-1018`, 231 upstream commits since `43a40d056`) did to it: "superseded" (upstream fixed the same thing, the fork's code was dropped, any test stays as a regression test), "adapted" (the fork's intent was re-applied on upstream's new code; no new id) or "absorbed". Status text above those bullets describes the tree at `1fd8ca2ae`.
- A "Merge of upstream `f3d38d16d`" bullet records what the 2026-10-19 merge (`supa/upstream-merge-1019`, 66 upstream commits after `2bbab8aff`) did to a patch, with the same vocabulary. Patches without such a bullet were not touched by those 66 commits (no changed file in common).
- Tests live in the same commit as their fix (the fork has no separate `test:` commits). Test paths are under `crates/` unless noted.

## Summary table

| id | commit | title | area | platform | test | applies to upstream main | PR group |
|----|--------|-------|------|----------|------|--------------------------|----------|
| P01 | 3a1bd4cd8 | fix(codegen): refresh guarded class-env slots after a CJS binding's initializer | codegen | all | integration | clean | PR-I |
| P02 | fc9f6cb62 | fix(codegen): register computed-member methods with the entry they define | codegen | all | integration | clean | PR-J |
| P03 | 78f00dedd | fix(codegen): load regex literal handles in worker programs | codegen, runtime | all (programs using Worker) | integration | clean | PR-L |
| P04 | 2d333eac4 | fix(codegen): accept the zero-width .alt_entry directive in stack-map blocks | codegen (gc_map) | Mach-O only | integration | superseded by upstream `c4bf643f6` (merged) | none: superseded |
| P05 | 800781f0b | fix(runtime): accept image strings at the padded size codegen emits | runtime | all | integration + unit fixtures | superseded by upstream `4ed616f5e` (merged) | none: superseded |
| P06 | 2f01c61c4 | fix(runtime): reach the URLSearchParams probe for type-erased receivers | runtime | all | integration | superseded by upstream `79aae9aa7` (merged) | none: superseded |
| P07 | 83e19b5b8 | fix(codegen): keep linkonce_odr coalescing for helpers promoted under codegen units | codegen | all (PERRY_CODEGEN_UNITS>1) | integration | clean | PR-M |
| P08 | 150fc3c39 | fix(root_reload): stop declining large require closures on the cost cap | codegen (root_reload) | all | unit | clean | PR-P |
| P09 | 76d54d44a | fix(codegen): mark the hot-TLS thread-pointer read gc-leaf where it is emitted | codegen | Apple aarch64 only | unit (IR) | clean | PR-N |
| P10 | 7b5f84c69 | fix(hir): materialize a TypeScript enum used as a value | hir | all | hir + parity file | superseded by upstream `09e7861b4` (merged) | none: superseded |
| P11 | 066f57f15 | fix(hir): label a CommonJS module body frame with its file path | hir, runtime | all | hir + unit | clean | PR-K |
| P12 | 5e1f3ee20 | fix(codegen): register startup stubs through .init_array on ELF | codegen (stubs) | ELF/Linux only | unit | clean (`.github` hunks conflict) | PR-A |
| P13 | 0bbb806bf | fix(hir): construct undici agents through a require()d namespace local | hir | all | hir | clean | PR-H |
| P14 | 81525ce5d | fix(cjs-wrap): bind a required ES module package as its namespace | compile (cjs_wrap) | all | integration | clean | PR-E |
| P15 | 3f823e190 | fix(runtime): the unknown-receiver probe declines native URLSearchParams | runtime | all | unit | superseded by upstream `79aae9aa7` (merged) | none: superseded |
| P16 | 5ee46bdb0 | fix(compile): lower modules outside the entry directory under a unique name | compile | all | integration | superseded by upstream `c1671d39d` (merged) | none: superseded |
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
| P46 | 19c26c6a9 | fix(hir): construct the global when a program class shares a name with a globalThis alias | hir (`lower/expr_new.rs`, `lower/context.rs`, destructuring) | all | wasi probe `headers-global-alias.js` | not tried | PR-AC |
| P47 | bea2d51cb | fix(runtime): start reading when a readable that is not flowing is piped | runtime (node:stream, `node_stream_readwrite.rs`) | all | wasi probe `stream-pipe-starts-read.js` | superseded by upstream `b0d159c8c` (merged) | none: superseded |
| P48 | 19f404e40 | fix(runtime): hand a live stream to the function stage of stream.pipeline | runtime (node:stream, `node_stream_pipeline.rs`) | all | wasi probe `stream-pipeline-live-source.js` | not tried | PR-AE |
| P49 | 32943d82a | fix(runtime): read an http request through Readable.toWeb with the request's own read() | runtime (node:stream web adapter, `node_stream_constructors/web_adapter.rs`) | all | wasi probe `http-request-to-web.js` | not tried | PR-AF |
| P50 | a5ffa98e1 | fix(hir): extend the member a class heritage names when it shares the class's name | HIR class lowering (`perry-hir/src/lower_decl/class_decl.rs`) | all | wasi probe `class-extends-same-name-member.js` | not tried | PR-AG |
| P51 | a45195e98 | fix(gc-effects): size the disassembler output buffer with c_char | gc-effects (`perry-gc-effects/src/archive.rs`) | aarch64 Linux (build break) | the compiler's build (`build-perry`) | not tried | PR-AH |
| P52 | 7eb0760bd | fix(wasm32): call a captureless some() callback at its declared arity | runtime (`array/iter_methods.rs`) | wasm32 | wasi probe `array-some-callback-arity.js` | not tried | PR-AI |
| P53 | fc6a4b86c | fix(codegen): keep a scope group's frame root live until its last member reference | codegen (`collectors/shadow_slots.rs` and its six call sites) | all (observed on wasm32) | wasi probe `scope-group-root-live.js` | not tried | PR-AJ |
| P54 | 7f6a2b5f2 | fix(runtime): classify an uncaught throw by the personality's verdicts, not _Unwind_RaiseException's status | runtime (`eh.rs`, `exception.rs`) | aarch64 Linux native (libgcc) | native probe `eh-uncaught.js` | not tried | PR-AK |
| P55 | a29271566 | fix(wasm32): size the family-method tables and read the word directory at the target's width | runtime (`object/layout_desc/methods.rs`, `object/shapes.rs`) | wasm32 (build break) | the wasm32 runtime build (`wasi-linux`, `storage-wasi`) | not tried | PR-AL |
| P56 | 9a28f536b, ef4582580 | perf(wasm32): keep block-crossing values in stack slots in setjmp functions | codegen (`inprocess/sjlj_demote.rs`, `inprocess/optimize_emit.rs`) | wasm32 | wasi probe `sjlj-live-values.js` (GC stress) + `sjlj-size.sh` A/B table | not tried | PR-AM |
| P57 | ba91cd3d5 | perf(runtime): end an instanceof prototype walk at a self link or cycle | runtime (`object/instanceof.rs`) | all (measured on wasm32) | wasi probes `instanceof-matrix.js`, `instanceof-bench.js` | not tried | PR-AN |
| P58 | 0b9a602cf | fix(runtime): consult a computed static @@hasInstance declared in a class body | runtime (`object/global_this/generator_state.rs`) | all (found on wasm32) | wasi probe `instanceof-matrix.js` (`2 instanceof Even`) | not tried | PR-AO |
| P59 | 75654d1a3 | fix(runtime): initialize the derived instance when super() targets a native Error | runtime (`object/class_registry/construct/site.rs`) | all (seen on wasm32) | wasi probe `error-subclass-props.js`, Storage smoke error paths | not tried | PR-AP |
| P60 | 52f4de3cb | fix(hir): read a per-evaluation class declaration through its binding from earlier closures | HIR (`lower_decl/forward_class_reads.rs`, `block.rs`, `body_stmt.rs`) | all (seen on wasm32) | wasi probe `forward-class-binding.js`, Storage smoke duplicate upload | not tried | PR-AQ |
| P61 | bea18b173 | fix(runtime): clear an adopted promise's rejection once the adoption job attaches to it | runtime (`promise/assimilate.rs`) | wasm32-wasip1 | wasi probe `async-throw-after-await.js` | not tried | PR-AR |
| P62 | b94434efe | fix(runtime): resolve require("stream/promises") pipeline and finished to the promise implementations | runtime (`object/native_module/callable_exports.rs`, `object/native_module_dispatch.rs`) | all (observed on wasm32 and aarch64/x86_64 Linux native) | wasi probe `stream-pipeline-final-fn-require.js` | not tried | PR-AS |
| P63 | f969c418e, 77be4b284, 9a1758ff0 | fix(runtime): give fs streams, Dir and Dirent their module prototype, and let a subclass inherit a static Symbol.hasInstance | runtime (`object/object_ops/host_prototype.rs`, `object/object_ops/prototype.rs`, `node_stream_readwrite.rs`, `object/class_meta_registry.rs`) | all | wasi probes `instanceof-matrix.js`, `instanceof-bench.js`, native probe `host-object-chains.js` | not tried | PR-AT |
| P64 | cbcca2990 | fix(runtime): follow array forwarding when concatenating a list of buffers | runtime (`buffer/from.rs`) | all (found on wasm32) | wasi probes `buffer-concat-grown-list.js`, `fastify-inject-get.js` | not tried | PR-AU |
| P65 | 55259826f | perf(runtime): copy holey arrays and plain array-likes without a per-index HasProperty | runtime (`array/alloc.rs`, `array/indexing_proto_chain.rs`, `array/from_concat.rs`) | all (measured on wasm32) | wasi probes `array-holey-copy.js` (compared with node), `array-holey-copy-bench.js` | not tried | PR-AV |

All 22 patches except P12's `.github` hunks, P05 and P06 cherry-pick cleanly.
A stack of every patch except P05 and P06, with P12 limited to `crates/`, also applies cleanly in sequence on `1fd8ca2ae`.

## Proposed upstream PRs

Ordered by value and independence. Each PR carries its patches' tests.

1. **PR-A ELF `.init_array` startup registration** (P12). Without it no startup registration runs on Linux: `new Function` is refused and the dyn-eval, regex, url and temporal engines are never installed. Prerequisite: none. Send only the `crates/perry-codegen/src/stubs.rs` hunk; drop the `.github/supa` hunks.
2. **PR-B `class X extends http.Agent` keeps its own instance and `options`** (P17, P19). Makes agentkeepalive-style subclasses work. Prerequisite: none; P19 needs P17.
3. **PR-C `IncomingMessage.pipe` on the server request** (P21, P22). `req.pipe(dest)` forwarded nothing and left the request hanging. Squash P22 into P21: P22 is the entry-point fix the P21 test needs. Prerequisite: none.
4. **PR-D `stream.pipeline` into an `fs.createWriteStream`** (P20). Every upload through `pipeline(src, fs.createWriteStream(path))` threw `ERR_INVALID_ARG_TYPE`. Prerequisite: none.
5. **PR-E `require()` of an ES module package returns its namespace** (P14). Matches Node 22 require(esm) for packages with named exports plus `export default`. Prerequisite: none.
6. **PR-F Unique module names outside the entry directory** (P16). Superseded by upstream `c1671d39d`; do not send. Tagged-template call-site ids collided across same-named `index.js` files in `node_modules`. Prerequisite: none.
7. **PR-G Bare TypeScript enum in value position** (P10). Superseded by upstream `09e7861b4`; do not send. `Object.values(E)`, `const e = E` threw `ReferenceError`. Prerequisite: none.
8. **PR-H `new <require("undici")>.Agent(...)`** (P13). esbuild CJS output threw `undefined is not a constructor`. Prerequisite: none.
9. **PR-I Guarded class-env refresh after a later `const`** (P01). Prerequisite: none.
10. **PR-J Computed-member registration links** (P02). One-predicate fix for an undefined `..._eclo$info` symbol. Prerequisite: none.
11. **PR-K CJS module body frame carries its file path** (P11). `Error.stack` prints `at Object.<anonymous> (<path>)`. Prerequisite: none; re-run the test first because upstream `f063a7d29` reworked `Error.stack` frame walking.
12. **PR-L Regex literals in programs that use `Worker`** (P03). Prerequisite: none.
13. **PR-M `weak_odr` for promoted `linkonce_odr` helpers under codegen units** (P07). Prerequisite: none.
14. **PR-N Mark the Apple arm64 hot-TLS asm gc-leaf where emitted** (P09). Prerequisite: none.
15. **PR-O `.alt_entry` in the stack-map rewriter on Mach-O** (P04). Superseded by upstream `c4bf643f6`; do not send. Prerequisite: none.
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
30. **PR-AD (withdrawn)** `readable.pipe()` starts reading a stream that was not flowing (P47). Upstream `b0d159c8c` fixed it; see "Not proposed".
31. **PR-AE `stream.pipeline(streams..., fn)` gives the function the live stream** (P48). Prerequisite: none.
32. **PR-AF `Readable.toWeb(req)` yields the request body** (P49). Prerequisite: PR-AE for the probe's pipeline route (the roundtrip route now relies on upstream `b0d159c8c`).
33. **PR-AG `class X extends ns.X` runs the base constructor** (P50). Prerequisite: none.
34. **PR-AH `perry-gc-effects` builds on aarch64 Linux** (P51). `c_char` is `u8` there, so the disassembler buffer type must follow it. Tiny. Prerequisite: none.
35. **PR-AI `arr.some(captureless arrow)` applies the arrow's declared arity on wasm32** (P52). Prerequisite: none (the probe needs PR-R and PR-S).
36. **PR-AJ A scope group's frame root stays live until the last reference to any member** (P53). Prerequisite: none (the probe needs PR-R and PR-S).
37. **PR-AK An uncaught throw is recognised from the personality's verdicts, not the status `_Unwind_RaiseException` returns** (P54). Prerequisite: none (the probe is the existing `eh-uncaught`).
38. **PR-AL The upstream family-method tables are pointer-width aware** (P55). `PerryFamilyMethods` and its entries pin LP64 sizes, and `perry_probe_family_method` reads the shape directory's word directory at an LP64 offset. Only matters to a tree that builds the runtime for a 32-bit target (needs PR-R). Prerequisite: PR-R.
39. **PR-AM wasm32 setjmp functions keep block-crossing values in stack slots, so try/for-of code grows linearly** (P56). Prerequisite: none (the probe needs PR-R and PR-S for its GC-stress marker; the A/B size script is fork-only).
40. **PR-AN `instanceof` stops following a [[Prototype]] self link or cycle** (P57). Prerequisite: none (the probes need PR-R and PR-S).
41. **PR-AO A class-body `static [Symbol.hasInstance]` is consulted by `instanceof`** (P58). Prerequisite: upstream `152fccfa2` (the hook is a computed static member since then); the probe needs PR-R and PR-S.
42. **PR-AP `super()` into a native Error initialises the derived instance** (P59). A class that extends an Error and whose class value escapes lost its own properties and its polymorphic methods. Prerequisite: none (the probe needs PR-R and PR-S on wasm32; the logic is target-independent).
43. **PR-AQ A forward reference to a per-evaluation class declaration reads that evaluation's class** (P60). In a function body `class B extends Error` is created per evaluation, but a closure written before the declaration (esbuild's `__export(exports, { B: () => B })`) read the shared template class, whose `.prototype` differs from the evaluation's, so `instanceof`, `constructor` and prototype identity disagreed. Prerequisite: none (pre-existing at the 2026-10-18 merge).
44. **PR-AR An async arrow returning an async function that throws after an await no longer reports the inner rejection as unhandled** (P61). Prerequisite: none (the probe is self-contained).
45. **PR-AS `require("stream/promises")` `pipeline` and `finished` resolve to the promise implementations** (P62). Reading either off the CJS module value, or calling it as `mod.pipeline(...)`, went through a native-module namespace with no dispatch bucket and answered `undefined` without running any stage, so a `(0, require("stream/promises").pipeline)(src, transform, finalFn)` never ran `finalFn`. Prerequisite: none.
46. **PR-AT `node:fs` streams, `Dir` and `Dirent` have a real [[Prototype]] chain; a subclass inherits a static `Symbol.hasInstance`** (P63). Prerequisite: PR-AN is not required (the probes need PR-R and PR-S).
47. **PR-AU `Buffer.concat` follows the forwarding stub a grown list leaves behind** (P64). Prerequisite: none (the probes need PR-R and PR-S for the `// npm:` and `// network:` markers).
48. **PR-AV Copying a holey array or a plain array-like skips the per-index HasProperty when no index can be found** (P65). Prerequisite: none (the probes need PR-R and PR-S).

Not proposed: P04, P05, P06, P10, P15, P16, P47. Upstream fixed the same bugs independently (`c4bf643f6` for P04, `4ed616f5e` for P05, `79aae9aa7` for P06 and P15, `09e7861b4` for P10, `c1671d39d` for P16, `b0d159c8c` for P47); the 2026-10-18 merge took upstream's versions and kept the fork's tests as regression tests.

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
- Merge of upstream `f3d38d16d` (2026-10-19): still needed, kept as it was. `expr/static_field_meta.rs` merged without conflict; upstream `152fccfa2` ("follow live constructor and home-object heritage") changed `lower_class_evaluation_object` elsewhere in the file, and this patch's `store_first_evaluation_slot` call is intact.

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
- Merge of upstream `f3d38d16d` (2026-10-19): still needed, kept as it was. The `body_needs_explicit_method_owner` call in `lower_computed_member_registration` is intact; upstream `152fccfa2` made `lower_class_evaluation_object` define static computed members on the evaluation object as well, in another hunk of the same file.

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
- Merge of upstream `f3d38d16d` (2026-10-19): kept as it was. The `js_regexp_literal_loaded` declaration in `runtime_decls/strings.rs` sits among upstream's new `js_class_super_parent` and `js_class_super_construct_apply` declarations (`152fccfa2`) and the removal of `js_region_guard_prime` (`fabd82345`).

### P04 2d333eac4 fix(codegen): accept the zero-width .alt_entry directive in stack-map blocks
- Area / platform: codegen (gc_map) / Mach-O only (the directive is what LLVM emits on Mach-O).
- Problem: codegen failed with `unrecognised directive `.alt_entry` inside the stack-map block` for a module with GC safepoints and a literal family that gains a property after birth. ajv's `jtd-schema.js` hit it, which blocked compiling fastify.
- Root cause: the family's layout descriptor exports an `internal alias` of its `layout_id` word (`layout_desc.rs`). On Mach-O LLVM assembles an alias to `sym+offset` as `.alt_entry <alias>` plus an assignment after the stack-map block, and the rewriter refuses directives of unknown width; `.alt_entry` was missing from `is_zero_width_directive`.
- Fix: add `.alt_entry` to the zero-width list. Files: `perry-codegen/src/gc_map.rs` (1 line).
- Test: same commit, `perry/tests/layout_family_alias_stack_map.rs::family_layout_alias_with_stack_map_compiles_and_runs`.
- Upstream: cherry-pick clean. Upstream touched: none; `gc_map.rs` still has `is_zero_width_directive` without `.alt_entry`, and the `internal alias` is still emitted (`layout_desc.rs:635,673`). Also affected: likely on macOS.
- Merge of upstream `2bbab8aff` (2026-10-18): superseded. Upstream `c4bf643f6` (2026-10-17, "the stack-map rewriter knows every symbol attribute (Mach-O .alt_entry)") fixes the same rewriter bug, so the fork's `gc_map.rs` change was dropped and upstream's taken. `perry/tests/layout_family_alias_stack_map.rs` stays as a regression test. PR-O is not sent.
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
- Merge of upstream `2bbab8aff` (2026-10-18): superseded. Upstream `4ed616f5e`'s `image.rs` and `image_tests.rs` were taken; the fork's `image_string_literal_native_args.rs` integration test stays as a regression test. P32's wasm32 `bounds` was re-applied on top of upstream's check.
- Depends on: none. Not for upstream (superseded); drop at the next sync.

### P06 2f01c61c4 fix(runtime): reach the URLSearchParams probe for type-erased receivers
- Area / platform: runtime / all.
- Problem: reading a method off a type-erased URLSearchParams (for example an array element) returned `undefined`. Hit by pg-connection-string's `searchParams` use.
- Root cause: URLSearchParams is layout-born and premarked plain-ordinary, so `named_read_receiver_kind` classified it Ordinary and skipped the dynamic method probe.
- Fix: exclude the URLSearchParams layout from the Ordinary fast arm. Files: `perry-runtime/src/object/field_get_set/exotic_named_read.rs`.
- Test: same commit, `perry/tests/url_search_params_type_erased_methods.rs::type_erased_url_search_params_methods_are_callable` (runs pg-connection-string's parse and a type-erased `get()`).
- Upstream: cherry-pick CONFLICT in `exotic_named_read.rs`. Upstream fixed the same symptom in `79aae9aa7` (#12697, 2026-10-17): the URLSearchParams layout now names `%URLSearchParams.prototype%`, and `search_params_read`, its bound-method thunks and `NamedReadKind::Ordinary` are deleted. Upstream's gap test is `test-files/test_gap_12697_urlsearchparams_size_and_methods_inherited.ts`. Not in the fork.
- Merge of upstream `2bbab8aff` (2026-10-18): superseded. Upstream `79aae9aa7` deleted `search_params_read` and its thunks, so the fork's `exotic_named_read.rs` change was dropped and upstream's taken. `perry/tests/url_search_params_type_erased_methods.rs` stays as a regression test.
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
- Merge of upstream `f3d38d16d` (2026-10-19): kept as it was. The `weak_odr` header case in `dialect/mod.rs` is intact; upstream `1bda539c9` (native IR reader builds `freeze` from a rendered text line) edited the same parser in other hunks.

### P08 150fc3c39 fix(root_reload): stop declining large require closures on the cost cap
- Area / platform: codegen (root_reload) / all.
- Problem: the CJS wrapper threw `Cannot convert undefined or null to object` (Supabase Storage's semver `require` via pg-boss).
- Root cause: root_reload declines a whole function when `blocks * groups` exceeds `MAX_BLOCK_LOAD_PRODUCT` (8M), and a declined function keeps stale registers. The count included groups read only in their own builder block, and the bound was below the largest real function (28187 blocks x 570 walking groups = 16.1M). The closure derives its captured-module cell address once at entry, so after a minor GC it read a from-space copy.
- Fix: measure the cap only against groups with a use outside the root load's own block (answer unchanged, walk skipped for the rest) and raise the bound to 64M; the commit measures the walk at tens of ms. Files: `perry-codegen/src/root_reload.rs`, `root_reload_tests.rs`.
- Test: same commit, `root_reload_tests.rs::the_cap_does_not_count_groups_that_never_walk` (unit; no end-to-end repro).
- Upstream: cherry-pick clean. Upstream touched: `291142de3`. `MAX_BLOCK_LOAD_PRODUCT` is still `8_000_000` upstream (`root_reload.rs:299`). Also affected: unknown (needs a large closure and GC timing).
- Merge of upstream `2bbab8aff` (2026-10-18): adapted, no new id. Upstream `914a51a86` ("root reload past the block x load cap for entry-stored roots") added an entry-store fallback for functions over the cap, which conflicts with this patch's intent. Both are kept: the cap is measured against `walking_groups` (groups read from another block than their load), the bound is 64M (`MAX_BLOCK_LOAD_PRODUCT`), and a function over it takes upstream's fallback. The register-use index is built ahead of the cap. `root_reload_tests.rs` keeps the fork's large-closure test next to upstream's.
- Depends on: none. PR-P. The 64M value is a fork measurement; expect review discussion.
- Repro: none small; the trigger is a function with more than ~14k blocks.
- Merge of upstream `f3d38d16d` (2026-10-19): kept as it was. Upstream `0199f9921` (family-layout method lookup) added `perry_probe_family_method` to `NON_COLLECTING` in `root_reload.rs`, a one-line hunk away from the cap logic (`MAX_BLOCK_LOAD_PRODUCT` is still 64M).

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
- Merge of upstream `2bbab8aff` (2026-10-18): superseded. Upstream `09e7861b4` ("compile TypeScript from its own sources") makes enums runtime values, so the fork's `perry-hir` change (`enum_runtime_object_fields`) was dropped. `perry-hir/tests/enum_as_value_lowering.rs` stays and passes on upstream's lowering. PR-G is not sent.
- Depends on: none. PR-G.
- Repro: `enum S { A = "a", B = "b" }; console.log(Object.values(S));` (expected `[ 'a', 'b' ]`).

### P11 066f57f15 fix(hir): label a CommonJS module body frame with its file path
- Area / platform: hir + runtime / all.
- Problem: `Error.stack` printed `at __perry_cjs_factory (<anonymous>)` where Node prints `at Object.<anonymous> (/abs/file.js:L:C)`. fastify-plugin derives an anonymous plugin's name from the path in the caller's frame, and `match(fileNamePattern)[1]` threw `Cannot convert undefined or null to object`, aborting Storage at startup.
- Root cause: the factory's registered display name carried no file location.
- Fix: the factory's display name is `Object.<anonymous> (<source path>)` (set where the nested declaration lowers) and the frame renderer prints a name that already carries a location verbatim instead of appending `(<anonymous>)`. Line and column are still not provided. Files: `perry-hir/src/lower_decl/body_stmt/nested_fn_decl.rs`, `perry-runtime/src/error_stack_frames.rs`.
- Test: same commit, `perry-hir/tests/cjs_factory_frame_label.rs::the_module_body_frame_is_labelled_with_the_module_path` and `error_stack_frames.rs::a_module_body_frame_renders_its_own_location`.
- Upstream: cherry-pick clean. Upstream touched: `f063a7d29` ("Error.stack walks runtime frames by unwind table"), which edits `error_stack_frames.rs`; the merge is textually clean but the new frame walker may change what the test sees, so re-run it. Also affected: likely.
- Merge of upstream `2bbab8aff` (2026-10-18): adapted, no new id. The hir and `render_frames` hunks merged as they were; the unit test `a_module_body_frame_renders_its_own_location` now calls `render_frames(blob, RENDER_LIMIT)`, the signature upstream `f063a7d29` introduced.
- Depends on: none. PR-K.
- Repro: in a CommonJS module, `console.log(new Error().stack)`; the top-level frame should read `Object.<anonymous> (<abs path>)`.

### P12 5e1f3ee20 fix(codegen): register startup stubs through .init_array on ELF
- Area / platform: codegen (stubs) / ELF only (Linux; the commit names glibc on aarch64, the tests build x86_64 and aarch64 objects). Mach-O and COFF keep `@llvm.global_ctors`.
- Problem: neither the feature-installer unit nor the static-shape-seed unit registered on Linux. `js_runtime_install_compiled` (dyn-eval, regex, url, temporal engines) was skipped and `new Function` threw `dynamic Function refused (AOT, dyn-eval feature off)`.
- Root cause: both units registered via `@llvm.global_ctors`; the in-process TargetMachine is built with `UseInitArray=false`, so on ELF LLVM lowered it to the legacy `.ctors` section, which glibc on aarch64 never runs.
- Fix: on ELF targets emit a pointer in `.init_array` (global so the section is writable, kept alive through `@llvm.used`). Files: `perry-codegen/src/stubs.rs`. The commit also changed `.github/supa/probes.sh` and `regressions.sh` (fork CI only; not for upstream).
- Test: same commit, unit tests in `stubs.rs`: `elf_startup_registration_lands_in_init_array` (both units, aarch64 and x86_64 ELF sections) and `non_elf_startup_registration_keeps_global_ctors`.
- Upstream: cherry-pick conflicts only in the two `.github/supa` files (they do not exist upstream); the `stubs.rs` hunk applies clean, including over upstream `37a30b076`, which adds a `registrations` parameter to the same file. Upstream `stubs.rs` still emits `@llvm.global_ctors` (lines 209 and 322) and `perry-codegen` has no `.init_array` handling. Also affected: yes. We verified upstream's Fastify README example fails on Linux without this patch (task brief; the fork CI probes `fastify-readme.js` and `fastify-npm.js` exercise it).
- Merge of upstream `2bbab8aff` (2026-10-18): adapted, no new id. `stubs.rs` merged over upstream `37a30b076` and `bc84a76f0`; the unit test `elf_startup_registration_lands_in_init_array` passes the new `registrations` argument of `generate_feature_installer_object` (`&[]`).
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
- Merge of upstream `2bbab8aff` (2026-10-18): superseded together with P06 (upstream `79aae9aa7`): the probe mechanism this patch adjusted no longer exists (URLSearchParams is born on an ordinary layout and its methods come from its prototype), so its change and its unit test `unknown_receiver_probe_declines_url_search_params_but_not_ordinary_objects` were dropped. P06's integration test covers the behavior.
- Depends on: P06 (same symptom, same fix family). Not for upstream (superseded).

### P16 5ee46bdb0 fix(compile): lower modules outside the entry directory under a unique name
- Area / platform: compile (collect_modules) / all.
- Problem: in Storage ajv's `_`!${x}`` received the strings of a parameter destructuring, generated validator source read `if({(...)="", ){`, and the draft-07 meta schema compile threw. That aborted fastify's preReady hook loop and left later routes without hook arrays.
- Root cause: collection names a module by its path below the entry directory and fell back to the bare file name otherwise, so every `index.js` under `node_modules` shared a name. The per-module salt for tagged-template call-site ids derives from that name, so the first tagged template of two such modules collided.
- Fix: name such modules by their path relative to the entry directory with `..` segments (unique, independent of checkout location). Files: `perry/src/commands/compile/collect_modules.rs`, `collect_modules_helpers.rs` (`collection_module_name`).
- Test: same commit, `perry/tests/tagged_template_sites_outside_entry_dir.rs::first_tagged_template_of_same_named_modules_outside_the_entry_dir_stays_distinct`.
- Upstream: cherry-pick clean. Upstream touched: `790ac5eea`. Upstream `collect_modules.rs` still falls back to the bare `file_name()`. Also affected: likely.
- Merge of upstream `2bbab8aff` (2026-10-18): superseded. Upstream `c1671d39d` (2026-10-18, "preserve external module identities before lowering") fixes the same collision, so the fork's `collect_modules.rs` change (and its now-unused `PathBuf` import in `collect_modules_helpers.rs`) was dropped. `perry/tests/tagged_template_sites_outside_entry_dir.rs` stays as a regression test. PR-F is not sent.
- Depends on: none. PR-F.
- Repro: entry `src/main.js` importing `../lib/a/index.js` and `../lib/b/index.js`, each exporting a different tagged template result such as ``tag`alpha-${1}-end` ``; the second prints the first's strings.

### P17 15c3bb6b7 fix(runtime): keep subclasses of http.Agent as their own instances
- Area / platform: runtime / all.
- Problem: a subclass of `http.Agent` reached through a local alias lost its prototype methods and field writes: `getCurrentStatus()` read back `undefined` and Storage's agent metrics timer threw (agentkeepalive's `OriginalAgent`).
- Root cause: `super()` in a class extending the bound `http.Agent` export ran it as an ordinary call, building a native agent handle that the derived constructor returned instead of the subclass instance.
- Fix: construct the agent through the http dispatcher up front and alias the subclass instance to the handle, as `http.ServerResponse` already is. Files: `perry-runtime/src/object/native_this_alias.rs`.
- Test: same commit, `perry/tests/http_agent_subclass_keeps_its_own_surface.rs::two_level_subclass_of_aliased_http_agent_keeps_methods_and_fields`.
- Upstream: cherry-pick clean. Upstream touched: none. Also affected: likely.
- Merge of upstream `2bbab8aff` (2026-10-18): adapted, no new id. Upstream `e7476115a` moved the http native classes onto static layouts and removed the by-name alias fallback; `native_this_alias.rs` was re-applied on upstream's version with `Agent` joining the bound exports that reach `super(...)` (see P19 for the options record).
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
- Merge of upstream `2bbab8aff` (2026-10-18): adapted, no new id. The `compile_env.rs` entry was dropped because upstream retired `COMPILE_ENV_EXCLUSIONS`; the runtime knob is unchanged.
- Judgement: generally useful and small; it follows the existing `PERRY_TRACE_*` pattern, so propose it upstream as a separate low-priority PR.
- Depends on: none. PR-Q.

### P19 8fe4deaf2 fix(runtime): give http.Agent subclass instances Node's options record
- Area / platform: runtime / all.
- Problem: agentkeepalive's `HttpsAgent` reads `this.options.maxCachedSessions` and keeps its timeouts there; `this.options` was `undefined`, so the agent never finished constructing.
- Root cause: the subclass instance is aliased to a native agent handle that exposes `sockets`, `freeSockets`, `requests` and data properties but has no `options` record. Node's constructor stores `this.options` (noDelay defaults to true, path forced to null).
- Fix: install an own `options` object on the instance after the native handle is constructed, copied from the constructor arguments (`install_agent_options`). Files: `perry-runtime/src/object/native_this_alias.rs`.
- Test: same commit, `http_agent_subclass_keeps_its_own_surface.rs::subclass_of_aliased_http_agent_exposes_node_options_and_socket_tables`.
- Upstream: cherry-pick alone conflicts in the test file (created by P17); clean after P17. Upstream touched: none. Also affected: likely.
- Merge of upstream `2bbab8aff` (2026-10-18): adapted with P17. `install_agent_options` lives in the re-applied `native_this_alias.rs`.
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
- Merge of upstream `f3d38d16d` (2026-10-19): kept as it was. Upstream `5d49df9a2` ("honor pipe destination and digest listener protocols") routes pipe destinations that are not classic stream instances through their own `write` and `end` in `node_stream_pipe_dests.rs`. This patch's fs-write-stream branch of `end_pipe_destinations` still runs ahead of that routing; `pipeline_into_fs_write_stream` stays in `regressions.sh` and passed on the merged tree.

### P21 286f4ae58 fix(http): pipe a server request's buffered body into its destination
- Area / platform: perry-ext-http / all.
- Problem: `req.pipe(dest)` on a server request moved no bytes, never ended `dest`, and returned `undefined`. Storage's `req.raw.pipe(new PassThrough())` plus `stream.pipeline(proxy, fs.createWriteStream(file))` therefore hung: `POST /object/...` timed out on the client.
- Root cause: the server `IncomingMessage` method dispatch knew `on`, `pause`, `resume`, `setEncoding` and a few others but no `pipe`, so it fell to the default arm. Only the client `IncomingMessage` implemented `pipe`.
- Fix: the handler runs once the body is buffered, so `pipe` writes the buffered body to `dest` as one chunk (honouring `setEncoding`), ends `dest` unless `options.end` is false, and returns `dest`; a body already delivered to a `data` listener is not sent twice; `pipe` is listed as a method of the request. Files: `perry-ext-http/src/client_events.rs`, `server/handle_dispatch.rs`, `server/request.rs`.
- Test: same commit, `perry/tests/incoming_message_pipe.rs::server_request_pipe_forwards_body_and_returns_dest`. This test only passes with P22.
- Upstream: cherry-pick clean. Upstream touched: none; `is_incoming_message_member` upstream has no `pipe`. Also affected: likely.
- Depends on: P22 for the test to pass. PR-C (squash with P22).
- Repro: `http.createServer((req, res) => { const p = new PassThrough(); const ret = req.pipe(p); ... })`, POST a body, expect `ret === p` and the body on `p` (full source in the test).
- Merge of upstream `f3d38d16d` (2026-10-19): kept as it was. Upstream `5d64ee58e` ("Enter HTTP response operations through per-method prototype bodies") moved the response dispatch (`setHeader`, `writeHead`, `write`, ...) in `perry-ext-http/src/server/handle_dispatch.rs` into `server/response_methods.rs`; the request-side `pipe` entry this patch added is not part of it. `incoming_message_pipe` stays in `regressions.sh` and passed on the merged tree.

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
- Merge of upstream `2bbab8aff` (2026-10-18): adapted, no new id. Upstream changed `PerryLayoutDesc.proto` to `*const PerryProtoFamily` and moved layouts, atoms and image ranges behind `static_registry.rs`; the wasm `.init_array` constructors and the ILP32 `BandDir` offsets (`FLAT_IDS_OFFSET`, `PROTO_CELL_OFFSET`, `WORD_DIR_OFFSET` in `shapes_store.rs`, used by `layout_probe.rs`) were re-applied on that layout.
- Merge of upstream `f3d38d16d` (2026-10-19): adapted, no new id. Upstream `0199f9921` ("answer unknown method calls from family layouts") added a `methods` pointer to `PerryLayoutDesc` (LP64 size 64 to 72, `class_id` at 56; the ILP32 sizes 56 and 44 are unchanged because the pointer fits existing padding), the `PerryFamilyMethods` tables and `perry_probe_family_method`. The conflict in `layout_desc.rs` was resolved by keeping this patch's pointer-width-aware asserts with the new LP64 values. `layout_probe.rs` already reads the shape directory at the `shapes_store` offsets (`FLAT_BASE_OFFSET`, `FLAT_IDS_OFFSET`, `PROTO_CELL_OFFSET`, `WORD_DIR_OFFSET`). The new method-table code did not, and is fixed by P55. wasm32 codegen emits no layout descriptors, so the family tables are null there and the lookup answers 0 (ordinary dispatch).

### P24 bd6269a6b fix(runtime): make the wasm32 runtime compile for wasip1
- Area / platform: runtime, updater / wasm32.
- Problem: `perry-runtime` did not build for `wasm32-wasip1`.
- Root cause: unix-only or pointer-width-dependent code (tty input, process streams, the net turnloop ABI, the thread pool) compiled unconditionally; the commit message records no detail.
- Fix: cfg-gated stubs and a wasm pool (`turnloop_pool_wasm.rs`), plus `wasi_net` transport scaffolding; 20 files.
- Test: the wasip1 runtime build in `wasi-linux`.
- Upstream: not cherry-picked. Depends on: none. PR-R.
- Merge of upstream `2bbab8aff` (2026-10-18): partly absorbed. Upstream turned the `mod-*` cargo features into runtime Hook slots (`module_hooks.rs`) and gates `dgram` and `dgram_reactor` on `not(target_arch = "wasm32")`, so the fork's `not(target_os = "wasi")` cfgs on them were dropped. `socket2` stays in the non-wasi dependency table and `turnloop_pool_wasm.rs` is unchanged.

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
- Merge of upstream `2bbab8aff` (2026-10-18): adapted, no new id. Upstream added the same `addr >= 1 << 47` check at three sites in the new `object/builtin_method.rs`; the wasm32 release build failed with `arithmetic_overflow` there, so they compare as `u64` too.

### P27 2f4a2a4f4 feat(compile): add a wasip1 target that links a WASI preview1 core module
- Area / platform: compile, codegen / wasm32.
- Problem: no way to produce a module that runs on a WASI preview1 host.
- Fix: `--target wasip1` reuses the wasm32 lowering and the wasi link with the `wasm32-wasip1` triple, wasi-sdk's p1 sysroot and no `cabi_realloc` export; `scripts/wasi_build_runtime.sh` takes the runtime target. Docs in `docs/WASI_SUPPORT.md`.
- Test: wasi probes compared against node.
- Upstream: not cherry-picked. Depends on: P23-P26. PR-S.
- Merge of upstream `2bbab8aff` (2026-10-18): adapted, no new id. Upstream's `native_link_set_skipped` in `run_pipeline.rs` (no native link set, so no runtime-archive effects sidecar, `Undescribed` table) named only the preview2 `wasi` target; it now also covers `wasip1`, which links the wasm32 archive after codegen the same way.

### P28 9e0beba53 fix(codegen): regenerate the wasm32 runtime ABI table, which had drifted from the runtime
- Area / platform: codegen (wasm32) / wasm32.
- Problem: `wasm32/runtime_abi.tsv` no longer matched the runtime's entry points, so wasm calls were declared with the wrong widths.
- Fix: regenerated with `scripts/runtime_abi_check.py`.
- Test: `scripts/runtime_abi_check.py`.
- Upstream: not cherry-picked; the table churns, so regenerate on the upstream base instead of cherry-picking. Depends on: none. PR-S.
- Merge of upstream `2bbab8aff` (2026-10-18): `runtime_abi.tsv` was not merged by hand. It was regenerated on the merged tree with `scripts/runtime_abi_check.py --emit-wasm-abi` (5199 symbols) and checked with `--check-wasm-abi`.
- Merge of upstream `f3d38d16d` (2026-10-19): `runtime_abi.tsv` conflicted again and was regenerated on the merged tree with `scripts/runtime_abi_check.py --emit-wasm-abi` (5202 symbols). Added: `js_class_super_construct_apply`, `js_class_super_parent`, `js_node_http_method_fallback`, `js_node_http_response_layout_receiver`, `perry_probe_family_method`. Removed: `js_region_guard_pack`, `js_region_guard_prime`.

### P29 c546aab14 fix(codegen): cover macro-defined runtime entry points in the wasm32 ABI table
- Area / platform: codegen (wasm32), scripts / wasm32.
- Problem: the ABI check could not see entry points defined by macros (`closure_call_entry!`, `kind_entry!`, the array/string prototype entry macros), so rows for them were missing (222 added).
- Fix: `scan_macro_entries` in `scripts/runtime_abi_check.py` reads each macro family's fixed shape, and the table gains the rows.
- Test: `scripts/runtime_abi_check.py`.
- Upstream: not cherry-picked. Depends on: P28. PR-S.
- Merge of upstream `2bbab8aff` (2026-10-18): covered by the P28 regeneration.
- Merge of upstream `f3d38d16d` (2026-10-19): covered by the P28 regeneration.

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
- Merge of upstream `2bbab8aff` (2026-10-18): adapted, no new id. The wasi block of `run_pipeline.rs` passes `&[]` for the new `registrations` argument of `generate_feature_installer_object`; `scripts/wasi_build_runtime.py` keeps the `{"alloc-mimalloc"}` exclusion and the `external-*-pump` stdlib features. Upstream's `FeatureInstalls::Selected` derives the stdlib half of the installer from the program's imports and marks the `external-*-pump` features `Compiled`, which `generate_feature_installer_object` skips; the wasip1 bundle links those pumps, so `require('node:zlib')` returned undefined in the CI-built Storage module. `crates/perry/src/commands/stdlib_installs.rs` now has `WASIP1_STDLIB_FEATURES` and `wasip1_stdlib_installs()` (the stdlib half for the wasip1 target) and `run_pipeline.rs` uses it for the wasi block.

### P32 0dac0c454 fix(runtime): admit program-emitted image strings on wasm32
- Area / platform: runtime / wasm32.
- Problem: string readers that validate headers (`path.*`, `URLSearchParams`, fs paths) rejected every string literal.
- Root cause: literals emitted by codegen live in static data, but only the runtime's own strings were registered as image strings.
- Fix: bound the candidate range by `__data_end`; the header validation is unchanged. File: `value/addr_class/image.rs`.
- Test: wasi probes `path-url-util-os`, `fs`.
- Upstream: not cherry-picked. Depends on: P23. PR-R.
- Merge of upstream `2bbab8aff` (2026-10-18): adapted, no new id. Re-applied on upstream `4ed616f5e`'s image check (the atom-hash trailer): `bounds(addr)` asks `static_registry::image_range` first and then falls back to `__data_end` on wasm.

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
- Merge of upstream `2bbab8aff` (2026-10-18): adapted, no new id. Upstream's `node_stream/proto_methods.rs` became a slot table; the fix is `Slot::EndEmitted` there instead of a new method entry.
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
- Merge of upstream `2bbab8aff` (2026-10-18): adapted, no new id. Upstream moved stdlib-module detection into `collect_modules/source_prep.rs` (`PreparedSource`); `uses_dns` is computed there and OR'd into the context in `collect_modules.rs`, next to the import-based check.
- Not covered: instance methods of `new dns.Resolver()` reached through a CommonJS namespace were not re-tested.

### P46 19c26c6a9 fix(hir): construct the global when a program class shares a name with a globalThis alias
- Area / platform: hir / all targets; seen on wasm32-wasip1.
- Problem: Storage's resumable upload endpoint (`POST /upload/resumable`) answered 500 `TypeError: append is not a function`. srvx's node adapter keeps `const NativeHeaders = globalThis.Headers` and declares its own `class Headers` that wraps a lazily built native one; reading the first request header ran `new NativeHeaders()`.
- Root cause: HIR records `const X = globalThis.Y` as a let-class alias (`let_class_aliases`, keyed by name) and lowers `new X()` to `Expr::New { class_name: "Y" }`. Codegen resolves that class by string, so a program class named `Y` declared in the same module captured the construction: `new NativeHeaders()` built the program's `Headers`, an object without `append`.
- Fix: `LoweringContext::global_class_aliases` marks the aliases whose initializer is a `globalThis` read (`register_global_class_alias`, used by the three destructuring paths and the `PropertyGet` arm in `alias_tracking.rs`; `register_let_class_alias` clears the mark when a name is rebound). `lower_new` lowers `new Alias()` to `global_property_new_dynamic` when the alias is such a global and the program also binds that global's name, so the value on `globalThis` is constructed. Files: `perry-hir/src/lower/{lowering_context,context_new,context,expr_new}.rs`, `perry-hir/src/destructuring/{pattern_binding,var_decl/alias_tracking}.rs`.
- Test: wasi probe `.github/supa/wasi-probes/headers-global-alias.js` (fails with `append is not a function` before the fix, matches node after); port to `crates/perry/tests` for upstream.
- Not covered: `new Wrapped.Headers()` (a member callee whose property is named like a global) still builds the native class, a separate bug found while writing the probe.
- Upstream: not cherry-picked. Depends on: none. PR-AC.
- Merge of upstream `2bbab8aff` (2026-10-18): still needed, kept as it was (the hir files merged without conflict). The upstream commits `3bc9b5492` (IncomingMessage explicit receivers) and `3ab9e5fa4` (native inits on user subclasses) do not touch how `new Alias()` resolves its class. Checked on CI (wasi-linux, experiment branches off the merge without this fix and with it): the probe `headers-global-alias.js` exits 1 without the fix and matches node with it.
- Merge of upstream `f3d38d16d` (2026-10-19): still needed, kept as it was. Upstream `dc081fd0c` ("construct evaluated classes through their lexical bindings") changed which local `lower_new` looks up for a per-evaluation class declaration (`expr_new.rs`); it does not touch how `new Alias()` resolves a global alias, and the merge was textually clean. `headers-global-alias.js` ran in `wasi-linux` on the merged tree.

### P47 bea2d51cb fix(runtime): start reading when a readable that is not flowing is piped
- Area / platform: runtime node:stream / all targets; seen on wasm32-wasip1.
- Problem: `Readable.fromWeb(webStream).pipe(dest)` never delivered a byte and never ended; @tus/server pipes the request body this way (`Readable.fromWeb(body).pipe(PassThrough)`), so a TUS PATCH stored nothing.
- Root cause: `pipe_stream_to_destination` attached the destination, flushed already buffered chunks and marked the source flowing, but never called `_read`. Only `on('data')` scheduled a read (`schedule_readable_resume`). A stream whose data is produced by `_read` (fromWeb pulls its web source there) therefore sat idle with nothing buffered. Node's `pipe` calls `src.resume()` when the source is not flowing, which reads.
- Fix: `pipe_stream_to_destination` schedules `invoke_read_once` in a microtask (`schedule_read_after_pipe`), as resume's flow does, skipped when the stream was destroyed, paused again or has no destination left by then. The unit test `pipe_cleanup_does_not_swallow_destination_error` now gives its source a `read()`, since a bare Readable raises `ERR_METHOD_NOT_IMPLEMENTED` once a pipe reads it, as in Node. File: `perry-runtime/src/node_stream_readwrite.rs`.
- Test: wasi probe `.github/supa/wasi-probes/stream-pipe-starts-read.js` (fromWeb piped into a Writable and into a PassThrough; times out before the fix, prints 1500 for both after); port to `crates/perry/tests` for upstream. The probe carries `// network: yes` because a program naming the global `ReadableStream` links the net imports (pre-existing, independent of this fix).
- Not covered: the event order of `pipe` ('pause'/'close' relative to 'end') differs from Node, and a Readable whose `read()` pushes lazily still gets `_read` called once only (`hidden_read_invoked_key` is never reset on push).
- Upstream: not cherry-picked. Depends on: none. PR-AD.
- Merge of upstream `2bbab8aff` (2026-10-18): superseded. Upstream `b0d159c8c` ("a Readable with a _read hook keeps reading, in node's order") makes `pipe` start the read itself, in Node's order, so the fork's `schedule_read_after_pipe` was dropped from `node_stream_readwrite.rs` (and its unit-test `read()` stub). The probe `stream-pipe-starts-read.js` stays as a regression test and passes on the merged tree.

### P48 19f404e40 fix(runtime): hand a live stream to the function stage of stream.pipeline
- Area / platform: runtime node:stream / all targets; seen on wasm32-wasip1.
- Problem: `await streamP.pipeline(passThrough, transform, async (source) => { for await (const c of source) ... })` returned the result of an empty source whenever the data reached the first stream after the pipeline started (a request body piped in, a write from a timer or a microtask). @tus/server's `writeToStore` is this shape, so every TUS PATCH reported `Upload-Offset: 0`.
- Root cause: a pipeline with a function stage takes the 'collected' path (`run_collected_pipeline`): it collects the first stage's chunks once at the start and passes that array, as a `Readable.from`, to the function. With nothing buffered yet the function got an empty stream.
- Fix: when every stage before a final function stage is a stream and the first has nothing buffered, is not ended and has no source iterator, `run_live_stream_to_function_pipeline` wires the streams end to end (`wire_pipeline_pair`, a source error destroys the stream the function reads), starts them, and passes the last stream itself to the function; the function's promise is settled by the existing pump. Other pipelines keep the collected path. File: `perry-runtime/src/node_stream_pipeline.rs`.
- Test: wasi probe `.github/supa/wasi-probes/stream-pipeline-live-source.js` (a piped source, a timer write, a microtask write, a transform as first stage; each prints 0 before the fix and 1500 after, as node does); port to `crates/perry/tests` for upstream.
- Not covered: the collected path still snapshots a first stream that already holds data, and chunk boundaries can differ from Node (Node's `read()` coalesces everything buffered; the probe sums lengths). The settling pump blocks the caller until the function's promise resolves.
- Upstream: not cherry-picked. Depends on: none. PR-AE.
- Merge of upstream `2bbab8aff` (2026-10-18): still needed, kept as it was. On a merge tree that has `b0d159c8c` but not this fix, the probe `stream-pipeline-live-source.js` still differs from node (checked on CI) while `stream-pipe-starts-read.js` passes, so `b0d159c8c` does not cover this path and `run_live_stream_to_function_pipeline` stays.

### P49 32943d82a fix(runtime): read an http request through Readable.toWeb with the request's own read()
- Area / platform: runtime node:stream / all targets; seen on wasm32-wasip1.
- Problem: `Readable.toWeb(req)` for a server `IncomingMessage` produced a web stream that closed at once with no data. srvx's node adapter builds a fetch `Request` body this way, so Storage handlers (TUS resumable uploads) saw an empty body.
- Root cause: the web adapter's pull step read the node stream through the node:stream hidden buffer (`read_stream_with_size_arg`). A server request is a bare native handle with no such state, so the read returned null and the adapter closed the web stream. The handle exposes its own `read()` (the whole body on the first call, then null) and `destroy()`.
- Fix: `node_to_web_readable_pull` calls the handle's `read()` when the source is a bare handle (`is_bare_handle_value`: HANDLE_TAG, not a stream-id band) and closes the controller when it returns null; `node_to_web_readable_cancel` destroys the handle through `destroy_foreign_readable`. File: `perry-runtime/src/node_stream_constructors/web_adapter.rs`.
- Test: wasi probe `.github/supa/wasi-probes/http-request-to-web.js` (server probe: a 300 kB POST read with the web reader, through `fromWeb(toWeb(req)).pipe(PassThrough)`, and through that plus `pipeline(proxy, transform, async fn)`; before the fixes P47-P49 the routes answer 0 or hang, after they match node); port to `crates/perry/tests` for upstream. Runs under supa-host with `--listen 127.0.0.1:18323`.
- Not covered: the CommonJS spelling `const { Readable } = require('node:stream'); Readable.toWeb(x)` goes through the method-value fallback, which returns a plain object rather than a ReadableStream; a `for await` over `Readable.fromWeb(...)` repeats the last chunk; `push(Uint8Array)` into a non-object-mode Readable yields a Uint8Array, not a Buffer.
- Upstream: not cherry-picked. Depends on: PR-AD, PR-AE for the probe's roundtrip and pipeline routes. PR-AF.
- Merge of upstream `2bbab8aff` (2026-10-18): still needed, kept as it was. Neither `3bc9b5492` ("initialize IncomingMessage explicit receivers") nor `b0d159c8c` covers it: on a merge tree without this fix the probe `http-request-to-web.js` still differs from node (checked on CI).

### P50 a5ffa98e1 fix(hir): extend the member a class heritage names when it shares the class's name
- Area / platform: HIR class lowering / all targets; seen on wasm32-wasip1.
- Problem: `class FileStore extends import_file_store.FileStore` (Storage's tus store, esbuild-style CommonJS interop) was lowered without a parent. The base constructor never ran, so `this.configstore`, `this.directory` and the other base fields were undefined and `POST /upload/resumable` failed with `Cannot read properties of undefined (reading 'set')`.
- Root cause: a member heritage is resolved by its trailing property name, and when that name equals the subclass's own name (issue 4908: `class Agent extends http.Agent`) the lookup finds the subclass itself, so the lowering left the class parentless. That is right for a native-module member but wrong when the object is a value the program binds.
- Fix: when the heritage object is neither a native-module binding nor a global-object alias (`member_heritage_object_is_program_value`), the colliding-name case lowers the heritage expression as the dynamic parent (`extends_expr`), with no static name or link, so `super()` runs the evaluated member's constructor. Native-module and global-alias members keep the parentless handling. Files: `perry-hir/src/lower_decl/class_decl.rs`, `class_decl/class_heritage.rs`.
- Test: wasi probe `.github/supa/wasi-probes/class-extends-same-name-member.js` (subclass of `@tus/file-store`'s `FileStore` named `FileStore`; before: `instanceof` false, base fields undefined, `hasExtension is not a function`; after: matches node); port to `crates/perry/tests` for upstream.
- Not covered: a base class and a same-named subclass in the SAME module (for example an IIFE-local base and a top-level subclass) still collide on the by-name class tables in codegen (`class_ids`), and `super()` fails with `Class constructor X cannot be invoked without 'new'`.
- Upstream: not cherry-picked. Depends on: none. PR-AG.
- Merge of upstream `2bbab8aff` (2026-10-18): still needed, kept as it was (the class_decl files merged without conflict). Upstream's canonical-class and IIFE series (`d7918a6d6`, "Cover overridable IIFE call evaluating a class twice", and its neighbours) is in the merge, and the probe `class-extends-same-name-member.js` still differs from node without the fix (checked on CI). The gap listed under "Not covered" is still open: the probes `class-iife-base-same-name` (an IIFE-local base and a same-named top-level subclass) and `cbp1` to `cbp4` fail with and without the fork's fixes on the merged tree, so upstream's series does not close them either.
- Merge of upstream `f3d38d16d` (2026-10-19): still needed, kept as it was. Upstream `152fccfa2` and `dc081fd0c` touch the same files (`class_decl.rs` re-exports `lower_class_heritage_expr`, which became `pub(crate)`); `member_heritage_object_is_program_value` and its call site are intact and the merge was textually clean. `class-extends-same-name-member.js` passed in `wasi-linux` on the merged tree. The gap under "Not covered" is unchanged.

### P51 a45195e98 fix(gc-effects): size the disassembler output buffer with c_char
- Area / platform: gc-effects (`perry-gc-effects/src/archive.rs`) / aarch64 Linux (compile error); other targets unaffected.
- Problem: upstream's `perry-gc-effects` does not compile on aarch64 Linux (the fork's CI runner): `Disassembler::instruction` hands LLVM's disassembler C API a `[0i8; 1024]` output buffer, and `c_char` is `u8` on aarch64 Linux, so the call does not type-check. `build-perry` failed on the first merge run because of it.
- Root cause: the buffer type spelled the platform's `c_char` as `i8`.
- Fix: the buffer is `[0 as std::ffi::c_char; 1024]`.
- Test: none of its own; the compiler's build on aarch64 Linux (`build-perry` in the fork's CI) is the check.
- Upstream: not cherry-picked (written on top of the 2026-10-18 merge). Depends on: none. PR-AH.

### P52 7eb0760bd fix(wasm32): call a captureless some() callback at its declared arity
- Area / platform: runtime array iteration (`perry-runtime/src/array/iter_methods.rs`) / wasm32-wasip1.
- Problem: the merged Storage module trapped at startup with "indirect call type mismatch" inside `js_array_some_captureless` (Storage's route matcher calls `routes.some(captureless arrow)`).
- Root cause: upstream lowers `arr.some(capturelessArrow)` to an inline loop and falls back to the runtime helper `js_array_some_captureless` for receivers the loop does not admit. The helper's loop calls the arrow's body with the element, the index and the array whatever it declares, relying on a native call being safe when over-applied. WebAssembly checks the type of every indirect call, so a body declaring one parameter trapped when called with three. Closure dispatch (`closure/registry.rs::dispatch_with_arity`) applies the declared arity.
- Fix: on wasm32 (`cfg!(target_os = "wasi")`) the helper takes the generic path (`js_closure_alloc_singleton` + `js_array_some`) for every receiver, as it already did for typed arrays and buffers. Native keeps the loop.
- Test: wasi probe `.github/supa/wasi-probes/array-some-callback-arity.js` (an accessor array, holes, an element on `Array.prototype`, arrows of zero to three parameters, a route table; traps before the fix, matches node after); port to `crates/perry/tests` for upstream.
- Not covered: other helpers that over-apply a body on a native-only loop were not audited (`js_array_some_captureless` was the only one the Storage smoke reached).
- Upstream: not cherry-picked (written on top of the 2026-10-18 merge). Depends on: none. PR-AI.

### P53 fc6a4b86c fix(codegen): keep a scope group's frame root live until its last member reference
- Area / platform: codegen shadow-slot lifetimes (`perry-codegen/src/collectors/shadow_slots.rs`, `collect_shadow_slot_clear_points`, called from `codegen/{function,method,method_static,closure,entry,entry/module_init,helpers}.rs`) / shadow slots on every target; the failure was observed on wasm32-wasip1.
- Problem: the merged Storage module did not start under the default GC settings. A trace of the trap put it in `js_object_get_field_nonptr`, called from ajv's `properties` code generator (`properties.code`), on an object whose block had been retired by a moving collection. It reproduced with the default nursery and disappeared with `PERRY_GC_MOVING_LOOP_POLLS=0` or a huge nursery.
- Root cause: bindings a closure captures and someone mutates are grouped into one heap scope object (`scope_env`), and the defining frame keeps ONE root for the group, the first member's shadow slot (`compact_root_slots` drops the other members' slots). Every member is read and written through that root. `collect_shadow_slot_clear_points` placed the lexical-death clear after the last statement that references the root's local, and it counted references to that local only. In ajv's function the first member (`it`) is dead before `valid`, another member, is read again; the slot was cleared (inactive, so the collector stopped rewriting the frame word), and a nursery evacuation in between left the frame on the scope object's retired copy. The code generated for that function is identical in the previous Storage module (`m9`) and the collector logic predates the merge-base, so the bug is latent in the fork head and upstream; the merged runtime changed when collections run and exposed it.
- Fix: a reference to any member of a group counts as a reference to the group's root (`ScopeMap::capture_key`). Roots are live for longer, never for less time, so no collector invariant changes; the six call sites pass `cross_module.scope_map`.
- Test: wasi probe `.github/supa/wasi-probes/scope-group-root-live.js` (a group whose first member is dead before another member is read and written after a forced evacuation, in a function, a method and a closure; expects the node output). The probe's `// wasm-env:` marker (new, `wasi-probes.sh`) hands `PERRY_GC_SCAVENGE_NURSERY_MB=1 PERRY_GC_FORCE_EVACUATE=1` to the wasm run. The Storage smoke under supa-host with default GC settings is the end-to-end check. The three ajv probes written while diagnosing it passed without the fix and were dropped.
- Upstream: not cherry-picked (written on top of the 2026-10-18 merge). Depends on: none. PR-AJ. Upstream's own tests would need a compile that reaches a moving collection with the group's first member unused; that is easiest with the probe's `PERRY_GC_*` settings.
- Merge of upstream `f3d38d16d` (2026-10-19): kept as it was. `codegen/method.rs` was changed by upstream `3ff413af5` (shared checked default-derived parent constructors) and `152fccfa2`; the `scope_map` argument this patch passes to `collect_shadow_slot_clear_points` is intact and the merge was textually clean. `scope-group-root-live.js` passed in `wasi-linux` on the merged tree, and the merged Storage module runs under supa-host with the default GC settings (job `storage-wasi-smoke`).

### P54 7f6a2b5f2 fix(runtime): classify an uncaught throw by the personality's verdicts, not _Unwind_RaiseException's status
- Area / platform: Itanium exception transport (`perry-runtime/src/eh.rs`, `exception.rs` `js_throw`) / native aarch64 Linux with glibc's libgcc (`libgcc_s`); macOS and x86_64 return the documented status.
- Problem: the native probe `eh-uncaught` (a TypeError thrown through two JS frames with no `try`, expects exit status 1 and the uncaught report) printed `perry: FATAL: exception transport failed (reason=<number>)` and aborted. The "reason" was different on every run (-1870538120, 2123750008, ...). It failed on every full probes run since the probes job first executed on this runner (2026-10-16), including the pre-merge head `add33c494` (run 39159589605) and a pure upstream baseline (`supa/upstream-baseline`, run 38911042588): it is not caused by the merge or by any fork patch (`supa/wasip1` pushes skip probes-linux, which is why it looked green).
- Root cause: `js_throw` compared the status returned by `_Unwind_RaiseException` with `_URC_END_OF_STACK` (5). A gdb session on the failing runner (probe logs of runs 38933235199 and 38944406800) showed x0 holding the address of the per-thread `_Unwind_Exception` object on return, so the status is the object pointer's low 32 bits: ASLR-dependent and never 5. libgcc's `_Unwind_RaiseException` contains the `__builtin_eh_return` install path, which shares its epilogue with the plain return, and on this build (aarch64, PAC) the return register is not reloaded. C++ never notices because `__cxa_throw` ignores the status, so no other caller exercises it. The phase-1 search itself was right: the exception was uncaught, the stack intact.
- Fix: the personality records what it concluded about the raise in progress in a per-thread cell (a handler accepted in phase 1, or an LSDA it could not decode); `raise_perry_exception` re-arms the cell before each raise. A raise that returns with no verdict ended at the outermost frame, which is the uncaught path (`raise_found_no_handler`). The returned status is kept only in the FATAL message and in the `PERRY_EH_TRACE` line, which now prints it next to the independent `_Unwind_Backtrace` verdict, so a bad status is visible in the log. A raise that returns after phase 1 accepted a handler, or after an LSDA failure, still takes the FATAL path. The wasip1 and Windows transports do not use this path (setjmp and SEH).
- Test: the existing native probe `.github/supa/probes/eh-uncaught.js` (`// expect-exit: 1`) in the probes-linux job; it is the failing case without the fix and passed with it on the first CI run (run 39172226453: `no handler in 7 frame(s); walk ended with reason 5 ... the raise returned -311891416`, the second number being the garbage status). No unit test: the broken status is only produced by the libgcc build on that runner.
- Upstream: not cherry-picked (written on top of the 2026-10-18 merge). Depends on: none. PR-AK. A candidate for upstream Perry, whose own aarch64 Linux CI would show the same failure of any uncaught-throw test.

### P55 a29271566 fix(wasm32): size the family-method tables and read the word directory at the target's width
- Area / platform: runtime object model (`perry-runtime/src/object/layout_desc/methods.rs`, `object/shapes.rs`) / wasm32-wasip1 (build break); LP64 targets unaffected.
- Problem: after the 2026-10-19 merge the wasm32 runtime did not compile: `methods.rs` (upstream `0199f9921`, "answer unknown method calls from family layouts") asserts `size_of::<PerryFamilyMethods>() == 16` and `size_of::<PerryFamilyMethod>() == 24`, which are the LP64 sizes (12 and 16 on ILP32). Past the asserts, `perry_probe_family_method` reads the word directory of the shape directory at `SHAPE_DIR_FLAT_BASE + 24`, an LP64 offset: on wasm32 the field sits at +12 and the read would have returned another word of the directory.
- Root cause: the tables spell pointers as `ptr` in codegen's IR, which LLVM lays out at the target's width, and the runtime's view of them has to follow; upstream builds the runtime for 64-bit targets only. `layout_desc.rs` already carried pointer-width-aware asserts from P23, `layout_probe.rs` the `shapes_store` offsets; the new file did neither.
- Fix: the two size asserts are pinned per pointer width (64-bit: 16 and 24; 32-bit: 12 and 16; `PerryMethodHolder` is 8 on both). The word directory is read at `shapes::WORD_DIR_OFFSET` (`offset_of!(BandDir, word_dir)`, re-exported from the private `shapes_store` as `pub(crate)`), as `layout_probe.rs` does.
- Test: none of its own. The wasm32 runtime build is the check (`cargo check -p perry-runtime-static --target wasm32-wasip1`, `wasi-linux` and `storage-wasi` in CI). The lookup is inert on wasm32 today (wasm32 codegen emits no layout descriptors, so `PerryLayoutDesc.methods` is null and `perry_probe_family_method` answers 0), so no probe reaches the corrected read; it matters once wasm32 codegen emits descriptors.
- Not covered: nothing on wasm32 reaches the corrected read today. `layouts_enabled` (`perry-codegen/src/layout_desc.rs`) is false for wasm targets, so no descriptor or family table is emitted, and `expr/method_site.rs` emits the `perry_probe_family_method` call only when the program has families. If wasm32 ever emits descriptors, that site calls the selected closure body through a code pointer (`JsBody::Pointer`), an indirect call that needs the callee retyping of P39 and the declared-arity rule of P52; neither was exercised.
- Upstream: not cherry-picked (written on top of the 2026-10-19 merge). Depends on: P23 (and PR-R). PR-AL.

### P56 (9a28f536b, ef4582580) perf(wasm32): keep block-crossing values in stack slots in setjmp functions
- Area / platform: codegen (`perry-codegen/src/inprocess/sjlj_demote.rs`, hooked in `optimize_emit.rs`) / wasm32 only (the pass is skipped for every other target).
- Problem: 181 MB (60.6%) of the code bytes of the 373.9 MB Storage module were runs of `local.get $fp; local.get $N; f64.store offset=8k`, in setjmp (`try_table`) functions: about 3,000 of 95,000 functions hold 211 MB of 314 MB body bytes and 99.3% of the store-run bytes. The cost per function was about 0.78 x calls x locals.
- Root cause: LLVM's wasm sjlj lowering (`-wasm-enable-sjlj`) turns every call of a setjmp function into an `invoke` that unwinds to one shared dispatch block, which re-enters the function after any `setjmp` call. Each re-entry edge breaks dominance for every SSA value defined before the setjmp label, so `rebuildSSA` adds a phi per value with one incoming entry per invoke, and the backend demotes each phi to a stack slot: one store per invoke per value, (calls x block-crossing values) in total. A call result that feeds a phi is the same case even inside one block: `rebuildSSA` checks dominance of a phi user against the phi's own block and an `invoke` result only dominates through its normal edge, so `%r = call ...; br %merge` with `%merge = phi [%r, %b]` makes SSA reconstruction walk every predecessor back around the longjmp cycle and leave a dead phi web behind, which is demoted to the same per-invoke stores before anything deletes it. Perry's inline property reads (slow paths that are calls merging into one phi) hit this everywhere.
- Fix: after the optimizer and before emission (so nothing promotes the slots back to SSA), every function that calls `setjmp` gets one stack slot per value that is used outside its defining block, across a `setjmp` call, or (for call results) by any phi: one store after the definition, one load before each such use (phi operands are loaded at the end of the incoming block). The slots are SSA's values written once per execution of the definition, which is what the lowering's phis carried, so a re-entry reads what it read before; with nothing left to repair the lowering adds no phis and the cost is linear. Values defined in the entry block before its first call, static allocas (hoisted to the front first), the `setjmp` result and dynamic allocas are left alone; a function with `invoke`, landing pads or funclets is skipped. Perry's GC roots are shadow-frame slots reloaded after collection points, so no SSA value was a root and a plain slot changes nothing for the collector. `PERRY_WASM_SJLJ_DEMOTE=0` disables the pass for before/after measurements; the module is verified after the pass.
- Test: wasi probe `.github/supa/wasi-probes/sjlj-live-values.js` (values live across try/catch/finally, a throw from a deep frame, loops that throw and catch each iteration, iterator `return()` on break, throw and return, destructuring, generators and async functions suspended in a try; compared with node under `PERRY_GC_SCAVENGE_NURSERY_MB=1 PERRY_GC_FORCE_EVACUATE=1 PERRY_GC_VERIFY_EVACUATION=1`). `.github/supa/sjlj-size.sh` (run by the wasi-linux job) compiles N-step try, try/finally and for-of functions with the pass off and on, prints the store counts of the function into the job summary, runs both builds under wasmtime against node, and fails if the pass does not shrink the largest try variant.
- Measured (CI run 39184714714, Storage module `aad50d3b7`): raw 373,932,969 -> 189,787,375 bytes (-49.2%), stripped 371,882,512 -> 187,736,918 (-49.5%), code section 123.8 MB, bytes in store runs of >= 4 groups about 181 MB -> 2.2 MB (7.8 MB in all store groups); 95,053 functions as before. The A/B table (run 39182096945) is linear with the pass: `try` stores 6,606 / 25,486 / 100,110 / 396,814 at N = 16 / 32 / 64 / 128 without it, 272 / 528 / 1,040 / 2,064 with it (function text 1.21 M -> 26 k lines at N = 128).
- Upstream: not cherry-picked (written on top of the 2026-10-18 merge). Depends on: none. PR-AM. Interacts with P37 (`mark_call_noinline` keeps callees from inlining into setjmp frames); P37 stays, and whether it is still needed once this lands is measured separately.

### P57 ba91cd3d5 perf(runtime): end an instanceof prototype walk at a self link or cycle
- Area / platform: `instanceof` against a non-class right operand (`ordinary_has_instance_prototype_walk_rooted`, `perry-runtime/src/object/instanceof.rs`) / all targets; measured on wasm32.
- Problem: `stream instanceof Error` and `stream instanceof Blob`, with `stream` a `node:fs` read stream, cost about 130 ms each on the arm64 CI runner (about 100 ms on x86_64). Supabase Storage's download path performs both once per response (fastify's `reply.send` and an `onSend` hook), so a 1 MB GET spent about 200 ms there against about 29 ms for an upload.
- Root cause: `js_object_get_prototype_of` returns the receiver itself for an object it cannot place on a chain; the native read stream is one (`Object.getPrototypeOf(stream) === stream`). The walk had no cycle guard and ran to its 100,000-hop cap, each hop a by-name `constructor` read. Targets that are classes with a class id answer from a registry and were not affected (`stream instanceof Base` took 0.2 us).
- Fix: the walk ends at a self link or any cycle. A self link is caught on the first hop; a longer cycle by Brent's test with one rooted tortoise re-seated at each power of two. Identities are compared, not addresses held across a call that can collect. No change for finite chains, so `Symbol.hasInstance`, bound functions, proxies and prototype mutation take the same paths as before.
- Test: wasi probe `.github/supa/wasi-probes/instanceof-matrix.js` (90 comparisons with node: classes, builtins, `Symbol.hasInstance`, prototype reassignment, bound functions, primitives, deep chains, read streams) and `instanceof-bench.js` (answers compared with node; per-operation time and the prototype chain of each operand on stderr). Before the fix the bench reports `chain fs.ReadStream => SELF!` and 130 ms for each non-class target.
- Not fixed here, found on the way: the read stream still answered false to `instanceof Readable` and `instanceof Object` (node: true) because its chain is the self link, and a static `Symbol.hasInstance` inherited by a subclass was not consulted (`2 instanceof SubEven`). Both are fixed by P63 and the probes compare them.
- Upstream: not cherry-picked. Upstream `f3d38d16d` touches `object_ops/prototype.rs` only lightly and does not change this walk. Depends on: none. PR-AN.

### P58 0b9a602cf fix(runtime): consult a computed static @@hasInstance declared in a class body
- Area / platform: `install_class_symbol_method` (`perry-runtime/src/object/global_this/generator_state.rs`) / all targets; found on wasm32.
- Problem: `class Even { static [Symbol.hasInstance](n) { return n % 2 === 0; } }` was ignored: `2 instanceof Even` answered false (node: true). The `instanceof-matrix` wasi probe caught it after the merge of upstream `1019`.
- Root cause: upstream `152fccfa2` stopped lifting the hook into `__perry_wk_hasinstance_<class>` and made it a real computed static member, installed on the class object by `install_class_symbol_method`. `js_instanceof` reads an own `@@hasInstance` only when `CLASS_STATIC_SYMBOLS_LATCH` is armed, and that function stored the method without arming it. Every other route that puts a static symbol on a class (`store_class_static_symbol_root`, `Object.defineProperty` on a class) arms it, so the hook worked only after one of those had run.
- Fix: arm the latch in `install_class_symbol_method`.
- Test: wasi probe `.github/supa/wasi-probes/instanceof-matrix.js`, lines `2 in Even`, `3 in Even`, `instance in Even`.
- Upstream: not proposed yet; the regression is in upstream `152fccfa2`. Depends on: none. PR-AO.

### P59 75654d1a3 fix(runtime): initialize the derived instance when super() targets a native Error
- Area / platform: class construction (`perry-runtime/src/object/class_registry/construct/site.rs`, `js_class_value_super_construct_site`) / all targets share the code path; observed on wasm32-wasip1 in the Storage smoke.
- Problem: after the 2026-10-19 merge Storage's own error objects lost their own `statusCode` and `code`. An upload with an invalid key answered `{"statusCode":500,"code":"FST_ERR_FAILED_ERROR_SERIALIZATION",...}` instead of a 4xx InvalidKey, and an upload to an existing key answered `{"statusCode":"500","error":"Internal","message":"Internal Server Error","code":"InternalError"}` instead of 409. Both were right on `supa/upstream-merge-1018` (`d455a2f12`, run 39150485994).
- Root cause: upstream `152fccfa2` ("checked heritage", with `3ff413af5` and `2d6f6be94`). When a class's heritage must be re-read at run time (`requires_live`: its class value escapes or is relinked, always the case for Storage's classes), `super(...)` lowers to `js_class_value_super_construct_site` instead of the direct Error lowering. For a native Error parent the site called `js_new_function_construct_with_new_target`, which allocates a fresh `ErrorHeader` (GC type 7) and the constructor then replaced `this` with it. The preallocated derived instance stayed uninitialised, and the dispatch tower (`native_call_method.rs`, the `gc_type != GC_TYPE_OBJECT` stub) answers a polymorphic call on an `ErrorHeader` receiver with `{}`. `error.render()`, `isRenderableError()` and the instance `withStatusCode()` of `StorageBackendError` are such calls, which is where `statusCode` and `code` went. Calls the compiler binds statically still worked, so the symptom depended on the call shape.
- Fix: for a builtin Error-family parent (`Error`, `TypeError`, `RangeError`, `ReferenceError`, `SyntaxError`, `EvalError`, `URIError`) and an object-typed receiver, `init_error_family_receiver` runs `js_error_subclass_default_init_with_options(this, message, options)` on the preallocated instance (message, stack, cause as own properties), which is what the direct lowering did before the merge, and returns it. `AggregateError` and every other parent keep the construct path.
- Test: wasi probe `.github/supa/wasi-probes/error-subclass-props.js` (a replica of `StorageBackendError` with a static and an instance `withStatusCode`, `render`, `isRenderableError`, plus classes called through `o[name]()`; expects the node output) and four Storage smoke requests in `.github/supa/smoke.sh` (invalid key, existing key without upsert, missing object, bad JWT), whose transcript every runtime must reproduce.
- Upstream: not cherry-picked (written on top of the 2026-10-19 merge). Depends on: none. PR-AP. Storage's duplicate upload also needed P60. A candidate for upstream Perry: the bug is in upstream `152fccfa2`'s runtime half and upstream's own tests would show it with an escaped `class E extends Error` whose methods are called through a variable.

### P60 52f4de3cb fix(hir): read a per-evaluation class declaration through its binding from earlier closures
- Area / platform: HIR lowering of class declarations in function bodies (`perry-hir/src/lower_decl/{forward_class_reads.rs,block.rs,body_stmt.rs}`) / all targets; observed on wasm32-wasip1 in the Storage smoke.
- Problem: with P59 applied, Storage's duplicate upload still answered `ResourceAlreadyExists` instead of `KeyAlreadyExists`: `isStorageError` and `ensurePgErrorQueryName` compared an error's prototype chain against a class value that was not the one the error was built from.
- Root cause: a `class B extends Error` inside a function takes the per-evaluation path (`fresh_binding` in `body_stmt.rs`: dynamic or live heritage), and its name is bound to the evaluated class only from the declaration onward. A closure lowered earlier (esbuild's `__export(exports, { B: () => B })`) lowers `B` through `class_binding_read` to `ClassRef(template)`, the shared template value, whose `.prototype` differs from the evaluation's. Only function scope, a forward closure and a builtin heritage trigger it; a top-level class, a class declared before the closure, and `extends <user class>` were fine. Not part of the 2026-10-19 merge regression: it reproduces at `supa/upstream-merge-1018`.
- Fix: after lowering a block, `redirect_forward_class_reads` rewrites every `ClassRef(template)` that precedes the declaration into `js_class_lexical_binding_get(ClassRef(template))` and publishes the evaluated class with `js_class_lexical_binding_set` right after the declaration (the existing runtime bridge; `get` falls back to the class ref when nothing is stored).
- Test: wasi probe `.github/supa/wasi-probes/forward-class-binding.js` (getter export, `setPrototypeOf(this, B.prototype)` plus a static `create`, a subclass of the forward-referenced class, a single evaluation) and the Storage smoke duplicate-upload request.
- Limitations: the bridge is last-wins per template, so concurrent evaluations of the same function see the latest class from an earlier closure; a forward `new B()` in a closure still constructs the template.
- Upstream: not cherry-picked (written on top of the 2026-10-19 merge). Depends on: none. PR-AQ. A candidate for upstream Perry.

### P61 bea18b173 fix(runtime): clear an adopted promise's rejection once the adoption job attaches to it
- Area / platform: promise adoption (`perry-runtime/src/promise/assimilate.rs`, `native_promise_adoption_job`) / wasm32-wasip1 (the native probe build did not show it, run 39200302805), where it killed Storage.
- Problem: in the supa-wasm host, `GET /storage/v1/object/info/...` answered 500 and the process then exited 1 through Storage's `uncaughtException` handler, which exits by design. Any error thrown after an `await` in an object route (a missing bucket, a missing object) reached Fastify's error handler and also the uncaught-exception hook, so one 404 stopped the server. Node answers the 4xx and keeps running.
- Root cause: Fastify's route handler is `async (request, reply) => requestHandler(...)`, an async arrow returning the promise of an async function that throws after an await. `async` return of a native promise resolves the outer promise through `enqueue_native_adoption_job`, which clears the inner promise from the unhandled-rejection set when the job is queued and attaches the real reaction in a microtask one tick later. The inner function's continuation was queued first, so it rejects the inner promise before the adoption job runs; `reject` with no reaction puts it back into the unhandled set, and the adoption job (which delivers the rejection to the outer promise) never cleared it again. The checkpoint at the end of the drain then reported an inner rejection the outer promise's handlers had consumed: `uncaughtException` (or exit 1 without a listener). The `throw`-without-`await` and the `return await` forms were not affected.
- Fix: when the adoption job finds the inner promise already rejected it calls `mark_rejection_handled(inner)` before queueing the outer's rejection, as it already did at queue time and as the pending branch (`js_promise_resolve_with_promise`) does.
- Test: wasi probe `.github/supa/wasi-probes/async-throw-after-await.js` (five inner shapes by four outer shapes, each printing how many uncaught reports it caused; the three `throwAfterAwait* x asyncReturn` lines printed 1 before the fix, run 39192065961, and 0 after, run 39192398158). The same probe compiled natively passed without the fix, so it is a wasi probe only. The storage-wasi job also serves the real compiled object info routes behind Fastify (`storage-info-server.sh`) and compares answers, stdout and exit status with node; the missing-bucket request killed the module before the fix. The fork's smoke (`smoke.sh`) covers `object/info`, `object/info/authenticated`, `object/info/public` and HEAD on objects against node.
- Not covered: the 500 `TypeError: value is not a function` that preceded the exit in the supa-wasm run was not reproduced by any build of d455a2f12 or later (renderers with a mock reply, behind Fastify with Storage's hooks, real routes, real module graph). The only module run in the host predates P53 (GC roots cleared early), which produces such stale values; a host run with a rebuilt module is needed to confirm it is gone.
- Upstream: not cherry-picked (written on top of the 2026-10-18 merge). Depends on: none. PR-AR. A candidate for upstream Perry: the adoption path and the unhandled-rejection tracker are upstream code, and the probe's `throwAfterAwait* x asyncReturn` lines are the failing case, though only a wasm32 build showed it so far.

### P62 b94434efe fix(runtime): resolve require("stream/promises") pipeline and finished to the promise implementations
- Area / platform: runtime native-module exports and method dispatch (`perry-runtime/src/object/native_module/callable_exports.rs`, `object/native_module_dispatch.rs`) / all targets (reproduced on wasm32-wasip1 and Linux native).
- Problem: Storage's S3 PutObject (`pipeline(body, limit, handler)` from `require("stream/promises")`, esbuild CJS output) answered 500: the final handler was never run, its `{ headers }` result never came back, and `routeHandler` threw `Cannot read properties of undefined (reading 'headers')`. GET, HEAD and DELETE answered 500 with the same error. Node gives 200/200/200/204.
- Root cause: `require("stream/promises")` is `Expr::NativeModuleRef("stream/promises")`. A read of `.pipeline` / `.finished` minted a BOUND_METHOD closure over that namespace (`bound_native_callable_export_value`), and a direct `mod.pipeline(...)` call went to `dispatch_native_module_method`. Both reach `nm_dispatch_lookup("stream/promises")`, which has no bucket (only `stream`), so the call returned `undefined`. `import { pipeline } from "stream/promises"`, `import * as` and `require("stream").promises.pipeline` use the `stream_promises` submodule registry and were fine.
- Fix: both sites hand back / call the submodule's real export (`stream_promises_export_callable`), the closure the working forms already give.
- Test: wasi probe `stream-pipeline-final-fn-require.js` (member, `node:`-prefixed member, comma, destructured, `stream.promises` and identity cases against node). Before the fix the `stream/promises` forms printed `undefined`; after, all lines match node.
- Not covered: other native-module ids with no dispatch bucket (any `X/promises` alias reached through `require`) would answer `undefined` the same way; only `stream/promises` was in the path of Storage.
- Upstream: not cherry-picked (written on the fork). Depends on: none. PR-AS, a candidate for upstream PerryTS/perry.

### P63 f969c418e 77be4b284 9a1758ff0 fix(runtime): give fs streams, Dir and Dirent their module prototype, and let a subclass inherit a static Symbol.hasInstance
- Area / platform: `Object.getPrototypeOf` of native host objects (`perry-runtime/src/object/object_ops/prototype.rs`, new `host_prototype.rs`), the `instanceof Stream` arm (`node_stream_readwrite.rs`), the static `Symbol.hasInstance` registry (`object/class_meta_registry.rs`) / all targets.
- Problem: `Object.getPrototypeOf(fs.createReadStream(f)) === rs` (the same for `createWriteStream`, `new fs.ReadStream`, and `Dirent`). So `rs instanceof Readable`, `Stream`, `EventEmitter` and `Object` were false (node: true), `rs.constructor` and `rs.hasOwnProperty` were missing, and a user loop `while (p = Object.getPrototypeOf(p))` never ended. `rs instanceof Readable` walked 64 self-link hops, about 86 us per check. Probe `host-object-chains.js` on the unfixed build (run 39181675274): `fs.ReadStream`, `fs.WriteStream`, `new fs.ReadStream` and `fs.Dirent` answered `SELF`; `fs.Dir`, `net.Socket`, `net.Server`, the stream classes, zlib streams, `fs.Stats` and the web classes were already correct.
- Root cause: the fs stream objects are plain objects stamped with a reserved class id (`CLASS_ID_FS_READ_STREAM` and the like). `get_prototype_of_resolved` found no registered prototype for them and ended in its `return obj_value` fallback, which answers the receiver. The prototype chain itself already existed: `fs.ReadStream.prototype` links to `Readable.prototype` > `Stream.prototype` > `EventEmitter.prototype` > `Object.prototype` through `native_module/constructor_shapes.rs`; only the objects did not point at it.
- Fix: `host_prototype::native_host_prototype(class_id)` maps the reserved class ids of `fs.ReadStream`, `WriteStream`, `Utf8Stream`, `Dir` and `Dirent` to their export and returns `<export>.prototype` through an ordinary `[[Get]]`, the pattern `net_socket_prototype_value` already uses. It is consulted just before each of the two `return obj_value` fallbacks. Nothing is stored per object: no creation cost, no side table, and no inherited-property lookup changes for the stream objects (their methods stay own closures). The stream's snapshot properties (`closed`, `destroyed`, `readable`, `writable`, ...) are now defined as own data properties on first store (`fs/stream.rs`): with the chain in place an assignment found the getter-only accessor on `Readable.prototype` and threw `Cannot assign to read only property 'closed'` (seen in Storage's upload, upload-pipeline probes and one regression test). `instanceof Stream` also falls back to the chain walk (it answered from the readable/writable flags only). `lookup_has_instance_hook` now walks the class parent chain, so `class SubEven extends Even` inherits `Even`'s static hook (`2 instanceof SubEven`); the registry is idle, and the walk not taken, in a program with no such hook. Since upstream `152fccfa2` a class-body `static [Symbol.hasInstance]` is no longer registered but installed in the class's static symbol table (P58), which `instanceof` read for the operand class only, so `instanceof` now reads that table up the parent chain too (`class_static_symbol_lookup_in_chain` in `instanceof/static_dispatch.rs`, `9a1758ff0`, written when P58 and this change met); without it `2 instanceof SubEven` stayed false for the class-body form.
- Test: `host-object-chains.js` (native probe, compared with node: full chain and instanceof columns for the fs and stream classes, and a never-SELF walk for http, crypto, child process and process stdio objects), `instanceof-matrix.js` (read stream against Readable, Stream, EventEmitter, Object, fs.ReadStream, Writable; `SubEven`) and `instanceof-bench.js` (the two cells it left out of the compare are back).
- Upstream: not cherry-picked. Upstream `f3d38d16d` adds 10 lines in the class-constructor branch of `object_ops/prototype.rs`, away from the two sites touched here. Depends on: none. PR-AT.
- Not fixed, found on the way: a property read on the stream does not follow the new chain (`rs.constructor === fs.ReadStream` is false and `rs.hasOwnProperty` is undefined; node: true, a function): the read path of these objects looks at their own fields only. Making `Readable.prototype` members visible on them changes what fastify and Storage see on a response stream, so it is left for its own change. Several host objects answer `null` instead of a chain (`http.Server`, `http.Agent`, `http.ClientRequest`, `crypto.Hash/Hmac/Sign`, `ChildProcess` and its stdio, `process.stdout/stdin`: `getPrototypeOf` is `null` or a bare `Object.prototype`; node has a chain). They do not loop, they fail `instanceof` and `.constructor`. `crypto.createCipheriv` and `readline.createInterface` threw in the probe (`Cannot convert undefined or null to object`, `Cannot read properties of undefined (reading .close.)`); not investigated.

### P64 cbcca2990 fix(runtime): follow array forwarding when concatenating a list of buffers
- Area / platform: `js_buffer_concat_impl` (`perry-runtime/src/buffer/from.rs`, behind `Buffer.concat(list[, totalLength])` and the native-module dispatch) / all targets; found on wasm32-wasip1 through Fastify `app.inject`.
- Problem: `app.inject({ method: 'GET', ... })` threw `The "list[0]" argument must be an instance of Buffer or Uint8Array. Received type number (...)` from `Buffer.concat` in light-my-request's `generatePayload`; `HEAD` worked because it writes no body, and node was fine. The failure is not a collector or setjmp problem: it is deterministic, the same under the default settings, and does not depend on async ticks.
- Root cause: light-my-request's `Response.write` does `this._lightMyRequest.payloadChunks.push(Buffer.from(data, encoding))` and `generatePayload` later does `Buffer.concat(response._lightMyRequest.payloadChunks)`. A push past the array's capacity grows it into a new block and leaves a forwarding stub at the old head (#233): the new address replaces `length` and `capacity`, and the first element slot reads as a raw pointer, which is the "number" in the error. A push through a local gets its binding re-pointed, and `this.f.push(v)` gets the field write-back (`field_writeback`), but a push through a longer path (`this.a.b.push(v)`) or into a parameter leaves the stale head in the field or the caller's binding. Every array consumer resolves such a head with `clean_arr_ptr` (`Buffer.from(array)` since #6486, `buffer.set`, `js_array_length`) except `js_buffer_concat_impl`, which stripped the NaN-box tag and read the header raw.
- Fix: `js_buffer_concat_impl` resolves the list with `crate::array::clean_arr_ptr`, which strips the tag, follows the forwarding chain, materializes a lazy array and rejects a non-array; the GC root it takes for the copy is the resolved head.
- Test: wasi probe `.github/supa/wasi-probes/buffer-concat-grown-list.js` (a nested field, an object field and a capture appended from timers, a list grown through a parameter, with and without `totalLength`; before the fix every shape except the captured local threw, run 39204300540) and `fastify-inject-get.js` (the real fastify 5.11.2 from npm: GET json, text and Buffer replies, a 40 KB body, a 404, a POST, HEAD). Neither needs a `// wasm-env:` setting. `PERRY_GC_FORCE_EVACUATE=1` with `PERRY_GC_VERIFY_EVACUATION=1` gave the same failure before the fix, so the probe runs with the default settings.
- Not covered: other runtime consumers that read an array header raw were not audited beyond the `buffer` module (the others there already resolve forwarding). The wasm codegen's `buffer_concat` import (`perry-codegen-wasm`) is a separate JS-hosted path.
- Upstream: not cherry-picked (written on top of the 2026-10-19 merge). Depends on: none. PR-AU.

### P65 55259826f perf(runtime): copy holey arrays and plain array-likes without a per-index HasProperty
- Area / platform: `js_array_from_arraylike_with_missing` (`perry-runtime/src/array/alloc.rs`), `array_spec_has_index` (`array/indexing_proto_chain.rs`), the concat bulk paths (`array/from_concat.rs`) / all targets; measured on wasm32.
- Problem: Storage's cold start spent about 118 ms (x86_64) to 218 ms (arm64) in the lru-cache constructor, 91 ms of it in `js_array_from_arraylike_with_missing` under `js_array_clone`: `Array.from({ length: max })` ran the full ordinary HasProperty (a string allocation, then the own-key and prototype walk) for each of `max` indices on a plain object. The array-like loop came in with upstream `a160d2bd6`; the cost grew as the generic has-property path did.
- Root cause: nothing short-circuited the case where no index can exist. The same shape cost shows on holey arrays: `array_spec_has_index` allocated two key strings and probed the named-property map for every hole before reaching its prototype checks, and `concat` refused its bulk copy for any source with a hole, so each hole took that probe.
- Fix: (1) A plain object (shape of default-attribute data keys, class id 0 or a closed literal's anonymous id with the DEFAULT shape prototype, default prototype, no array-index key) with `OBJECT_PROTO_HAS_INDEX` false has no index to find, so the result is filled with the missing value (`undefined`, or a hole for the borrowed `slice`) in one pass and the layout rebuilt once. `length` is read first, so a getter that adds an index is seen. The generic `Array.prototype.slice.call(arrayLike)` (`js_arraylike_slice`, `array/generic.rs`) takes the same proof and returns the species result, already `count` holes, without the per-index `al_has` walk. (2) `array_holes_are_absent` (no element descriptors, recorded prototype or sparse storage, and no indexed property on or retarget of `Array.prototype` / `Object.prototype`) lets `array_spec_has_index` answer from the dense slot, and lets `concat` copy such holes verbatim. Every latch is set by the write that creates the condition, so a property added later is seen by the next call. Nothing new is stored on a hot path.
- Test: wasi probe `.github/supa/wasi-probes/array-holey-copy.js` (compared with node: holes preserved or filled for Array.from, spread, slice, concat, splice, fill and the borrowed slice; an indexed data property and a getter on `Array.prototype` and on `Object.prototype`, before, after and once removed; an index added between two copies; own index keys, a null prototype, a class getter, a custom prototype and a `length` getter that adds an index; `new Array(1e6)` copies) and `array-holey-copy-bench.js` (results compared; per-copy time on stderr).
- Measured (wasm32, CI Linux x86_64, `array-holey-copy-bench.js`, ms per copy of 300000, base `6cab5e032` against this branch): `Array.from({length}).fill(undefined)` 205.0 -> 4.4, `holey.concat(holey)` 70.2 -> 5.8, `Array.prototype.slice.call({length})` 282.6 -> 0.2; `Array.from(holey)`, `[...holey]`, `holey.slice()` and `new Array(N).fill(0)` were already 1-3 ms. Storage smoke ready time on the same host against run 39192203548's module: 3806/3841/3853 ms before, 3557/3645/3708 ms after (100 KB, 5 MiB, forced-evacuation runs); a second run on the final runtime gave 4119/4242/4389 ms before, 3857/4286/3986 ms after. Ready times on the shared runner vary by a few hundred milliseconds between runs, so the Storage figure is a direction (about 250 ms less), not a precise gain; the micro-benchmark is the measurement.
- Also fixed (a divergence on the base too): `concat` read a hole's inherited element from its default-prototype clone, so a source array with its own `setPrototypeOf` link or an Array-subclass prototype that carries an index lost that element (`append_spread_array`, `array/from_concat.rs`). It now reads the source array. The probe covers a swapped prototype (data and getter, `Array.from`, `slice.call`, `concat`, spread) and a subclass prototype that gains an index after instances exist.
- Not fixed, found on the way (both differ from node on the base, so the probes stay off them): `Object.keys(array)` returns no index keys for a dense array above 100000 elements (`js_object_keys_shape`, `object/field_get_set/enumeration.rs`: the `length > 100_000` branch sets `dense_limit` to 0 unless the array is sparse), so the probes count large arrays with `hasOwnProperty` at a stride; and `new Array(5).fill(0)` with an inherited accessor `Array.prototype[1]` (getter plus a no-op setter) defines an own element, where node's `fill` runs the inherited setter and leaves the hole.
- Also fixed on the way: `census_gates_real_add_definition_and_spread_producers` (`object/shape_mint_census_gate_tests.rs`) failed about half of its parallel runs on the base; the census counters are process-global and any test's mint moved them. The census is now armed on the capturing thread only and the counter tests are serialized (test-only code).
- Upstream: not cherry-picked; upstream has the same loop. Depends on: none. PR-AV.

## Not for upstream

Every other fork-only non-merge commit is CI, probes, a temporary diagnostic, or a Storage shim. None edits files outside `.github/` (checked with `git show --name-only`). There are 44 such commits, 24 fix/feat commits are the patches above, and the fork has no `test:` commits.

**Fork CI workflow, composite action and driver scripts** (`.github/workflows/supa-storage.yml`, `.github/actions/supa-rust-env`, `.github/supa/*.sh`; Blacksmith runner, sccache, lld, caches). Fork-specific infrastructure for supabase/perry. Merge of upstream `2bbab8aff` (2026-10-18): adapted. Upstream's perry compiles natively only against runtime archives that carry a `.gc-effects` sidecar and routes `undici` to `libperry_ext_undici.a`, so `build-perry` writes the sidecars (`scripts/gc_call_effects/sidecars.sh target-libs/release`), builds `perry-ext-undici`, stages both in `perry-dist` (cache key `perry-dist-*-wasi-gcfx-*`), and `regressions-linux` copies the sidecars with the archives. The `perry-ext-zlib` and `perry-ext-ws` wrapper archives are built and staged the same way (compiled programs that import `zlib` or `ws` link them; cache key `perry-dist-*-wasi-gcfx2-*`), and the wasip1 compile of Storage needs no sidecar (`native_link_set_skipped` covers wasi targets; see P31 and P32). The workflow also gained a `wasi_probe_names` dispatch input (run only the named wasi probes) and `wasi-probes.sh` a `// wasm-env: NAME=VALUE...` marker (variables for the wasm run only); both were written to reproduce P53.
Known and parked: the probes `cbp1` to `cbp4` and `class-iife-base-same-name` are open gaps (see P50). The probe `eh-uncaught` failed on aarch64 Linux from before the merge and is fixed by P54.

**Storage smoke under supa-host** (`.github/supa/wasi-smoke.sh`, job `storage-wasi-smoke` in `supa-storage.yml`, dispatch input `smoke_baseline_run`; the host source is the orphan branch `supa/ci-supa-host`). The job runs the compiled, stripped Storage module under a wasmtime host with the `supa_net` sockets against a Postgres service, three times (a 100 KB upload, a 5 MiB upload, a 100 KB upload with `PERRY_GC_FORCE_EVACUATE=1 PERRY_GC_VERIFY_EVACUATION=1`), and diffs each smoke transcript with the one node produces from the same Storage checkout (`node-reference` artifact). It reports ready time, RSS, the precompiled (`.cwasm`) size and the precompile time, and fails on any difference, a dead host or a host that never answers `/status`. With `smoke_baseline_run=<run id>` it also runs the `storage-wasi-module` artifact of that run on the same host and runner, so sizes and ready times compare like for like. It runs on `supa/wasip1` pushes and on dispatches with `storage_wasi=true`. The host is `host/` of supabase/supa-wasm at `6186ad065` plus a small patch (`--rw-dir`, `--threads`, `compile`, `.cwasm` loading, exceptions and GC on); supabase/supa-wasm is not reachable from this repository's Actions token, which is why the source is vendored on `supa/ci-supa-host`. It is built from outside the checkout (this repository's `.cargo/config.toml` holds nightly-only flags) and cached by the hash of its sources. Known gaps: the host is a snapshot, not supa-wasm's current head; one measurement per run, and ready times on the shared runner vary by a few hundred milliseconds between runs.
`7ed44e85e` `89067cad4` `dc4aeef27` (`supa/upstream-merge-1019`); `8bbdfb2` `811c1c5` `e0b0cab` (`supa/ci-supa-host`)
`e8ac78fea` `ece6015bb` `297306927` `18b63cef3` `512996ccb` `0c3401687` `9d2cbde15` `8a051e924` `53423af73` `942a6fe56` `5b1438709`

**CI wiring of regression tests** (adds test names or log capture to `.github/supa/regressions.sh`; the tests themselves belong to the patches above).
`2f2aa9106` `28ec96b4c` `45f599068` `679c8489c` `972d69cfc` `c14ff7647` `0ab92cf1e`

**Probes** (`.github/supa/probes/*.js`, `probe.js`, `probes.sh`): fastify README/npm, ajv, cdn-cache-manager, ESM-from-CJS, http.Agent, upload-pipeline probes and their fixtures. They reproduce Storage-shaped failures and are not upstream tests. Candidates to reuse as upstream tests: `fastify-readme.js` (for PR-A) and `esm-from-cjs.js` (for PR-E), both after rewriting as `crates/perry/tests` cases.
`200a70f05` `4561dccb5` `6ccdadf95` `aa4e27a74` `6ffb0639a` `d9eefe30b` `c3cff7bc6` `5002c8b14` `5511ceefd` `723c309c3` `f0475a91a` `1ccc26071` `815c06f11` `b22beb087` `18f6e5fff` `763c3aa57`

**Temporary diagnostics** (fastify preParsing and ajv failure-site tracing, uncaught-throw return-path gdb tracing, and their removal; one of them is an empty commit that only re-ran the pipeline).
`de78dda9a` `edfe3727f` `84c7f28de` `b1c720155` `aa8c0218e` `b24de7373` `d559df970` `6a26fd5f0`

**Storage dependency shims** (`.github/supa/shims.sh`, `patch-find-my-way.cjs`). The first replaces the four `new Function` generated functions in find-my-way 9.7.0 with closures; it also deletes upstream's `.github/dependabot.yml` from the fork. It predates P12, and whether it is still needed on Linux is unverified. The second removes the earlier agentkeepalive shim now that P02, P17 and P19 make the real package run.
`da99fa8be` `7b9b592a3`

**Fastify lazy schema compilation shim** (`.github/supa/patch-fastify-lazy-schema.cjs`, applied by `shims.sh`; `SUPA_LAZY_SCHEMAS=0` skips it for A/B runs). A Fastify-upstream candidate, written against fastify 5.11.2 and generic: it touches no Storage source. Fastify compiles every route's body/params/querystring/headers validators and response serializers while the routes register; in the wasm cold-start profile (supa-wasm run 39175290098) ajv is 65% of the first request's 2.8 s of CPU and fast-json-stringify 16%, almost all of it from this registration-time compile. The shim wraps the `compile` argument of `compileSchemasForValidation` and `compileSchemasForSerialization` in `lib/validation.js` with a `lazyCompiler` helper, so each slot of the route context (`kSchemaBody`, `kSchemaResponse[status][contentType]`, ...) holds a function that calls the real compiler on its first invocation and delegates to the result, mirroring `validate.errors` onto itself after each call (the only property fastify reads from a validator). Observable differences, none reachable with a valid schema: a schema that fails to compile throws at the first request that needs it (a 500 from that request) instead of from `ready()`, and a failed compile is retried on the next call; ajv properties other than `errors` (`schema`, `schemaEnv`, `source`) are not on `getValidationFunction()`'s result; a custom compiler returning a non-function is no longer detected at startup. Checked under node on a 16-route fastify app (params, query, headers, body, `$ref` shared schemas, per-content-type bodies and responses, 2xx/default responses, async and `{value}`/`{error}` custom validators, route-level and encapsulated compilers, `schemaErrorFormatter`, `getValidationFunction`/`compileValidationSchema`): the responses are identical to the eager build except for the order of a custom compiler's side effects and the bad-schema case above. Not covered: Storage's own eager ajv uses (`routes/s3/router.ts` `registerRoute`, `routes/vector/validation.ts`, `routes/bucket/lifecycle.ts`), which this does not defer.

**Ajv boot shim** (`.github/supa/patch-ajv-boot.cjs`, applied by `shims.sh`; `SUPA_LAZY_AJV=0` (workflow input `ajv: eager`) restores the originals for A/B runs). A Storage-specific shim, no Perry change and no P-id, applied on top of the lazy schema shim. Under Perry an Ajv instance compiles the draft-07 meta-schema on its first `addSchema`/`compile`, and every validator is code generation plus `new Function`; three startup costs remained after the lazy schema shim. `dist/http/routes/s3/router.js` `Router.registerRoute` compiled one validator per S3 route (about 100): each route now gets a validator that adds and compiles its schema on first call (the first registration of a method+url key still wins, and `validate.errors` is mirrored onto the wrapper, the only property the S3 handler reads). `@fastify/ajv-compiler`'s pooled ValidatorCompiler (an Ajv instance, the ajv-formats plugin and an `addSchema` per shared schema) is built on the first compile instead of when the first route context asks for it; the pool key and the standalone `code` option still build eagerly. `validateSchema: false` is set on the three Ajv instances Storage builds at boot, so none compiles the meta-schema to check a schema it is about to compile; no check is lost because the reference run under node in storage-prep (original sources, eager registration of every S3 route, fastify compile of every route, `addSchema` of every shared schema) fails to start when any of those schemas is invalid. Differences from eager compilation, none visible with a valid schema: an invalid schema throws from the first request that needs it instead of from startup, and a validator's other ajv properties (`schema`, `schemaEnv`, `source`) are not on the S3 route wrapper. The smoke covers the error paths that go through these validators (invalid json, wrong type, invalid bucket name, bad query, invalid body, S3 validation failure) and diffs them against node.
`1e1d2ad05`

**Storage package stubs** (`.github/supa/storage-stubs.sh` and `stub-packages.cjs`, applied by `shims.sh`; `SUPA_STORAGE_VARIANT=base` (workflow input `storage_variant: base`) keeps the packages for A/B runs). Local-dev only and NOT an upstream candidate: it removes Storage features, so it is neither a Perry change nor something to propose to Storage. The built Storage's AWS SDK (and `@tus/s3-store`, `aws-sigv4-sign`), `@fastify/swagger`/`swagger-ui`, `pg-boss`, `@fastify/rate-limit` and the vector, iceberg, render and admin route modules become throwing stubs before the compile, which takes about 39% off the wasm module; the S3 object backend, TUS on S3, presigned URLs, vectors, iceberg, the job queue, image rate limiting and `/documentation` are gone from that build. supa-wasm's environment never reaches them (`STORAGE_BACKEND=file`, `PG_QUEUE_ENABLE=false`, `RATE_LIMITER_ENABLED=false`, `IMAGE_TRANSFORMATION_ENABLED=false`, vector and iceberg off), except swagger, which registers unless `EXPOSE_DOCS=false`. The S3 protocol endpoint (`/s3`) is unaffected: it verifies sigv4 itself and reads the SDK only for types and one `instanceof`. storage-prep runs the stubbed Storage under node with `EXPOSE_DOCS=false` and fails unless its smoke transcript matches the unstubbed reference apart from the docs probes; that transcript is the reference of storage-wasi-smoke and storage-linux for the stubbed build.
`e3aacc0cd`

**wasip1 series since storage-ci** (`supa/wasip1`): CI wiring and diagnostics `ef0f3969f` `dd33cf711` `f96fd56bd` `e81da245e` `04a35b714` `5c07ca9f3` `e5558632d` `628f36abe` `367281739` `5defe7f9a` `74694d7d4` `37c69af62` `61aa2c6df` (`supa-storage.yml`, `.github/supa/*.sh`, the temporary diagnostic probes and the `SMOKE_BYTES` smoke input). The `test(wasi)` probe commits `506e7d053` and `ec19714e1` and the `docs:` commit `b3cce1633` (how the wasm32 ABI table is regenerated) go upstream with PR-T and PR-S respectively.

Merge commits (not counted): `1f3c775af` (merge of upstream main), `03ef52d0f` (merge of `supa/upstream-sync`), `d7c409f8c` (merge of upstream `f3d38d16d`, 2026-10-19).

## Fork baseline

- Upstream reference: `refs/upstream-main` = `1fd8ca2ae` (2026-10-17), 38 commits ahead of the fork's last sync.
- Merge-base of `supa/storage-ci` with upstream main: `43a40d056` (2026-10-16, "perf: read-before-write check knows paths that cannot complete normally").
- Last upstream sync merge: `1f3c775af` (2026-10-16 15:12 +0200, "Merge PerryTS/perry main into supa/storage-ci"), whose second parent is `43a40d056`. `03ef52d0f` (2026-10-16 17:25 +0200) merged the fork's own `supa/upstream-sync` branch.
- Original fork point of the earlier patches (P01-P14): `5b76f8acc` (2026-10-15, "gc effects: regenerate macOS table for Object.create families"). The older branch `supa/storage` (an older tip) is an ancestor of `supa/storage-ci`.
- Fork tip: `supa/storage-ci` (tip, 2026-10-16); 68 fork-only commits, 66 non-merge.
- Upstream merge (2026-10-18): `supa/upstream-merge-1018` merges upstream `2bbab8aff` (2026-10-18, "docs(changelog): record V8 heap snapshot stream crash fix") into `supa/wasip1`; merge-base `43a40d056`, 231 upstream commits. Superseded by it: P04, P05, P06, P10, P15, P16, P47. Adapted: P08, P11, P12, P17, P18, P19, P23, P24, P28, P29, P31, P32, P41, P45. Checked and kept as they were: P46, P48, P49, P50. New on top of the merge: P51, P52, P53, P54.
- Upstream merge (2026-10-19): `supa/upstream-merge-1019` merges upstream `f3d38d16d` (66 commits after `2bbab8aff`) into `d455a2f12`, the green head of `supa/upstream-merge-1018`. Two textual conflicts: `object/layout_desc.rs` (the fork's pointer-width-aware asserts kept, the LP64 `PerryLayoutDesc` assert is now 72 bytes for upstream's new `methods` field, see P23) and `wasm32/runtime_abi.tsv` (regenerated, 5202 symbols, see P28). Superseded by it: none. Adapted: P23, P28, P29. Checked and kept as they were: P01, P02, P03, P07, P08, P20, P21, P46, P50, P53 (their files changed upstream). New on top of the merge: P55, P59, P60. Upstream's family-layout method tables (`0199f9921`) are inert on wasm32 because wasm32 codegen emits no layout descriptors; the other commits (nursery births, module-evaluation identity, class heritage, HTTP response methods, removal of `js_region_guard_pack` and `js_region_guard_prime`, ...) needed no fork change beyond P55. The Storage module compiled for `wasip1` is 375,881,317 bytes (373,830,860 stripped), against 373,932,969 (371,882,512) for the 1018 merge: +1,948,348 bytes, +0.52%, all in code. Precompiled with the smoke job's host on the Linux arm64 runner: 515,276,616 bytes against 512,648,416 for the 1018 module (+0.51%). The Storage smoke (100 KB, 5 MiB, and 100 KB under forced evacuation with verification) is identical to node's transcript for both modules; ready times on the same runner and host were 6615, 6522, 6900 ms (1018 module) and 7781, 6862, 7159 ms (this merge), idle RSS 556 and 574 MB.
- Ledger written: 2026-10-17. Updated 2026-10-19 for the merge of `f3d38d16d`.
