// wasm-env: PERRY_GC_SCAVENGE_NURSERY_MB=1 PERRY_GC_FORCE_EVACUATE=1 PERRY_GC_VERIFY_EVACUATION=1
// Values computed before and between throwing calls stay correct after the
// exception lands (P55). wasm32 implements try/catch/finally and the
// iterator-close protocol with setjmp; the code generator keeps every value
// that crosses a block of such a function in a stack slot, written when it is
// defined and read at each use, instead of re-deriving it at every call. The
// cases below read such values after the longjmp-style re-entry, with moving
// collections in between.
function churn(n) {
  const keep = [];
  for (let i = 0; i < n; i++) {
    const o = { i: i, s: 'item-' + i };
    if (i % 500 === 0) keep.push(o);
  }
  return keep.length;
}
function boom(n) {
  if (n % 2 === 1) throw new Error('boom ' + n);
  return n * 3;
}
function deep(n) {
  if (n === 0) throw new RangeError('deep');
  return deep(n - 1) + 1;
}

// Numbers, strings and objects built before the try, used in every handler.
function liveAcross(seed) {
  const a = seed * 2 + 1;
  const b = 'k' + seed;
  const c = { seed: seed, tag: b + '!' };
  const d = [seed, seed + 1, seed + 2];
  let log = '';
  try {
    log += 'try:' + a + ';';
    churn(3000);
    log += boom(seed) + ';';
    log += 'after;';
  } catch (e) {
    churn(3000);
    log += 'catch:' + e.message + ':' + a + ':' + b + ':' + c.tag + ':' + d.join('/') + ';';
  } finally {
    churn(3000);
    log += 'finally:' + a + ':' + b + ':' + c.seed + ':' + d.length + ';';
  }
  return log + a + b + c.tag + d[2];
}
for (let i = 0; i < 4; i++) console.log(liveAcross(i));

// A throw from a deep frame, values defined on both sides of the throwing call.
function acrossFrames(k) {
  const before = { k: k, text: 'before-' + k };
  let r;
  try {
    const mid = before.k + 100;
    r = deep(k) + mid;
  } catch (e) {
    const after = e.message + ':' + before.text;
    churn(2000);
    r = after + ':' + before.k;
  }
  return r;
}
console.log(acrossFrames(0), acrossFrames(3), acrossFrames(40));

// Values defined in each iteration of a loop, thrown away and re-entered.
function loopCatch() {
  const out = [];
  let acc = 0;
  for (let i = 0; i < 6; i++) {
    const sq = i * i;
    const label = 'i' + i;
    try {
      acc += boom(i);
      out.push(label + '=' + acc);
    } catch (e) {
      churn(1500);
      out.push(label + ':' + e.message + ':' + sq + ':' + acc);
    }
    out.push(sq + acc);
  }
  return out.join(',');
}
console.log(loopCatch());

// Iterator close: `return` runs on break, throw and return, not on exhaustion.
function counter(n, log, name) {
  let i = 0;
  return {
    [Symbol.iterator]() { return this; },
    next() {
      churn(300);
      return i < n ? { value: i++, done: false } : { value: undefined, done: true };
    },
    return() { log.push(name + ' closed at ' + i); return {}; },
  };
}
function closing() {
  const log = [];
  const tail = 'tail';
  for (const x of counter(5, log, 'exhaust')) { if (x > 99) break; }
  for (const x of counter(5, log, 'break')) { if (x === 2) break; }
  try {
    for (const x of counter(5, log, 'throw')) { if (x === 3) throw new Error('stop ' + x + tail); }
  } catch (e) { log.push(e.message); }
  const viaReturn = (() => {
    for (const x of counter(5, log, 'return')) { if (x === 1) return 'ret ' + x + tail; }
    return 'none';
  })();
  log.push(viaReturn);
  outer: for (const a of counter(3, log, 'outer')) {
    for (const b of counter(3, log, 'inner' + a)) {
      if (b === 1) continue outer;
    }
  }
  return log.join(' | ');
}
console.log(closing());

// Destructuring closes a user iterator it did not exhaust.
function destructure() {
  const log = [];
  const [p, q] = counter(5, log, 'array-pattern');
  const [r, ...rest] = counter(4, log, 'rest-pattern');
  return log.join(' | ') + ' => ' + p + q + r + rest.join('');
}
console.log(destructure());

// Generators and async functions suspended inside a try.
function* gen(log) {
  const base = { v: 10 };
  try {
    for (let i = 0; i < 3; i++) {
      churn(1000);
      yield base.v + i;
    }
  } finally {
    log.push('gen finally ' + base.v);
  }
}
function generators() {
  const log = [];
  const g = gen(log);
  const first = g.next().value;
  churn(2000);
  const second = g.next().value;
  g.return(0);
  for (const v of gen(log)) { if (v === 11) break; }
  return log.join(' | ') + ' => ' + first + ',' + second;
}
console.log(generators());

async function asyncTry(n) {
  const keep = { n: n, s: 'async-' + n };
  try {
    await null;
    churn(2000);
    if (n % 2 === 1) throw new Error('async boom ' + n);
    return keep.s + ' ok';
  } catch (e) {
    await null;
    return keep.s + ' caught ' + e.message;
  } finally {
    churn(1000);
    console.log('async finally', keep.n);
  }
}
(async () => {
  console.log(await asyncTry(0));
  console.log(await asyncTry(1));
  console.log(await Promise.all([asyncTry(2), asyncTry(3)]));
  console.log('done');
})();
