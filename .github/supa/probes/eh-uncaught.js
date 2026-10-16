// expect-exit: 1
// An uncaught throw from nested calls must end like Node: report, exit 1, and
// no "FATAL: exception transport failed" from the runtime.
function inner() { throw new TypeError('uncaught on purpose'); }
function outer() { inner(); }
console.log('before');
outer();
console.log('not reached');
