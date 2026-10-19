// Compiled inside the Storage checkout (real dist, real node_modules) by the
// storage-wasi job, run under wasmtime and compared with node. It drives the
// renderers behind GET /object/info/* and HEAD /object/* with a stand-in for
// the Fastify request and reply, so a failure points at the renderer code
// instead of the server around it.
"use strict";
require("./dist/start/minimal-defaults"); // stdout logging, no pino worker thread
const { HeadRenderer } = require("./dist/storage/renderer/head");
const { InfoRenderer } = require("./dist/storage/renderer/info");
const { ImageRenderer } = require("./dist/storage/renderer/image");
const { setErrorHandler } = require("./dist/http/error-handler");
const fastify = require("fastify");

let uncaught = 0;
process.on("uncaughtException", (e) => {
  uncaught++;
  console.log("UNCAUGHT", e && e.name, e && e.message);
});

function reply() {
  const r = { code: 0, headers: {}, sent: undefined };
  r.status = (c) => { r.code = c; return r; };
  r.header = (k, v) => { r.headers[k] = String(v); return r; };
  r.send = (b) => { r.sent = b; return r; };
  return r;
}
const object = {
  id: "i", name: "a.bin", version: "v1", bucket_id: "b", user_metadata: null,
  updated_at: "2026-01-01T00:00:00.000Z", created_at: "2026-01-01T00:00:00.000Z",
  archived_at: null, is_delete_marker: false, is_versioned: false,
  metadata: {
    size: 5000, mimetype: "application/octet-stream", eTag: '"e"', cacheControl: "no-cache",
    contentLength: 5000, lastModified: "2026-01-01T00:00:00.000Z", httpStatusCode: 200,
  },
};
const options = { bucket: "bkt", key: "k", version: "v1", object };
const request = { query: {}, headers: {} };

async function stage(label, fn) {
  try {
    const v = await Promise.race([
      fn(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
    ]);
    console.log(label, "ok", JSON.stringify(v, (k, x) => (x instanceof Date ? x.toISOString() : x)));
  } catch (e) {
    console.log(label, "ERR", e && e.name, e && e.message);
  }
}

async function main() {
  await stage("applyTransformation", () => ImageRenderer.applyTransformation({}));
  const head = new HeadRenderer();
  const info = new InfoRenderer();
  await stage("head getAsset", () => head.getAsset(request, options));
  await stage("info getAsset", () => info.getAsset(request, options));
  await stage("info setHeaders", async () => {
    const res = reply();
    const data = await head.getAsset(request, options);
    info.setHeaders(request, res, data, options);
    return { code: res.code, headers: res.headers };
  });
  await stage("head render", async () => {
    const res = reply();
    await head.render(request, res, options);
    return { code: res.code, headers: res.headers, sent: res.sent };
  });
  await stage("info render", async () => {
    const res = reply();
    await info.render(request, res, options);
    return { code: res.code, headers: res.headers, sent: res.sent };
  });
  await stage("info render again", async () => {
    const res = reply();
    await info.render(request, res, options);
    return { code: res.code, headers: res.headers, sent: res.sent };
  });
  // The same renderers behind real Fastify routes, requests injected in-process.
  const app = fastify();
  setErrorHandler(app);
  app.head("/head", async (req, res) => new HeadRenderer().render(req, res, options));
  app.get("/info", async (req, res) => new InfoRenderer().render(req, res, options));
  app.get("/object", async (req, res) => res.send({ a: 1 }));
  app.get("/object-late", async (req, res) => { await null; return res.send({ a: 1 }); });
  app.get("/throws", async () => { throw new Error("boom"); });
  const send = (headers) => async (req, res) => {
    for (const [k, v] of Object.entries(headers)) res.header(k, v);
    return res.send({ a: 1 });
  };
  app.get("/h-type", send({ "Content-Type": "application/json" }));
  app.get("/h-etag", send({ ETag: '"e"' }));
  app.get("/h-modified", send({ "Last-Modified": "Thu, 01 Jan 2026 00:00:00 GMT" }));
  app.get("/h-cache", send({ "Cache-Control": "no-cache" }));
  app.get("/h-length-num", send({ "Content-Length": 5000 }));
  app.get("/h-length-str", send({ "Content-Length": "5000" }));
  app.get("/h-length-exact", send({ "Content-Length": 7 }));
  await app.ready();
  for (const [method, url] of [
    ["HEAD", "/head"], ["GET", "/object"], ["GET", "/object-late"], ["GET", "/throws"],
    ["GET", "/h-type"], ["GET", "/h-etag"], ["GET", "/h-modified"], ["GET", "/h-cache"],
    ["GET", "/h-length-num"], ["GET", "/h-length-str"], ["GET", "/h-length-exact"],
    ["GET", "/info"], ["GET", "/info"],
  ]) {
    await stage("inject " + method + " " + url, async () => {
      const r = await app.inject({ method, url });
      return { status: r.statusCode, type: r.headers["content-type"], body: r.body };
    });
  }
  console.log("done", "uncaught", uncaught);
}
main();
