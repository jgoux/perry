// node:fs in a writable directory preopened by the host as /work
// (wasmtime --dir HOST::/work); node runs with the same directory in WORK_DIR.
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.WORK_DIR || '/work';
const dir = path.join(base, 'fsprobe');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'a.txt');
fs.writeFileSync(file, 'hello fs');
console.log(fs.readFileSync(file, 'utf8'));
fs.appendFileSync(file, ' more');
console.log(fs.readFileSync(file).length);
const st = fs.statSync(file);
console.log(st.isFile(), st.isDirectory(), st.size);
console.log(fs.statSync(dir).isDirectory());
fs.mkdirSync(path.join(dir, 'sub'));
fs.writeFileSync(path.join(dir, 'b.bin'), Buffer.from([1, 2, 3]));
console.log(fs.readdirSync(dir).sort().join(','));
console.log(fs.existsSync(file), fs.existsSync(path.join(dir, 'nope')));
try {
  fs.readFileSync(path.join(dir, 'nope'));
} catch (e) {
  console.log('code', e.code);
}
fs.unlinkSync(file);
fs.unlinkSync(path.join(dir, 'b.bin'));
fs.rmdirSync(path.join(dir, 'sub'));
console.log(fs.readdirSync(dir).length);
fs.promises.writeFile(path.join(dir, 'p.txt'), 'promise').then(() =>
  fs.promises.readFile(path.join(dir, 'p.txt'), 'utf8').then((s) => {
    console.log('promises', s);
    fs.unlinkSync(path.join(dir, 'p.txt'));
    fs.rmdirSync(dir);
  }));
