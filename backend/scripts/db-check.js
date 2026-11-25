// Prints the connection status and the tables in the database.
//
//   npm run db:check

import { query, closePool } from '../src/db.js';

async function main() {
  const info = await query('SELECT current_database() AS db, current_user AS usr, version() AS version');
  console.log(`Connected to "${info.rows[0].db}" as "${info.rows[0].usr}"`);
  console.log(info.rows[0].version);

  const tables = await query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name`);
  console.log(`\n${tables.rowCount} table(s):`);
  for (const t of tables.rows) console.log(`  - ${t.table_name}`);
}

main()
  .catch((err) => {
    console.error(`Database check failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(closePool);
