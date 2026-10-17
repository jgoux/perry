// node:events: on/once/off ordering, the error event contract, once() promises.
const { EventEmitter, once } = require('node:events');
const e = new EventEmitter();
const seen = [];
const a = (x) => seen.push('a' + x);
e.on('t', a);
e.once('t', (x) => seen.push('once' + x));
e.prependListener('t', (x) => seen.push('first' + x));
e.emit('t', 1);
e.emit('t', 2);
e.off('t', a);
e.emit('t', 3);
console.log(seen.join(','), e.listenerCount('t'));
try {
  e.emit('error', new Error('boom'));
} catch (err) {
  console.log('thrown', err.message);
}
e.on('error', (err) => console.log('handled', err.message));
e.emit('error', new Error('boom2'));
(async () => {
  setTimeout(() => e.emit('ready', 42, 'x'), 5);
  const args = await once(e, 'ready');
  console.log('once', args.join('|'));
  console.log(e.eventNames().join(','));
})();
