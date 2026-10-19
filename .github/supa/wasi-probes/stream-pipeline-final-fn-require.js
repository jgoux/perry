// stream/promises pipeline(source, transform, finalFn) reached through require(),
// bisecting the specifier, the call form and the transform. The final function
// must run and the promise must resolve with its return value in every variant.
"use strict";
const stream = require("stream");
const util = require("util");
const bare = require("stream/promises");
const prefixed = require("node:stream/promises");
const { pipeline: destructured } = require("stream/promises");

class Limit extends stream.Transform {
  constructor(limit) {
    super();
    this.limit = limit;
  }
  _transform(chunk, enc, cb) {
    cb(null, chunk);
  }
}
const plain = () => new stream.Transform({ transform(chunk, enc, cb) { cb(null, chunk); } });
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
  bareMember: () => bare.pipeline(body(), new Limit(9), total),
  prefixedMember: () => prefixed.pipeline(body(), new Limit(9), total),
  bareComma: () => (0, bare.pipeline)(body(), new Limit(9), total),
  destructured: () => destructured(body(), new Limit(9), total),
  streamPromises: () => stream.promises.pipeline(body(), new Limit(9), total),
  promisified: () => util.promisify(stream.pipeline)(body(), new Limit(9), total),
  plainTransform: () => bare.pipeline(body(), plain(), total),
  twoStages: () => bare.pipeline(body(), total),
};
(async () => {
  for (const [name, run] of Object.entries(tests)) {
    console.log(name, JSON.stringify(await timeout(run(), 3000)));
  }
  process.exit(0);
})();
