// An uncaught throw from nested calls ends like Node: report on stderr, exit 1.
// stderr-contains: uncaught on purpose
function inner() { throw new TypeError('uncaught on purpose'); }
function outer() { inner(); }
console.log('before');
outer();
console.log('not reached');
