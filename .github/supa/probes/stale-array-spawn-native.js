// compare-node
// child_process.spawn fed an argument list whose head is a forwarding stub after a push grew it
// (wasi-probes/stale-array-consumers.js has the full story). node is the reference.
const cp = require('child_process');
const v8 = require('v8');

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
const str = (i) => 'a' + i;
const num = (i) => i * 3 + 1;
const obj = (i) => ({ a: i, b: 'x' + i });

const lines = [];
const kids = shapes.map(([shape, make], i) => new Promise((resolve) => {
  let out = '';
  const c = cp.spawn('echo', make(40, str));
  c.stdout.on('data', (d) => { out += d; });
  c.on('close', () => { lines[i] = 'spawn args (' + shape + ') ' + out.trim(); resolve(); });
}));
Promise.all(kids).then(() => {
  for (const l of lines) console.log(l);
  console.log('done');
});
