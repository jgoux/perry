// node:zlib from perry-ext-zlib: sync and callback round trips.
const zlib = require('node:zlib');
const input = Buffer.from('hello hello hello hello zlib '.repeat(40));
const gz = zlib.gzipSync(input);
console.log('gzip magic', gz[0], gz[1], gz.length < input.length);
console.log('gunzip', zlib.gunzipSync(gz).equals(input));
const df = zlib.deflateSync(input);
console.log('deflate smaller', df.length < input.length);
console.log('inflate', zlib.inflateSync(df).toString() === input.toString());
console.log('raw', zlib.inflateRawSync(zlib.deflateRawSync(input)).equals(input));
console.log('empty', zlib.gunzipSync(zlib.gzipSync(Buffer.alloc(0))).length);
zlib.gzip(input, (err, out) => {
  console.log('gzip cb', err === null || err === undefined, out[0], out[1]);
  zlib.gunzip(out, (err2, back) => {
    console.log('gunzip cb', err2 === null || err2 === undefined, back.equals(input));
  });
});
