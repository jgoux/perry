// The networking modules load and expose their entry points (no sockets here).
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const tls = require('node:tls');
console.log(typeof http.createServer, typeof http.request, typeof http.get);
console.log(typeof https.request, typeof https.get, typeof https.createServer);
console.log(typeof net.createServer, typeof net.connect, typeof net.Socket);
console.log(typeof tls.connect, typeof tls.createServer);
console.log(typeof fetch, typeof Headers, typeof Request, typeof Response);
let undici;
try {
  undici = require('undici');
} catch (e) {
  undici = null;
}
// node has no `undici` module; wasm bundles ext-undici. Both must be usable or absent.
console.log(undici === null || typeof undici.fetch === 'function');
