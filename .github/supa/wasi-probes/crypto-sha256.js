// node:crypto from the bundled perry-stdlib: hashes, HMAC, random bytes and the
// WebCrypto subtle API (the HMAC and digest paths jose uses for HS256).
// network: yes (links the shared net code; supa_net is imported but never called)
const crypto = require('node:crypto');
for (const alg of ['sha256', 'sha1', 'md5']) {
  console.log(alg, crypto.createHash(alg).update('abc').digest('hex'));
}
console.log(crypto.createHash('sha256').update('').digest('hex'));
console.log(crypto.createHash('sha256').update('hello ').update('world').digest('base64'));
console.log(crypto.createHmac('sha256', 'key').update('data').digest('hex'));
console.log(crypto.createHmac('sha1', Buffer.from('k')).update('d').digest('base64'));
console.log(crypto.randomBytes(16).length, crypto.randomBytes(0).length, typeof crypto.randomUUID());
console.log(crypto.randomBytes(8).toString('hex').length);

const enc = new TextEncoder();
(async () => {
  const subtle = crypto.webcrypto.subtle;
  const key = await subtle.importKey(
    'raw', enc.encode('secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const sig = await subtle.sign('HMAC', key, enc.encode('message'));
  console.log(Buffer.from(sig).toString('hex'), sig.byteLength);
  console.log(await subtle.verify('HMAC', key, sig, enc.encode('message')));
  console.log(await subtle.verify('HMAC', key, sig, enc.encode('other')));
  const digest = await subtle.digest('SHA-256', enc.encode('abc'));
  console.log(Buffer.from(digest).toString('hex'), digest.byteLength);
})().catch((e) => {
  console.log('error', e && e.message);
  process.exitCode = 1;
});
