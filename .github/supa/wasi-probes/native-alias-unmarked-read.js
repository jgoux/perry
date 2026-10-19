// The classic util.inherits construction over a native class: `http.Server.call(this)`
// and `http.ServerResponse.call(this, req)` alias an unmarked `new F()` object to a
// native handle. Reads of names the object does not carry itself must reach the
// native state (a handle property, a socket), not be answered "absent" from the
// object's shape. node and the wasm module must print the same lines.
// network: yes (links the shared net code; supa_net is imported but never called)
const http = require('node:http');
const util = require('node:util');
const { Writable } = require('node:stream');

function Srv() {
  http.Server.call(this);
}
util.inherits(Srv, http.Server);
const s = new Srv();
console.log('server instanceof', s instanceof Srv, s instanceof http.Server);
console.log('server listening', s.listening, typeof s.listen, typeof s.address, typeof s.close);

function Res(req) {
  http.ServerResponse.call(this, req);
}
util.inherits(Res, http.ServerResponse);
const r = new Res({ method: 'GET' });
const sock = new Writable({ write(chunk, enc, cb) { cb(); } });
console.log('response before socket', r.socket === null, r.statusCode, r.headersSent, r.finished);
r.assignSocket(sock);
console.log('response socket', r.socket === sock, r.connection === sock);
r.setHeader('x-probe', '1');
console.log('response header', r.getHeader('x-probe'), r.hasHeader('x-probe'));
r.end('done');
console.log('response ended', r.finished, r.writableEnded, r.statusCode);
