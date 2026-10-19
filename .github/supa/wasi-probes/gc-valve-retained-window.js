// max-rss-mb: 1200
// wasm-env: PERRY_GC_DIAG=1
// stderr-contains: [gc-block-persist] scan=1 effective=0 frame=1 ran=1
// One synchronous Array.from call allocates and keeps well over 64 MB with no loop poll
// and no microtask boundary, so the only collections are allocation-point
// valves, which run under a forced conservative scan. That scan does nothing on
// wasm32, so the block-persistence window must still run (the stderr marker),
// and the retained result must come out intact.
const rows = Array.from({ length: 3e6 }, (_, i) => ({ i, s: [i] }));
let sum = 0;
for (let i = 0; i < rows.length; i += 997) sum = (sum + rows[i].i + rows[i].s[0]) % 1000003;
console.log(rows.length, rows[rows.length - 1].s[0], sum);
