// compare-node
// A class extending http.Agent, two levels deep, keeps its own methods and fields.
const OriginalAgent = require('http').Agent;
class A extends OriginalAgent {
  constructor(o) { super(o); this.n = 1; }
  getCurrentStatus() { return { n: this.n, sockets: Object.keys(this.sockets).length }; }
}
class B extends A {
  constructor(o) { super(o); this.protocol = 'https:'; }
}
const b = new B({ keepAlive: true, maxSockets: 5 });
console.log(typeof b.getCurrentStatus, JSON.stringify(b.getCurrentStatus()), b.protocol, b.maxSockets);
