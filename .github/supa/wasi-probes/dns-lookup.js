// Name resolution through the host's supa_net.resolve.
// compile-only: needs a resolver
// network: yes
import * as dns from 'node:dns';

dns.lookup('localhost', (err, address, family) => {
  console.log('localhost', err === null, ['127.0.0.1', '::1'].includes(address), family === 4 || family === 6);
  dns.lookup('localhost', { all: true }, (err2, all) => {
    console.log('all', err2 === null, all.length > 0, all.every((a) => typeof a.address === 'string'));
    dns.lookup('127.0.0.1', (err3, literal, fam) => {
      console.log('literal', err3 === null, literal, fam);
      dns.lookup('no-such-host.invalid', (err4) => {
        console.log('missing', err4 && err4.code);
      });
    });
  });
});
