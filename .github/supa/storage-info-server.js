// Compiled inside the Storage checkout (real dist, real node_modules) by the
// storage-wasi job and served on the listener wasmtime hands the guest. The
// routes put the renderers behind GET /object/info/* and HEAD /object/* in a
// real Fastify server with Storage's error handler; storage-info-server.sh
// sends the same requests to node and to the wasm module and compares.
"use strict";
require("./dist/start/minimal-defaults"); // stdout logging, no pino worker thread
const { HeadRenderer } = require("./dist/storage/renderer/head");
const { InfoRenderer } = require("./dist/storage/renderer/info");
const { setErrorHandler } = require("./dist/http/error-handler");
const fastify = require("fastify");

process.on("uncaughtException", (e) => {
  console.log("UNCAUGHT", e && e.name, e && e.message);
  process.exit(1);
});

const object = {
  id: "i", name: "a.bin", version: "v1", bucket_id: "b", user_metadata: null,
  updated_at: "2026-01-01T00:00:00.000Z", created_at: "2026-01-01T00:00:00.000Z",
  archived_at: null, is_delete_marker: false, is_versioned: false,
  metadata: {
    size: 5000, mimetype: "application/octet-stream", eTag: '"e"', cacheControl: "no-cache",
    lastModified: "2026-01-01T00:00:00.000Z", httpStatusCode: 200,
  },
};
const options = { bucket: "bkt", key: "k", version: "v1", object };

const app = fastify();
setErrorHandler(app);
app.head("/head/*", async (req, res) => new HeadRenderer().render(req, res, options));
app.get("/info/*", async (req, res) => new InfoRenderer().render(req, res, options));
app.get("/object", async (req, res) => res.send({ a: 1 }));
app.get("/throws", async () => { throw new Error("boom"); });
app.get("/quit", async (req, res) => {
  setTimeout(() => process.exit(0), 50);
  return res.send({ bye: true });
});
app.listen({ port: 18331, host: "127.0.0.1" }).then(() => console.log("listening"));
