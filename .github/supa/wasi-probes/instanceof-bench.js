// network: yes (node:stream links the shared net code; supa_net is imported but never called)
// `instanceof` cost: the left operands Storage's download path passes through
// fastify's reply.send (`payload instanceof Error`) and an onSend hook
// (`payload instanceof Blob`) -- a node:fs read stream -- plus the other common
// shapes. stdout (compared with node) carries the answers; timings and the
// [[Prototype]] chains go to stderr, which is not compared.
const fs = require('node:fs');
const path = require('node:path');
const { Readable, PassThrough } = require('node:stream');
const base = process.env.WORK_DIR || '/work';
const file = path.join(base, 'instanceof-bench.bin');
fs.writeFileSync(file, Buffer.alloc(1024, 7));

class Base {}
class Derived extends Base {}
function Legacy() {}

const rs = fs.createReadStream(file);
rs.on('error', () => {});
const subjects = {
  'fs.ReadStream': rs,
  PassThrough: new PassThrough(),
  Readable: new Readable({ read() {} }),
  Buffer: Buffer.alloc(8),
  Uint8Array: new Uint8Array(8),
  Error: new Error('x'),
  Derived: new Derived(),
  Legacy: new Legacy(),
  plain: { a: 1 },
  array: [1, 2],
  null: null,
  number: 3,
};
const targets = { Error, Blob, ArrayBuffer, Readable, Base, Legacy, Object, Array };

function chain(label, o) {
  const parts = [];
  let cur = o;
  for (let i = 0; i < 12 && cur !== null && typeof cur === 'object'; i++) {
    const next = Object.getPrototypeOf(cur);
    if (next === null) {
      parts.push('null');
      break;
    }
    const c = next.constructor;
    parts.push((next === cur ? 'SELF! ' : '') + (typeof c === 'function' ? c.name : typeof c));
    if (next === cur) break;
    cur = next;
  }
  console.error('chain', label, '=>', parts.join(' > '));
}
for (const k of Object.keys(subjects)) {
  const v = subjects[k];
  if (v !== null && typeof v === 'object') chain(k, v);
}

const now = () => Number(process.hrtime.bigint()) / 1e6;
const answers = [];
let slow = 0;
let readStreamInReadable = NaN;
for (const sk of Object.keys(subjects)) {
  const v = subjects[sk];
  const row = [];
  for (const tk of Object.keys(targets)) {
    const C = targets[tk];
    const t0 = now();
    const r = v instanceof C;
    const first = now() - t0;
    row.push(r ? 1 : 0);
    // A single check that already takes milliseconds is the finding; do not repeat it.
    let n = 1;
    let per = first;
    if (first < 1) {
      n = 20000;
      const t1 = now();
      let hits = 0;
      for (let i = 0; i < n; i++) if (v instanceof C) hits++;
      per = (now() - t1) / n;
      if ((hits === n) !== r) throw new Error('unstable result');
    } else {
      slow++;
    }
    if (sk === 'fs.ReadStream' && tk === 'Readable') readStreamInReadable = per;
    console.error(
      'bench',
      sk.padEnd(14),
      tk.padEnd(11),
      (per * 1000).toFixed(2).padStart(10),
      'us/op over',
      n,
    );
  }
  answers.push(sk + ' ' + row.join(''));
}
console.log(answers.join('\n'));
console.error('summary: fs.ReadStream instanceof Readable', (readStreamInReadable * 1000).toFixed(2), 'us/op');
console.error('slow checks (>= 1 ms for one call):', slow);
rs.destroy();
rs.on('close', () => fs.rmSync(file, { force: true }));
