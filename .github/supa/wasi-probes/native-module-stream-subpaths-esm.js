// import of stream/promises, stream/consumers and stream/web (namespace, default, named).
// network: yes
import * as sp from "stream/promises";
import spDefault from "node:stream/promises";
import { finished } from "stream/promises";
import * as sc from "stream/consumers";
import scDefault from "node:stream/consumers";
import { text, json } from "stream/consumers";
import * as sw from "stream/web";
import swDefault from "node:stream/web";
import { ReadableStream } from "stream/web";
import { Readable } from "stream";

const source = (...chunks) => Readable.from(chunks);
console.log("stream/promises", typeof sp.pipeline, typeof spDefault.pipeline, sp.pipeline === spDefault.pipeline,
  typeof sp.finished, spDefault.finished === sp.finished, finished === sp.finished);
const r = source("x");
r.resume();
console.log("finished", (await sp.finished(r)) === undefined);
console.log("consumers", typeof sc.text, typeof scDefault.text, typeof text, typeof json);
console.log("text ns", await sc.text(source("a", "b")));
console.log("text default", await scDefault.text(source("c", "d")));
console.log("text named", await text(source("e")));
console.log("json named", JSON.stringify(await json(source('{"k":', "2}"))));
console.log("buffer", (await sc.buffer(source(Buffer.from("buf")))).toString());
console.log("web", typeof sw.ReadableStream, typeof swDefault.WritableStream, sw.ReadableStream === globalThis.ReadableStream,
  ReadableStream === globalThis.ReadableStream, swDefault.TransformStream === globalThis.TransformStream);
const reader = new sw.ReadableStream({ start(c) { c.enqueue("w"); c.close(); } }).getReader();
console.log("read", JSON.stringify(await reader.read()));
console.log("strategy", new swDefault.CountQueuingStrategy({ highWaterMark: 4 }).highWaterMark);
process.exit(0);
