// Dynamic string-key read cost on the shapes ajv's generated validators, find-my-way,
// lru-cache and fastify read through `o[key]` and `o.name`: a hit in a small object,
// an absent key that ends at Object.prototype, inherited reads through a short chain,
// a big dictionary with mixed hits and misses, a null-prototype map, a class
// instance missing its method names, and named reads from one site that sees
// many shapes (the site stays megamorphic, so every read takes the miss path).
// stdout (compared with node) carries a checksum of every phase's results; the
// timings go to stderr, which is not compared.
const now = () => Number(process.hrtime.bigint()) / 1e6;
const N = Number(process.env.DYNGET_ITERS || 200000);
const ROUNDS = 3;

const schemaKeywords = (
  '$id,$ref,type,properties,required,additionalProperties,items,enum,const,format,' +
  'pattern,minimum,maximum,minLength,maxLength,minItems,maxItems,uniqueItems,allOf,anyOf,' +
  'oneOf,not,if,then,else,default,title,description,definitions,patternProperties,dependencies'
).split(',');
// what libraries probe on arbitrary values: Object.prototype members, then keys nothing defines
const protoNames = [
  'toString', 'then', 'toJSON', 'valueOf', 'nodeType', 'hasOwnProperty', '$$typeof',
  'constructor', 'asymmetricMatch', 'length',
];

// small schema-node objects: a handful of keywords each, the rest absent
const nodes = [];
for (let i = 0; i < 64; i++) {
  const n = {};
  n.type = i % 3 ? 'object' : 'string';
  if (i % 2) n.properties = { a: 1 };
  if (i % 5 === 0) n.required = ['a'];
  if (i % 7 === 0) n.additionalProperties = false;
  if (i % 4 === 0) n.minLength = i;
  nodes.push(n);
}

const big = {};
for (let i = 0; i < 400; i++) big['route' + i] = i;
const bigKeys = [];
for (let i = 0; i < 800; i++) bigKeys.push('route' + ((i * 7) % 800));

const parent = { shared: 1, other: 2 };
const middle = Object.create(parent);
middle.mid = 3;
const leaf = Object.create(middle);
leaf.own = 4;
const chainKeys = ['own', 'mid', 'shared', 'other', 'absent', 'toString', 'nothing', 'valueOf'];

const dict = Object.create(null);
for (let i = 0; i < 80; i++) dict['key' + i] = i;
const dictKeys = [];
for (let i = 0; i < 160; i++) dictKeys.push('key' + ((i * 3) % 160));

class Service {
  constructor() {
    this.name = 'svc';
    this.count = 1;
  }
  run() {}
}
const instance = new Service();
const instanceKeys = ['name', 'count', 'run', 'toString', 'stop', 'hasOwnProperty', 'missing'];

function score(v) {
  return v === undefined ? 1 : typeof v === 'number' ? v : typeof v === 'string' ? v.length : 3;
}

// one site, many shapes: absent schema keywords, and the names libraries probe on any value
function readSchema(n) {
  return (
    score(n.type) + score(n.properties) + score(n.required) + score(n.additionalProperties) +
    score(n.minLength) + score(n.pattern) + score(n.format) + score(n.items) + score(n.enum) +
    score(n.$ref)
  );
}
function probeAny(v) {
  return (
    (v.then === undefined ? 1 : 2) + (v.toJSON === undefined ? 1 : 2) + (v.nodeType === undefined ? 1 : 2) +
    (v.$$typeof === undefined ? 1 : 2) + (v.asymmetricMatch === undefined ? 1 : 2) +
    (v.toString === undefined ? 1 : 2) + (v.hasOwnProperty === undefined ? 1 : 2) +
    (v.valueOf === undefined ? 1 : 2)
  );
}
const READS_PER_ITER = { 'named-megamorphic': 10, 'named-probe-any': 8 };

const phases = [
  ['small-hit/miss', () => {
    let sum = 0;
    for (let i = 0; i < N; i++) {
      sum += score(nodes[i & 63][schemaKeywords[i % schemaKeywords.length]]);
    }
    return sum;
  }],
  ['proto-miss', () => {
    let sum = 0;
    const o = nodes[3];
    for (let i = 0; i < N; i++) sum += score(o[protoNames[i % protoNames.length]] === undefined ? 0 : 1);
    return sum;
  }],
  ['chain', () => {
    let sum = 0;
    for (let i = 0; i < N; i++) sum += score(leaf[chainKeys[i & 7]]);
    return sum;
  }],
  ['big-dictionary', () => {
    let sum = 0;
    for (let i = 0; i < N; i++) sum += score(big[bigKeys[i % bigKeys.length]]);
    return sum;
  }],
  ['null-proto-map', () => {
    let sum = 0;
    for (let i = 0; i < N; i++) sum += score(dict[dictKeys[i % dictKeys.length]]);
    return sum;
  }],
  ['named-megamorphic', () => {
    let sum = 0;
    for (let i = 0; i < N; i++) sum += readSchema(nodes[i & 63]);
    return sum;
  }],
  ['named-probe-any', () => {
    let sum = 0;
    for (let i = 0; i < N; i++) sum += probeAny(nodes[i & 63]);
    return sum;
  }],
  ['class-instance', () => {
    let sum = 0;
    for (let i = 0; i < N; i++) sum += score(instance[instanceKeys[i % instanceKeys.length]] === undefined ? 0 : 1);
    return sum;
  }],
];

const results = [];
let total = 0;
for (const [label, run] of phases) {
  let best = Infinity;
  let sum = 0;
  for (let r = 0; r < ROUNDS; r++) {
    const t0 = now();
    sum = run();
    best = Math.min(best, now() - t0);
  }
  total += best;
  results.push(label + ' ' + sum);
  const reads = N * (READS_PER_ITER[label] || 1);
  console.error('bench', label.padEnd(18), best.toFixed(1).padStart(9), 'ms /', reads, 'reads', ((best * 1e6) / reads).toFixed(0).padStart(6), 'ns/read');
}
console.log(results.join('\n'));
console.error('bench total best-of-' + ROUNDS + ':', total.toFixed(1), 'ms');
