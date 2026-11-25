// Weight tracking (Firestore users/{uid}/weight_requests and diary_weigh_ins).
// Mounted at /api/users/:userId, after the access check. Same behaviour as
// lib/core/services/weight_service.dart.
//
//   GET    /weight-requests?status=pending            admin requests
//   POST   /weight-requests                           (admin / their trainer) ask for a weigh-in
//   POST   /weight/log  { weight, diaryWeighInId? }   log current weight (logCurrentWeight)
//   GET    /weight/history                            completed weights from both sources
//   DELETE /weight                                    (admin / their trainer) clear weight data, re-create diary
//   GET    /diary-weigh-ins                           scheduled weekly weigh-ins
//   POST   /diary-weigh-ins/initialize { startDate? } create 4 weekly weigh-ins if none exist
//   POST   /diary-weigh-ins/:weighInId/complete { weight }

import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { notFound } from '../errors.js';
import * as v from '../validate.js';

export const weightRouter = Router({ mergeParams: true });

const toRequest = (r) => ({
  id: r.id,
  requestedAt: r.requested_at,
  status: r.status,
  weight: r.weight,
  completedAt: r.completed_at,
});

const toWeighIn = (r) => ({
  id: r.id,
  date: r.scheduled_date,
  status: r.status,
  weight: r.weight,
  completedAt: r.completed_at,
});

