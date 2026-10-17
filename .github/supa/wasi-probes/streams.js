// node:stream: Readable.from -> Transform -> Writable through pipeline().
const { Readable, Transform, Writable, pipeline } = require('node:stream');
const out = [];
const upper = new Transform({
  transform(chunk, _enc, cb) {
    cb(null, chunk.toString().toUpperCase());
  },
});
const sink = new Writable({
  write(chunk, _enc, cb) {
    out.push(chunk.toString());
    cb();
  },
});
pipeline(Readable.from(['a', 'b', 'c']), upper, sink, (err) => {
  console.log('pipeline done', err === undefined || err === null, out.join(''));
  const r = new Readable({ read() {} });
  const chunks = [];
  r.on('data', (c) => chunks.push(c.toString()));
  r.on('end', () => console.log('end', chunks.join('+')));
  r.push('x');
  r.push('y');
  r.push(null);
});
