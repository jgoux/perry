// wasm-env: PERRY_GC_SCAVENGE_NURSERY_MB=1 PERRY_GC_FORCE_EVACUATE=1
// Bindings a closure captures and someone mutates share one heap scope object,
// and the defining frame keeps ONE root for it: the first binding's slot. The
// frame reads and writes every member through that root, so it must stay live
// until the LAST reference to ANY member, not just the first binding's. Here
// `first` is never mentioned after `setFirst` is created, but `counter` is
// read and written after a moving collection; a root cleared early leaves the
// frame on the scope object's retired copy.
function churn(n) {
  const keep = [];
  for (let i = 0; i < n; i++) {
    const o = { i: i, s: 'item-' + i };
    if (i % 1000 === 0) keep.push(o);
  }
  return keep.length;
}

function inFunction() {
  let first = { n: 0 };
  let counter = 1;
  const setFirst = () => { first = { n: first.n + 1 }; };
  const bump = () => { counter = counter + 1; return counter; };
  setFirst();
  churn(300000);
  counter = counter + 10;
  const r = bump();
  return [counter, r];
}

class Holder {
  inMethod() {
    let first = { n: 0 };
    let counter = 1;
    const setFirst = () => { first = { n: first.n + 1 }; };
    const bump = () => { counter = counter + 1; return counter; };
    setFirst();
    churn(300000);
    counter = counter + 10;
    const r = bump();
    return [counter, r];
  }
}

const inClosure = () => {
  let first = { n: 0 };
  let counter = 1;
  const setFirst = () => { first = { n: first.n + 1 }; };
  const bump = () => { counter = counter + 1; return counter; };
  setFirst();
  churn(300000);
  counter = counter + 10;
  const r = bump();
  return [counter, r];
};

console.log('function', JSON.stringify(inFunction()));
console.log('method', JSON.stringify(new Holder().inMethod()));
console.log('closure', JSON.stringify(inClosure()));
