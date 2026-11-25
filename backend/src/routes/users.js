// /api/users
//
//   GET    /api/users?role=client&archived=false&search=ann&unassigned=true&trainerId=…
//          super admin: everyone; admin: users (if "view users" is on) + the trainers they manage
//   GET    /api/users/:userId                                  account (see middleware/access.js)
//   PATCH  /api/users/:userId                                  update (self / admin / super admin)
//   DELETE /api/users/:userId                                  delete account + all data
//   PUT    /api/users/:userId/trainer        { trainerId }     (admin) assign / unassign a trainer
//   PUT    /api/users/:userId/test-clients   { clientIds }     (admin) admin's test clients
//
//   GET    /api/users/:userId/profile                          onboarding profile
//   PUT    /api/users/:userId/profile        { profile }       replace profile
//   PATCH  /api/users/:userId/profile        { profile }       merge fields (e.g. streak)
//   POST   /api/users/:userId/complete-profile { profile? }    finish onboarding
//
//   GET    /api/users/:userId/fitness-profile                  fitness profile (+ BMI, age, missing steps)
//   PUT    /api/users/:userId/fitness-profile/:step { data }   save one step (self / admin)
//   POST   /api/users/:userId/fitness-profile/complete         finish (all steps needed)
//
// Plans and weight routes are mounted under the same /:userId prefix.
// `:userId` may be "me".
//
// Roles are never changed here: they come only from registration (User) or
// an invitation (Admin / Trainer).

import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { userAccess, selfOrAdmin } from '../middleware/access.js';
import {
  USER_COLUMNS, TRAINER_NAME_COLUMN, PERMISSIONS, toPublicUser, loadTestClients,
  hasPermission, isAdminRole, normaliseWhatsapp,
} from '../users/userModel.js';
import { badRequest, forbidden, conflict } from '../errors.js';
import * as v from '../validate.js';
import { SECTIONS, validateSection, toPublicFitness } from '../users/fitnessProfile.js';
import { plansRouter } from './plans.js';
import { weightRouter } from './weight.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

