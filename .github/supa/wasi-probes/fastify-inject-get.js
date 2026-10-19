// npm: fastify@5.11.2
// Fastify's own inject (light-my-request) running unpatched from node_modules.
// A GET with a body answers through Response.write, which collects
// Buffer.from(data) in an array the response keeps in a nested field, and
// generatePayload concatenates it in a later tick; HEAD never writes a body.
const fastify = require('fastify');

const app = fastify();
app.get('/json', async () => ({ ok: true, items: [1, 2, 3] }));
app.get('/text', async (req, reply) => reply.type('text/plain').send('hello inject'));
app.get('/buffer', async (req, reply) => reply.type('application/octet-stream').send(Buffer.from('raw bytes')));
app.get('/big', async () => ({ pad: 'x'.repeat(40000) }));
app.post('/echo', async (req) => ({ got: req.body }));

async function main() {
  for (const [method, url, payload] of [
    ['GET', '/json'], ['HEAD', '/json'], ['GET', '/text'], ['GET', '/buffer'],
    ['GET', '/big'], ['GET', '/missing'], ['POST', '/echo', { a: 1 }], ['GET', '/json'],
  ]) {
    try {
      const res = await app.inject(payload === undefined ? { method, url } : { method, url, payload });
      const body = method === 'HEAD' ? '' : res.payload;
      console.log(method, url, res.statusCode, res.headers['content-type'], body.length, body.slice(0, 60));
    } catch (e) {
      console.log(method, url, 'threw', e && e.name, e && e.message);
    }
  }
  await app.close();
  console.log('done');
}
main();
