// A closure lowered before a class declaration that is evaluated per call (here:
// heritage is the native Error) must read the evaluated class, not the shared
// template. esbuild's CommonJS output exports classes through such closures
// (`__export(exports, { C: () => C })` precedes `class C extends Error`), and
// Storage's errors then failed instanceof / constructor checks against the
// exported class.
function describe(label, C, make) {
  const e = make(C);
  console.log(
    label,
    e instanceof C,
    Object.getPrototypeOf(e) === C.prototype,
    e.constructor === C,
    C.prototype.constructor === C,
  );
}

// 1. forward getter exported next to the class
function factory() {
  const exported = {};
  Object.defineProperty(exported, 'B', { get: () => B, enumerable: true });
  class B extends Error {
    constructor(options) {
      super(options.message);
      this.code = options.code;
    }
    render() {
      return { code: this.code };
    }
  }
  exported.direct = B;
  return exported;
}
const one = factory();
describe('getter', one.B, (C) => new C({ message: 'm', code: 'c' }));
console.log('same value', one.B === one.direct);

// 2. constructor re-asserting the prototype with the class's own binding
function resetting() {
  const exported = {};
  Object.defineProperty(exported, 'B', { get: () => B, enumerable: true });
  class B extends Error {
    constructor(options) {
      super(options.message);
      Object.setPrototypeOf(this, B.prototype);
    }
    static create(message) {
      return new B({ message });
    }
  }
  return exported;
}
const two = resetting();
describe('reset', two.B, (C) => new C({ message: 'm' }));
const made = two.B.create('x');
console.log('static', made instanceof two.B, made.message);

// 3. a subclass of the forward-referenced class
function derived() {
  const get = () => Base;
  class Base extends Error {
    constructor(message) {
      super(message);
    }
    who() {
      return 'base';
    }
  }
  class Child extends Base {
    who() {
      return 'child:' + super.who();
    }
  }
  return { get, Child };
}
const three = derived();
const child = new three.Child('c');
console.log('derived', child instanceof three.get(), child.who(), child.constructor === three.Child);

// 4. a class evaluated once is the same value through every route
const again = factory();
console.log('single evaluation', again.B === again.direct, again.B === again.B);
