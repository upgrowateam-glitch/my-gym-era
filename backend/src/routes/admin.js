// Admin / Super Admin endpoints.
//
//   GET /api/admin/stats                    dashboard counts
//   GET /api/admin/overview                 Super Admin dashboard (Super Admin only)
//   GET /api/admin/trainers?archived=false  trainers (super admin: all;
//                                           admin: the trainers they manage)
//
// New Admin and Trainer accounts are created through invitations
// (routes/invitations.js). Activate / deactivate and access switches:
// PATCH /api/users/:userId { isArchived } / { permissions } (routes/users.js).

import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { USER_COLUMNS, TRAINER_NAME_COLUMN, toPublicUser } from '../users/userModel.js';
import { SELECT_INVITATION, toInvitation } from './invitations.js';
import * as v from '../validate.js';
import { badRequest, forbidden } from '../errors.js';
import { hasPermission, normaliseWhatsapp } from '../users/userModel.js';
import { getSetting, setSetting } from '../settings.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));

adminRouter.get('/stats', async (req, res) => {
  const { rows } = await query(`
    SELECT
      count(*) FILTER (WHERE role = 'client' AND NOT is_archived)::int AS clients,
      count(*) FILTER (WHERE role = 'client' AND is_archived)::int     AS archived_clients,
      count(*) FILTER (WHERE role = 'client' AND NOT is_archived AND trainer_id IS NULL)::int AS unassigned_clients,
      count(*) FILTER (WHERE role = 'trainer' AND NOT is_archived)::int AS trainers,
      count(*) FILTER (WHERE role = 'trainer' AND NOT is_archived AND managed_by = $1)::int AS my_trainers,
      count(*) FILTER (WHERE role = 'admin' AND NOT is_archived)::int   AS admins,
      count(*) FILTER (WHERE role = 'super_admin' AND NOT is_archived)::int AS super_admins,
      (SELECT count(*)::int FROM invitations i
        WHERE i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
          AND ($2 OR i.invited_by = $1)) AS pending_invitations
    FROM users`, [req.user.id, req.user.role === 'super_admin']);
  const r = rows[0];
  res.json({
    clients: r.clients,
    archivedClients: r.archived_clients,
    unassignedClients: r.unassigned_clients,
    trainers: r.trainers,
    myTrainers: r.my_trainers,
    admins: r.admins,
    superAdmins: r.super_admins,
    pendingInvitations: r.pending_invitations,
  });
});

adminRouter.get('/trainers', async (req, res) => {
  // archived: false (default) = active trainers, true = deactivated, any = both.
  const archivedParam = req.query.archived === undefined ? 'false' : v.oneOf(req.query.archived, 'archived', ['true', 'false', 'any']);
  const params = [archivedParam === 'any' ? null : archivedParam === 'true'];
  let scope = '';
  // ?scope=all: every trainer in the gym (Admins need "View all users"), used
  // when assigning users to trainers. Otherwise an Admin sees only their own.
  const all = req.query.scope === 'all';
  if (all && req.user.role === 'admin' && !hasPermission(req.user, 'view_users')) {
    throw forbidden('Your account does not have access to this.', 'no_permission');
  }
  if (req.user.role === 'admin' && !all) {
    params.push(req.user.id);
    scope = 'AND managed_by = $2';
  }
  const { rows } = await query(
    `SELECT ${USER_COLUMNS},
            (SELECT m.display_name FROM users m WHERE m.id = users.managed_by) AS manager_name,
            (SELECT count(*)::int FROM users c
              WHERE c.trainer_id = users.id AND c.role = 'client' AND NOT c.is_archived) AS client_count
     FROM users WHERE role = 'trainer' AND ($1::boolean IS NULL OR is_archived = $1) ${scope}
     ORDER BY display_name, email`, params);
  res.json({
    trainers: rows.map((r) => ({ ...toPublicUser(r), managerName: r.manager_name, clientCount: r.client_count })),
  });
});

// ── Move users between trainers ─────────────────────────────────────────────
// POST /api/admin/trainers/:id/move-users  { toTrainerId }
// Moves every user of trainer :id to another active trainer (or to nobody with
// toTrainerId: null). Super Admin, or an Admin with "View all users".
adminRouter.post('/trainers/:id/move-users', async (req, res) => {
  if (req.user.role === 'admin' && !hasPermission(req.user, 'view_users')) {
    throw forbidden('Your account does not have access to this.', 'no_permission');
  }
  const fromId = v.string(req.params.id, 'id', { max: 128, allowEmpty: false });
  const toId = req.body?.toTrainerId === null ? null : v.string(req.body?.toTrainerId, 'toTrainerId', { max: 128, allowEmpty: false });
  const { rows: from } = await query('SELECT role FROM users WHERE id = $1', [fromId]);
  if (from[0]?.role !== 'trainer') throw badRequest('Trainer not found.', 'invalid_trainer');
  if (toId !== null) {
    if (toId === fromId) throw badRequest('Choose a different trainer.', 'same_trainer');
    const { rows: to } = await query('SELECT role, is_archived FROM users WHERE id = $1', [toId]);
    if (to[0]?.role !== 'trainer' || to[0].is_archived) throw badRequest('Choose an active trainer.', 'invalid_trainer');
  }
  const { rowCount } = await query(
    "UPDATE users SET trainer_id = $1 WHERE trainer_id = $2 AND role = 'client'", [toId, fromId]);
  res.json({ moved: rowCount });
});

