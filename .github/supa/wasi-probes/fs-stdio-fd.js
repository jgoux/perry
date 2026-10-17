// fs.writeSync / fs.write on the standard descriptors (logger destinations
// such as pino's sync stdout write to fd 1 directly).
const fs = require('node:fs');
console.log('written', fs.writeSync(1, 'to fd 1\n'));
console.log('written', fs.writeSync(1, Buffer.from('buffer to fd 1\n')));
fs.writeSync(2, 'to fd 2\n');
fs.write(1, 'async to fd 1\n', (err, n) => {
  console.log('callback', err === null, n);
});
