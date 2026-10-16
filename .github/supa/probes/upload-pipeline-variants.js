// compare-node
// Bisects the request-body upload hang: the same PassThrough -> fs write
// stream pipeline, fed four different ways. Each variant has its own timeout
// and prints what the streams looked like when it stalled.
"use strict";
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const stream = require("stream");
const { promisify } = require("util");
const pipeline = promisify(stream.pipeline);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "upload-variants-"));
const big = Buffer.alloc(131072, 7);
const chunk = 16384;

function feed(pt, done) {
  let off = 0;
  const step = () => {
    if (off >= big.length) { pt.end(); done && done(); return; }
    pt.write(big.subarray(off, off + chunk));
    off += chunk;
    setImmediate(step);
  };
  step();
}

function withTimeout(name, run) {
  return new Promise((resolve) => {
    const state = {};
    const timer = setTimeout(() => {
      console.log(name + ": TIMEOUT " + JSON.stringify(state));
      resolve();
    }, 8000);
    run(state).then(
      (size) => { clearTimeout(timer); console.log(name + ": ok " + size); resolve(); },
      (err) => { clearTimeout(timer); console.log(name + ": error " + (err && err.message)); resolve(); }
    );
  });
}

function target(name, state) {
  const file = path.join(dir, name + ".bin");
  const dest = fs.createWriteStream(file);
  dest.on("finish", () => { state.finish = true; });
  dest.on("close", () => { state.close = true; });
  state.written = () => dest.bytesWritten;
  return { file, dest };
}

async function v1() { // fed in chunks after the pipeline starts
  await withTimeout("fed-after-pipeline", async (state) => {
    const pt = new stream.PassThrough();
    const { file, dest } = target("v1", state);
    const p = pipeline(pt, dest);
    feed(pt);
    await p;
    return fs.statSync(file).size;
  });
}

async function v2() { // fully written and ended before the pipeline starts
  await withTimeout("ended-before-pipeline", async (state) => {
    const pt = new stream.PassThrough();
    const { file, dest } = target("v2", state);
    await new Promise((resolve) => feed(pt, resolve));
    await new Promise((r) => setTimeout(r, 50));
    await pipeline(pt, dest);
    return fs.statSync(file).size;
  });
}

function serve(name, beforePipeline) {
  return withTimeout(name, async (state) => {
    const { file, dest } = target(name, state);
    let seen;
    const server = http.createServer(async (req, res) => {
      const proxy = new stream.PassThrough();
      req.pipe(proxy);
      try {
        if (beforePipeline) await beforePipeline();
        await pipeline(proxy, dest);
        res.end("ok");
      } catch (err) {
        res.statusCode = 500;
        res.end(String(err && err.message));
      }
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    await new Promise((resolve, reject) => {
      const req = http.request(
        { host: "127.0.0.1", port: server.address().port, method: "POST",
          headers: { "content-length": big.length } },
        (res) => { res.resume(); res.on("end", resolve); }
      );
      req.on("error", reject);
      req.end(big);
    });
    server.close();
    seen = fs.statSync(file).size;
    return seen;
  });
}

(async () => {
  await v1();
  await v2();
  await serve("http-pipeline-immediately", null);
  await serve("http-pipeline-after-await", () => fs.promises.mkdir(dir, { recursive: true }));
  fs.rmSync(dir, { recursive: true, force: true });
})();
