// Helper for the test scripts: creates temporary accounts directly in the
// database (the database has no built-in sample accounts any more).
// Every email starts with the given tag, so tests can delete them afterwards:
//   DELETE FROM users WHERE email LIKE '<tag>%'

import { randomBytes } from 'node:crypto';
import { query } from '../../src/db.js';
import { hashPassword } from '../../src/auth/passwords.js';

export const TEST_PASSWORD = 'test-pass-123';

// Admins get all access switches unless `permissions` is given.
export async function createTestUser(tag, role, { password = TEST_PASSWORD, name, permissions, managedBy } = {}) {
  const email = `${tag}-${role}-${randomBytes(3).toString('hex')}@test.local`;
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, display_name, role, profile_completed, permissions, managed_by)
     VALUES ($1, $2, $3, $4, true, $5, $6) RETURNING id`,
    [email, await hashPassword(password), name ?? `${tag} ${role}`, role,
      permissions ?? (role === 'admin' ? ['invite_trainers', 'manage_trainers', 'view_users'] : []),
      managedBy ?? null]);
  return { id: rows[0].id, email, password };
}
