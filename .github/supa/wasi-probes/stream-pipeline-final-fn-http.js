// An http request body proxied through a PassThrough the way Storage's upload
// path does (listeners on the request, a rebound destroy, req.pipe(proxy)), then
// pipeline(proxy, Transform subclass, wrapped async function) as S3 PutObject
// runs it. The final function must run and the promise resolve with its value.
// network: yes
// server-port: 18324
// request: PUT /put @bytes:1000
// request: PUT /put-big @bytes:300000
// request: GET /quit
"use strict";
var import_http = require("http");
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
function bodyProxy(body) {
  const proxy = new import_stream.PassThrough();
  const destroy = proxy.destroy.bind(proxy);
  proxy.destroy = (error) => destroy(error);
  body.on("aborted", () => {});
  body.on("close", () => {});
  body.on("end", () => {});
  body.on("error", (err) => proxy.destroy(err));
  proxy.on("error", () => body.unpipe(proxy));
  body.pipe(proxy);
  return proxy;
}
function withHandler(handler) {
  return async (stream) => {
    return handler(stream);
  };
}
const total = async (stream) => {
  let n = 0;
  for await (const chunk of stream) n += chunk.length;
  return { headers: { etag: n } };
};

const server = import_http.createServer(async (req, res) => {
  if (req.url === "/quit") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("bye", () => setTimeout(() => process.exit(0), 50));
    return;
  }
  try {
    const out = await (0, import_promises.pipeline)(bodyProxy(req), new Limit(1 << 30), withHandler(total));
    console.log(req.url, JSON.stringify(out));
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(JSON.stringify(out));
  } catch (e) {
    console.log(req.url, "error", e && e.message);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("error");
  }
});
server.listen(18324, "127.0.0.1", () => console.log("listening"));
