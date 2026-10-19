// fill on a pre-sized array whose length is past what `new Array(n)` backs with
// slots (above 1,000,000 it keeps a small store and a logical length): fill and
// fill(v, start, end) used to write every index in [start, end) over that store,
// past the allocation, and on wasm32 trapped once the write left linear memory.
// Sizes cross the dense threshold and the growth steps; start/end cover a range
// inside the store, one that crosses its end, and ones far past it; the arrays
// are then read, mapped, appended to and filled again through every route.
// max-rss-mb: 1500
// The array is digested at a stride (Object.keys skips the dense indices of an
// array above 100000 elements), holes counted through `in`.
function digest(a) {
  let sum = 0;
  let holes = 0;
  let others = 0;
  for (let i = 0; i < a.length; i += 997) {
    if (i in a) {
      if (typeof a[i] === 'number') sum += a[i];
      else others++;
    } else holes++;
  }
  const last = a.length - 1;
  return `len=${a.length} first=${a[0]} last=${a[last]} sum=${sum} holes=${holes} other=${others}`;
}
function t(name, f) {
  let r;
  try {
    r = f();
  } catch (e) {
    r = 'threw ' + (e && e.constructor && e.constructor.name);
  }
  console.log(name + ' ' + r);
}

const sizes = [0, 1, 3, 4, 5, 16, 1000, 65536, 999999, 1000000, 1000001, 1048577, 1500000, 2000000, 3000000];
for (const n of sizes) {
  t('fill ' + n, () => {
    const a = new Array(n);
    const r = a.fill(7);
    return (r === a) + ' ' + digest(a) + ' | ' + digest(r);
  });
}
// Literal length: the compiler may lower it differently from a variable.
t('fill literal 3e6', () => {
  const a = new Array(3e6).fill(0);
  return digest(a);
});
t('fill literal 1.5e6 temp', () => digest(new Array(1500000).fill(2)));

// Ranges, each on a fresh 1.2M and 3M array.
for (const n of [1200000, 3000000]) {
  const ranges = [
    [0, 10],
    [0, 4],
    [2, 6],
    [3, 5000],
    [100, 1100000],
    [-5, undefined],
    [-10, -2],
    [n - 10, n],
    [n - 10, n + 100],
    [n - 1, n],
    [1000000, 1000010],
    [1000000, 1002000],
    [1100000, n],
    [n, n],
    [10, 5],
    [0, n],
    [5, undefined],
    [-n - 50, 20],
  ];
  for (const [s, e] of ranges) {
    t(`fillRange ${n} ${s} ${e}`, () => {
      const a = new Array(n);
      const r = e === undefined ? a.fill(9, s) : a.fill(9, s, e);
      return (r === a) + ' ' + digest(a);
    });
  }
  t(`fillChain ${n}`, () => {
    const a = new Array(n).fill(1, 0, 10).fill(2, 10, 20).fill(3, -5);
    return digest(a);
  });
  t(`fillTwice ${n}`, () => {
    const a = new Array(n);
    a.fill(1);
    a.fill(2, 5, 50);
    return digest(a);
  });
}

// Values that are not numbers: a string or object value is stored in every slot.
t('fill string 1.2M', () => {
  const a = new Array(1200000).fill('ab');
  return digest(a) + ' ' + a[0] + a[1199999] + ' ' + (a[0] === a[1199999]);
});
t('fill object 1.2M', () => {
  const o = { k: 1 };
  const a = new Array(1200000).fill(o);
  o.k = 5;
  return digest(a) + ' ' + a[0].k + a[1199999].k + ' ' + (a[3] === a[1100000]);
});
t('fill undefined 1.2M', () => {
  const a = new Array(1200000).fill(undefined);
  return digest(a) + ' ' + (5 in a);
});
t('fill null range', () => {
  const a = new Array(1200000).fill(null, 1000000, 1100000);
  return digest(a) + ' ' + a[1000000] + ' ' + a[999999];
});

// The filled array is a normal array afterwards.
t('fill then reads', () => {
  const a = new Array(1200000).fill(3);
  return [a.indexOf(3), a.lastIndexOf(3), a.includes(3), a.includes(4), a.at(-1), a.slice(-2).join(), a.join('').length].join(' ');
});
t('fill then map', () => {
  const a = new Array(1200000).fill(0).map((_, i) => i * 2);
  return digest(a);
});
t('fill then map objects', () => {
  const a = new Array(1200000).fill(0).map((_, i) => ({ i, s: [i] }));
  return a.length + ' ' + a[0].i + ' ' + a[1199999].s[0] + ' ' + a[777777].i;
});
t('fill then object stores', () => {
  const a = new Array(1200000).fill(0);
  for (let i = 0; i < a.length; i++) a[i] = { i };
  return a.length + ' ' + a[0].i + ' ' + a[1199999].i + ' ' + a[600000].i;
});
t('fill then push, pop, length', () => {
  const a = new Array(1200000).fill(1);
  a.push(2);
  a.push(3);
  const popped = a.pop();
  return popped + ' ' + digest(a);
});
t('fill then forEach, reduce, filter', () => {
  const a = new Array(1200000).fill(2);
  let c = 0;
  a.forEach((v) => {
    c += v;
  });
  return c + ' ' + a.reduce((x, y) => x + y, 0) + ' ' + a.filter((v) => v === 2).length;
});
t('fill then reverse, concat, spread', () => {
  const a = new Array(1200000).fill(5);
  a.reverse();
  const b = a.concat([1]);
  const c = [...a];
  return digest(a) + ' | ' + digest(b) + ' | ' + digest(c);
});
t('fill then set after fill', () => {
  const a = new Array(1200000).fill(0);
  a[5] = 'x';
  a[1199999] = 'y';
  a[1200000] = 'z';
  return a.length + ' ' + a[5] + a[1199999] + a[1200000] + ' ' + a[6];
});

// A binding that keeps the pre-fill reference sees the fill: a closure and a module
// global as well as a local.
let moduleArray = new Array(1300000);
t('fill module global', () => {
  moduleArray.fill(4);
  return digest(moduleArray) + ' ' + (moduleArray.fill(6) === moduleArray);
});
t('fill captured by closure', () => {
  const a = new Array(1300000);
  const f = () => a[1299999] + a[0];
  a.fill(8);
  return f() + ' ' + digest(a);
});
t('fill local then read', () => {
  const a = new Array(1100000);
  a.fill(1, 1, 1099990);
  return a[0] + ' ' + a[1] + ' ' + a[1099989] + ' ' + a[1099990] + ' ' + digest(a);
});
t('fill alias', () => {
  const a = new Array(1100000);
  const b = a;
  a.fill(3);
  b[7] = 4;
  return a[7] + ' ' + b[8] + ' ' + (a === b);
});
