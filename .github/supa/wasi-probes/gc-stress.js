// max-rss-mb: 1500
// Allocate and drop roughly 200 MB of objects, arrays and strings in a loop
// while a live linked structure must survive every collection intact.
let head = null;
for (let i = 0; i < 20000; i++) head = { v: i, next: head, label: 'node-' + i, tags: [i, String(i)] };

let checksum = 0;
for (let round = 0; round < 300; round++) {
  const batch = [];
  for (let i = 0; i < 2500; i++) {
    batch.push({ id: i, name: 'item-' + round + '-' + i, tags: ['a', 'b', String(i)], nested: { x: i * 2, y: [i, i + 1] } });
  }
  let big = '';
  for (let i = 0; i < 64; i++) big += 'chunk' + i + ':' + round + ';';
  const wide = new Array(4096).fill(round);
  checksum = (checksum + batch.length + batch[round % 2500].name.length + big.length + wide[7] + batch[2499].nested.y[1]) % 1000003;
  if (round % 50 === 0) console.log('round', round, checksum);
}

let live = 0, count = 0, labelBytes = 0;
for (let n = head; n !== null; n = n.next) { live += n.v; count++; labelBytes += n.label.length + n.tags[1].length; }
console.log('live', count, live, labelBytes);
console.log('checksum', checksum);
console.log(count === 20000 && live === 199990000 ? 'live structure intact' : 'LIVE STRUCTURE CORRUPTED');
