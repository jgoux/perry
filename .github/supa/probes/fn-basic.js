// A dynamic Function runs through the runtime interpreter.
const add = new Function('a', 'b', 'return a + b');
console.log('add', add(1, 2));
