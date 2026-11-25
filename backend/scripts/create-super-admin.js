// Creates the Super Admin account (or turns an existing account into one).
// Use it once on a fresh database; Admins and Trainers are then invited from
// the app.
//
//   npm run create-super-admin
//
// It asks for the email, name and password in the terminal. The password is
// hidden while typing and is stored only as a bcrypt hash.

import readline from 'node:readline';
import { query, closePool } from '../src/db.js';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../src/auth/passwords.js';

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Print the question, then hide every typed character.
      rl._writeToOutput = (s) => { if (!rl.__shownPrompt) { rl.output.write(s); rl.__shownPrompt = true; } };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function main() {
  const email = (await ask('Super Admin email: ')).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('That is not a valid email address.');
  const name = await ask('Display name: ');
  const password = await ask(`Password (min ${MIN_PASSWORD_LENGTH} characters, hidden): `, { hidden: true });
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error('Password is too short.');
  const again = await ask('Repeat password: ', { hidden: true });
  if (again !== password) throw new Error('Passwords do not match.');

  const hash = await hashPassword(password);
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, display_name, role, profile_completed)
     VALUES ($1, $2, $3, 'super_admin', true)
     ON CONFLICT ((lower(email))) DO UPDATE SET
       password_hash = EXCLUDED.password_hash, display_name = EXCLUDED.display_name,
       role = 'super_admin', profile_completed = true, is_archived = false, trainer_id = NULL
     RETURNING id, (xmax = 0) AS created`,
    [email, hash, name]);
  console.log(rows[0].created
    ? `\nSuper Admin account created: ${email}`
    : `\nExisting account ${email} is now the Super Admin (password updated).`);
}

main()
  .catch((err) => {
    console.error(`\nCould not create the Super Admin: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(closePool);
