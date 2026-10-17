// AsyncLocalStorage keeps its store across await and setTimeout.
const { AsyncLocalStorage } = require('node:async_hooks');
const als = new AsyncLocalStorage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function work(id) {
  await sleep(id);
  const a = als.getStore();
  await Promise.resolve();
  setTimeout(() => console.log('timer', id, als.getStore().id), 1);
  await sleep(2);
  return a.id + ':' + als.getStore().id;
}
(async () => {
  console.log('outside', als.getStore());
  const r = await Promise.all([
    als.run({ id: 'one' }, () => work(25)),
    als.run({ id: 'two' }, () => work(1)),
  ]);
  console.log(r.join(','));
  console.log('after', als.getStore());
})();
