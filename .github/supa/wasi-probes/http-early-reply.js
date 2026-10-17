// A server that rejects an upload before reading its body while the client is
// still sending several MB, and half-closes the connection itself (Connection:
// close, `socket.destroySoon = () => socket.end()`, then `socket.end()` once the
// response has finished, draining the rest of the body until the client hangs up).
// Both the server's own close and the application's `socket.end()` shut the write
// side down; the second is a no-op in Node, and a shutdown failure after the
// response (EPIPE, ENOTCONN) never surfaces on a server socket. It must not become
// an uncaught 'error' that kills the process: the next request must still be answered.
// network: yes
// server-port: 18322
// request: POST /upload @bytes:5000000
// request: POST /upload @bytes:5000000
// request: GET /ping
// request: GET /quit
const http = require('node:http');

const noop = () => {};

function rejectAndHalfClose(req, res) {
  const socket = req.socket;
  res.setHeader('Connection', 'close');
  socket.destroySoon = () => socket.end();
  res.once('finish', () => {
    if (socket.destroyed) return;
    const timer = setTimeout(() => socket.destroy(), 3000);
    timer.unref();
    socket.end();
    socket.prependListener('end', () => socket.destroy());
    process.nextTick(() => {
      if (socket.destroyed) return;
      socket.removeAllListeners('data');
      socket.on('data', noop);
      if (socket.readable) socket.resume();
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/upload') {
    rejectAndHalfClose(req, res);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
  } else if (req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('pong');
  } else if (req.url === '/quit') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('bye', () => {
      console.log('closing');
      setTimeout(() => process.exit(0), 50);
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  }
});
server.listen(18322, '127.0.0.1', () => {
  console.log('listening', server.address().port);
});
