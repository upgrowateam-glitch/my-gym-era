// Applies SQL files in backend/migrations/ in name order.
// Each file runs once, inside its own transaction, and is recorded in
// schema_migrations. Safe to run repeatedly.
//
//   npm run migrate

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, withTransaction, closePool } from '../src/db.js';

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

async function main() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  const { rows } = await pool.query('SELECT version FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.version));

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  let count = 0;

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
    });
    console.log(`applied  ${file}`);
    count++;
  }

  console.log(count === 0 ? 'Database is up to date.' : `${count} migration(s) applied.`);
}

main()
  .catch((err) => {
    console.error(`Migration failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(closePool);
