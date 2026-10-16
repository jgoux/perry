// finally runs on every path: normal, throw, return, break and continue.
function f1() { try { return 'try'; } finally { console.log('f1 finally'); } }
function f2() { try { throw new Error('f2'); } catch (e) { return 'catch ' + e.message; } finally { console.log('f2 finally'); } }
function f3() { try { throw new Error('f3'); } finally { console.log('f3 finally'); } }
function f4() { try { return 'a'; } finally { return 'b'; } }
console.log(f1());
console.log(f2());
try { f3(); } catch (e) { console.log('f3 caught', e.message); }
console.log(f4());
for (let i = 0; i < 3; i++) {
  try { if (i === 1) continue; console.log('body', i); } finally { console.log('finally', i); }
}
outer: for (let i = 0; i < 2; i++) {
  for (let j = 0; j < 2; j++) {
    try { if (j === 1) break outer; console.log('inner', i, j); } finally { console.log('cleanup', i, j); }
  }
}
try {
  try { throw new Error('first'); } finally { console.log('inner finally'); }
} catch (e) { console.log('got', e.message); }
console.log('done');
