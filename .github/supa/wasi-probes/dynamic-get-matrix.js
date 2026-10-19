// Dynamic string-key reads (`o[key]`, `o.name`) whose inline fast path misses:
// own and inherited data, absent keys that end at Object.prototype or at a null
// prototype, accessors, Object.prototype additions and removals after a miss,
// own shadows and deletes, prototype swaps, symbol and numeric-string keys,
// Object.keys order, dictionary-sized objects, and the receiver kinds whose
// reads the shapes alone do not decide (class instances, arrays, functions,
// RegExp, Map/Set, WeakMap/WeakSet, arguments, boxed primitives, built-in
// namespaces, globalThis). Every line is compared with node.
const out = [];
const check = (label, value) => out.push(label + ': ' + value);
const show = (v) => {
  if (v === undefined) return 'u';
  if (typeof v === 'function') return 'fn';
  if (typeof v === 'symbol') return 'sym';
  if (v === null) return 'null';
  if (typeof v === 'object') return 'obj';
  return typeof v + ':' + String(v);
};
// Keys come from data, never from literals the compiler could resolve.
const keys = (
  'a,b,missing,toString,hasOwnProperty,valueOf,constructor,__proto__,isPrototypeOf,' +
  'propertyIsEnumerable,toLocaleString,__defineGetter__,__lookupGetter__,0,1,2,length,' +
  'name,message,flags,source,lastIndex,size,prototype,@@iterator,Symbol.iterator,' +
  '#a,__proto,proto__,hasOwn'
).split(',');
const row = (o) => keys.map((k) => show(o[k])).join(' ');
const rowTry = (f) => {
  try {
    return f();
  } catch (e) {
    return 'throws ' + (e && e.name);
  }
};

// receivers
function Legacy() {
  this.own = 1;
}
Legacy.prototype.inherited = 2;
class Klass {
  x = 1;
  get g() {
    return 'getter';
  }
  m() {}
  static s = 3;
}
class Sub extends Klass {
  y = 2;
}
const withGetter = {
  a: 1,
  get missing() {
    return 'from getter ' + this.a;
  },
  set b(v) {
    this._b = v;
  },
};
const chain1 = { a: 5, b: 6 };
const chain2 = Object.create(chain1);
chain2.c = 7;
const chain3 = Object.create(chain2);
const nullChain = Object.create(Object.create(null));
const nullProto = Object.create(null);
nullProto.a = 1;
function argsObject() {
  return arguments;
}
const receivers = {
  plain: { a: 1, b: 2 },
  empty: {},
  literal3: { a: 1, b: 2, 0: 'zero', 1: 'one' },
  nullProto,
  nullChain,
  chain2,
  chain3,
  legacy: new Legacy(),
  klass: new Klass(),
  sub: new Sub(),
  klassCtor: Klass,
  withGetter,
  array: [1, 2, 3],
  fn: function named(a, b) {},
  arrow: () => 1,
  regexp: /x+/gi,
  map: new Map([[1, 2]]),
  set: new Set([1]),
  weakmap: new WeakMap(),
  weakset: new WeakSet(),
  date: new Date(0),
  error: new Error('boom'),
  typeError: new TypeError('bad'),
  args: argsObject(1, 2),
  boxedString: new String('abc'),
  boxedNumber: new Number(5),
  Math,
  JSON,
  Reflect,
  globalThis,
  promise: Promise.resolve(1),
  u8: new Uint8Array(3),
};
for (const label of Object.keys(receivers)) {
  check('row ' + label, rowTry(() => row(receivers[label])));
}

// own value, inherited value and absence across a null-prototype chain
check('chain3 a', chain3['a'] + ' ' + chain3['c'] + ' ' + chain3['zz'.slice(0, 2) + 'x']);
check('nullChain toString', show(nullChain['toString'.slice(0)]));
check('nullProto a', show(nullProto['a']));
check('nullProto hasOwnProperty', show(nullProto['hasOwnProperty'.slice(0)]));

