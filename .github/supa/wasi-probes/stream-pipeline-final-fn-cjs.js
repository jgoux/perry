// The compiled (CommonJS) shape of Storage's S3 PutObject: the unprefixed
// "stream/promises" specifier, called as (0, import_promises.pipeline)(...) with
// a Transform subclass in the middle and a wrapped async final function. The
// final function must run and the promise must resolve with its return value.
"use strict";
var import_stream = require("stream");
var import_promises = require("stream/promises");

class Limit extends import_stream.Transform {
  constructor(limit) {
    super();
    this.limit = limit;
    this.seen = 0;
  }
  _transform(chunk, enc, cb) {
    this.seen += chunk.length;
    cb(null, chunk);
  }
}
function withHandler(handler) {
  return async (stream) => {
    return handler(stream);
  };
}
function run(body, limit, handler) {
  return (0, import_promises.pipeline)(body, new Limit(limit), withHandler(handler));
}
const total = async (stream) => {
  let n = 0;
  for await (const chunk of stream) n += chunk.length;
  return { headers: { etag: n } };
};
const body = () => {
  const proxy = new import_stream.PassThrough();
  import_stream.Readable.from([Buffer.alloc(1000), Buffer.alloc(500)]).pipe(proxy);
  return proxy;
};
const timeout = (p, ms) =>
  Promise.race([p, new Promise((resolve) => setTimeout(() => resolve("TIMEOUT"), ms))]);

(async () => {
  console.log("cjs", JSON.stringify(await timeout(run(body(), 9, total), 3000)));
  process.exit(0);
})();
