// process.exit sets the status the host sees (proc_exit) and flushes stdout first.
console.log('before exit');
setTimeout(() => console.log('never printed'), 50);
process.exit(3);