// Object.prototype additions and removals after a miss
{
  const probe = 'late' + ['Prop'].join('');
  const o1 = { a: 1 };
  const o2 = Object.create(o1);
  const o3 = {};
  const readAll = () => show(o1[probe]) + ' ' + show(o2[probe]) + ' ' + show(o3[probe]);
  check('prototype add: before', readAll());
  check('prototype add: miss again', readAll());
  Object.prototype[probe] = 5;
  check('prototype add: data', readAll());
  Object.defineProperty(o2, probe, { value: 6, configurable: true, writable: true });
  check('prototype add: shadow', readAll());
  delete o2[probe];
  check('prototype add: unshadow', readAll());
  delete Object.prototype[probe];
  check('prototype add: removed', readAll());
  Object.defineProperty(Object.prototype, probe, {
    get() {
      return 'getter sees a=' + this.a;
    },
    configurable: true,
  });
  check('prototype getter', readAll());
  delete Object.prototype[probe];
  check('prototype getter removed', readAll());
  const calls = [];
  Object.defineProperty(Object.prototype, probe, {
    get() {
      calls.push('get');
      return 7;
    },
    set(v) {
      calls.push('set ' + v);
    },
    configurable: true,
  });
  o3[probe] = 9;
  check('prototype setter', calls.join('|') + ' own=' + Object.prototype.hasOwnProperty.call(o3, probe));
  check('prototype setter read', readAll());
  delete Object.prototype[probe];
  o3[probe] = 10;
  check('prototype setter removed', readAll() + ' own=' + Object.keys(o3).join(','));
  delete o3[probe];
  check('prototype after own delete', readAll());
}

// Object.prototype methods replaced and restored
{
  const original = Object.prototype.valueOf;
  const o = { a: 1 };
  const name = 'value' + 'Of';
  check('method before', o[name] === original);
  Object.prototype[name] = function replaced() {
    return 'replaced';
  };
  check('method replaced', o[name]() + ' ' + (o[name] === original));
  delete Object.prototype[name];
  check('method deleted', show(o[name]));
  Object.defineProperty(Object.prototype, name, {
    value: original,
    writable: true,
    configurable: true,
    enumerable: false,
  });
  check('method restored', o[name] === original);
}

// own shadows, deletes and re-adds; Object.keys order
{
  const o = { a: 1, b: 2, c: 3 };
  const read = (k) => show(o[k]);
  check('delete: before', read('b') + ' ' + Object.keys(o).join());
  delete o.b;
  check('delete: after', read('b') + ' ' + Object.keys(o).join());
  o.b = 4;
  check('delete: re-added last', read('b') + ' ' + Object.keys(o).join());
  o.toString = 'own';
  check('shadow builtin', read('toString') + ' ' + Object.keys(o).join());
  delete o.toString;
  check('unshadow builtin', show(o['to' + 'String']) + ' ' + Object.keys(o).join());
  const mixed = { z: 1, 2: 'two', y: 2, 1: 'one', x: 3, 10: 'ten', '01': 'str', '-1': 'neg' };
  check('numeric keys order', Object.keys(mixed).join());
  check('numeric reads', ['1', '2', '10', '01', '-1', '3', '1.0'].map((k) => show(mixed[k])).join(' '));
  delete mixed[2];
  mixed[2] = 'again';
  check('numeric re-add', Object.keys(mixed).join() + ' ' + mixed[1 + 1]);
  check('for-in order', (() => { const r = []; for (const k in mixed) r.push(k); return r.join(); })());
}

