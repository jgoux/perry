// JSON stringify/parse round trip, indentation, revivers and parse errors.
const doc = {
  s: 'héllo "quoted" \n newline ☃ 😀',
  n: [0, -1, 1.5, 1e21, 1e-7, 123456789012345],
  b: [true, false, null],
  nested: { a: { b: { c: [1, { d: 'deep' }] } } },
  empty: { o: {}, a: [] },
  skip: undefined,
  date: new Date(86400000),
};
const text = JSON.stringify(doc);
console.log(text);
const back = JSON.parse(text);
console.log(JSON.stringify(back) === text, back.nested.a.b.c[1].d, back.s.length);
console.log(JSON.stringify(doc.nested, null, 2));
console.log(JSON.stringify({ a: 1, b: [1, 2] }, null, '--'));
console.log(JSON.stringify(doc, ['s', 'empty']));
console.log(JSON.parse('{"a":1,"b":[1,2,{"c":3}]}', (k, v) => (typeof v === 'number' ? v * 10 : v)).b[2].c);
for (const bad of ['{', '{"a":}', '[1,]', '', 'nope']) {
  try { JSON.parse(bad); console.log('parsed?!'); } catch (e) { console.log(JSON.stringify(bad), e.name); }
}
const big = []; for (let i = 0; i < 2000; i++) big.push({ i, s: 'v' + i });
console.log(JSON.parse(JSON.stringify(big)).length, JSON.stringify(big).length);
console.log(JSON.stringify('x'), JSON.stringify(null), JSON.stringify(undefined), JSON.stringify(() => 1));
console.log(JSON.stringify({ toJSON() { return { custom: true }; } }));
