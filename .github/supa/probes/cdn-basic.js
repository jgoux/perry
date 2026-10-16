// What cdn-cache-manager.js needs at module init: undici's Agent and the
// global Headers/URL constructors.
const undici = require('undici');
console.log('typeof undici.Agent', typeof undici.Agent);
console.log('typeof Headers', typeof Headers);
console.log('typeof URL', typeof URL);
try {
  const a = new undici.Agent({ keepAliveTimeout: 1000 });
  console.log('agent ok', typeof a);
} catch (e) {
  console.log('agent threw', String(e));
}
try {
  const h = new Headers({ a: 'b' });
  console.log('headers ok', h.get('a'));
} catch (e) {
  console.log('headers threw', String(e));
}
