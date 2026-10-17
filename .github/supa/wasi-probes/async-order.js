// Microtasks, nextTick, timers and async/await ordering must match Node.
// Nothing here races two timers or a timer against setImmediate from the main
// script (Node itself leaves those unordered); each phase starts from a timer
// callback so the order is defined.
const log = (s) => console.log(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
log('sync 1');
setTimeout(() => log('timeout 10'), 10);
setTimeout(() => log('timeout 3'), 3);
Promise.resolve().then(() => log('promise 1')).then(() => log('promise 2'));
queueMicrotask(() => log('microtask'));
(async () => {
  log('async start');
  await null;
  log('async after await');
  const v = await new Promise((res) => setTimeout(() => res('resolved late'), 20));
  log(v);
  try { await Promise.reject(new Error('rejected')); } catch (e) { log('caught ' + e.message); }
  const all = await Promise.all([1, Promise.resolve(2), new Promise((r) => setTimeout(() => r(3), 2))]);
  log('all ' + all.join(','));
  const settled = await Promise.allSettled([Promise.resolve('a'), Promise.reject(new Error('b'))]);
  log('settled ' + settled.map((s) => s.status).join(','));
  const raced = await Promise.race([sleep(60).then(() => 'slow'), sleep(3).then(() => 'fast')]);
  log('race ' + raced);
  async function* gen() { yield 1; await null; yield 2; }
  for await (const x of gen()) log('gen ' + x);

  // From a timer callback: nextTick, then promise jobs, then the check phase.
  await sleep(5);
  setImmediate(() => log('immediate'));
  setTimeout(() => log('timeout 0'), 0);
  process.nextTick(() => log('nextTick'));
  Promise.resolve().then(() => log('then'));
  await sleep(50);

  let n = 0;
  await new Promise((done) => {
    const t = setInterval(() => {
      log('interval ' + ++n);
      if (n === 3) { clearInterval(t); done(); }
    }, 15);
  });
  log('async end');
})();
log('sync 2');
