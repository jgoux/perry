// network: yes (node:stream links the shared net code; supa_net is imported but never called)
// `instanceof` semantics: classes, builtins, Symbol.hasInstance (own, inherited,
// added and removed later), prototype reassignment, bound functions, primitives,
// deep and cross chains, non-callable right operands, node:fs read streams.
// Every line is compared with node.
const fs = require('node:fs');
const path = require('node:path');
const out = [];
const check = (label, value) => out.push(label + ': ' + value);

class A {}
class B extends A {}
class C extends B {}
function F() {}
function G() {}
G.prototype = Object.create(F.prototype);

// classes
check('B in A', new B() instanceof A);
check('A in B', new A() instanceof B);
check('C in A', new C() instanceof A);
check('C in Object', new C() instanceof Object);
check('B in C', new B() instanceof C);
check('class itself in Function', A instanceof Function);
check('class itself in Object', A instanceof Object);

// plain functions and Object.create
check('F instance', new F() instanceof F);
check('G in F', new G() instanceof F);
check('F in G', new F() instanceof G);
check('create(F.prototype)', Object.create(F.prototype) instanceof F);
check('create(null) in Object', Object.create(null) instanceof Object);
check('create({}) in Object', Object.create({}) instanceof Object);
check('create(A.prototype) in A', Object.create(A.prototype) instanceof A);

// builtins
check('array in Array', [] instanceof Array);
check('array in Object', [] instanceof Object);
check('object in Array', {} instanceof Array);
check('map in Map', new Map() instanceof Map);
check('map in Set', new Map() instanceof Set);
check('set in Set', new Set() instanceof Set);
check('date in Date', new Date() instanceof Date);
check('regexp in RegExp', /x/ instanceof RegExp);
check('promise in Promise', Promise.resolve() instanceof Promise);
check('error in Error', new Error('x') instanceof Error);
check('typeerror in Error', new TypeError('x') instanceof Error);
check('error in typeerror', new Error('x') instanceof TypeError);
check('typeerror in rangeerror', new TypeError('x') instanceof RangeError);
check('fn in Function', (() => 1) instanceof Function);
check('fn in Object', (() => 1) instanceof Object);
check('u8 in Uint8Array', new Uint8Array(2) instanceof Uint8Array);
check('u8 in Uint16Array', new Uint8Array(2) instanceof Uint16Array);
check('buffer in Uint8Array', Buffer.alloc(2) instanceof Uint8Array);
check('buffer in Buffer', Buffer.alloc(2) instanceof Buffer);
check('u8 in Buffer', new Uint8Array(2) instanceof Buffer);
check('arraybuffer in ArrayBuffer', new ArrayBuffer(2) instanceof ArrayBuffer);
check('u8.buffer in ArrayBuffer', new Uint8Array(2).buffer instanceof ArrayBuffer);
check('u8 in ArrayBuffer', new Uint8Array(2) instanceof ArrayBuffer);
check('error subclass', new (class MyErr extends Error {})('x') instanceof Error);

// primitives and wrappers
check('1 in Number', 1 instanceof Number);
check('string in String', 'x' instanceof String);
check('true in Boolean', true instanceof Boolean);
check('1n in BigInt', 1n instanceof BigInt);
check('symbol in Symbol', Symbol('x') instanceof Symbol);
check('null in Object', null instanceof Object);
check('undefined in Object', undefined instanceof Object);
check('new Number in Number', new Number(1) instanceof Number);
check('new String in String', new String('x') instanceof String);
check('new Number in Object', new Number(1) instanceof Object);
check('1 in Object', 1 instanceof Object);

// bound functions
const BoundA = A.bind(null);
const BoundF = F.bind(null);
check('A instance in bound A', new A() instanceof BoundA);
check('B instance in bound A', new B() instanceof BoundA);
check('new bound A in A', new BoundA() instanceof A);
check('F instance in bound F', new F() instanceof BoundF);
check('plain in bound F', {} instanceof BoundF);
check('nested bound', new F() instanceof BoundF.bind(null));

// prototype reassignment and mutation
function H() {}
const h1 = new H();
check('h1 before', h1 instanceof H);
const oldProto = H.prototype;
H.prototype = {};
check('h1 after reassign', h1 instanceof H);
check('new after reassign', new H() instanceof H);
Object.setPrototypeOf(h1, H.prototype);
check('h1 after setPrototypeOf', h1 instanceof H);
H.prototype = oldProto;
check('h1 after restore', h1 instanceof H);
const m = {};
check('m before', m instanceof F);
Object.setPrototypeOf(m, F.prototype);
check('m after setPrototypeOf', m instanceof F);
Object.setPrototypeOf(m, null);
check('m after null', m instanceof F);
check('m after null in Object', m instanceof Object);
const inserted = new F();
check('inserted before', inserted instanceof A);
Object.setPrototypeOf(F.prototype, A.prototype);
check('F.prototype now under A', inserted instanceof A);
Object.setPrototypeOf(F.prototype, Object.prototype);
check('F.prototype back', inserted instanceof A);

// Symbol.hasInstance: static, defined later, removed
class Even {
  static [Symbol.hasInstance](n) {
    return typeof n === 'number' && n % 2 === 0;
  }
}
check('2 in Even', 2 instanceof Even);
check('3 in Even', 3 instanceof Even);
check('instance in Even', new Even() instanceof Even);
class Late {}
const late = new Late();
check('late before', late instanceof Late);
check('5 before', 5 instanceof Late);
Object.defineProperty(Late, Symbol.hasInstance, {
  value: (x) => x === 5,
  configurable: true,
});
check('late after', late instanceof Late);
check('5 after', 5 instanceof Late);
delete Late[Symbol.hasInstance];
check('late removed', late instanceof Late);
check('5 removed', 5 instanceof Late);
function Fn() {}
const fn = new Fn();
check('fn before', fn instanceof Fn);
Object.defineProperty(Fn, Symbol.hasInstance, { value: () => false, configurable: true });
check('fn override false', fn instanceof Fn);
delete Fn[Symbol.hasInstance];
check('fn restored', fn instanceof Fn);

// long chain: terminates and answers
let deep = {};
for (let i = 0; i < 2000; i++) deep = Object.create(deep);
check('deep in Object', deep instanceof Object);
check('deep in A', deep instanceof A);
Object.setPrototypeOf(Object.getPrototypeOf(deep), A.prototype);
check('deep in A after relink', deep instanceof A);

// right operands that are not constructors
for (const [label, rhs] of [['object', {}], ['number', 1], ['undefined', undefined], ['null', null]]) {
  try {
    check('rhs ' + label, {} instanceof rhs);
  } catch (e) {
    check('rhs ' + label, e instanceof TypeError);
  }
}

// node:fs read stream: the left operand fastify and Storage's onSend hook see
const dir = process.env.WORK_DIR || '/work';
const file = path.join(dir, 'instanceof-matrix.bin');
fs.writeFileSync(file, 'x');
const rs = fs.createReadStream(file);
rs.on('error', () => {});
check('fs stream in Error', rs instanceof Error);
check('fs stream in Blob', rs instanceof Blob);
check('fs stream in ArrayBuffer', rs instanceof ArrayBuffer);
check('fs stream in Array', rs instanceof Array);
check('fs stream in A', rs instanceof A);
check('fs stream in F', rs instanceof F);
check('fs stream in Map', rs instanceof Map);
check('fs stream in Uint8Array', rs instanceof Uint8Array);
rs.destroy();
rs.on('close', () => fs.rmSync(file, { force: true }));

console.log(out.join('\n'));
