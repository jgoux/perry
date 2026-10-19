// wasm-env: PERRY_GC_LOG=1
// stderr-max-count: 0 kind=full
// max-rss-mb: 900
// A request-shaped loop over a steady live heap: each turn of the event loop reads a 1 MiB
// buffer, copies it twice (concat and a typed-array slice copy) and drops all three, the way a
// storage server streams an object. The off-heap bytes die young, so the collector should pay
// for them with cheap minors; a full mark-sweep over the live heap per few requests is the bug
// (the stderr bound counts the full collections the log reports).
//
// Each request also builds about 1 MB of small garbage, as a real request handler does. That is
// not decoration: the full collector force-marks every object in the last five 1 MiB arena blocks
// (block persistence, protecting values only a register holds), so a program that allocates almost
// nothing but big buffers keeps their holders, and through them the buffers' off-heap bytes,
// alive until the window moves on. Without the garbage this loop retains all 360 MB it allocates.
const live = [];
for (let i = 0; i < 60000; i++) live.push({ id: i, name: 'obj-' + i, tags: [i, 'x' + i], nested: { a: i * 2 } });

function fill(buf, seed) {
  for (let i = 0; i < buf.length; i += 4096) buf[i] = (seed + i / 4096) & 255;
  return buf;
}

async function main() {
  let checksum = 0;
  for (let req = 0; req < 120; req++) {
    await new Promise((resolve) => setImmediate(resolve));
    const body = fill(Buffer.alloc(1048576), req);
    const joined = Buffer.concat([body.subarray(0, 524288), body.subarray(524288)]);
    const copy = new Uint8Array(joined);
    const junk = [];
    for (let i = 0; i < 10000; i++) junk.push({ i, s: 'j' + i });
    checksum = (checksum + junk.length) % 1000003;
    for (let i = 0; i < copy.length; i += 65536) checksum = (checksum + copy[i] + joined[i]) % 1000003;
    if (req % 30 === 0) console.log('request', req, checksum);
  }
  let sum = 0;
  for (let i = 0; i < live.length; i++) sum += live[i].nested.a + live[i].tags[0];
  console.log('checksum', checksum);
  console.log(sum === 5399910000 ? 'live heap intact' : 'LIVE HEAP CORRUPTED ' + sum);
}
main();
