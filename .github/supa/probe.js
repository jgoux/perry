// Compiled inside the Storage checkout (real node_modules) with probe=true.
"use strict";
var import_globals = require("@platformatic/globals");
console.log('typeof ns', typeof import_globals);
console.log('keys', Object.keys(import_globals).join(','));
console.log('typeof getGlobal', typeof import_globals.getGlobal);
console.log('call', String((0, import_globals.getGlobal)()));
