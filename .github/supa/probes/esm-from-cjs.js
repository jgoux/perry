// An ESM-only package (type: module, exports.require -> the same file) required
// from CommonJS, the way storage's esbuild output requires @platformatic/globals.
"use strict";
var import_esm = require("esm-pkg");
console.log('typeof ns', typeof import_esm);
console.log('keys', Object.keys(import_esm).join(','));
console.log('typeof getGlobal', typeof import_esm.getGlobal);
console.log('typeof updateGlobals', typeof import_esm.updateGlobals);
console.log('call', String((0, import_esm.getGlobal)()));
