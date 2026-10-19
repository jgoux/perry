// require("fs/promises") is a native-module namespace; every export must resolve
// to the real implementation whichever way it is read or called (member, node:
// spelling, comma call, destructured) and be the same function as fs.promises.
"use strict";
const fs = require("fs");
const bare = require("fs/promises");
const prefixed = require("node:fs/promises");
const { readFile, writeFile, mkdir, stat } = require("fs/promises");
const base = require("path").join(process.env.WORK_DIR || "/work", "nm-fsp");
const names = ["readFile", "writeFile", "appendFile", "mkdir", "readdir", "stat", "lstat", "rm",
  "rmdir", "unlink", "rename", "copyFile", "truncate", "access", "mkdtemp", "realpath", "open",
  "chmod", "utimes", "symlink", "readlink", "link", "opendir", "cp"];
const show = async (label, fn) => {
  try { console.log(label, JSON.stringify(await fn())); }
  catch (e) { console.log(label, "threw", e && e.name, e && e.code); }
};
(async () => {
  for (const n of names) {
    console.log("export", n, typeof bare[n], typeof prefixed[n], bare[n] === fs.promises[n], prefixed[n] === bare[n]);
  }
  console.log("constants", typeof bare.constants, bare.constants === fs.constants);
  console.log("same namespace", bare === fs.promises, prefixed === bare);
  await show("mkdir", () => bare.mkdir(base, { recursive: true }).then((p) => typeof p));
  await show("mkdir comma", () => (0, bare.mkdir)(base + "/a", { recursive: true }).then((p) => typeof p));
  await show("mkdir destructured", () => mkdir(base + "/b", { recursive: true }).then((p) => typeof p));
  await show("writeFile", () => bare.writeFile(base + "/f.txt", "hello"));
  await show("writeFile comma", () => (0, prefixed.writeFile)(base + "/g.txt", "world"));
  await show("writeFile destructured", () => writeFile(base + "/h.txt", "!"));
  await show("appendFile", () => bare.appendFile(base + "/f.txt", " there"));
  await show("readFile", () => bare.readFile(base + "/f.txt", "utf8"));
  await show("readFile comma", () => (0, bare.readFile)(base + "/g.txt", "utf8"));
  await show("readFile destructured", () => readFile(base + "/h.txt", "utf8"));
  await show("readFile missing", () => bare.readFile(base + "/missing.txt"));
  await show("stat", () => bare.stat(base + "/f.txt").then((s) => [s.size, s.isFile(), s.isDirectory()]));
  await show("stat destructured", () => stat(base).then((s) => s.isDirectory()));
  await show("lstat", () => bare.lstat(base + "/f.txt").then((s) => s.size));
  await show("copyFile", () => bare.copyFile(base + "/f.txt", base + "/c.txt"));
  await show("rename", () => bare.rename(base + "/c.txt", base + "/d.txt"));
  await show("truncate", () => bare.truncate(base + "/d.txt", 3));
  await show("readFile truncated", () => bare.readFile(base + "/d.txt", "utf8"));
  await show("access", () => bare.access(base + "/d.txt"));
  await show("access missing", () => bare.access(base + "/nope"));
  await show("readdir", () => bare.readdir(base).then((l) => l.sort()));
  await show("realpath", () => bare.realpath(base + "/a/..").then((p) => p === fs.realpathSync(base)));
  await show("mkdtemp", () => bare.mkdtemp(base + "/t-").then((p) => p.startsWith(base + "/t-")));
  await show("open", async () => {
    const h = await bare.open(base + "/f.txt", "r");
    const { bytesRead } = await h.read(Buffer.alloc(5), 0, 5, 0);
    await h.close();
    return bytesRead;
  });
  await show("unlink", () => bare.unlink(base + "/d.txt"));
  await show("rm", () => bare.rm(base, { recursive: true, force: true }));
  await show("rm check", () => bare.access(base));
  process.exit(0);
})();
