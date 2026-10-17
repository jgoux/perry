// process.env, process.argv and process.hrtime.bigint.
console.log(typeof process.env, typeof process.env.PATH_PROBE_UNSET, process.env.PATH_PROBE_UNSET === undefined);
process.env.PROBE_VAR = 'v1';
console.log(process.env.PROBE_VAR, 'PROBE_VAR' in process.env);
delete process.env.PROBE_VAR;
console.log(process.env.PROBE_VAR);
console.log(Array.isArray(process.argv), process.argv.length >= 1, typeof process.argv[0]);
const a = process.hrtime.bigint();
const b = process.hrtime.bigint();
console.log(typeof a, b >= a);
const t0 = process.hrtime.bigint();
setTimeout(() => {
  const dt = process.hrtime.bigint() - t0;
  console.log('elapsed ok', dt >= 4000000n, dt < 5000000000n);
}, 5);
console.log(typeof process.platform, typeof process.pid, typeof process.cwd());
