// An HTTP server on the host-provided listener: routing, a request body, a JSON
// response, a 404 and a clean shutdown. node and the wasm module must give curl
// the same answers and print the same lines.
// network: yes
// server-port: 18321
// request: GET /
// request: GET /json
// request: POST /echo ping-pong
// request: GET /missing
// request: GET /quit
const http = require('node:http');

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('hello from ' + req.method + ' ' + req.url);
  } else if (req.url === '/json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, items: [1, 2, 3] }));
  } else if (req.url === '/echo') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      console.log('echo', req.method, body.length);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(body.toUpperCase());
    });
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
server.listen(18321, '127.0.0.1', () => {
  console.log('listening', server.address().port);
});
