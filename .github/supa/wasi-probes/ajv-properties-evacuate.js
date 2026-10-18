// npm: ajv@8.18.0
// max-rss-mb: 1500
// wasm-env: PERRY_GC_FORCE_EVACUATE=1 PERRY_GC_VERIFY_EVACUATION=1
// ajv's `properties` keyword keeps one generated name alive across the
// recursive compilation of every property schema, which allocates enough to
// collect. The generated code must name the variable, not print an object.
const Ajv = require('ajv');
const ajv = new Ajv({ strict: false, code: { source: true } });
const sources = [];
let garbage = 0;
for (let i = 0; i < 3; i++) {
  const schema = {
    type: 'object',
    properties: {
      a: { type: 'string', minLength: 1 },
      b: { type: 'object', properties: { c: { type: 'integer' }, d: { type: 'array', items: { type: 'string' } } } },
      ['p' + i]: { type: 'number' },
    },
    required: ['a'],
  };
  const validate = ajv.compile(schema);
  const code = String(validate.source.validateCode);
  sources.push(code);
  garbage += code.split('').reverse().join('').length;
  const ok = validate({ a: 'x', b: { c: 1, d: ['y'] }, ['p' + i]: 2 });
  const bad = validate({ a: '', b: { c: 1.5 } });
  if (i % 1 === 0) console.log('schema', i, ok, bad, code.length);
}
console.log(sources[0]);
console.log('object names in generated code:', sources.filter((s) => s.includes('[object Object]')).length);
console.log('distinct', new Set(sources.map((s) => s.length)).size, garbage);
