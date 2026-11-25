import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `Missing ${name} in backend/.env. Copy backend/.env.example to backend/.env and fill it in.`,
    );
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  // Where uploaded files are stored, and the public address used in their URLs
  // (defaults to the address the request came in on).
  uploadDir: path.resolve(backendDir, process.env.UPLOAD_DIR ?? 'uploads'),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ? process.env.PUBLIC_BASE_URL.replace(/\/+$/, '') : undefined,
  db: {
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE ?? 'mygymera_dev',
    user: process.env.PGUSER ?? 'mygymera_app',
    // Read lazily so `config` can be imported before .env is complete.
    get password() {
      return required('PGPASSWORD');
    },
  },
  jwt: {
    get secret() {
      const secret = required('JWT_SECRET');
      if (secret.length < 32) throw new Error('JWT_SECRET in backend/.env must be at least 32 characters.');
      return secret;
    },
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
};
