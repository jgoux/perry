// Classes, Symbols, Map and Set behave like Node.
class Animal {
  #secret = 7;
  static count = 0;
  constructor(name) { this.name = name; Animal.count++; }
  get secret() { return this.#secret; }
  speak() { return `${this.name} makes a sound`; }
  static create(n) { return new this(n); }
  toString() { return `Animal(${this.name})`; }
}
class Dog extends Animal {
  speak() { return super.speak() + ' (woof)'; }
  get [Symbol.toStringTag]() { return 'Dog'; }
}
const d = Dog.create('rex');
console.log(d.speak(), d.secret, Animal.count, `${d}`, Object.prototype.toString.call(d));
console.log(d instanceof Animal, Object.getPrototypeOf(Dog) === Animal, Dog.name);

const sym = Symbol('tag');
const obj = { [sym]: 1, plain: 2, [Symbol.for('shared')]: 3 };
console.log(Object.keys(obj).join(','), Object.getOwnPropertySymbols(obj).length, sym.toString(), sym.description);
console.log(Symbol.for('shared') === Symbol.for('shared'), Symbol('a') === Symbol('a'), Symbol.keyFor(Symbol.for('shared')));
class Range {
  constructor(n) { this.n = n; }
  *[Symbol.iterator]() { for (let i = 0; i < this.n; i++) yield i; }
  [Symbol.toPrimitive](hint) { return hint === 'number' ? this.n : `Range(${this.n})`; }
}
console.log([...new Range(4)].join(','), +new Range(3), `${new Range(2)}`);

const m = new Map();
m.set('a', 1).set({ k: 1 }, 'obj').set(NaN, 'nan').set(0, 'zero');
console.log(m.size, m.get('a'), m.get(NaN), m.get(-0), [...m.keys()].length);
m.delete('a');
console.log([...m.values()].join('|'));
const s = new Set([3, 1, 3, 2, 1]);
console.log(s.size, [...s].join(','), s.has(2), s.has(9));
for (const [k, v] of new Map([[1, 'x'], [2, 'y']])) console.log(k, v);
const wm = new WeakMap(); const key = {}; wm.set(key, 'v');
console.log(wm.get(key), wm.has({}));
console.log(JSON.stringify([...new Map([[1, 2]])]), JSON.stringify([...new Set(['a'])]));
