'use strict';
// Defers fastify 5.11.2's route schema compilation from registration to first use.
// A route's body/params/querystring/headers validators and its response
// serializers are compiled while the routes register, which for Storage's ~200
// routes is most of the startup CPU (ajv code generation and fast-json-stringify).
// compileSchemasForValidation/compileSchemasForSerialization keep their shape
// and still fill the same route-context slots, but each slot now holds a function
// that calls the compiler on its first invocation and delegates to the result.
//
// Differences from eager compilation, none of which a valid schema can observe:
//   - a schema that fails to compile throws from the first request that needs it
//     (a 500 from that request) instead of aborting
//     route registration; the failed compile is retried on the next call;
//   - `validate.errors` is mirrored onto the wrapper after every call, which is
//     all fastify and its documented getValidationFunction API read; other ajv
//     properties of a validator (schema, schemaEnv, source) are not on the wrapper;
//   - a custom compiler that returns a non-function is not detected at startup.
// Generic enough to propose to fastify; the helper is the whole change.
// usage: node patch-fastify-lazy-schema.cjs <storage checkout> [off]
const fs = require('fs');
const path = require('path');
const p = path.join(process.argv[2], 'node_modules', 'fastify', 'lib', 'validation.js');
const off = process.argv[3] === 'off';

if (!fs.existsSync(p + '.orig')) fs.copyFileSync(p, p + '.orig');
let src = fs.readFileSync(p + '.orig', 'utf8');
if (off) {
  fs.writeFileSync(p, src);
  console.log('fastify lazy schema compilation: not applied');
  process.exit(0);
}

function once(from, to) {
  if (src.split(from).length !== 2) throw new Error(`validation.js: expected exactly one occurrence of: ${from}`);
  src = src.replace(from, () => to);
}

once('function compileSchemasForSerialization (context, compile) {\n  if (!context.schema || !context.schema.response) {\n    return\n  }\n',
  `// Wraps a schema compiler so that each compiled function is built on its first call.
function lazyCompiler (compile) {
  return function lazyCompile (opts) {
    let fn = null
    function lazy (...args) {
      if (fn === null) fn = compile(opts)
      const result = fn.apply(this, args)
      lazy.errors = fn.errors
      return result
    }
    return lazy
  }
}

function compileSchemasForSerialization (context, compile) {
  if (!context.schema || !context.schema.response) {
    return
  }
  compile = lazyCompiler(compile)
`);
once('function compileSchemasForValidation (context, compile, isCustom) {\n  const { schema } = context\n  if (!schema) {\n    return\n  }\n',
  'function compileSchemasForValidation (context, compile, isCustom) {\n  const { schema } = context\n  if (!schema) {\n    return\n  }\n  compile = lazyCompiler(compile)\n');

fs.writeFileSync(p, src);
console.log('fastify lazy schema compilation applied');
