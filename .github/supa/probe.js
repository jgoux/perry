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
stage('compile integer', () => { const v = new Ajv({ strict: false }).compile({ type: 'integer', minimum: 0 }); return v(3) + ',' + v(-1) + ',' + v(1.5); });
const fjsOpts = { strictSchema: false, validateSchema: false, allowUnionTypes: true, uriResolver: fastUri };
stage('fjs-style meta validate', () => {
  const a = new Ajv(fjsOpts); ajvFormats(a);
  return a.validate(meta, { type: 'string', maxLength: 3, minLength: 1 });
});
