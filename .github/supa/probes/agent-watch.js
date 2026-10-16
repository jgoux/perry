// npm: agentkeepalive@4.6.0
// bundle-npm
// compare-node
// Storage's agent monitor in tsc's CommonJS shape: namespace import of
// agentkeepalive, two agents built from one options object, status polled by
// an interval and summed by a helper.
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const agentkeepalive_1 = __importStar(require("agentkeepalive"));

function createAgent(name, options) {
  const agentOptions = { maxSockets: options.maxSockets, keepAlive: true, keepAliveMsecs: 1000, freeSocketTimeout: 1000 * 15 };
  const httpAgent = new agentkeepalive_1.default(agentOptions);
  const httpsAgent = new agentkeepalive_1.HttpsAgent(agentOptions);
  let watcher = undefined;
  return {
    httpAgent,
    httpsAgent,
    monitor: () => {
      const agent = watchAgent(name, 'https', httpsAgent);
      watcher = agent;
      return agent;
    },
    close: () => { if (watcher) clearInterval(watcher); },
  };
}
function watchAgent(name, protocol, agent) {
  return setInterval(() => {
    const httpStatus = agent.getCurrentStatus();
    console.log('status', typeof httpStatus);
    const httpStats = gatherHttpAgentStats(httpStatus);
    console.log(name, protocol, JSON.stringify(httpStats));
  }, 20);
}
function gatherHttpAgentStats(status) {
  let busySocketCount = 0;
  for (const host in status.sockets) {
    if (status.sockets.hasOwnProperty(host)) busySocketCount += status.sockets[host];
  }
  let freeSocketCount = 0;
  for (const host in status.freeSockets) {
    if (status.freeSockets.hasOwnProperty(host)) freeSocketCount += status.freeSockets[host];
  }
  return { busySocketCount, freeSocketCount, errorSocketCount: status.errorSocketCount, timeoutSocketCount: status.timeoutSocketCount, createSocketErrorCount: status.createSocketErrorCount };
}

const a = createAgent('probe', { maxSockets: 5 });
console.log('direct', typeof a.httpsAgent.getCurrentStatus(), typeof a.httpAgent.getCurrentStatus());
const w = a.monitor();
setTimeout(() => { a.close(); console.log('done'); }, 70);
