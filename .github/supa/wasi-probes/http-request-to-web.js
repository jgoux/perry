// An http request body read through the web stream adapters, as srvx and other
// fetch-style servers do: Readable.toWeb(req) read with a reader, the same
// converted back with Readable.fromWeb() and piped through a PassThrough into a
// pipeline ending in an async function. Every route must see the whole body.
// network: yes
// server-port: 18323
// request: POST /reader @bytes:300000
// request: POST /roundtrip @bytes:300000
// request: POST /pipeline @bytes:300000
// request: GET /quit
import http from 'node:http';
import { Readable, PassThrough, Transform } from 'node:stream';
import streamP from 'node:stream/promises';

const routes = {
  async '/reader'(req) {
    const reader = Readable.toWeb(req).getReader();
    let n = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.length;
    }
    return n;
  },
  async '/roundtrip'(req) {
    const proxy = new PassThrough();
    Readable.fromWeb(Readable.toWeb(req)).pipe(proxy);
    let n = 0;
    for await (const chunk of proxy) n += chunk.length;
    return n;
  },
  async '/pipeline'(req) {
    const proxy = new PassThrough();
    const limiter = new Transform({ transform(chunk, enc, cb) { cb(null, chunk); } });
    Readable.fromWeb(Readable.toWeb(req)).pipe(proxy);
    return streamP.pipeline(proxy, limiter, async (stream) => {
      let n = 0;
      for await (const chunk of stream) n += chunk.length;
      return n;
    });
  },
};

const server = http.createServer(async (req, res) => {
  if (req.url === '/quit') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('bye', () => setTimeout(() => process.exit(0), 50));
    return;
  }
  try {
    const n = await routes[req.url](req);
    console.log(req.url, n);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(String(n));
  } catch (e) {
    console.log(req.url, 'error', e && e.message);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('error');
  }
});
server.listen(18323, '127.0.0.1', () => console.log('listening'));
