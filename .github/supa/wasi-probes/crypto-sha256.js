// optional: node:crypto lives in perry-stdlib, which the wasip1 archive does not bundle yet.
const crypto = require('crypto');
console.log(crypto.createHash('sha256').update('abc').digest('hex'));
console.log(crypto.createHash('sha256').update('').digest('hex'));
console.log(crypto.createHash('sha256').update('hello ').update('world').digest('base64'));