// prototype swaps after a miss
{
  const holder = { late: 9 };
  const other = { late: 10, extra: 11 };
  const o = { a: 1 };
  const miss = () => show(o['la' + 'te']) + ' ' + show(o['ex' + 'tra']) + ' ' + show(o['to' + 'String']);
  check('proto swap: before', miss());
  Object.setPrototypeOf(o, holder);
  check('proto swap: holder', miss());
  Object.setPrototypeOf(o, other);
  check('proto swap: other', miss());
  Object.setPrototypeOf(o, null);
  check('proto swap: null', miss());
  Object.setPrototypeOf(o, Object.prototype);
  check('proto swap: Object.prototype', miss());
  o.__proto__ = holder;
  check('proto swap: __proto__ set', miss());
  const viaProto = { __proto__: other, own: 1 };
  check('proto literal', show(viaProto['late']) + ' ' + show(viaProto['own']) + ' ' + show(viaProto['to' + 'String']));
  const nullLiteral = { __proto__: null, own: 1 };
  check('null literal', show(nullLiteral['own']) + ' ' + show(nullLiteral['to' + 'String']));
  check('grandparent mutation', (() => {
    const g = { deep: 1 };
    const p = Object.create(g);
    const c = Object.create(p);
    const before = show(c['de' + 'ep']) + show(c['sh' + 'adow']);
    g.shadow = 2;
    const addedUp = show(c['sh' + 'adow']);
    p.shadow = 3;
    const shadowed = show(c['sh' + 'adow']);
    delete p.shadow;
    delete g.shadow;
    return before + ' ' + addedUp + ' ' + shadowed + ' ' + show(c['sh' + 'adow']);
  })());
}

// symbol keys
{
  const s1 = Symbol('s1');
  const s2 = Symbol.for('s2');
  const o = { a: 1 };
  check('symbol miss', show(o[s1]) + ' ' + show(o[Symbol.iterator]) + ' ' + show(o[Symbol.toStringTag]));
  o[s1] = 'one';
  check('symbol own', show(o[s1]) + ' ' + Object.getOwnPropertySymbols(o).length + ' ' + Object.keys(o).join());
  Object.prototype[s2] = 'from proto';
  check('symbol on Object.prototype', show(o[s2]) + ' ' + show({}[s2]) + ' ' + show(Object.create(null)[s2]));
  delete Object.prototype[s2];
  check('symbol removed', show(o[s2]) + ' ' + show({}[s2]));
  const strKey = '@@iterator';
  check('@@ string key', show(o[strKey]) + ' ' + show([][strKey]));
  o[strKey] = 'str';
  check('@@ string key own', show(o[strKey]) + ' ' + Object.keys(o).join());
  const tagged = { [Symbol.toStringTag]: 'T' };
  check('toStringTag', Object.prototype.toString.call(tagged) + ' ' + show(tagged[Symbol.toStringTag]));
}

// accessors, frozen and sealed receivers
{
  const calls = [];
  const o = {
    get a() {
      calls.push('a');
      return 1;
    },
    b: 2,
  };
  const child = Object.create(o);
  check('getter own', show(o['a']) + ' ' + show(child['a']) + ' ' + show(child['b']) + ' ' + calls.join());
  const frozen = Object.freeze({ a: 1, b: 2 });
  check('frozen', show(frozen['a']) + ' ' + show(frozen['zz'.slice(1)]) + ' ' + show(frozen['to' + 'String']));
  const sealed = Object.seal({ a: 1 });
  check('sealed', show(sealed['a']) + ' ' + show(sealed['x' + 'y']));
  const nonExt = Object.preventExtensions({ a: 1 });
  check('non-extensible', show(nonExt['a']) + ' ' + show(nonExt['x' + 'y']));
  const defined = {};
  Object.defineProperty(defined, 'hidden', { value: 1, enumerable: false });
  Object.defineProperty(defined, 'ro', { value: 2, writable: false, enumerable: true });
  check('defineProperty', show(defined['hid' + 'den']) + ' ' + show(defined['ro']) + ' ' + Object.keys(defined).join());
}

// dictionary-sized objects: hits, misses, deletes
{
  const big = {};
  for (let i = 0; i < 300; i++) big['k' + i] = i;
  const sample = [0, 1, 150, 299, 300, 1000].map((i) => show(big['k' + i])).join(' ');
  check('big hit/miss', sample + ' ' + show(big['to' + 'String']) + ' ' + Object.keys(big).length);
  for (let i = 0; i < 300; i += 7) delete big['k' + i];
  check('big after deletes', [0, 1, 7, 150, 294, 299].map((i) => show(big['k' + i])).join(' ') + ' ' + Object.keys(big).length);
  big.k0 = 'back';
  check('big re-add', show(big['k' + 0]) + ' ' + Object.keys(big).slice(-2).join());
  const child = Object.create(big);
  check('big child', show(child['k' + 1]) + ' ' + show(child['k' + 7]) + ' ' + show(child['miss' + 'ing']));
}

