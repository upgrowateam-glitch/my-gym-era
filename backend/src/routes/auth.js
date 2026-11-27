import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { hashPassword, verifyPassword, burnTime, MIN_PASSWORD_LENGTH } from '../auth/passwords.js';
import { signToken } from '../auth/tokens.js';
import { requireAuth, ARCHIVED_MESSAGE } from '../middleware/auth.js';
import { getSetting } from '../settings.js';
import { USER_COLUMNS, TRAINER_NAME_COLUMN, toPublicUser, loadTestClients } from '../users/userModel.js';
import { badRequest, unauthorized, forbidden, conflict } from '../errors.js';

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_LOGIN = 'Invalid email or password.';

function readEmail(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) throw badRequest('Please enter a valid email address.', 'invalid_email');
  return email;
}

function readPassword(value, field = 'password') {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, `invalid_${field}`);
  }
  if (value.length > 128) throw badRequest('Password is too long.', `invalid_${field}`);
  return value;
}

async function sessionResponse(user) {
  return { token: signToken(user), user: toPublicUser(user, await loadTestClients(user.id)) };
}

// POST /api/auth/register  { email, password, displayName? }
// New accounts are always clients (same as the app today); admins promote users.
authRouter.post('/register', async (req, res) => {
  const email = readEmail(req.body);
  const password = readPassword(req.body?.password);
  const displayName =
    typeof req.body?.displayName === 'string' ? req.body.displayName.trim().slice(0, 100) : '';

  const passwordHash = await hashPassword(password);

  const user = await withTransaction(async (client) => {
    const existing = await client.query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
    if (existing.rowCount > 0) throw conflict('An account with this email already exists.', 'email_in_use');

    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, display_name, role, profile_completed)
       VALUES ($1, $2, $3, 'client', false)
       RETURNING ${USER_COLUMNS}`,
      [email, passwordHash, displayName],
    );
    return rows[0];
  });

  res.status(201).json(await sessionResponse(user));
});

// POST /api/auth/login  { email, password }
authRouter.post('/login', async (req, res) => {
  const email = readEmail(req.body);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  const { rows } = await query(
    `SELECT ${USER_COLUMNS}, ${TRAINER_NAME_COLUMN}, password_hash FROM users WHERE lower(email) = $1`,
    [email],
  );
  const row = rows[0];

  if (!row) {
    await burnTime(password);
    throw unauthorized(INVALID_LOGIN, 'invalid_credentials');
  }
  if (!row.password_hash) {
    // An account without a password (e.g. created for a future sign-in method).
    throw unauthorized('Please reset your password to sign in.', 'password_reset_required');
  }
  if (!(await verifyPassword(password, row.password_hash))) {
    throw unauthorized(INVALID_LOGIN, 'invalid_credentials');
  }
  if (row.is_archived) {
    // The password was right, so it is safe to tell them who they are and how
    // to reach the gym (the Super Admin's support WhatsApp number, if set).
    const err = forbidden(ARCHIVED_MESSAGE, 'account_archived');
    err.details = {
      name: row.display_name || null,
      email: row.email,
      supportWhatsapp: await getSetting('support_whatsapp'),
    };
    throw err;
  }

  delete row.password_hash;
  res.json(await sessionResponse(row));
});

// GET /api/auth/me   → the signed-in user
authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ user: toPublicUser(req.user, await loadTestClients(req.user.id)) });
});

// POST /api/auth/change-password  { currentPassword, newPassword }
authRouter.post('/change-password', requireAuth, async (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = readPassword(req.body?.newPassword, 'new_password');

  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!(await verifyPassword(currentPassword, rows[0]?.password_hash))) {
    throw unauthorized('Current password is incorrect.', 'invalid_current_password');
  }

  if (newPassword === currentPassword) {
    throw badRequest('Choose a new password that is different from the current one.', 'same_password');
  }
  const updated = await query(
    `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING ${USER_COLUMNS}`,
    [await hashPassword(newPassword), req.user.id]);
  res.json({ ok: true, user: toPublicUser(updated.rows[0], await loadTestClients(req.user.id)) });
});
