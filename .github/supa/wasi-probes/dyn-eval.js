// new Function compiles and runs source text at run time (runtime interpreter).
const add = new Function('a', 'b', 'return a + b');
console.log('add', add(1, 2));
const fib = new Function('n', 'let a = 0, b = 1; for (let i = 0; i < n; i++) { const t = a + b; a = b; b = t; } return a;');
console.log('fib', fib(20));
const mk = new Function('return { name: "dyn", list: [1, 2, 3].map(x => x * x) }');
console.log(JSON.stringify(mk()));
const thrower = new Function('throw new RangeError("from eval")');
try { thrower(); } catch (e) { console.log('caught', e.name, e.message); }
console.log(Function('x', 'return x * 2')(21), typeof add, add.length);
