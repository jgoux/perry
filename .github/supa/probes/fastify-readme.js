// The README "Get started" Fastify example (README.md), with its ESM import,
// compiled the way the README says: fastify is a dependency, installed next to
// the program at build time (Perry compiles it from node_modules; the binary
// needs none at run time). The routes after the README one are the shapes
// Storage uses (params, response schema, body schema). The expected output is
// recorded by running the same file under node.
// compare-node
// npm: fastify@5.11.2 find-my-way@9.7.0 ajv@8.18.0 fast-json-stringify@7.0.1
// bundle-npm
import fastify from 'fastify';
import http from 'node:http';

const app = fastify();
app.get('/api/users', async () => [{ id: 1, name: 'Alice' }]);
app.get('/api/users/:id', async (req) => ({ id: Number(req.params.id), name: 'Alice' }));
app.get('/api/profile', {
  schema: { response: { 200: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } } } } },
}, async () => ({ id: 2, name: 'Bob', secret: 'dropped by the response schema' }));
app.post('/api/users', {
  schema: { body: { type: 'object', required: ['name'], additionalProperties: false, properties: { name: { type: 'string', minLength: 1 } } } },
}, async (req) => ({ created: req.body.name }));

const PORT = 18437;
const kill = setTimeout(() => { console.log('TIMEOUT'); process.exit(3); }, 30000);

function call(method, path, payload) {
  return new Promise((resolve) => {
    const headers = { connection: 'close' };
    const data = payload === undefined ? null : JSON.stringify(payload);
    if (data !== null) { headers['content-type'] = 'application/json'; headers['content-length'] = String(Buffer.byteLength(data)); }
    const req = http.request({ host: '127.0.0.1', port: PORT, method, path, headers }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        const type = String(res.headers['content-type'] || '').split(';')[0];
        console.log(method + ' ' + path + ' -> ' + res.statusCode + ' ' + type + ' ' + body);
        resolve();
      });
    });
    req.on('error', (e) => { console.log(method + ' ' + path + ' -> error ' + String(e && e.message)); resolve(); });
    if (data !== null) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('Listening on :' + PORT);
  await call('GET', '/api/users');
  await call('GET', '/api/users/42');
  await call('GET', '/api/profile');
  await call('POST', '/api/users', { name: 'Carol' });
  await call('POST', '/api/users', {});
  await call('GET', '/api/missing');
  try { app.close(); } catch (e) { console.log('close threw ' + String(e && e.message)); }
  clearTimeout(kill);
  console.log('done');
  process.exit(0);
}

app.listen({ port: PORT, host: '127.0.0.1' }, (err) => {
  if (err) { console.log('listen failed ' + String(err && err.message)); process.exit(2); }
  run();
});
