// Invitations: Super Admin → Admin / Trainer, Admin → Trainer.
//
// Signed in (Super Admin, or Admin with the "invite trainers" switch):
//   POST /api/invitations  { name, email?, whatsapp?, role, permissions?, expiresInDays }
//        → { invitation, token }   (the token is shown ONCE; only its hash is stored)
//   GET  /api/invitations                 super admin: all; admin: their own
//   POST /api/invitations/:id/revoke      cancel a pending invitation
//   POST /api/invitations/:id/renew  { expiresInDays }
//        → new link + new expiry (the old link stops working)
//
// Public (the person who received the link):
//   GET  /api/invitations/token/:token           details for the acceptance screen
//   POST /api/invitations/token/:token/accept    { name, email?, password }
//        → creates the account with the invitation's role and signs in
//
// Rules: unique link, expiry, single use, revocable; the role and access come
// only from the invitation. If the invitation has an email, the account must
// use that email.

import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../auth/passwords.js';
import { signToken } from '../auth/tokens.js';
import {
  USER_COLUMNS, PERMISSIONS, toPublicUser, hasPermission, normaliseWhatsapp,
} from '../users/userModel.js';
import { HttpError, badRequest, forbidden, notFound, conflict } from '../errors.js';
import * as v from '../validate.js';

export const invitationsRouter = Router();

const EXPIRY_DAYS = [1, 3, 7, 14];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

export function statusOf(row) {
  if (row.used_at) return 'used';
  if (row.revoked_at) return 'revoked';
  if (new Date(row.expires_at) <= new Date()) return 'expired';
  return 'pending';
}

export const toInvitation = (r) => ({
  id: r.id,
  role: r.role,
  name: r.name,
  email: r.email,
  whatsapp: r.whatsapp,
  permissions: r.permissions,
  invitedBy: r.invited_by,
  invitedByName: r.invited_by_name ?? null,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  usedAt: r.used_at,
  usedBy: r.used_by,
  usedByName: r.used_by_name ?? null,
  revokedAt: r.revoked_at,
  status: statusOf(r),
});

export const SELECT_INVITATION = `
  SELECT i.*,
         (SELECT u.display_name FROM users u WHERE u.id = i.invited_by) AS invited_by_name,
         (SELECT u.display_name FROM users u WHERE u.id = i.used_by) AS used_by_name
  FROM invitations i`;

function readExpiry(value) {
  const days = value === undefined ? 7 : Number(value);
  if (!EXPIRY_DAYS.includes(days)) throw badRequest(`Expiry must be one of ${EXPIRY_DAYS.join(', ')} days.`, 'invalid_expiry');
  return days;
}

/** May this person create / manage invitations for this role? */
function assertCanInvite(user, role) {
  if (role === 'admin' && user.role !== 'super_admin') throw forbidden('Only the Super Admin can invite Admins.');
  if (role === 'trainer' && !hasPermission(user, 'invite_trainers')) {
    throw forbidden('Your account does not have access to invite trainers.', 'no_permission');
  }
}

// ── Public: open / accept a link ────────────────────────────────────────────
async function findByToken(token, client = { query }) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const { rows } = await client.query(`${SELECT_INVITATION} WHERE i.token_hash = $1`, [hashToken(token)]);
  return rows[0] ?? null;
}

function assertUsable(inv) {
  if (!inv) throw notFound('This invitation link is not valid.', 'invitation_invalid');
  const status = statusOf(inv);
  if (status === 'used') throw new HttpError(410, 'This invitation has already been used.', 'invitation_used');
  if (status === 'revoked') throw new HttpError(410, 'This invitation was cancelled.', 'invitation_revoked');
  if (status === 'expired') throw new HttpError(410, 'This invitation has expired. Ask for a new link.', 'invitation_expired');
}

invitationsRouter.get('/token/:token', async (req, res) => {
  const inv = await findByToken(req.params.token);
  assertUsable(inv);
  res.json({
    invitation: {
      role: inv.role,
      name: inv.name,
      email: inv.email,
      whatsapp: inv.whatsapp,
      invitedByName: inv.invited_by_name,
      expiresAt: inv.expires_at,
    },
  });
});

