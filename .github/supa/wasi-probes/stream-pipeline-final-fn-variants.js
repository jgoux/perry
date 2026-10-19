// stream/promises pipeline(source, transform, finalFn) as Storage's S3 PutObject calls it:
// the final function must run and the promise must resolve with its return value.
// Each variant changes one thing from the plain `streamP.pipeline(...)` member call.
import { Readable, PassThrough, Transform } from 'node:stream';
import * as streamP from 'node:stream/promises';
import { pipeline } from 'node:stream/promises';

const timeout = (p, ms, name) =>
  Promise.race([p, new Promise((resolve) => setTimeout(() => resolve(name + ' TIMEOUT'), ms))]);

class Limit extends Transform {
  seen = 0;
  constructor(limit) { super(); this.limit = limit; }
  _transform(chunk, enc, cb) { this.seen += chunk.length; cb(null, chunk); }
}
const body = () => {
  const proxy = new PassThrough();
  Readable.from([Buffer.alloc(1000), Buffer.alloc(500)]).pipe(proxy);
  return proxy;
};
const total = async (stream) => {
  let n = 0;
  for await (const chunk of stream) n += chunk.length;
  return { headers: { etag: n } };
};
const wrap = (handler) => async (stream) => handler(stream);
const viaHelper = (b, limit, handler) => pipeline(b, new Limit(limit), wrap(handler));

const tests = {
  member: async () => streamP.pipeline(body(), new Limit(9), total),
  named: async () => pipeline(body(), new Limit(9), total),
  comma: async () => (0, streamP.pipeline)(body(), new Limit(9), total),
  wrapped: async () => pipeline(body(), new Limit(9), wrap(total)),
  helper: async () => viaHelper(body(), 9, total),
  twoStreams: async () => pipeline(body(), total),
  reboundDestroy: async () => {
    const proxy = body();
    const destroy = proxy.destroy.bind(proxy);
    proxy.destroy = (error) => destroy(error);
    return pipeline(proxy, new Limit(9), total);
  },
};
for (const [name, run] of Object.entries(tests)) {
  const r = await timeout(run(), 3000, name);
  console.log(name, typeof r === 'string' ? r : JSON.stringify(r));
}
process.exit(0);
