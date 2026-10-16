// Same, in a program that imports http, which makes perry rebuild the runtime,
// stdlib and wrappers together (the Storage compile takes this path).
const http = require('http');
const add = new Function('a', 'b', 'return a + b');
console.log('add', add(1, 2), typeof http.createServer);
