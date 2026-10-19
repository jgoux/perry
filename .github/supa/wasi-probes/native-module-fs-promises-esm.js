// import of "fs/promises" in its namespace, default and named forms resolves
// every export to the real implementation, identical to fs.promises.
import * as ns from "fs/promises";
import def from "node:fs/promises";
import { readFile, writeFile, mkdir, rm } from "fs/promises";
import { promises } from "fs";
import { join } from "path";

const base = join(process.env.WORK_DIR || "/work", "nm-fsp-esm");
const names = ["readFile", "writeFile", "appendFile", "mkdir", "readdir", "stat", "lstat", "rm",
  "rename", "copyFile", "access", "mkdtemp", "unlink"];
for (const n of names) {
  console.log("export", n, typeof ns[n], typeof def[n], ns[n] === promises[n], def[n] === ns[n]);
}
console.log("named identity", readFile === promises.readFile, writeFile === promises.writeFile);
await mkdir(base, { recursive: true });
await writeFile(base + "/a.txt", "esm");
console.log("readFile named", await readFile(base + "/a.txt", "utf8"));
console.log("readFile ns", await ns.readFile(base + "/a.txt", "utf8"));
console.log("readFile default", await def.readFile(base + "/a.txt", "utf8"));
console.log("readFile comma", await (0, ns.readFile)(base + "/a.txt", "utf8"));
console.log("appendFile", await ns.appendFile(base + "/a.txt", "!"), await ns.readFile(base + "/a.txt", "utf8"));
console.log("stat", (await def.stat(base + "/a.txt")).size);
console.log("readdir", JSON.stringify(await ns.readdir(base)));
await rm(base, { recursive: true, force: true });
console.log("removed", await ns.access(base).then(() => false, (e) => e.code));
process.exit(0);
