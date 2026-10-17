// Arrays that carry own named properties (the `raw` array of a tagged-template
// strings object, `match` results with `index`/`input`, user-added labels) keep
// the property holder alive and findable across nursery collections. The
// holder is reached through `ArrayHeader::named`, a four-byte pointer on wasm32
// that is followed by padding: the collector must treat it as a pointer, not
// as an eight-byte value that picks up whatever the padding holds.
function tag(strings) { return strings; }
function churn(n) {
  const a = [];
  for (let i = 0; i < n; i++) a.push({ i, s: 'x' + i, t: [i] });
  return a.length;
}

const kept = [];
for (let i = 0; i < 400; i++) {
  const a = [i, i + 1, i + 2];
  a.label = 'label-' + i;
  a.meta = { n: i, tags: ['t' + i] };
  kept.push(a);
  const m = /(\d+)-(\w+)/.exec('id ' + i + '-name' + i);
  kept.push(m);
  const t = tag`a${i}b${'s'}c`;
  kept.push(t);
  churn(1500);
}

let bad = 0;
for (let i = 0; i < 400; i++) {
  const a = kept[i * 3];
  if (a.label !== 'label-' + i || a.meta.n !== i || a.meta.tags[0] !== 't' + i || a[1] !== i + 1) bad++;
  const m = kept[i * 3 + 1];
  if (m.index !== 3 || m.input !== 'id ' + i + '-name' + i || m[2] !== 'name' + i) bad++;
  const t = kept[i * 3 + 2];
  if (t.raw.length !== 3 || t.raw[0] !== 'a' || t.raw[2] !== 'c' || t.length !== 3) bad++;
}
console.log(bad === 0 ? 'named properties intact' : 'NAMED PROPERTIES CORRUPTED: ' + bad);
