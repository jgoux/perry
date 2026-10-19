// network: yes
// A list that grew by push past its initial capacity leaves a forwarding stub
// where the head used to be. A binding that kept the old head (a field no
// write-back reached, the caller's variable after a push through a parameter)
// still names the live array through it, but the stub's length and capacity
// words now hold the new address and element 0 reads as a raw pointer. Every
// consumer below must see the same list as node does. buffer-concat-grown-list
// covers Buffer.concat. This probe holds the consumers that follow the stub
// already (controls, each fed a fresh list and both stale shapes); the ones
// that did not have a probe of their own, stale-array-<consumer>.js.
const util = require('util');
const path = require('path');
const fs = require('fs');
const work = process.env.WORK_DIR || '/work';

class Holder {
  constructor() {
    this._state = { items: [] };
  }
  add(v) {
    this._state.items.push(v);
  }
  items() {
    return this._state.items;
  }
}
function fill(list, n, mk) {
  for (let i = 0; i < n; i++) list.push(mk(i));
}
// The list as a nested field the push never wrote back, and as the caller's
// binding after a push through a parameter.
function viaField(n, mk) {
  const h = new Holder();
  for (let i = 0; i < n; i++) h.add(mk(i));
  return h.items();
}
function viaParam(n, mk) {
  const list = [];
  fill(list, n, mk);
  return list;
}
// The control: the same elements in a list that never went stale.
function fresh(n, mk) {
  return Array.from(viaParam(n, mk));
}
const shapes = [
  ['fresh', fresh],
  ['field', viaField],
  ['param', viaParam],
];

function run(label, mk, fn) {
  for (const [shape, make] of shapes) {
    const name = label + ' (' + shape + ')';
    try {
      console.log(name, fn(make(40, mk)));
    } catch (e) {
      console.log(name, 'threw', e && e.name, e && e.message);
    }
  }
}
const num = (i) => i * 3 + 1;
const str = (i) => 's' + i;
// Long enough that node prints one element per line: the grouping of a short
// element list into columns is not what this probe is about.
const wide = (i) => 'a-long-element-that-fills-the-line-' + i;
const obj = (i) => ({ a: i, b: 'x' + i });
const pair = (i) => ['k' + i, i];
const code = (i) => 65 + (i % 26);
const byte = (i) => i & 0xff;

// JSON.stringify, with and without a replacer.
run('json replacer fn', obj, (l) => JSON.stringify(l, (k, v) => v).length);
run('json replacer fn numbers', num, (l) => JSON.stringify(l, (k, v) => v));
run('json replacer list', obj, (l) => JSON.stringify(l, ['a']).length);
run('json nested replacer', obj, (l) => JSON.stringify({ l }, (k, v) => v).length);
run('json plain', obj, (l) => JSON.stringify(l).length);
run('json indent', obj, (l) => JSON.stringify(l, null, 2).length);
run('json field', num, (l) => JSON.stringify({ l }));

// Consumers that already follow forwarding: each must keep doing so.
// Constructors and natives that read an array argument.
run('Buffer.from', byte, (l) => Buffer.from(l).toString('hex'));
run('Uint8Array', byte, (l) => new Uint8Array(l).join());
run('Uint8Array.from', byte, (l) => Uint8Array.from(l).join());
run('buffer.set', byte, (l) => {
  const b = Buffer.alloc(40);
  b.set(l);
  return b.toString('hex');
});
run('Set', num, (l) => Array.from(new Set(l)).join());
run('Map', pair, (l) => Array.from(new Map(l)).join('|'));
run('Object.fromEntries', pair, (l) => JSON.stringify(Object.fromEntries(l)));
run('Array.from', num, (l) => Array.from(l).join());
run('spread', num, (l) => [...l].join());
run('concat arg', num, (l) => [0].concat(l).join());
run('concat receiver', num, (l) => l.concat([1]).join());
run('slice', num, (l) => l.slice(2, 30).join());
run('Math.max.apply', num, (l) => Math.max.apply(null, l));
run('Math.max spread', num, (l) => Math.max(...l));
run('fromCharCode.apply', code, (l) => String.fromCharCode.apply(null, l));
run('fromCharCode spread', code, (l) => String.fromCharCode(...l));
run('Function.apply', num, (l) => (function () { return arguments.length; }).apply(null, l));
run('Reflect.apply', num, (l) => Reflect.apply(Math.max, null, l));
run('Reflect.construct', num, (l) => Reflect.construct(Array, l).length);
run('path.join spread', str, (l) => path.join(...l));
run('Blob', str, (l) => new Blob(l).size);
run('Headers', pair, (l) => Array.from(new Headers(l)).length);
run('URLSearchParams', pair, (l) => new URLSearchParams(l).toString());
run('write list', str, (l) => l.join(''));
run('fs.writevSync', byte, (l) => {
  const file = path.join(work, 'stale-writev.bin');
  const f = fs.openSync(file, 'w');
  const n = fs.writevSync(f, l.map((x) => Buffer.from([x])));
  fs.closeSync(f);
  return n + ' ' + fs.readFileSync(file).toString('hex');
});
run('sort', num, (l) => l.slice().sort((a, b) => b - a).join());
run('for of', num, (l) => {
  let s = 0;
  for (const v of l) s += v;
  return s;
});
run('destructure', num, (l) => {
  const [a, b, ...rest] = l;
  return a + ' ' + b + ' ' + rest.length;
});

// Promise combinators take the list too. Results are collected and printed in
// a fixed order once everything settled.
const lines = [];
const tasks = [];
function note(i, text) {
  lines[i] = text;
}
let slot = 0;
for (const [shape, make] of shapes) {
  const ps = () => make(40, (i) => Promise.resolve(i));
  const at = () => slot++;
  const a = at(), b = at(), c = at(), d = at();
  tasks.push(
    Promise.all(ps()).then((r) => note(a, 'Promise.all (' + shape + ') ' + r.length + ' ' + r[39])),
    Promise.allSettled(ps()).then((r) => note(b, 'Promise.allSettled (' + shape + ') ' + r.length + ' ' + r[39].value)),
    Promise.race(ps()).then((r) => note(c, 'Promise.race (' + shape + ') ' + r)),
    Promise.any(ps()).then((r) => note(d, 'Promise.any (' + shape + ') ' + r)),
  );
}
Promise.all(tasks).then(() => {
  for (const l of lines) console.log(l);
  console.log('done');
});
