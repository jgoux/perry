// Microtasks, nextTick, timers and async/await ordering must match Node.
const log = (s) => console.log(s);
log('sync 1');
setTimeout(() => log('timeout 20'), 20);
setTimeout(() => log('timeout 0'), 0);
setTimeout(() => log('timeout 5'), 5);
setTimeout(() => log('timeout 1'), 1);
setImmediate(() => log('immediate'));
process.nextTick(() => log('nextTick'));
Promise.resolve().then(() => log('promise 1')).then(() => log('promise 2'));
queueMicrotask(() => log('microtask'));
(async () => {
  log('async start');
  await null;
  log('async after await');
  const v = await new Promise((res) => setTimeout(() => res('resolved late'), 10));
  log(v);
  try { await Promise.reject(new Error('rejected')); } catch (e) { log('caught ' + e.message); }
  const all = await Promise.all([1, Promise.resolve(2), new Promise((r) => setTimeout(() => r(3), 2))]);
  log('all ' + all.join(','));
  const settled = await Promise.allSettled([Promise.resolve('a'), Promise.reject(new Error('b'))]);
  log('settled ' + settled.map((s) => s.status).join(','));
  const raced = await Promise.race([new Promise((r) => setTimeout(() => r('slow'), 15)), new Promise((r) => setTimeout(() => r('fast'), 3))]);
  log('race ' + raced);
  async function* gen() { yield 1; await null; yield 2; }
  for await (const x of gen()) log('gen ' + x);
  const t = setInterval(() => { log('interval'); }, 2);
  await new Promise((r) => setTimeout(r, 9));
  clearInterval(t);
  log('async end');
})();
log('sync 2');
