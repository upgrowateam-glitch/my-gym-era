import pg from 'pg';
import { config } from './config.js';

// DATE columns (e.g. day_plans.plan_date) come back as 'YYYY-MM-DD' strings
// instead of JS Dates, which avoids time-zone shifts.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
// NUMERIC columns (weights) come back as JS numbers instead of strings.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number(value));

let pool;

/** Shared connection pool (created on first use). */
export function getPool() {
  if (!pool) {
    pool = new pg.Pool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      max: 10,
    });
  }
  return pool;
}

export function query(text, params) {
  return getPool().query(text, params);
}

/** Runs `fn(client)` inside a transaction; rolls back on error. */
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
