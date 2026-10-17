// A `pg` client (the npm package, compiled with the program) against a Postgres
// server named by PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE.
// compile-only: needs a Postgres server
// network: yes
// npm: pg@8
const { Client } = require('pg');

async function main() {
  const client = new Client();
  await client.connect();
  const one = await client.query('select 1 as one');
  console.log(JSON.stringify(one.rows));
  const sum = await client.query('select $1::int + $2::int as sum, $3::text as label', [20, 22, 'pg']);
  console.log(JSON.stringify(sum.rows));
  try {
    await client.query('select * from no_such_table');
  } catch (e) {
    console.log('error', e.code);
  }
  await client.end();
  console.log('done');
}
main().catch((e) => {
  console.log('failed', e.code, e.message);
  process.exit(1);
});
