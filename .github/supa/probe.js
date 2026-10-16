// Compiled inside the Storage checkout (real node_modules) with probe=true.
"use strict";
const cg = require("ajv/dist/compile/codegen");
const { _, not, and, Name } = cg;
const data = new Name("data");
const show = (label, c) => console.log(label, '=>', String(c));
const t1 = _`typeof ${data} == "number"`;
show('t1', t1);
const t2 = _`!(${data} % 1)`;
show('t2', t2);
const a = and(t1, t2);
show('and', a);
show('not(and)', not(a));
const a3 = and(t1, t2, _`isFinite(${data})`);
show('and3', a3);
show('not(and3)', not(a3));
const g = new cg.CodeGen({ es5: false, lines: false });
g.if(not(a3), () => g.return(false));
console.log('gen', String(g.toString()));
const Ajv = require("ajv");
const ajv = new Ajv({ strict: false });
try {
  const v = ajv.compile({ type: "integer", minimum: 0 });
  console.log('valid(3)', v(3), 'valid(-1)', v(-1), 'valid(1.5)', v(1.5));
} catch (e) {
  console.log('ajv compile failed', String(e && e.message).slice(0, 300));
}
