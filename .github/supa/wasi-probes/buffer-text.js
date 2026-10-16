// Buffer and TextEncoder/TextDecoder.
const b = Buffer.from('héllo wörld', 'utf8');
console.log(b.length, b.toString('hex'), b.toString('base64'));
console.log(Buffer.from('aGk=', 'base64').toString(), Buffer.from('6869', 'hex').toString());
const c = Buffer.concat([Buffer.from('ab'), Buffer.alloc(2, 0x63), Buffer.from([100, 101])]);
console.log(c.toString(), c.length, c.slice(1, 4).toString(), c.indexOf('d'));
const w = Buffer.alloc(8);
w.writeUInt32BE(0xdeadbeef, 0); w.writeInt16LE(-2, 4); w.writeUInt8(255, 6);
console.log(w.toString('hex'), w.readUInt32BE(0), w.readInt16LE(4), w.readUInt8(6));
console.log(Buffer.compare(Buffer.from('a'), Buffer.from('b')), Buffer.from('x').equals(Buffer.from('x')), Buffer.isBuffer(w));
const enc = new TextEncoder();
const bytes = enc.encode('€uro \u{1F600}');
console.log(bytes.length, Array.from(bytes.slice(0, 4)).join(','), enc.encoding);
const dec = new TextDecoder();
console.log(dec.decode(bytes), dec.encoding, new TextDecoder().decode(new Uint8Array([104, 105])));
const u8 = new Uint8Array([1, 2, 3, 4]);
console.log(Buffer.from(u8.buffer).toString('hex'), new Uint32Array(u8.buffer)[0]);
console.log(JSON.stringify(Buffer.from('ab')));
