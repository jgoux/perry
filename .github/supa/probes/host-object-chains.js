// compare-node
// The [[Prototype]] chain of native host objects: Object.getPrototypeOf must lead
// to Object.prototype and never return the receiver itself (a self link made a
// `while (p = Object.getPrototypeOf(p))` loop spin), and instanceof must follow
// the chain. One line per object, compared with node.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const events = require('node:events');
const stream = require('node:stream');
const readline = require('node:readline');

const out = [];
const nameOf = (p) => {
  const d = Object.getOwnPropertyDescriptor(p, 'constructor');
  return d && typeof d.value === 'function' ? d.value.name : '?';
};
function chain(o) {
  const names = [];
  let p = o;
  for (let i = 0; i < 12; i++) {
    const next = Object.getPrototypeOf(p);
    if (next === null) return names.join(' > ') + ' > null';
    if (next === p) return names.join(' > ') + ' > SELF';
    names.push(nameOf(next));
    p = next;
  }
  return names.join(' > ') + ' > ...';
}
function survey(label, make, ...ctors) {
  try {
    const o = make();
    const tests = ctors.map((c) => {
      try { return (o instanceof c) ? 'y' : 'n'; } catch (e) { return 'throws'; }
    });
    out.push(label + ': ' + chain(o) + ' | instanceof ' + tests.join(','));
    return o;
  } catch (e) {
    out.push(label + ': ERROR ' + (e && e.message));
  }
}
const E = events.EventEmitter, S = stream.Stream, R = stream.Readable, W = stream.Writable;
const D = stream.Duplex, T = stream.Transform;

const dir = process.env.WORK_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'hoc-'));
const file = path.join(dir, 'hoc.bin');
fs.writeFileSync(file, 'x');

// instanceof columns: Object, EventEmitter, Stream, Readable, Writable, then the specific constructor
const rs = survey('fs.ReadStream', () => fs.createReadStream(file), Object, E, S, R, W, fs.ReadStream);
rs.on('error', () => {});
const ws = survey('fs.WriteStream', () => fs.createWriteStream(path.join(dir, 'hoc-out.bin')), Object, E, S, R, W, fs.WriteStream);
ws.on('error', () => {});
survey('new fs.ReadStream', () => new fs.ReadStream(file), Object, E, S, R, W, fs.ReadStream)?.on('error', () => {});
survey('fs.Stats', () => fs.statSync(file), Object, fs.Stats);
survey('fs.Dirent', () => fs.readdirSync(dir, { withFileTypes: true })[0], Object, fs.Dirent);
survey('fs.Dir', () => { const d = fs.opendirSync(dir); d.closeSync(); return d; }, Object, fs.Dir);
survey('Readable', () => new R(), Object, E, S, R, W);
survey('Writable', () => new W(), Object, E, S, R, W);
survey('Duplex', () => new D(), Object, E, S, R, W, D);
survey('Transform', () => new T(), Object, E, S, R, W, D, T);
survey('PassThrough', () => new stream.PassThrough(), Object, E, S, R, W, D, T, stream.PassThrough);
survey('Readable.from', () => R.from(['a']), Object, E, S, R, W);
survey('EventEmitter', () => new E(), Object, E);
survey('net.Socket', () => new net.Socket(), Object, E, S, D, net.Socket);
survey('net.Server', () => net.createServer(), Object, E, net.Server);
survey('http.Server', () => http.createServer(), Object, E, net.Server, http.Server);
survey('http.Agent', () => new http.Agent(), Object, E, http.Agent);
survey('http.ClientRequest', () => { const r = http.request({ host: '127.0.0.1', port: 1, path: '/' }); r.on('error', () => {}); r.destroy(); return r; }, Object, E, S, W, http.ClientRequest, http.OutgoingMessage);
survey('zlib.Gzip', () => zlib.createGzip(), Object, E, S, R, W, D, T, zlib.Gzip);
survey('zlib.Deflate', () => zlib.createDeflate(), Object, E, S, R, W, D, T, zlib.Deflate);
survey('zlib.BrotliCompress', () => zlib.createBrotliCompress(), Object, E, S, T, zlib.BrotliCompress);
survey('crypto.Hash', () => crypto.createHash('sha256'), Object, E, S, T, crypto.Hash);
survey('crypto.Hmac', () => crypto.createHmac('sha256', 'k'), Object, E, S, T, crypto.Hmac);
survey('crypto.Cipheriv', () => crypto.createCipheriv('aes-128-cbc', Buffer.alloc(16), Buffer.alloc(16)), Object, E, S, T, crypto.Cipheriv);
survey('crypto.Sign', () => crypto.createSign('sha256'), Object, E, S, W, crypto.Sign);
survey('readline.Interface', () => { const i = readline.createInterface({ input: new R({ read() {} }) }); i.close(); return i; }, Object, E, readline.Interface);
const child = survey('ChildProcess', () => cp.spawn('cat', [], { stdio: ['pipe', 'pipe', 'pipe'] }), Object, E, cp.ChildProcess);
if (child) {
  child.on('error', () => {});
  survey('ChildProcess.stdin', () => child.stdin, Object, E, S, R, W);
  survey('ChildProcess.stdout', () => child.stdout, Object, E, S, R, W);
  child.kill();
}
survey('process.stdout', () => process.stdout, Object, E, S, R, W);
survey('process.stdin', () => process.stdin, Object, E, S, R, W);
survey('timer', () => { const t = setTimeout(() => {}, 1); clearTimeout(t); return t; }, Object);
survey('AbortController', () => new AbortController(), Object);
survey('URL', () => new URL('http://a/'), Object, URL);
survey('Headers', () => new Headers(), Object, Headers);
survey('Blob', () => new Blob(['x']), Object, Blob);
survey('TextEncoder', () => new TextEncoder(), Object, TextEncoder);

// A user loop over the chain must end (the self link made it spin).
let hops = 0;
for (let p = rs; (p = Object.getPrototypeOf(p)) && hops < 1000;) hops++;
out.push('fs.ReadStream walk ends: ' + (hops < 1000) + ' hops ' + hops);
const rsProto = Object.getPrototypeOf(rs);
out.push('proto is fs.ReadStream.prototype: ' + (rsProto === fs.ReadStream.prototype));
out.push('ws proto is fs.WriteStream.prototype: ' + (Object.getPrototypeOf(ws) === fs.WriteStream.prototype));
out.push('proto chain reaches Readable.prototype: ' + R.prototype.isPrototypeOf(rs));
out.push('Stream.prototype.isPrototypeOf(rs): ' + S.prototype.isPrototypeOf(rs));
out.push('EventEmitter.prototype.isPrototypeOf(rs): ' + E.prototype.isPrototypeOf(rs));
out.push('Object.prototype.isPrototypeOf(rs): ' + Object.prototype.isPrototypeOf(rs));
out.push('rs.constructor === fs.ReadStream: ' + (rs.constructor === fs.ReadStream));
out.push('rs.hasOwnProperty is inherited: ' + (typeof rs.hasOwnProperty));

rs.destroy();
ws.destroy();
// The servers and child above keep nothing alive after their handles close.
console.log(out.join('\n'));
fs.rmSync(dir, { recursive: true, force: true });
process.exit(0);
