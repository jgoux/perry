'use strict';
// Takes ajv out of Storage's boot path. Under Perry an Ajv instance compiles the
// draft-07 meta-schema on its first addSchema/compile, and every route validator is
// code generation plus `new Function` evaluation, so these three startup costs are
// most of what is left after patch-fastify-lazy-schema.cjs:
//
//   1. dist/http/routes/s3/router.js: Router.registerRoute adds and compiles one
//      validator per S3 route (about 100). Each route now gets a validator that
//      adds and compiles its schema on its first call. The first registration of a
//      method+url key still wins, as getSchema(key) returning the existing schema
//      did, and `validate.errors` is mirrored onto the wrapper after every call,
//      which is all the S3 handler reads.
//   2. @fastify/ajv-compiler index.js: the pooled ValidatorCompiler (an Ajv instance,
//      the ajv-formats plugin and an addSchema per shared schema) is built when the
//      first route context asks for it. It is now built on the first compile, which
//      the lazy route schemas already defer to the first request. The pool still
//      keys, and the `code` (standalone) option still builds, eagerly.
//   3. `validateSchema: false` on the three Ajv instances Storage builds at boot (the S3
//      router, the lifecycle PUT validator, the fastify ajv-compiler instance), so none
//      of them compiles the meta-schema to check a schema it is about to compile.
//      Fastify callers that pass their own validateSchema still win.
//      No check is lost: every one of these schemas is static for a given
//      configuration, and the reference run that storage-prep makes under node
//      (original sources, same environment, eager registration of every S3 route,
//      fastify compile of every route, addSchema of every shared schema) fails to
//      start when any of them is not a valid schema.
//
// Differences from eager compilation, none of which a valid schema can observe:
//   - an invalid schema throws from the first request that needs it instead of from
//     startup;
//   - a validator's other ajv properties (schema, schemaEnv, source) are not on the
//     S3 route wrapper.
// usage: node patch-ajv-boot.cjs <storage checkout> [off]
const fs = require('fs');
const path = require('path');
const root = process.argv[2];
const off = process.argv[3] === 'off';

function patchFile(rel, edits) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p + '.orig')) fs.copyFileSync(p, p + '.orig');
  let src = fs.readFileSync(p + '.orig', 'utf8');
  if (!off) {
    for (const [from, to, count = 1] of edits) {
      if (src.split(from).length !== count + 1) throw new Error(`${rel}: expected ${count} occurrence(s) of: ${from}`);
      src = src.split(from).join(to);
    }
  }
  fs.writeFileSync(p, src);
}

patchFile('dist/http/routes/s3/router.js', [
  [`    addUsedSchema: false,
    allErrors: false
  }).addKeyword(import_finite.finiteKeyword);`,
   `    addUsedSchema: false,
    allErrors: false,
    validateSchema: false
  }).addKeyword(import_finite.finiteKeyword);`],
  [`    const existingSchema = this.ajv.getSchema(schemaKey);
    if (!existingSchema) {
      this.ajv.addSchema(
        {
          type: "object",
          properties: schemaToCompile,
          required: required.filter(Boolean)
        },
        schemaKey
      );
    }
    const validate = this.ajv.getSchema(schemaKey);
`,
   `    const validate = supaLazyRouteValidator(
      this.ajv,
      schemaKey,
      {
        type: "object",
        properties: schemaToCompile,
        required: required.filter(Boolean)
      }
    );
`],
  [`class Router {
`,
   `const supaRouteSchemas = /* @__PURE__ */ new WeakMap();
function supaLazyRouteValidator(ajv, key, def) {
  let defs = supaRouteSchemas.get(ajv);
  if (!defs) {
    defs = /* @__PURE__ */ new Map();
    supaRouteSchemas.set(ajv, defs);
  }
  if (!defs.has(key)) defs.set(key, def);
  let fn = null;
  function validate(data) {
    if (fn === null) {
      fn = ajv.getSchema(key);
      if (!fn) {
        ajv.addSchema(defs.get(key), key);
        fn = ajv.getSchema(key);
      }
    }
    const result = fn.apply(this, arguments);
    validate.errors = fn.errors;
    return result;
  }
  return validate;
}
class Router {
`],
]);

patchFile('dist/http/routes/bucket/lifecycle.js', [
  [`    coerceTypes: false,
    schemas: [import_auth.authSchema]
  })`,
   `    coerceTypes: false,
    validateSchema: false,
    schemas: [import_auth.authSchema]
  })`],
]);

patchFile('node_modules/@fastify/ajv-compiler/lib/validator-compiler.js', [
  ['Object.assign({}, defaultAjvOptions, options.customOptions)',
   'Object.assign({ validateSchema: false }, defaultAjvOptions, options.customOptions)', 2],
]);

patchFile('node_modules/@fastify/ajv-compiler/index.js', [
  [`    const compiler = new ValidatorCompiler(externalSchemas, options)
    const ret = compiler.buildValidatorFunction.bind(compiler)
    validatorPool.set(uniqueAjvKey, ret)

    if (options.customOptions.code !== undefined) {
      ret[AjvReference] = compiler
    }
`,
   `    let ret
    if (options.customOptions.code !== undefined) {
      const compiler = new ValidatorCompiler(externalSchemas, options)
      ret = compiler.buildValidatorFunction.bind(compiler)
      ret[AjvReference] = compiler
    } else {
      // The Ajv instance is built by the first compile, not by the first route.
      let compiler = null
      ret = function lazyBuildValidatorFunction (opts) {
        if (compiler === null) compiler = new ValidatorCompiler(externalSchemas, options)
        return compiler.buildValidatorFunction(opts)
      }
    }
    validatorPool.set(uniqueAjvKey, ret)
`],
]);

console.log(off ? 'ajv boot patches: not applied' : 'ajv boot patches applied');
