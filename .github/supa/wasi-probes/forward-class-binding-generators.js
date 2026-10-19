// A per-evaluation class declaration (heritage is the native Error) that an
// earlier closure reads must keep one identity through the async/generator
// lowering, through generator and async function declarations, and through
// fresh class expressions that evaluate code naming it. Every line is compared
// with node.

function rec(depth) {
  const read = () => C;
  let inner;
  if (depth > 0) inner = rec(depth - 1);
  class C extends Error {}
  return { read, C, inner };
}

async function main() {
  // 1. async loop: the iteration's getter is created before the declaration
  const results = [];
  for (let i = 0; i < 3; i++) {
    const read = () => C;
    class C extends Error {}
    await 0;
    results.push(read() === C);
  }
  console.log('async for', results.join(','));

  // 2. for...of in an async function, closures kept past the loop
  const kept = [];
  for (const n of [1, 2, 3]) {
    const read = () => C;
    class C extends Error {
      static n = n;
    }
    await 0;
    kept.push({ read, C });
  }
  console.log(
    'async for-of',
    kept.map((k) => k.read() === k.C).join(','),
    kept.map((k) => k.read().n).join(','),
    kept[0].C !== kept[1].C,
  );

  // 3. async arrows across an await, declaration before and after the await
  const arrowAfter = async () => {
    const read = () => C;
    class C extends Error {}
    await 0;
    return read() === C;
  };
  const arrowBefore = async () => {
    const read = () => C;
    await 0;
    class C extends Error {}
    return read() === C;
  };
  console.log('async arrows', await arrowAfter(), await arrowBefore(), await arrowAfter());

  // 4. a generator loop
  function* loop() {
    for (let i = 0; i < 3; i++) {
      const read = () => C;
      class C extends Error {}
      yield read() === C;
    }
  }
  console.log('generator loop', [...loop()].join(','));

  // 5. generator, async and plain function declarations reading a class
  // declared after them in a function scope, evaluated twice
  function scope(tag) {
    function* gen() {
      yield C;
    }
    async function asyncGet() {
      return C;
    }
    function plain() {
      return C;
    }
    class C extends Error {
      static tag = tag;
    }
    return { gen, asyncGet, plain, C };
  }
  const s1 = scope('a');
  const s2 = scope('b');
  console.log(
    'declarations',
    [...s1.gen()][0] === s1.C,
    [...s2.gen()][0] === s2.C,
    (await s1.asyncGet()) === s1.C,
    (await s2.asyncGet()) === s2.C,
    s1.plain() === s1.C,
    s2.plain() === s2.C,
    s1.C !== s2.C,
    [...s1.gen()][0].tag,
    [...s2.gen()][0].tag,
  );

  // 6. a fresh class expression evaluates its static initializers, computed
  // keys, heritage and captured values in the closure that holds it
  function scoped() {
    const make = () =>
      class {
        static base = C;
        static [C.name] = 1;
      };
    const extend = () => class extends C {};
    class C extends Error {}
    return { make, extend, C };
  }
  const x = scoped();
  const y = scoped();
  const m1 = x.make();
  const m2 = x.make();
  console.log(
    'class expression',
    m1.base === x.C,
    m2.base === x.C,
    y.make().base === y.C,
    y.make().base !== x.C,
    m1.C,
    Object.getPrototypeOf(x.extend()) === x.C,
    Object.getPrototypeOf(y.extend()) === y.C,
    new (x.extend())() instanceof x.C,
    new (x.extend())() instanceof y.C,
  );

  // 7. a factory re-entered before the first invocation's declaration runs
  const outer = rec(2);
  const mid = outer.inner;
  const inner = mid.inner;
  console.log(
    'reentry',
    outer.read() === outer.C,
    mid.read() === mid.C,
    inner.read() === inner.C,
    outer.C !== mid.C,
    mid.C !== inner.C,
    outer.C !== inner.C,
  );
}
main();
