// compare-node
// Storage's binary upload path: a request body piped through a PassThrough
// proxy (uploader.ts createUploadBodyProxy), then promisify(stream.pipeline)
// into fs.createWriteStream (file backend uploadObject), then a reply.
"use strict";
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { PassThrough } = require("stream");
const stream = require("stream");
const { promisify } = require("util");
const pipeline = promisify(stream.pipeline);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "upload-probe-"));
const payload = crypto.createHash("sha256").update("seed").digest();
const big = Buffer.concat(Array.from({ length: 4096 }, () => payload));
const sum = (b) => crypto.createHash("sha256").update(b).digest("hex");

function createUploadBodyProxy(body) {
  const proxy = new PassThrough();
  let bodyEnded = false;
  const destroy = proxy.destroy.bind(proxy);
  proxy.destroy = (error) => destroy(error);
  const onBodyError = (err) => { if (!proxy.destroyed) proxy.destroy(err); };
  const onBodyEnd = () => { bodyEnded = true; };
  const onBodyClose = () => {
    if (!bodyEnded && !body.readableEnded && !proxy.destroyed) {
      proxy.destroy(new Error("Request stream closed before upload could complete"));
    }
  };
  const onProxyError = () => { body.unpipe(proxy); };
  const cleanup = () => {
    body.unpipe(proxy);
    body.off("aborted", onBodyClose);
    body.off("close", onBodyClose);
    body.off("end", onBodyEnd);
    body.off("error", onBodyError);
    proxy.off("error", onProxyError);
    proxy.off("close", cleanup);
  };
  body.on("aborted", onBodyClose);
  body.on("close", onBodyClose);
  body.on("end", onBodyEnd);
  body.on("error", onBodyError);
  proxy.on("error", onProxyError);
  proxy.on("close", cleanup);
  body.pipe(proxy);
  return proxy;
}

let stage = "start";
const server = http.createServer(async (req, res) => {
  try {
    stage = "proxy";
    const body = createUploadBodyProxy(req);
    const file = path.join(dir, "hello.bin");
    stage = "mkdir";
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    const dest = fs.createWriteStream(file);
    stage = "pipeline";
    await pipeline(body, dest);
    stage = "stat";
    const st = await fs.promises.stat(file);
    stage = "reply";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ size: st.size, sum: sum(fs.readFileSync(file)) }));
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("server error at " + stage + ": " + (err && err.message));
  }
});

const watchdog = setTimeout(() => {
  console.log("TIMEOUT at stage " + stage);
  process.exit(1);
}, 20000);

server.listen(0, "127.0.0.1", () => {
  const req = http.request(
    { host: "127.0.0.1", port: server.address().port, method: "POST", path: "/upload",
      headers: { "content-type": "application/octet-stream", "content-length": big.length } },
    (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        console.log("status", res.statusCode);
        console.log("body", Buffer.concat(chunks).toString());
        console.log("expected", JSON.stringify({ size: big.length, sum: sum(big) }));
        clearTimeout(watchdog);
        fs.rmSync(dir, { recursive: true, force: true });
        server.close();
      });
    }
  );
  req.end(big);
});
