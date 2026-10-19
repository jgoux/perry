// Copying holey arrays and array-likes: Array.from, spread, slice, concat,
// splice, fill and the borrowed `Array.prototype.slice.call(arrayLike)`. A hole
// is preserved where the spec preserves it (slice, concat, splice) and becomes
// `undefined` where it does not (Array.from, spread), and an indexed property
// added to Array.prototype / Object.prototype -- before or after the first
// copy -- must be seen, including a getter, since the fast paths are only
// valid while no such property exists.
function show(a) {
  // No array built here: an accessor on Array.prototype[1] would intercept push.
  let out = a.length + ':[';
  for (let i = 0; i < a.length; i++) out += (i ? ',' : '') + (i in a ? String(a[i]) : '<hole>');
  return out + ']';
}
function ownCount(a) {
  return Object.keys(a).length;
}
const getterCalls = { length: 0 };

function ops(label) {
  const holey = [1, , 3, , 5];
  holey.length = 7;
  const arrayLike = { length: 6, 1: 'b', 4: 'e' };
  const empty = { length: 4 };
  const o = (name, f) => {
    let r;
    try {
      r = f();
    } catch (e) {
      r = 'threw ' + (e && e.constructor && e.constructor.name);
    }
    console.log(label + ' ' + name + ' ' + r);
  };
  o('from(arrayLike)', () => show(Array.from(arrayLike)));
  o('from(empty)', () => show(Array.from({ length: 4 })));
  o('from(holey)', () => show(Array.from(holey)));
  o('from(holey,map)', () => show(Array.from(holey, (v, i) => i + ':' + v)));
  o('spread', () => show([...holey]));
  o('slice', () => show(holey.slice()));
  o('slice(1,5)', () => show(holey.slice(1, 5)));
  o('slice.call(arrayLike)', () => show(Array.prototype.slice.call(arrayLike)));
  o('slice.call(empty)', () => show(Array.prototype.slice.call(empty)));
  o('concat self', () => show(holey.concat(holey)));
  o('concat lead', () => show([0].concat(holey, [9])));
  o('splice', () => show([].concat(holey).splice(0, 5)));
  o('fill', () => show(holey.slice().fill(7, 1, 4)));
  o('fill all', () => show(new Array(5).fill(0)));
  o('Array.apply', () => show(Array.apply(null, { length: 3 })));
  o('own keys of from', () => ownCount(Array.from(empty)));
  o('own keys of slice', () => ownCount(holey.slice()));
  o('own keys of concat', () => ownCount(holey.concat(holey)));
  const big = new Array(1e6);
  big[5] = 'five';
  o('big from(holey)', () => ownCount(Array.from(big)) + ' ' + Array.from(big).length);
  o('big from(length)', () => ownCount(Array.from({ length: 1e6 })));
  o('big slice', () => ownCount(big.slice()) + ' ' + big.slice().length);
  o('big concat', () => ownCount(big.concat(big)) + ' ' + big.concat(big).length);
  o('big spread', () => ownCount([...big]) + ' ' + [...big].length);
  o('big fill', () => {
    const f = new Array(1e6).fill(2);
    let s = 0;
    for (let i = 0; i < f.length; i++) s += f[i] === 2 ? 1 : 0;
    return s + ' ' + ownCount(f);
  });
}

ops('pristine');
ops('pristine again');

Array.prototype[3] = 'ap3';
Object.defineProperty(Array.prototype, 1, {
  configurable: true,
  get() {
    getterCalls.length++;
    return 'getter1';
  },
  set(v) {},
});
ops('array-proto');
console.log('getter calls ' + (getterCalls.length > 0));
delete Array.prototype[3];
delete Array.prototype[1];
ops('array-proto removed');

Object.prototype[2] = 'op2';
Object.defineProperty(Object.prototype, 4, {
  configurable: true,
  get() {
    return 'getter4';
  },
  set(v) {},
});
ops('object-proto');
delete Object.prototype[2];
delete Object.prototype[4];
ops('object-proto removed');

// A property added after copies have already been made is seen by the next one.
const late = { length: 3 };
console.log('late before ' + show(Array.from(late)));
Object.prototype[1] = 'late1';
console.log('late after ' + show(Array.from(late)));
delete Object.prototype[1];
console.log('late removed ' + show(Array.from(late)));

// Own index keys, a null prototype and a class instance keep their own answers.
console.log('own ' + show(Array.from({ length: 3, 0: 'a', 2: 'c' })));
console.log('null proto ' + show(Array.from(Object.assign(Object.create(null), { length: 3, 1: 'n' }))));
class Box {
  constructor() {
    this.length = 3;
  }
  get 1() {
    return 'boxed';
  }
}
console.log('class ' + show(Array.from(new Box())));
const proto = { 0: 'p0' };
console.log('custom proto ' + show(Array.from(Object.setPrototypeOf({ length: 2 }, proto))));
const getterLength = {
  get length() {
    Object.prototype[0] = 'from-length-getter';
    return 2;
  },
};
console.log('length getter ' + show(Array.from(getterLength)));
delete Object.prototype[0];
