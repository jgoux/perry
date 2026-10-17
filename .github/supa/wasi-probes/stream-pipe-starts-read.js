// `readable.pipe(dest)` on a stream that has not been flowing must start reading
// by itself: a Readable made by Readable.fromWeb() pulls its web source only
// when something asks it for data, and pipe() is that request. The destination
// (a Writable, or a PassThrough read back through its 'data' events) must see
// every byte and the end of the stream.
// network: yes
import { Readable, PassThrough, Writable } from 'node:stream';

const web = () => new ReadableStream({
  start(controller) {
    controller.enqueue(new Uint8Array(1000).fill(120));
    controller.enqueue(new Uint8Array(500).fill(121));
    controller.close();
  },
});
const timeout = (p, ms, name) =>
  Promise.race([p, new Promise((resolve) => setTimeout(() => resolve(name + ' TIMEOUT'), ms))]);

const tests = {
  async toWritable() {
    let total = 0;
    const sink = new Writable({ write(chunk, enc, cb) { total += chunk.length; cb(); } });
    const source = Readable.fromWeb(web());
    source.pipe(sink);
    await new Promise((resolve) => sink.on('finish', resolve));
    return total;
  },
  async throughPassThrough() {
    let total = 0;
    const proxy = new PassThrough();
    Readable.fromWeb(web()).pipe(proxy);
    await new Promise((resolve) => {
      proxy.on('data', (chunk) => { total += chunk.length; });
      proxy.on('end', resolve);
    });
    return total;
  },
};
for (const [name, run] of Object.entries(tests)) console.log(name, await timeout(run(), 3000, name));
process.exit(0);
