// Outbound TCP through the host: connect to an echo server (ECHO_PORT on
// 127.0.0.1), round-trip bytes, half-close, then see ECONNREFUSED and ENOTFOUND.
// compile-only: needs the echo server of wasi-local.sh
// network: yes
const net = require('node:net');
const port = Number(process.env.ECHO_PORT);

function failure(options) {
  return new Promise((resolve) => {
    const socket = net.connect(options);
    socket.on('connect', () => {
      socket.destroy();
      resolve('connected');
    });
    socket.on('error', (e) => resolve(e.code));
  });
}

const socket = net.connect({ host: '127.0.0.1', port });
let received = '';
socket.setEncoding('utf8');
socket.on('connect', () => {
  console.log('connected');
  socket.write('hello ');
  socket.end('echo');
});
socket.on('data', (d) => (received += d));
socket.on('end', async () => {
  console.log('received', JSON.stringify(received));
  console.log('refused', await failure({ host: '127.0.0.1', port: 1 }));
  console.log('notfound', await failure({ host: 'no-such-host.invalid', port: 80 }));
});
socket.on('close', () => console.log('closed'));
