// Converts a `users` row into the JSON the app receives.
// Password fields are never included.
//
// Roles: 'super_admin', 'admin', 'trainer', 'client' (shown as "User" in the app).

import { query } from '../db.js';

/** Admin access switches set by the Super Admin. */
export const PERMISSIONS = ['invite_trainers', 'manage_trainers', 'view_users'];

/** Client ids an admin has selected as test clients (users.testClients). */
export async function loadTestClients(userId) {
  const { rows } = await query(
    'SELECT client_id FROM admin_test_clients WHERE admin_id = $1 ORDER BY created_at',
    [userId],
  );
  return rows.map((r) => r.client_id);
}

// Plain column list for SELECT / RETURNING on the users table.
export const USER_COLUMNS = `
  id, email, display_name, role, profile_completed, is_archived, status,
  subscription_plan, discount_applied, avatar_url, joined_date,
  workout_days_filled, nutrition_days_filled, auth_provider, trainer_id,
  whatsapp, permissions, managed_by, created_at, updated_at`;

// Extra column with the assigned trainer's name (use with "FROM users").
export const TRAINER_NAME_COLUMN =
  `(SELECT t.display_name FROM users t WHERE t.id = users.trainer_id) AS trainer_name`;

export function toPublicUser(row, testClients = []) {
  return {
    uid: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    // Only users (clients) go through onboarding.
    profileCompleted: row.role === 'client' ? row.profile_completed : true,
    isArchived: row.is_archived,
    status: row.status,
    subscriptionPlan: row.subscription_plan,
    discountApplied: row.discount_applied,
    avatarUrl: row.avatar_url,
    joinedDate: row.joined_date,
    workoutDaysFilled: row.workout_days_filled,
    nutritionDaysFilled: row.nutrition_days_filled,
    authProvider: row.auth_provider,
    whatsapp: row.whatsapp ?? null,
    permissions: row.role === 'super_admin' ? [...PERMISSIONS] : (row.permissions ?? []),
    managedBy: row.managed_by ?? null,
    trainerId: row.trainer_id ?? null,
    trainerName: row.trainer_name ?? null,
    testClients,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const isAdminRole = (role) => role === 'admin' || role === 'super_admin';

/** Super admins have every access switch; admins only those turned on. */
export function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return user.role === 'admin' && (user.permissions ?? []).includes(permission);
}

/**
 * May this staff member see the given account (and its data)?
 *  - super admin: everyone
 *  - admin: users if "view_users" is on; trainers they manage
 *  - trainer: only users assigned to them
 */
export function canSeeAccount(staff, target) {
  if (staff.role === 'super_admin') return true;
  if (staff.role === 'admin') {
    if (target.role === 'client') return hasPermission(staff, 'view_users');
    if (target.role === 'trainer') return target.managed_by === staff.id;
    return false;
  }
  if (staff.role === 'trainer') return target.role === 'client' && target.trainer_id === staff.id;
  return false;
}

/** true if the signed-in staff member may coach this user (client). */
export function isStaffFor(staff, client) {
  return client.role === 'client' && canSeeAccount(staff, client);
}

/** Validates a WhatsApp number: optional +, 7–15 digits (spaces/dashes allowed). Returns normalised or null. */
export function normaliseWhatsapp(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[\s\-()]/g, '');
  return /^\+?\d{7,15}$/.test(cleaned) ? cleaned : undefined;
}
