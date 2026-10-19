// Cost of copying holey arrays and array-likes: the lru-cache constructor's
// `Array.from({ length: max }).fill(undefined)` plus the other copies of a
// holey array. stdout (compared with node) carries the results; timings go to
// stderr, which is not compared.
const N = 300000;
const REPS = 5;
function time(label, f) {
  const t0 = Date.now();
  let r;
  for (let i = 0; i < REPS; i++) r = f();
  console.error(`${label}: ${((Date.now() - t0) / REPS).toFixed(1)} ms per copy of ${N}`);
  return r;
}
const holey = new Array(N);
for (let i = 0; i < N; i += 1000) holey[i] = i;

const lru = time('Array.from({length}).fill(undefined)', () => Array.from({ length: N }).fill(undefined));
const fromHoley = time('Array.from(holey)', () => Array.from(holey));
const spread = time('[...holey]', () => [...holey]);
const sliced = time('holey.slice()', () => holey.slice());
const concatenated = time('holey.concat(holey)', () => holey.concat(holey));
const borrowed = time('Array.prototype.slice.call({length})', () => Array.prototype.slice.call({ length: N }));
const filled = time('new Array(N).fill(0)', () => new Array(N).fill(0));

console.log('lru', lru.length, lru[0], lru[N - 1], Object.keys(lru).length);
console.log('from holey', fromHoley.length, fromHoley[1000], fromHoley[1], Object.keys(fromHoley).length);
console.log('spread', spread.length, spread[2000], Object.keys(spread).length);
console.log('slice', sliced.length, sliced[3000], 1 in sliced, Object.keys(sliced).length);
console.log('concat', concatenated.length, concatenated[N + 4000], 1 in concatenated, Object.keys(concatenated).length);
console.log('borrowed', borrowed.length, 5 in borrowed, Object.keys(borrowed).length);
console.log('filled', filled.length, filled[N - 1], Object.keys(filled).length);
