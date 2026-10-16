// The smallest program: stdout, a few core expressions, and a clean exit.
const who = 'wasip1';
console.log(`hello from ${who}`);
console.log([1, 2, 3].map((x) => x * 2).join(','));
console.log(typeof process.exit, typeof setTimeout, typeof Buffer);
console.error('this line goes to stderr and is not compared');