invitationsRouter.post('/token/:token/accept', async (req, res) => {
  const name = v.string(req.body?.name, 'name', { max: 100, allowEmpty: false });
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 128) {
    throw badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 'invalid_password');
  }
  // Anything like "role" in the request is ignored on purpose.
  const typedEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const passwordHash = await hashPassword(password);

  const user = await withTransaction(async (client) => {
    // Lock the invitation so it can only be used once, even with two clicks.
    const inv = await findByToken(req.params.token, client);
    if (inv) await client.query('SELECT 1 FROM invitations WHERE id = $1 FOR UPDATE', [inv.id]);
    const fresh = inv ? (await client.query(`${SELECT_INVITATION} WHERE i.id = $1`, [inv.id])).rows[0] : null;
    assertUsable(fresh);

    const email = fresh.email ?? typedEmail;
    if (!EMAIL_RE.test(email)) throw badRequest('Please enter a valid email address.', 'invalid_email');
    if (fresh.email && typedEmail && typedEmail !== fresh.email) {
      throw badRequest('This invitation is for a different email address.', 'email_mismatch');
    }
    const taken = await client.query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
    if (taken.rowCount) throw conflict('An account with this email already exists.', 'email_in_use');

    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, display_name, role, profile_completed, whatsapp, permissions, managed_by)
       VALUES ($1, $2, $3, $4, true, $5, $6, $7)
       RETURNING ${USER_COLUMNS}`,
      [email, passwordHash, name, fresh.role, fresh.whatsapp,
        fresh.role === 'admin' ? fresh.permissions : [],
        fresh.role === 'trainer' ? fresh.invited_by : null]);
    await client.query('UPDATE invitations SET used_at = now(), used_by = $1 WHERE id = $2', [rows[0].id, fresh.id]);
    return rows[0];
  });

  res.status(201).json({ token: signToken(user), user: toPublicUser(user) });
});

// ── Signed in: create and manage ────────────────────────────────────────────
invitationsRouter.use(requireAuth, requireRole('admin'));

invitationsRouter.post('/', async (req, res) => {
  const role = v.oneOf(req.body?.role, 'role', ['admin', 'trainer']);
  assertCanInvite(req.user, role);

  const name = v.string(req.body?.name, 'name', { max: 100, allowEmpty: false });
  let email = null;
  if (req.body?.email !== undefined && req.body.email !== null && req.body.email !== '') {
    email = v.string(req.body.email, 'email', { max: 200 }).toLowerCase();
    if (!EMAIL_RE.test(email)) throw badRequest('Please enter a valid email address.', 'invalid_email');
  }
  const whatsapp = normaliseWhatsapp(req.body?.whatsapp);
  if (whatsapp === undefined) throw badRequest('Enter a valid WhatsApp number (digits, optional +).', 'invalid_whatsapp');
  if (!email && !whatsapp) throw badRequest('Enter an email address or a WhatsApp number.', 'contact_required');

  let permissions = [];
  if (role === 'admin') {
    permissions = req.body?.permissions === undefined
      ? [...PERMISSIONS]
      : [...new Set(v.stringArray(req.body.permissions, 'permissions', { maxItems: PERMISSIONS.length }))];
    for (const p of permissions) v.oneOf(p, 'permission', PERMISSIONS);
  }
  const days = readExpiry(req.body?.expiresInDays);

  if (email) {
    const taken = await query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
    if (taken.rowCount) throw conflict('An account with this email already exists.', 'email_in_use');
  }

  const token = newToken();
  const { rows } = await query(
    `INSERT INTO invitations (token_hash, role, name, email, whatsapp, permissions, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(days => $8))
     RETURNING id`,
    [hashToken(token), role, name, email, whatsapp, permissions, req.user.id, days]);
  const created = (await query(`${SELECT_INVITATION} WHERE i.id = $1`, [rows[0].id])).rows[0];
  res.status(201).json({ invitation: toInvitation(created), token });
});

invitationsRouter.get('/', async (req, res) => {
  const { rows } = req.user.role === 'super_admin'
    ? await query(`${SELECT_INVITATION} ORDER BY i.created_at DESC LIMIT 500`)
    : await query(`${SELECT_INVITATION} WHERE i.invited_by = $1 ORDER BY i.created_at DESC LIMIT 500`, [req.user.id]);
  res.json({ invitations: rows.map(toInvitation) });
});

/** Loads an invitation the signed-in person may manage. */
async function loadManageable(req) {
  const { rows } = await query(`${SELECT_INVITATION} WHERE i.id = $1`, [req.params.id]);
  const inv = rows[0];
  if (!inv || (req.user.role !== 'super_admin' && inv.invited_by !== req.user.id)) {
    throw notFound('Invitation not found.', 'invitation_not_found');
  }
  assertCanInvite(req.user, inv.role);
  return inv;
}

invitationsRouter.post('/:id/revoke', async (req, res) => {
  const inv = await loadManageable(req);
  if (inv.used_at) throw badRequest('This invitation has already been used.', 'invitation_used');
  await query('UPDATE invitations SET revoked_at = COALESCE(revoked_at, now()) WHERE id = $1', [inv.id]);
  const updated = (await query(`${SELECT_INVITATION} WHERE i.id = $1`, [inv.id])).rows[0];
  res.json({ invitation: toInvitation(updated) });
});

invitationsRouter.post('/:id/renew', async (req, res) => {
  const inv = await loadManageable(req);
  if (inv.used_at) throw badRequest('This invitation has already been used.', 'invitation_used');
  const days = readExpiry(req.body?.expiresInDays);
  const token = newToken();
  await query(
    `UPDATE invitations SET token_hash = $1, expires_at = now() + make_interval(days => $2), revoked_at = NULL
     WHERE id = $3`, [hashToken(token), days, inv.id]);
  const updated = (await query(`${SELECT_INVITATION} WHERE i.id = $1`, [inv.id])).rows[0];
  res.json({ invitation: toInvitation(updated), token });
});
