// Daily plans (Firestore users/{uid}/roadmap/{yyyy-MM-dd}).
// Mounted at /api/users/:userId/plans, after the access check.
//
//   GET    ?from=YYYY-MM-DD&to=YYYY-MM-DD   { plans: { "2026-11-10": {...}, ... } }
//   GET    /:date                           { plan: {...} | null }
//   PUT    /:date   { plan }                save (replace) the plan for that day
//   DELETE /:date                           delete that day's plan

import { Router } from 'express';
import { query } from '../db.js';
import { badRequest } from '../errors.js';
import * as v from '../validate.js';

export const plansRouter = Router({ mergeParams: true });

plansRouter.get('/', async (req, res) => {
  const params = [req.targetUser.id];
  const where = ['user_id = $1'];
  if (req.query.from !== undefined) {
    params.push(v.dateKey(req.query.from, 'from'));
    where.push(`plan_date >= $${params.length}`);
  }
  if (req.query.to !== undefined) {
    params.push(v.dateKey(req.query.to, 'to'));
    where.push(`plan_date <= $${params.length}`);
  }
  if (req.query.from && req.query.to && req.query.from > req.query.to) {
    throw badRequest('from must not be after to.', 'invalid_range');
  }

  const { rows } = await query(
    `SELECT plan_date, data FROM day_plans WHERE ${where.join(' AND ')} ORDER BY plan_date`,
    params,
  );
  const plans = {};
  for (const r of rows) plans[r.plan_date] = r.data;
  res.json({ plans });
});

plansRouter.get('/:date', async (req, res) => {
  const date = v.dateKey(req.params.date);
  const { rows } = await query('SELECT data FROM day_plans WHERE user_id = $1 AND plan_date = $2',
    [req.targetUser.id, date]);
  res.json({ plan: rows[0]?.data ?? null });
});

plansRouter.put('/:date', async (req, res) => {
  const date = v.dateKey(req.params.date);
  const plan = v.jsonObject(req.body?.plan, 'plan');
  const { rows } = await query(
    `INSERT INTO day_plans (user_id, plan_date, data) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, plan_date) DO UPDATE SET data = EXCLUDED.data
     RETURNING data`,
    [req.targetUser.id, date, plan],
  );
  res.json({ plan: rows[0].data });
});

plansRouter.delete('/:date', async (req, res) => {
  const date = v.dateKey(req.params.date);
  await query('DELETE FROM day_plans WHERE user_id = $1 AND plan_date = $2', [req.targetUser.id, date]);
  res.json({ ok: true });
});
