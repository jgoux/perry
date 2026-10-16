// fastify sets context[hook] = toSet.length ? toSet : null in a preReady
// callback for hooks its Context constructor never declared, then reads
// `preParsing !== null`. Each variant prints what a later read observes.
'use strict';
const kRouteContext = Symbol('route-context');
const hooks = ['onTimeout', 'onRequest', 'preParsing', 'preValidation', 'preHandler'];
const kHooks = { onTimeout: [], onRequest: [], preParsing: [], preValidation: [], preHandler: [] };
let failed = 0;
function check(name, ctx) {
  const seen = hooks.map((h) => (ctx[h] === null ? 'null' : ctx[h] === undefined ? 'undefined' : 'value')).join(',');
  const ok = seen === 'null,null,null,null,null';
  if (!ok) failed++;
  console.log(name, seen, ok ? 'ok' : 'WRONG');
}

function Ctx(o) { this.schema = o.schema; this.onTimeout = null; this.onRequest = null; this.preHandler = null; this.server = o.server; }
class KCtx { constructor(o) { this.schema = o.schema; this.onTimeout = null; this.onRequest = null; this.preHandler = null; this.server = o.server; } }

// A: constructor function, loop with ternary-null assign.
const a = new Ctx({ schema: 1, server: {} });
for (const hook of hooks) { const toSet = kHooks[hook].concat([]); a[hook] = toSet.length ? toSet : null; }
check('A fn ctor', a);

// B: class, same loop.
const b = new KCtx({ schema: 1, server: {} });
for (const hook of hooks) { const toSet = kHooks[hook].concat([]); b[hook] = toSet.length ? toSet : null; }
check('B class', b);

// C: fastify's exact expression inside a callback, `this` bound.
const opts = {};
const c = new KCtx({ schema: 1, server: {} });
const self = { [Symbol.for('hooks')]: kHooks };
const cb = () => {
  for (const hook of hooks) {
    const toSet = kHooks[hook].concat(opts[hook] || []).map((h) => h.bind(self));
    c[hook] = toSet.length ? toSet : null;
  }
};
cb();
check('C callback', c);

// D: read through a symbol-keyed holder like request[kRouteContext].
const d = new KCtx({ schema: 1, server: {} });
const req = { [kRouteContext]: d };
for (const hook of hooks) { const toSet = kHooks[hook].concat([]); d[hook] = toSet.length ? toSet : null; }
const viaHolder = req[kRouteContext].preParsing !== null;
if (viaHolder) failed++;
console.log('D holder preParsing !== null =', viaHolder, viaHolder ? 'WRONG' : 'ok');

if (failed) { console.log('FAILED', failed); process.exit(1); }
console.log('all ok');
