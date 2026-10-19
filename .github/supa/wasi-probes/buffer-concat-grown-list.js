// A list that grew by push past its initial capacity leaves a forwarding stub
// where the head used to be; a binding that kept the old head (a field no
// write-back reached, a closure's capture) still names the live array through
// it. Buffer.concat read length and elements off the raw head, so it saw the
// forwarding pointer in the first element slot and threw "list[0] ... Received
// number" (light-my-request collects a response body this way: `this._state.
// chunks.push(Buffer.from(data))` and `Buffer.concat(state.chunks)` in a later
// tick). Every shape below must concat to the same bytes as node.
function show(label, buf) {
  console.log(label, buf.length, buf.toString());
}
function chunk(i) {
  return Buffer.from('c' + i + ';');
}
function attempt(label, fn) {
  try {
    show(label, fn());
  } catch (e) {
    console.log(label, 'threw', e && e.name, e && e.message);
  }
}

// 1. A nested field, the light-my-request shape.
class Res {
  constructor() {
    this._state = { headers: null, trailers: {}, chunks: [] };
  }
  write(data) {
    this._state.chunks.push(Buffer.from(data));
    return true;
  }
  payload() {
    return Buffer.concat(this._state.chunks);
  }
}
for (const n of [1, 2, 5, 17, 40]) {
  const r = new Res();
  for (let i = 0; i < n; i++) r.write('c' + i + ';');
  attempt('nested field ' + n, () => r.payload());
}

// 2. A plain object field and a captured binding, appended from callbacks
// across turns of the event loop.
const state = { chunks: [] };
let captured = [];
const finished = [];
function tick(i, last) {
  setTimeout(() => {
    state.chunks.push(chunk(i));
    captured.push(chunk(i));
    if (last) {
      attempt('object field after ticks', () => Buffer.concat(state.chunks));
      attempt('captured binding after ticks', () => Buffer.concat(captured));
      attempt('with totalLength', () => Buffer.concat(state.chunks, 12));
      attempt('sliced', () => Buffer.concat(captured).subarray(0, 6));
      finished.push(1);
      console.log('done');
    }
  }, 0);
}
for (let i = 0; i < 20; i++) tick(i, i === 19);

// 3. The list handed through a function parameter before and after growth.
function fill(list, n) {
  for (let i = 0; i < n; i++) list.push(chunk(i));
}
const held = [];
fill(held, 30);
attempt('parameter', () => Buffer.concat(held));
const holder = { list: held };
fill(holder.list, 3);
attempt('parameter again', () => Buffer.concat(holder.list));
