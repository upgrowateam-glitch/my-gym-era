import { query } from '../db.js';
import { USER_COLUMNS, TRAINER_NAME_COLUMN, canSeeAccount, isAdminRole } from '../users/userModel.js';
import { forbidden, notFound } from '../errors.js';

/**
 * For routes under /api/users/:userId/...
 *
 * Who may access an account and its data:
 *   - the person themselves,
 *   - a super admin (everyone),
 *   - an admin: users (if their "view users" switch is on) and the trainers
 *     they manage,
 *   - a trainer: only users assigned to them.
 *
 * `:userId` may be "me". Sets req.targetUser and req.accessAs
 * ('self' | 'admin' | 'trainer'); super admins count as 'admin'.
 */
export async function userAccess(req, _res, next) {
  const id = req.params.userId === 'me' ? req.user.id : req.params.userId;
  const self = id === req.user.id;

  // Users can only ever reach themselves; checked before any lookup so other
  // ids can't be probed.
  if (!self && req.user.role === 'client') throw forbidden();

  const { rows } = await query(`SELECT ${USER_COLUMNS}, ${TRAINER_NAME_COLUMN} FROM users WHERE id = $1`, [id]);
  const target = rows[0];

  if (!self) {
    // "Not found" and "not allowed" look the same, except for super admins.
    if (!target) {
      if (req.user.role === 'super_admin') throw notFound('User not found.', 'user_not_found');
      throw forbidden();
    }
    if (!canSeeAccount(req.user, target)) throw forbidden();
  }

  req.targetUser = target;
  req.accessAs = self ? 'self' : isAdminRole(req.user.role) ? 'admin' : req.user.role;
  next();
}

/** Only the person themselves or an admin / super admin (not a trainer). */
export function selfOrAdmin(req, _res, next) {
  if (req.accessAs !== 'self' && req.accessAs !== 'admin') throw forbidden();
  next();
}
