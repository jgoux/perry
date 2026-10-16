// Layouts and atoms register through .init_array constructors on wasm. If the
// constructors do not run, property reads on builtins and shaped objects miss.
const o = { a: 1, b: 'two', c: [3] };
const keys = ['a', 'b', 'c', 'missing'];
console.log(keys.map((k) => typeof o[k]).join(','));
console.log(Object.keys(o).join(','), JSON.stringify(o));
const m = new Map([['x', 1]]);
console.log(m.get('x'), m.size, typeof m.get, typeof Map.prototype.set);
const e = new RangeError('r');
console.log(e.name, e.message, e instanceof Error, typeof e.stack);
console.log(Buffer.from('abc').length, typeof Buffer.prototype.toString);
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf([])).includes('push'));
console.log(typeof process.stdout.write, typeof process.env, typeof process.argv.length);
console.log([10, 9, 1].sort().join(','), 'abc'.toUpperCase(), (255).toString(16));
console.log(new Date(0).toISOString(), Math.max(1, 2, 3), parseInt('42px'));