// receivers that must keep their own semantics
{
  const arr = [1, 2, 3];
  arr.extra = 'e';
  check('array', show(arr['0']) + ' ' + show(arr['length']) + ' ' + show(arr['extra']) + ' ' + show(arr['4']) + ' ' + show(arr['mi' + 'ss']));
  const re = /ab(c)/g;
  re.custom = 1;
  check('regexp', show(re['flags']) + ' ' + show(re['source']) + ' ' + show(re['lastIndex']) + ' ' + show(re['custom']) + ' ' + show(re['mi' + 'ss']));
  const m = new Map([['k', 1]]);
  m.extra = 'x';
  check('map', show(m['size']) + ' ' + show(m['extra']) + ' ' + show(m['mi' + 'ss']) + ' ' + show(m['k']));
  const wm = new WeakMap();
  wm.extra = 'x';
  check('weakmap', show(wm['extra']) + ' ' + show(wm['mi' + 'ss']) + ' ' + show(wm['ge' + 't']) + ' ' + show(wm['has']));
  function f(a, b) {
    return arguments;
  }
  const args = f(1, 2, 3);
  check('arguments', show(args['0']) + ' ' + show(args['length']) + ' ' + show(args['2']) + ' ' + show(args['3']) + ' ' + show(args['mi' + 'ss']));
  const boxed = new String('abc');
  check('boxed string', show(boxed['0']) + ' ' + show(boxed['length']) + ' ' + show(boxed['3']) + ' ' + show(boxed['mi' + 'ss']));
  check('primitive string', show('abc'['1']) + ' ' + show('abc'['length']) + ' ' + show('abc'['mi' + 'ss']) + ' ' + show('abc'['to' + 'String']));
  check('primitive number', show((5)['to' + 'Fixed']) + ' ' + show((5)['mi' + 'ss']));
  const inst = new Sub();
  check('class instance', show(inst['x']) + ' ' + show(inst['y']) + ' ' + show(inst['g']) + ' ' + show(inst['m']) + ' ' + show(inst['mi' + 'ss']) + ' ' + show(inst['to' + 'String']));
  check('class statics', show(Sub['s']) + ' ' + show(Sub['na' + 'me']) + ' ' + show(Sub['mi' + 'ss']));
  Klass.prototype.added = 'later';
  check('class prototype add', show(inst['added']) + ' ' + show(new Klass()['added']));
  delete Klass.prototype.added;
  check('class prototype delete', show(inst['added']) + ' ' + show(new Klass()['added']));
  Object.prototype.viaObject = 'obj';
  check('class sees Object.prototype', show(inst['via' + 'Object']) + ' ' + show(arr['via' + 'Object']) + ' ' + show(re['via' + 'Object']) + ' ' + show(f['via' + 'Object']));
  delete Object.prototype.viaObject;
  check('class lost Object.prototype', show(inst['via' + 'Object']) + ' ' + show(arr['via' + 'Object']) + ' ' + show(re['via' + 'Object']) + ' ' + show(f['via' + 'Object']));
}

// missing reads that are `in`/hasOwn consistent
{
  const o = { a: 1, u: undefined };
  const probe = (k) => (k in o) + ' ' + Object.prototype.hasOwnProperty.call(o, k) + ' ' + show(o[k]);
  check('in/hasOwn', ['a', 'u', 'zz', 'toString', 'constructor', '__proto__'].map(probe).join(' | '));
  const inherited = Object.create({ u: undefined, v: 1 });
  check('inherited undefined', show(inherited['u']) + ' ' + ('u' in inherited) + ' ' + show(inherited['v']));
}

console.log(out.join('\n'));
