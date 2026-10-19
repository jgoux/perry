// stream/promises pipeline(source, transform, finalFn) reached through
// require("stream/promises"): the final function must run and the promise must
// resolve with its return value, whichever way the export is read. Storage's
// S3 PutObject calls it as `(0, import_promises.pipeline)(body, limit, handler)`.
"use strict";
const stream = require("stream");
const bare = require("stream/promises");
const prefixed = require("node:stream/promises");
const { pipeline: destructured } = require("stream/promises");

const passThrough = () =>
  new stream.Transform({ transform(chunk, enc, cb) { cb(null, chunk); } });
const body = () => {
  const proxy = new stream.PassThrough();
  stream.Readable.from([Buffer.alloc(1000), Buffer.alloc(500)]).pipe(proxy);
  return proxy;
};
const total = async (s) => {
  let n = 0;
  for await (const chunk of s) n += chunk.length;
  return { headers: { etag: n } };
};
const timeout = (p, ms) =>
  Promise.race([p, new Promise((resolve) => setTimeout(() => resolve("TIMEOUT"), ms))]);

const tests = {
  member: () => bare.pipeline(body(), passThrough(), total),
  prefixedMember: () => prefixed.pipeline(body(), passThrough(), total),
  comma: () => (0, bare.pipeline)(body(), passThrough(), total),
  destructured: () => destructured(body(), passThrough(), total),
  streamPromises: () => stream.promises.pipeline(body(), passThrough(), total),
  sameFunction: () => Promise.resolve(bare.pipeline === stream.promises.pipeline),
};
(async () => {
  for (const [name, run] of Object.entries(tests)) {
    console.log(name, JSON.stringify(await timeout(run(), 3000)));
  }
  process.exit(0);
})();
