// Trainer endpoints (the signed-in trainer's own users).
//
//   GET /api/trainer/users?archived=false   users assigned to me, with a short
//                                           profile summary and unread messages
//   GET /api/trainer/stats                  counts for my dashboard
//
// A user's details, profile, plans, weight and chat are reached through the
// normal /api/users/:userId/... and /api/chats/:clientId/... routes, which
// allow a trainer only for users assigned to them.

import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { USER_COLUMNS, toPublicUser } from '../users/userModel.js';
import * as v from '../validate.js';

export const trainerRouter = Router();
trainerRouter.use(requireAuth, requireRole('trainer'));

trainerRouter.get('/users', async (req, res) => {
  const archived = req.query.archived === undefined
    ? false : v.oneOf(req.query.archived, 'archived', ['true', 'false']) === 'true';
  const { rows } = await query(
    `SELECT ${USER_COLUMNS},
            (SELECT p.data->>'currentStreak' FROM client_profiles p WHERE p.user_id = users.id) AS current_streak,
            (SELECT max(d.plan_date) FROM day_plans d WHERE d.user_id = users.id) AS last_plan_date,
            COALESCE((SELECT ch.unread_admin_count FROM chats ch WHERE ch.client_id = users.id), 0) AS unread
     FROM users
     WHERE role = 'client' AND trainer_id = $1 AND is_archived = $2
     ORDER BY display_name, email`, [req.user.id, archived]);
  res.json({
    users: rows.map((r) => ({
      ...toPublicUser(r),
      currentStreak: r.current_streak === null ? null : Number(r.current_streak),
      lastPlanDate: r.last_plan_date,
      unreadMessages: r.unread,
    })),
  });
});

trainerRouter.get('/stats', async (req, res) => {
  const { rows } = await query(
    `SELECT
       count(*) FILTER (WHERE NOT is_archived)::int AS users,
       count(*) FILTER (WHERE NOT is_archived AND NOT profile_completed)::int AS onboarding,
       (SELECT COALESCE(sum(c.unread_admin_count), 0)::int FROM chats c
          JOIN users u ON u.id = c.client_id WHERE u.trainer_id = $1) AS unread_messages
     FROM users WHERE role = 'client' AND trainer_id = $1`, [req.user.id]);
  const r = rows[0];
  res.json({ users: r.users, onboarding: r.onboarding, unreadMessages: r.unread_messages });
});