// ── List ────────────────────────────────────────────────────────────────────
usersRouter.get('/', requireRole('admin'), async (req, res) => {
  const where = [];
  const params = [];
  if (req.query.role !== undefined) {
    params.push(v.oneOf(req.query.role, 'role', ['client', 'trainer', 'admin', 'super_admin']));
    where.push(`role = $${params.length}`);
  }
  if (req.query.archived !== undefined) {
    params.push(v.oneOf(req.query.archived, 'archived', ['true', 'false']) === 'true');
    where.push(`is_archived = $${params.length}`);
  }
  if (req.query.search) {
    params.push(`%${v.string(req.query.search, 'search', { max: 100 })}%`);
    where.push(`(display_name ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }
  if (req.query.unassigned === 'true') {
    where.push(`role = 'client' AND trainer_id IS NULL`);
  }
  if (req.query.trainerId) {
    params.push(v.string(req.query.trainerId, 'trainerId', { max: 128 }));
    where.push(`trainer_id = $${params.length}`);
  }
  // Admins (not super admins) see only what their access allows.
  if (req.user.role === 'admin') {
    params.push(hasPermission(req.user, 'view_users'));
    params.push(req.user.id);
    where.push(`((role = 'client' AND $${params.length - 1}) OR (role = 'trainer' AND managed_by = $${params.length}))`);
  }

  const { rows } = await query(
    `SELECT ${USER_COLUMNS}, ${TRAINER_NAME_COLUMN},
            COALESCE((SELECT array_agg(client_id ORDER BY created_at)
                      FROM admin_test_clients WHERE admin_id = users.id), '{}') AS test_clients
     FROM users
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY display_name, email`,
    params,
  );
  res.json({ users: rows.map((r) => toPublicUser(r, r.test_clients)) });
});

// Everything below is about one account and goes through the access check.
const userRouter = Router({ mergeParams: true });
usersRouter.use('/:userId', userAccess, userRouter);

// ── Single account ──────────────────────────────────────────────────────────
userRouter.get('/', async (req, res) => {
  res.json({ user: toPublicUser(req.targetUser, await loadTestClients(req.targetUser.id)) });
});

// Fields a person may change on their own account.
const SELF_FIELDS = {
  displayName: ['display_name', (x) => v.string(x, 'displayName', { max: 100, allowEmpty: false })],
  whatsapp: ['whatsapp', (x) => {
    const n = normaliseWhatsapp(x);
    if (n === undefined) throw badRequest('Enter a valid WhatsApp number (digits, optional +).', 'invalid_whatsapp');
    return n;
  }],
  avatarUrl: ['avatar_url', (x) => (x === null ? null : v.string(x, 'avatarUrl', { max: 2000 }))],
  profileCompleted: ['profile_completed', (x) => v.boolean(x, 'profileCompleted')],
};
// Fields only staff with authority over the account may change.
const ADMIN_FIELDS = {
  isArchived: ['is_archived', (x) => v.boolean(x, 'isArchived')],
  permissions: ['permissions', (x) => {
    const list = [...new Set(v.stringArray(x, 'permissions', { maxItems: PERMISSIONS.length }))];
    for (const p of list) v.oneOf(p, 'permission', PERMISSIONS);
    return list;
  }],
  status: ['status', (x) => v.oneOf(x, 'status', ['active', 'pending', 'suspended'])],
  subscriptionPlan: ['subscription_plan', (x) => (x === null ? null : v.string(x, 'subscriptionPlan', { max: 50 }))],
  discountApplied: ['discount_applied', (x) => (x === null ? null : v.number(x, 'discountApplied', { min: 0, max: 100 }))],
  workoutDaysFilled: ['workout_days_filled', (x) => v.number(x, 'workoutDaysFilled', { min: 0, max: 100000, integer: true })],
  nutritionDaysFilled: ['nutrition_days_filled', (x) => v.number(x, 'nutritionDaysFilled', { min: 0, max: 100000, integer: true })],
  joinedDate: ['joined_date', (x) => v.timestamp(x, 'joinedDate')],
};

/** Which admin fields may `actor` change on `target`? Throws if not allowed. */
function checkAdminField(key, actor, target, isSelf) {
  if (!isAdminRole(actor.role)) throw forbidden(`Only an admin can change ${key}.`);
  if (isSelf) {
    if (key === 'isArchived') throw badRequest('You cannot deactivate your own account.', 'self_lockout');
    if (key === 'permissions') throw forbidden('You cannot change your own access.');
  }
  if (key === 'permissions') {
    if (actor.role !== 'super_admin') throw forbidden('Only the Super Admin can change access.');
    if (target.role !== 'admin') throw badRequest('Access switches apply to Admin accounts only.', 'not_admin');
    return;
  }
  if (actor.role === 'admin') {
    // Admins: trainers they manage (activate/deactivate only, if allowed) and users.
    if (target.role === 'trainer') {
      if (key !== 'isArchived') throw forbidden();
      if (!hasPermission(actor, 'manage_trainers')) {
        throw forbidden('Your account does not have access to this.', 'no_permission');
      }
    } else if (target.role !== 'client') {
      throw forbidden();
    }
  }
}

userRouter.patch('/', selfOrAdmin, async (req, res) => {
  const body = v.jsonObject(req.body, 'body');
  const isSelf = req.targetUser.id === req.user.id;
  const sets = [];
  const params = [];

  if ('role' in body) throw badRequest('Roles cannot be changed.', 'role_locked');

  for (const [key, value] of Object.entries(body)) {
    const spec = SELF_FIELDS[key] ?? ADMIN_FIELDS[key];
    if (!spec) throw badRequest(`Unknown field: ${key}`, 'unknown_field');
    if (ADMIN_FIELDS[key]) checkAdminField(key, req.user, req.targetUser, isSelf);
    else if (!isSelf && !isAdminRole(req.user.role)) throw forbidden();
    params.push(spec[1](value));
    sets.push(`${spec[0]} = $${params.length}`);
  }
  if (sets.length === 0) throw badRequest('Nothing to update.', 'empty_update');

  // The last active Super Admin can never be deactivated.
  if (body.isArchived === true && req.targetUser.role === 'super_admin') {
    const { rows } = await query(`SELECT count(*)::int AS n FROM users WHERE role = 'super_admin' AND NOT is_archived`);
    if (rows[0].n <= 1) throw conflict('The last Super Admin cannot be deactivated.', 'last_super_admin');
  }

  params.push(req.targetUser.id);
  const user = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${USER_COLUMNS}`,
      params,
    );
    const u = rows[0];
    // A deactivated trainer's users go back to "unassigned".
    if (u.role === 'trainer' && u.is_archived) {
      await client.query('UPDATE users SET trainer_id = NULL WHERE trainer_id = $1', [u.id]);
    }
    return u;
  });
  res.json({ user: toPublicUser(user, await loadTestClients(user.id)) });
});

