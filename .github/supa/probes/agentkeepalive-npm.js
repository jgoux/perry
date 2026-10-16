// npm: agentkeepalive@4.6.0
// bundle-npm
// compare-node
import Agent, { HttpsAgent } from 'agentkeepalive';
const opts = { maxSockets: 5, keepAlive: true, keepAliveMsecs: 1000, freeSocketTimeout: 15000 };
for (const a of [new Agent(opts), new HttpsAgent(opts)]) {
  const s = a.getCurrentStatus();
  console.log(typeof s, JSON.stringify(s));
}
