// Deletes ALL data (users, plans, weights, chats, exercises, media, feedback,
// branding) and uploaded files, keeping the tables. For a fresh start.
// Only runs on *_dev or *_test databases, and asks for confirmation.
//
//   npm run db:reset

import readline from 'node:readline';
import { rm } from 'node:fs/promises';
import { query, closePool } from '../src/db.js';
import { config } from '../src/config.js';

const TABLES = [
  'messages', 'chats', 'admin_test_clients', 'client_profiles', 'day_plans',
  'weight_requests', 'diary_weigh_ins', 'invitations', 'feedback', 'media_items', 'exercises',
  'branding_settings', 'users',
];

async function main() {
  if (!/(_dev|_test)$/.test(config.db.database)) {
    throw new Error(`Refusing to reset "${config.db.database}": only *_dev or *_test databases.`);
  }
  if (!process.argv.includes('--yes')) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((r) => rl.question(
      `This deletes ALL data in "${config.db.database}" and all uploaded files. Type DELETE to continue: `, r));
    rl.close();
    if (answer.trim() !== 'DELETE') { console.log('Cancelled, nothing was deleted.'); return; }
  }
  await query(`TRUNCATE ${TABLES.join(', ')}`);
  await rm(config.uploadDir, { recursive: true, force: true });
  console.log(`All data deleted from "${config.db.database}" (tables kept) and uploads folder removed.`);
  console.log('Next: npm run create-super-admin');
}

main()
  .catch((err) => {
    console.error(`Reset failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(closePool);
