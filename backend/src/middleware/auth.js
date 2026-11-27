import { verifyToken } from '../auth/tokens.js';
import { query } from '../db.js';
import { USER_COLUMNS, TRAINER_NAME_COLUMN, hasPermission } from '../users/userModel.js';
import { unauthorized, forbidden } from '../errors.js';

export const ARCHIVED_MESSAGE = 'Your account has been deactivated. Please contact support.';

/**
 * Requires a valid `Authorization: Bearer <token>` header.
 * The user is re-loaded from the database on every request, so role changes,
 * access switches and deactivation take effect immediately.
 * Sets `req.user` to the users row.
 */
export async function requireAuth(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw unauthorized();

  let payload;
  try {
    payload = verifyToken(match[1]);
  } catch {
    throw unauthorized('Session expired. Please log in again.', 'invalid_token');
  }

  const { rows } = await query(`SELECT ${USER_COLUMNS}, ${TRAINER_NAME_COLUMN} FROM users WHERE id = $1`, [payload.sub]);
  const user = rows[0];
  if (!user) throw unauthorized('Session expired. Please log in again.', 'invalid_token');
  if (user.is_archived) throw forbidden(ARCHIVED_MESSAGE, 'account_archived');

  req.user = user;
  next();
}

/**
 * Allows only the given roles, e.g. requireRole('admin') or
 * requireRole('admin', 'trainer'). A super admin may do everything an admin
 * may do, so 'admin' also lets super admins through.
 */
export function requireRole(...roles) {
  return (req, _res, next) => {
    const role = req.user?.role;
    const ok = role && (roles.includes(role) || (role === 'super_admin' && roles.includes('admin')));
    if (!ok) throw forbidden();
    next();
  };
}

/** Super admins, or admins whose access switch `permission` is on. */
export function requirePermission(permission) {
  return (req, _res, next) => {
    if (!hasPermission(req.user, permission)) throw forbidden('Your account does not have access to this.', 'no_permission');
    next();
  };
}
