// A Date allocated into memory a dead object occupied reads as a Date, not as
// that object. A Date cell is a pointer-sized `meta` word, padding and the
// timestamp; the property-read paths load the word at payload +4 as a ShapeId,
// and on wasm32 that word is padding the allocator must clear: leftover bytes
// from an empty object (its ShapeId) made JSON.stringify and property reads
// treat the cell as an ordinary object and fault on its missing slots.
function churn(n) {
  const keep = [];
  for (let i = 0; i < n; i++) {
    const o = i % 3 === 0 ? {} : i % 3 === 1 ? { a: i } : { a: i, b: 'x' };
    if (i % 64 === 0) keep.push(o);
  }
  return keep.length;
}
function filler(n) {
  let s = 0;
  for (let i = 0; i < n; i++) {
    const a = [i, i + 1, 'v' + i, { i }];
    s += a.length;
  }
  return s;
}

let bad = 0;
let json = 0;
const sample = [];
for (let round = 0; round < 60; round++) {
  churn(20000);
  filler(5000);
  for (let i = 0; i < 4000; i++) {
    const t = 1700000000000 + round * 1000 + i;
    const d = new Date(t);
    const wrapped = { when: d, n: i };
    const text = JSON.stringify(wrapped);
    if (text !== '{"when":"' + new Date(t).toISOString() + '","n":' + i + '}') bad++;
    if (d.getTime() !== t || d.toUTCString().length !== 29 || d.foo !== undefined) bad++;
    json += text.length;
    if (i % 1000 === 0) sample.push(d);
  }
}
for (const d of sample) if (typeof d.toJSON() !== 'string') bad++;
console.log(bad === 0 ? 'dates intact' : 'DATES CORRUPTED: ' + bad, json);
// max-rss-mb: 1500
