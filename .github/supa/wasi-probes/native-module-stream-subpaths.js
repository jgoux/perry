// require() of stream/promises, stream/consumers and stream/web: every export must
// run the real implementation, however it is read or called.
// network: yes
"use strict";
const stream = require("stream");
const sp = require("stream/promises");
const spPrefixed = require("node:stream/promises");
const { finished, pipeline } = require("stream/promises");
const sc = require("stream/consumers");
const scPrefixed = require("node:stream/consumers");
const { text, json } = require("stream/consumers");
const sw = require("stream/web");
const swPrefixed = require("node:stream/web");
const { ReadableStream, TransformStream } = require("stream/web");
const show = async (label, fn) => {
  try { console.log(label, JSON.stringify(await fn())); }
  catch (e) { console.log(label, "threw", e && e.name); }
};
const source = (...chunks) => stream.Readable.from(chunks);
(async () => {
  for (const n of ["pipeline", "finished"]) {
    console.log("stream/promises", n, typeof sp[n], typeof spPrefixed[n], sp[n] === stream.promises[n]);
  }
  console.log("stream/promises namespace", sp === stream.promises, spPrefixed === sp);
  await show("finished member", async () => {
    const r = source("x");
    r.resume();
    return (await sp.finished(r)) === undefined;
  });
  await show("finished destructured", async () => {
    const r = source("x");
    r.resume();
    return (await finished(r)) === undefined;
  });
  await show("pipeline array", async () => {
    const chunks = [];
    const sink = new stream.Writable({ write(c, e, cb) { chunks.push(String(c)); cb(); } });
    await sp.pipeline([source("a", "b"), sink]);
    return chunks;
  });
  await show("pipeline comma", async () => {
    const chunks = [];
    const sink = new stream.Writable({ write(c, e, cb) { chunks.push(String(c)); cb(); } });
    await (0, pipeline)(source("c"), sink);
    return chunks;
  });

  for (const n of ["text", "json", "buffer", "arrayBuffer", "blob"]) {
    console.log("stream/consumers", n, typeof sc[n], typeof scPrefixed[n]);
  }
  await show("text member", () => sc.text(source("ab", "cd")));
  await show("text prefixed", () => scPrefixed.text(source("pre", "fixed")));
  await show("text comma", () => (0, sc.text)(source("com", "ma")));
  await show("text destructured", () => text(source("dest")));
  await show("json destructured", () => json(source('{"a":', "1}")));
  await show("json member", () => sc.json(source('[1,', '2]')));
  await show("buffer", async () => (await sc.buffer(source(Buffer.from("buf")))).toString());
  await show("arrayBuffer", async () => (await sc.arrayBuffer(source(Buffer.from("abcd")))).byteLength);
  await show("blob", async () => (await sc.blob(source(Buffer.from("blob")))).size);

  const classes = ["ReadableStream", "WritableStream", "TransformStream", "TextEncoderStream",
    "TextDecoderStream", "CompressionStream", "DecompressionStream", "ByteLengthQueuingStrategy",
    "CountQueuingStrategy", "ReadableStreamDefaultReader", "WritableStreamDefaultWriter"];
  for (const n of classes) {
    console.log("stream/web", n, typeof sw[n], typeof swPrefixed[n], sw[n] === globalThis[n]);
  }
  console.log("stream/web destructured", ReadableStream === globalThis.ReadableStream, TransformStream === globalThis.TransformStream);
  await show("ReadableStream", async () => {
    const reader = new sw.ReadableStream({ start(c) { c.enqueue(1); c.enqueue(2); c.close(); } }).getReader();
    const seen = [];
    for (let r = await reader.read(); !r.done; r = await reader.read()) seen.push(r.value);
    return seen;
  });
  await show("TransformStream", async () => {
    const t = new TransformStream({ transform(chunk, c) { c.enqueue(chunk * 2); } });
    const w = t.writable.getWriter();
    w.write(21);
    w.close();
    const r = t.readable.getReader();
    return (await r.read()).value;
  });
  await show("TextEncoderStream", () => Promise.resolve(new sw.TextEncoderStream().encoding));
  await show("CountQueuingStrategy", () => Promise.resolve(new sw.CountQueuingStrategy({ highWaterMark: 3 }).highWaterMark));
  process.exit(0);
})();