/** Start of today (UTC) unless the app sends its own local start-of-day. */
function startOfDay(value) {
  if (value !== undefined) return v.timestamp(value, 'startDate');
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Creates 4 weigh-ins 7 days apart if the user has none. Returns true if created. */
async function initializeDiary(client, userId, start) {
  const existing = await client.query('SELECT 1 FROM diary_weigh_ins WHERE user_id = $1 LIMIT 1', [userId]);
  if (existing.rowCount > 0) return false;
  for (let i = 0; i < 4; i++) {
    await client.query(
      'INSERT INTO diary_weigh_ins (user_id, scheduled_date) VALUES ($1, $2)',
      [userId, new Date(start.getTime() + i * 7 * 24 * 60 * 60 * 1000)],
    );
  }
  return true;
}

// ── Admin weight requests ───────────────────────────────────────────────────
weightRouter.get('/weight-requests', async (req, res) => {
  const params = [req.targetUser.id];
  let filter = '';
  if (req.query.status !== undefined) {
    params.push(v.oneOf(req.query.status, 'status', ['pending', 'completed']));
    filter = 'AND status = $2';
  }
  const { rows } = await query(
    `SELECT * FROM weight_requests WHERE user_id = $1 ${filter} ORDER BY requested_at`, params);
  res.json({ requests: rows.map(toRequest) });
});

weightRouter.post('/weight-requests', requireRole('admin', 'trainer'), async (req, res) => {
  const { rows } = await query(
    'INSERT INTO weight_requests (user_id) VALUES ($1) RETURNING *', [req.targetUser.id]);
  res.status(201).json({ request: toRequest(rows[0]) });
});

// ── Log current weight (WeightService.logCurrentWeight) ─────────────────────
weightRouter.post('/weight/log', async (req, res) => {
  const weight = v.weightKg(req.body?.weight);
  const diaryWeighInId = req.body?.diaryWeighInId
    ? v.string(req.body.diaryWeighInId, 'diaryWeighInId', { max: 128 })
    : null;
  const userId = req.targetUser.id;

  const result = await withTransaction(async (client) => {
    // 1. Admin requests: complete the first pending one, delete duplicates.
    const pending = await client.query(
      `SELECT id FROM weight_requests WHERE user_id = $1 AND status = 'pending'
       ORDER BY requested_at FOR UPDATE`, [userId]);
    let adminRequestId = null;
    if (pending.rows.length) {
      adminRequestId = pending.rows[0].id;
      await client.query(
        `UPDATE weight_requests SET status = 'completed', weight = $1, completed_at = now() WHERE id = $2`,
        [weight, adminRequestId]);
      const extra = pending.rows.slice(1).map((r) => r.id);
      if (extra.length) await client.query('DELETE FROM weight_requests WHERE id = ANY($1)', [extra]);
    }

    // 2. Diary: the specific week tapped, or else the latest pending week up to today.
    let diaryId = null;
    if (diaryWeighInId) {
      const upd = await client.query(
        `UPDATE diary_weigh_ins SET status = 'completed', weight = $1, completed_at = now()
         WHERE id = $2 AND user_id = $3 RETURNING id`, [weight, diaryWeighInId, userId]);
      if (upd.rowCount === 0) throw notFound('Weigh-in not found.', 'weigh_in_not_found');
      diaryId = diaryWeighInId;
    } else {
      const active = await client.query(
        `SELECT id FROM diary_weigh_ins
         WHERE user_id = $1 AND status = 'pending' AND scheduled_date < now() + interval '1 day'
         ORDER BY scheduled_date DESC LIMIT 1 FOR UPDATE`, [userId]);
      if (active.rows.length) {
        diaryId = active.rows[0].id;
        await client.query(
          `UPDATE diary_weigh_ins SET status = 'completed', weight = $1, completed_at = now() WHERE id = $2`,
          [weight, diaryId]);
      }
    }
    return { adminRequestId, diaryWeighInId: diaryId };
  });

  res.json({ ok: true, ...result });
});

// ── History (streamWeightHistory) ───────────────────────────────────────────
weightRouter.get('/weight/history', async (req, res) => {
  const { rows } = await query(
    `SELECT id, COALESCE(completed_at, requested_at) AS date, weight, 'admin' AS source
       FROM weight_requests WHERE user_id = $1 AND status = 'completed' AND weight > 0
     UNION ALL
     SELECT id, COALESCE(completed_at, scheduled_date), weight, 'diary'
       FROM diary_weigh_ins WHERE user_id = $1 AND status = 'completed' AND weight > 0
     ORDER BY date`,
    [req.targetUser.id]);
  res.json({ history: rows });
});

weightRouter.delete('/weight', requireRole('admin', 'trainer'), async (req, res) => {
  const start = startOfDay(req.body?.startDate);
  await withTransaction(async (client) => {
    await client.query('DELETE FROM diary_weigh_ins WHERE user_id = $1', [req.targetUser.id]);
    await client.query('DELETE FROM weight_requests WHERE user_id = $1', [req.targetUser.id]);
    await initializeDiary(client, req.targetUser.id, start);
  });
  res.json({ ok: true });
});

// ── Diary weekly weigh-ins ──────────────────────────────────────────────────
weightRouter.get('/diary-weigh-ins', async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM diary_weigh_ins WHERE user_id = $1 ORDER BY scheduled_date', [req.targetUser.id]);
  res.json({ weighIns: rows.map(toWeighIn) });
});

weightRouter.post('/diary-weigh-ins/initialize', async (req, res) => {
  const start = startOfDay(req.body?.startDate);
  const created = await withTransaction(async (client) => {
    // Lock the user row so two simultaneous calls can't both create 4 weigh-ins.
    await client.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [req.targetUser.id]);
    return initializeDiary(client, req.targetUser.id, start);
  });
  res.json({ created });
});

weightRouter.post('/diary-weigh-ins/:weighInId/complete', async (req, res) => {
  const weight = v.weightKg(req.body?.weight);
  const { rows } = await query(
    `UPDATE diary_weigh_ins SET status = 'completed', weight = $1, completed_at = now()
     WHERE id = $2 AND user_id = $3 RETURNING *`,
    [weight, req.params.weighInId, req.targetUser.id]);
  if (!rows[0]) throw notFound('Weigh-in not found.', 'weigh_in_not_found');
  res.json({ weighIn: toWeighIn(rows[0]) });
});
