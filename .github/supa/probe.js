// Compiled inside the Storage checkout (real node_modules) with probe=true.
"use strict";
const Ajv = require("ajv");
const fastUri = require("fast-uri");
const ajvFormats = require("ajv-formats");
function stage(label, fn) {
  try { console.log(label, 'ok', String(fn())); } catch (e) { console.log(label, 'FAILED', String(e && e.message).slice(0, 300)); }
}
const meta = 'http://json-schema.org/draft-07/schema#';
stage('plain meta validate', () => new Ajv({ strict: false }).validate(meta, { type: 'string', maxLength: 3 }));
stage('plain meta bad', () => new Ajv({ strict: false }).validate(meta, { type: 'string', maxLength: -3 }));
stage('plain validateSchema', () => new Ajv({ strict: false }).validateSchema({ type: 'integer', minimum: 0, maxLength: 4 }));
stage('formats meta validate', () => { const a = new Ajv({ strict: false }); ajvFormats(a); return a.validate(meta, { type: 'string', maxLength: 3, minLength: 1 }); });
const fjsOpts = { strictSchema: false, validateSchema: false, allowUnionTypes: true, uriResolver: fastUri };
stage('fjs-style meta validate', () => {
  const a = new Ajv(fjsOpts); ajvFormats(a);
  a.addKeyword({ keyword: 'fjs_type', type: 'object', errors: false, validate: (_t, d) => d && typeof d.toJSON === 'function' });
  return a.validate(meta, { type: 'string', maxLength: 3, minLength: 1 });
});
stage('fast-json-stringify', () => {
  const fjs = require("fast-json-stringify");
  const f = fjs({ type: 'object', properties: { a: { type: 'integer' }, b: { anyOf: [{ type: 'string' }, { type: 'integer' }] } } });
  return f({ a: 1, b: 'x' }) + f({ a: 2, b: 5 });
});
stage('fastify with response schema', () => {
  const fastify = require("fastify");
  const app = fastify();
  app.get('/s', { schema: { response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } } } }, async () => ({ ok: true }));
  app.ready().then(() => app.inject({ method: 'GET', url: '/s' })).then(r => console.log('inject', r.statusCode, r.body), e => console.log('inject failed', String(e && e.message)));
  return 'scheduled';
});