// Deletes the account and (through ON DELETE CASCADE) its profile, plans,
// weight data, chat and messages. Own account, or super admin / admin for users.
userRouter.delete('/', selfOrAdmin, async (req, res) => {
  const isSelf = req.targetUser.id === req.user.id;
  if (!isSelf && req.user.role === 'admin' && req.targetUser.role !== 'client') {
    throw forbidden('Admins can deactivate trainers, not delete them.');
  }
  if (req.targetUser.role === 'super_admin') {
    const { rows } = await query(`SELECT count(*)::int AS n FROM users WHERE role = 'super_admin' AND NOT is_archived`);
    if (rows[0].n <= 1) throw conflict('The last Super Admin cannot be deleted.', 'last_super_admin');
  }
  await query('DELETE FROM users WHERE id = $1', [req.targetUser.id]);
  res.json({ ok: true });
});

// Assign a user to a trainer (or unassign with trainerId: null). Admin only.
// (The app screens for assignment come in a later phase.)
userRouter.put('/trainer', requireRole('admin'), async (req, res) => {
  if (req.targetUser.role !== 'client') throw badRequest('Only users can be assigned to a trainer.', 'not_a_user');
  const trainerId = req.body?.trainerId === null ? null : v.string(req.body?.trainerId, 'trainerId', { max: 128, allowEmpty: false });
  if (trainerId) {
    const { rows } = await query('SELECT role, is_archived FROM users WHERE id = $1', [trainerId]);
    if (!rows[0] || rows[0].role !== 'trainer' || rows[0].is_archived) {
      throw badRequest('Choose an active trainer.', 'invalid_trainer');
    }
  }
  const { rows } = await query(
    `UPDATE users SET trainer_id = $1 WHERE id = $2 RETURNING ${USER_COLUMNS}, ${TRAINER_NAME_COLUMN}`,
    [trainerId, req.targetUser.id]);
  res.json({ user: toPublicUser(rows[0]) });
});

userRouter.put('/test-clients', requireRole('admin'), async (req, res) => {
  if (!isAdminRole(req.targetUser.role)) throw badRequest('Test clients can only be set on admin accounts.', 'not_admin');
  const clientIds = [...new Set(v.stringArray(req.body?.clientIds, 'clientIds', { maxItems: 500, maxLength: 128 }))];

  await withTransaction(async (client) => {
    if (clientIds.length) {
      const { rows } = await client.query(
        `SELECT id FROM users WHERE id = ANY($1) AND role = 'client'`, [clientIds]);
      if (rows.length !== clientIds.length) throw badRequest('Every test client must be an existing client.', 'invalid_client');
    }
    await client.query('DELETE FROM admin_test_clients WHERE admin_id = $1', [req.targetUser.id]);
    for (const clientId of clientIds) {
      await client.query('INSERT INTO admin_test_clients (admin_id, client_id) VALUES ($1, $2)',
        [req.targetUser.id, clientId]);
    }
  });
  res.json({ testClients: clientIds });
});

// ── Profile ─────────────────────────────────────────────────────────────────
userRouter.get('/profile', async (req, res) => {
  const { rows } = await query('SELECT data FROM client_profiles WHERE user_id = $1', [req.targetUser.id]);
  res.json({ profile: rows[0]?.data ?? null });
});

// Keeps the existing "fitness" object when the rest of the profile is replaced.
const KEEP_FITNESS = `CASE WHEN client_profiles.data ? 'fitness'
  THEN jsonb_build_object('fitness', client_profiles.data->'fitness') ELSE '{}'::jsonb END`;

function noFitnessKey(profile) {
  if (Object.hasOwn(profile, 'fitness')) {
    throw badRequest('Use /fitness-profile to change the fitness profile.', 'use_fitness_profile');
  }
  return profile;
}

userRouter.put('/profile', selfOrAdmin, async (req, res) => {
  const profile = noFitnessKey(v.jsonObject(req.body?.profile, 'profile'));
  const { rows } = await query(
    `INSERT INTO client_profiles (user_id, data) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data || ${KEEP_FITNESS}
     RETURNING data`,
    [req.targetUser.id, profile],
  );
  res.json({ profile: rows[0].data });
});

userRouter.patch('/profile', selfOrAdmin, async (req, res) => {
  const updates = noFitnessKey(v.jsonObject(req.body?.profile, 'profile'));
  const { rows } = await query(
    `INSERT INTO client_profiles (user_id, data) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET data = client_profiles.data || EXCLUDED.data
     RETURNING data`,
    [req.targetUser.id, updates],
  );
  res.json({ profile: rows[0].data });
});

