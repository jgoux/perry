// CommonJS name resolution through the host's supa_net.resolve: require('node:dns'),
// require('dns'), dns.promises and net.connect({ host: 'localhost' }) to a local listener.
// compile-only: needs a resolver
// network: yes
const dns = require('node:dns');
const bare = require('dns');
const dnsPromises = require('node:dns/promises');
const net = require('node:net');

const isLoopback = (a) => a === '127.0.0.1' || a === '::1';
const step = (name, fn) => new Promise((resolve) => fn((...r) => { console.log(name, ...r); resolve(); }));

async function main() {
  console.log('exports', typeof dns.lookup, typeof dns.promises.lookup, typeof dnsPromises.lookup, bare.lookup === dns.lookup);
  await step('lookup', (done) => dns.lookup('localhost', (err, address, family) =>
    done(err === null, isLoopback(address), family === 4 || family === 6)));
  await step('lookup all', (done) => bare.lookup('localhost', { all: true }, (err, all) =>
    done(err === null, all.length > 0, all.every((a) => isLoopback(a.address)))));
  await step('lookup literal', (done) => dns.lookup('127.0.0.1', (err, address, family) =>
    done(err === null, address, family)));
  await step('lookup missing', (done) => dns.lookup('no-such-host.invalid', (err) => done(err && err.code)));
  const one = await dns.promises.lookup('localhost');
  console.log('promises', isLoopback(one.address), one.family === 4 || one.family === 6);
  const all = await dnsPromises.lookup('localhost', { all: true });
  console.log('promises all', all.length > 0);
  try {
    await dns.promises.lookup('no-such-host.invalid');
  } catch (e) {
    console.log('promises missing', e.code);
  }

  const port = Number(process.env.PROBE_PORT || 47123);
  const server = net.createServer((socket) => socket.end('hello by name'));
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const body = await new Promise((resolve, reject) => {
    let received = '';
    const socket = net.connect({ host: 'localhost', port });
    socket.setEncoding('utf8');
    socket.on('data', (d) => (received += d));
    socket.on('end', () => resolve(received));
    socket.on('error', reject);
  });
  console.log('connect', JSON.stringify(body));
  const code = await new Promise((resolve) => {
    const socket = net.connect({ host: 'no-such-host.invalid', port });
    socket.on('connect', () => resolve('connected'));
    socket.on('error', (e) => resolve(e.code));
  });
  console.log('connect missing', code);
  server.close();
}
main().catch((e) => { console.log('failed', e && e.stack || e); process.exitCode = 1; });
