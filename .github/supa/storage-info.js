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
    const v = await fn();
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
  console.log("done");
}
main();
