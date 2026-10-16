// A thrown value must reach the nearest catch: directly, across calls,
// through rethrow, and out of nested try blocks.
function boom(msg) { throw new Error(msg); }
function mid(msg) { boom(msg); return 'unreachable'; }
function outer(msg) { return mid(msg); }
try { throw new Error('direct'); } catch (e) { console.log('caught', e.message); }
try { outer('across'); } catch (e) { console.log('caught', e.message); }
try { null.x; } catch (e) { console.log('caught', e.constructor.name); }
try { undefinedFunction(); } catch (e) { console.log('caught', e.name); }
try {
  try { boom('inner'); } catch (e) { console.log('inner caught', e.message); throw new TypeError('rethrown'); }
} catch (e) { console.log('outer caught', e.name, e.message); }
try { throw 42; } catch (e) { console.log('non-error', e, typeof e); }
try { throw { code: 'E_OBJ' }; } catch (e) { console.log('object', e.code); }
let depth = 0;
function recurse(n) { depth++; if (n === 0) throw new Error('bottom'); return recurse(n - 1); }
try { recurse(500); } catch (e) { console.log('deep', e.message, depth); }
for (let i = 0; i < 1000; i++) { try { if (i % 2) throw i; } catch (e) { depth += e; } }
console.log('loop', depth);
console.log('done');
