// Admin / Super Admin endpoints.
//
//   GET /api/admin/stats                    dashboard counts
//   GET /api/admin/trainers?archived=false  trainers (super admin: all;
//                                           admin: the trainers they manage)
//
// New Admin and Trainer accounts are created through invitations
// (routes/invitations.js). Activate / deactivate and access switches:
// PATCH /api/users/:userId { isArchived } / { permissions } (routes/users.js).

import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { USER_COLUMNS, toPublicUser } from '../users/userModel.js';
import * as v from '../validate.js';

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
  const archived = req.query.archived === undefined
    ? false : v.oneOf(req.query.archived, 'archived', ['true', 'false']) === 'true';
  const params = [archived];
  let scope = '';
  if (req.user.role === 'admin') {
    params.push(req.user.id);
    scope = 'AND managed_by = $2';
  }
  const { rows } = await query(
    `SELECT ${USER_COLUMNS},
            (SELECT m.display_name FROM users m WHERE m.id = users.managed_by) AS manager_name,
            (SELECT count(*)::int FROM users c
              WHERE c.trainer_id = users.id AND c.role = 'client' AND NOT c.is_archived) AS client_count
     FROM users WHERE role = 'trainer' AND is_archived = $1 ${scope}
     ORDER BY display_name, email`, params);
  res.json({
    trainers: rows.map((r) => ({ ...toPublicUser(r), managerName: r.manager_name, clientCount: r.client_count })),
  });
});
