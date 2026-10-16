// Compiled inside the Storage checkout (real node_modules) with probe=true.
"use strict";
const Ajv = require("ajv");
const fastUri = require("fast-uri");
const opts = { coerceTypes: 'array', useDefaults: true, removeAdditional: true, uriResolver: fastUri, addUsedSchema: false, allErrors: false };
let fails = 0;
function stage(label, fn) {
  try { console.log(label, 'ok', String(fn())); } catch (e) { fails++; console.log(label, 'FAILED', String(e && e.message).slice(0, 700)); }
}
// 1. fastify-style options, repeated compiles with garbage in between.
const junk = [];
for (let round = 0; round < 40; round++) {
  stage('round' + round, () => {
    const ajv = new Ajv(opts);
    const v = ajv.compile({ type: "object", properties: { n: { type: "integer", minimum: 0 }, s: { type: "string", maxLength: 10 } }, required: ["n"] });
    for (let i = 0; i < 2000; i++) junk.push({ i, s: "x" + i });
    if (junk.length > 20000) junk.length = 0;
    return v({ n: 3, s: "a" }) + ',' + v({ n: -1 }) + ',' + v({ n: 1.5 });
  });
}
// 2. a real fastify app with a validated route.
stage('fastify', () => {
  const fastify = require("fastify");
  const app = fastify();
  app.get('/x/:id', { schema: { params: { type: 'object', properties: { id: { type: 'integer' } } } } }, async () => ({ ok: true }));
  app.get('/status', async () => ({ ok: true }));
  app.ready().then(() => app.inject({ method: 'GET', url: '/status' })).then(r => console.log('inject', r.statusCode, r.body), e => console.log('inject failed', String(e && e.message)));
  return 'scheduled';
});
console.log('fails', fails);
