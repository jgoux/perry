// network: yes
// require("dns/promises") and require("node:dns/promises"): every export must be
// the function dns.promises exposes, and the ones that need no network must run.
"use strict";
const dns = require("dns");
const dp = require("dns/promises");
const dpPrefixed = require("node:dns/promises");
const { lookup, getServers, setDefaultResultOrder, getDefaultResultOrder } = require("dns/promises");
const show = async (label, fn) => {
  try { console.log(label, JSON.stringify(await fn())); }
  catch (e) { console.log(label, "threw", e && e.name, e && e.code); }
};
(async () => {
  for (const n of ["lookup", "lookupService", "resolve", "resolve4", "resolve6", "resolveAny", "resolveCname",
    "resolveMx", "resolveNs", "resolveSoa", "resolveSrv", "resolveTxt", "resolvePtr", "reverse", "getServers",
    "setServers", "getDefaultResultOrder", "setDefaultResultOrder", "Resolver"]) {
    console.log("export", n, typeof dp[n], typeof dpPrefixed[n], dp[n] === dns.promises[n]);
  }
  console.log("same namespace", dp === dns.promises, dpPrefixed === dp);
  await show("lookup member", () => dp.lookup("127.0.0.1"));
  await show("lookup prefixed", () => dpPrefixed.lookup("127.0.0.1"));
  await show("lookup comma", () => (0, dp.lookup)("127.0.0.1", { family: 4 }));
  await show("lookup destructured", () => lookup("::1"));
  await show("lookup all", () => dp.lookup("127.0.0.1", { all: true }));
  await show("getServers", () => Array.isArray(dp.getServers()));
  await show("getServers destructured", () => Array.isArray(getServers()));
  await show("getDefaultResultOrder", () => typeof dp.getDefaultResultOrder());
  await show("setDefaultResultOrder", () => {
    dp.setDefaultResultOrder("ipv4first");
    const first = dp.getDefaultResultOrder();
    setDefaultResultOrder("verbatim");
    return [first, getDefaultResultOrder(), dns.getDefaultResultOrder()];
  });
  await show("setDefaultResultOrder invalid", () => dp.setDefaultResultOrder("bogus"));
  await show("Resolver", () => {
    const r = new dp.Resolver();
    return [typeof r.resolve4, typeof r.getServers, Array.isArray(r.getServers())];
  });
  process.exit(0);
})();