// Finish onboarding: mark it done and save the profile.
userRouter.post('/complete-profile', selfOrAdmin, async (req, res) => {
  const profile = req.body?.profile === undefined ? undefined : noFitnessKey(v.jsonObject(req.body.profile, 'profile'));

  const user = await withTransaction(async (client) => {
    if (profile) {
      await client.query(
        `INSERT INTO client_profiles (user_id, data) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data || ${KEEP_FITNESS}`,
        [req.targetUser.id, { ...profile, completedAt: new Date().toISOString() }],
      );
    }
    const { rows } = await client.query(
      `UPDATE users SET profile_completed = true WHERE id = $1 RETURNING ${USER_COLUMNS}`,
      [req.targetUser.id],
    );
    return rows[0];
  });
  res.json({ user: toPublicUser(user, await loadTestClients(user.id)) });
});

// ── Fitness profile (Phase 2) ───────────────────────────────────────────────
// Only Users (clients) have one. Trainers can read their users' profiles;
// only the person or an admin can change them.

function requireClientTarget(req) {
  if (req.targetUser.role !== 'client') {
    throw badRequest('Only User accounts have a fitness profile.', 'not_a_user_account');
  }
}

async function loadFitness(db, userId) {
  const { rows } = await db.query(`SELECT data->'fitness' AS fitness FROM client_profiles WHERE user_id = $1`, [userId]);
  return rows[0]?.fitness ?? null;
}

userRouter.get('/fitness-profile', async (req, res) => {
  requireClientTarget(req);
  const fitness = await loadFitness({ query }, req.targetUser.id);
  res.json({ fitness: toPublicFitness(fitness, req.targetUser), profileCompleted: req.targetUser.profile_completed });
});

userRouter.put('/fitness-profile/:section', selfOrAdmin, async (req, res) => {
  requireClientTarget(req);
  const section = req.params.section;
  if (!SECTIONS.includes(section)) throw badRequest(`Unknown profile step: ${section}`, 'unknown_section');
  const { data, account } = validateSection(section, req.body?.data);

  const result = await withTransaction(async (client) => {
    let user = req.targetUser;
    if (account) {
      const { rows } = await client.query(
        `UPDATE users SET display_name = $2, whatsapp = $3 WHERE id = $1 RETURNING ${USER_COLUMNS}`,
        [user.id, account.displayName, account.whatsapp],
      );
      user = rows[0];
    }
    const patch = { [section]: data, updatedAt: new Date().toISOString() };
    const { rows } = await client.query(
      `INSERT INTO client_profiles (user_id, data) VALUES ($1, jsonb_build_object('fitness', $2::jsonb))
       ON CONFLICT (user_id) DO UPDATE
         SET data = client_profiles.data || jsonb_build_object('fitness', COALESCE(client_profiles.data->'fitness', '{}'::jsonb) || $2::jsonb)
       RETURNING data->'fitness' AS fitness`,
      [user.id, JSON.stringify(patch)],
    );
    return { user, fitness: rows[0].fitness };
  });

  res.json({
    fitness: toPublicFitness(result.fitness, result.user),
    user: account ? toPublicUser(result.user, await loadTestClients(result.user.id)) : undefined,
  });
});

userRouter.post('/fitness-profile/complete', selfOrAdmin, async (req, res) => {
  requireClientTarget(req);
  const result = await withTransaction(async (client) => {
    const { rows: locked } = await client.query(
      `SELECT data->'fitness' AS fitness FROM client_profiles WHERE user_id = $1 FOR UPDATE`, [req.targetUser.id]);
    const current = toPublicFitness(locked[0]?.fitness ?? null, req.targetUser);
    if (current.missing.length > 0) {
      throw badRequest(`Please complete these steps first: ${current.missing.join(', ')}.`, 'profile_incomplete');
    }
    const now = new Date().toISOString();
    const { rows } = await client.query(
      `UPDATE client_profiles
         SET data = data || jsonb_build_object('fitness', (data->'fitness') || jsonb_build_object('completedAt', $2::text, 'updatedAt', $2::text))
       WHERE user_id = $1 RETURNING data->'fitness' AS fitness`,
      [req.targetUser.id, now],
    );
    const { rows: users } = await client.query(
      `UPDATE users SET profile_completed = true WHERE id = $1 RETURNING ${USER_COLUMNS}`, [req.targetUser.id]);
    return { user: users[0], fitness: rows[0].fitness };
  });
  res.json({
    fitness: toPublicFitness(result.fitness, result.user),
    user: toPublicUser(result.user, await loadTestClients(result.user.id)),
  });
});

// ── Nested data ─────────────────────────────────────────────────────────────
userRouter.use('/plans', plansRouter);
userRouter.use('/', weightRouter);