// ── Super Admin dashboard ───────────────────────────────────────────────────
// GET /api/admin/overview   (Super Admin only) everything the dashboard shows,
// in one request. Only real numbers from the database.
// ── App settings (Super Admin only) ─────────────────────────────────────────
// supportWhatsapp: shown to deactivated users on the sign-in page.
adminRouter.get('/settings', requireRole('super_admin'), async (_req, res) => {
  res.json({ settings: { supportWhatsapp: await getSetting('support_whatsapp') } });
});

adminRouter.put('/settings', requireRole('super_admin'), async (req, res) => {
  v.jsonObject(req.body, 'body');
  if (req.body.supportWhatsapp !== undefined) {
    const number = normaliseWhatsapp(req.body.supportWhatsapp);
    if (number === undefined) {
      throw badRequest('Enter a valid WhatsApp number with country code, e.g. +91 98765 43210.', 'invalid_whatsapp');
    }
    await setSetting('support_whatsapp', number, req.user.id);
  }
  res.json({ settings: { supportWhatsapp: await getSetting('support_whatsapp') } });
});

adminRouter.get('/overview', requireRole('super_admin'), async (_req, res) => {
  const [counts, invitationCounts, latestInvitations, signups, recentUsers, trainers, library] = await Promise.all([
    query(`
      SELECT
        count(*) FILTER (WHERE role = 'admin' AND NOT is_archived)::int    AS admins,
        count(*) FILTER (WHERE role = 'trainer' AND NOT is_archived)::int  AS trainers,
        count(*) FILTER (WHERE role = 'client' AND NOT is_archived)::int   AS users,
        count(*) FILTER (WHERE role = 'client' AND is_archived)::int       AS inactive_users,
        count(*) FILTER (WHERE role = 'client' AND NOT is_archived AND trainer_id IS NULL)::int AS unassigned_users,
        count(*) FILTER (WHERE role = 'client' AND NOT is_archived AND profile_completed)::int  AS profiles_completed,
        count(*) FILTER (WHERE role = 'admin' AND created_at >= date_trunc('month', now()))::int   AS new_admins,
        count(*) FILTER (WHERE role = 'trainer' AND created_at >= date_trunc('month', now()))::int AS new_trainers,
        count(*) FILTER (WHERE role = 'client' AND created_at >= date_trunc('month', now()))::int  AS new_users
      FROM users`),
    query(`
      SELECT
        count(*) FILTER (WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at > now())::int AS pending,
        count(*) FILTER (WHERE used_at IS NOT NULL)::int AS used,
        count(*) FILTER (WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at <= now())::int AS expired,
        count(*) FILTER (WHERE used_at IS NULL AND revoked_at IS NOT NULL)::int AS revoked
      FROM invitations`),
    query(`${SELECT_INVITATION} ORDER BY i.created_at DESC LIMIT 5`),
    // New Users per month, last 6 months including this one (months without sign-ups = 0).
    query(`
      SELECT to_char(m, 'YYYY-MM') AS month,
             (SELECT count(*)::int FROM users
               WHERE role = 'client' AND created_at >= m AND created_at < m + interval '1 month') AS count
      FROM generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') AS m
      ORDER BY m`),
    query(`SELECT ${USER_COLUMNS}, ${TRAINER_NAME_COLUMN} FROM users
           WHERE role = 'client' ORDER BY created_at DESC LIMIT 5`),
    query(`
      SELECT ${USER_COLUMNS},
             (SELECT m.display_name FROM users m WHERE m.id = users.managed_by) AS manager_name,
             (SELECT count(*)::int FROM users c
               WHERE c.trainer_id = users.id AND c.role = 'client' AND NOT c.is_archived) AS client_count
      FROM users WHERE role = 'trainer' AND NOT is_archived
      ORDER BY client_count DESC, display_name, email`),
    query(`
      SELECT (SELECT count(*)::int FROM workout_videos) AS videos,
             (SELECT count(*)::int FROM workout_categories) AS categories,
             (SELECT count(*)::int FROM workouts) AS workouts_sent,
             (SELECT count(*)::int FROM workouts w WHERE EXISTS (SELECT 1 FROM workout_items i WHERE i.workout_id = w.id)
                AND NOT EXISTS (SELECT 1 FROM workout_items i WHERE i.workout_id = w.id AND i.completed_at IS NULL)) AS workouts_completed`),
  ]);

  const c = counts.rows[0];
  res.json({
    totals: {
      admins: c.admins, trainers: c.trainers, users: c.users,
      newThisMonth: { admins: c.new_admins, trainers: c.new_trainers, users: c.new_users },
    },
    users: {
      active: c.users,
      inactive: c.inactive_users,
      unassigned: c.unassigned_users,
      profilesCompleted: c.profiles_completed,
      signupsByMonth: signups.rows,
      recent: recentUsers.rows.map((r) => toPublicUser(r)),
    },
    invitations: { ...invitationCounts.rows[0], latest: latestInvitations.rows.map(toInvitation) },
    trainers: trainers.rows.map((r) => ({ ...toPublicUser(r), managerName: r.manager_name, clientCount: r.client_count })),
    library: {
      videos: library.rows[0].videos,
      categories: library.rows[0].categories,
      workoutsSent: library.rows[0].workouts_sent,
      workoutsCompleted: library.rows[0].workouts_completed,
    },
  });
});
