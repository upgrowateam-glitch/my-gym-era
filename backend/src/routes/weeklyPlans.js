// Phase 7: weekly workout plans and the daily follow-up.
//
// Weekly plan: the trainer builds one week (Mon–Sun; a day is a workout or a
// rest day) and it repeats for 1–12 weeks from a start date. Saving it creates
// each day's workout (the normal workouts the user already sees and ticks).
// A new plan replaces the previous plan's days that are not started yet.
//
//   POST   /api/weekly-plans  { userId, title, startDate, weeks, note,
//                               days: [{ weekday 0–6 (Mon–Sun), rest, title, items: [{ videoId, sets, reps, durationSeconds, restSeconds, note }] }] }
//          trainer → their assigned users; Admin (with "View all users") / Super Admin → any user
//   GET    /api/weekly-plans?userId=<id>|me   { current, history }
//   GET    /api/weekly-plans/:id
//   DELETE /api/weekly-plans/:id               removes its days that are not started yet (staff)
//
// Daily follow-up:
//   GET    /api/today?userId=<id>|me&date=YYYY-MM-DD   that day's workouts, the nutrition plan with meal
//                                                      times, and which meals were ticked
//   PUT    /api/today/meals  { date, meal, done }       the user ticks a meal (only the user)
//   GET    /api/today/summary?userId=<id>|me&days=7     per day: exercises done / planned, meals done / planned

import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { badRequest, forbidden, notFound } from '../errors.js';
import { isStaffFor } from '../users/userModel.js';
import * as v from '../validate.js';
import { WORKOUT_SELECT, accessTo, insertWorkout, loadAccount, readWorkoutItems, toWorkout } from './workouts.js';
import { MEALS } from './nutrition.js';

const DAY_MS = 86400000;
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
/** 0 = Monday … 6 = Sunday */
const weekdayOf = (date) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const userIdOf = (req) => (req.query.userId === undefined || req.query.userId === 'me'
  ? req.user.id : v.string(req.query.userId, 'userId', { max: 128 }));

// ── Weekly plans ────────────────────────────────────────────────────────────

export const weeklyPlansRouter = Router();
weeklyPlansRouter.use(requireAuth);

const toPlan = (r) => ({
  id: r.id,
  userId: r.user_id,
  sentBy: r.sent_by,
  sentByName: r.sent_by_name ?? null,
  title: r.title,
  startDate: r.start_date,
  weeks: r.weeks,
  endDate: addDays(r.start_date, r.weeks * 7 - 1),
  note: r.note,
  days: r.days,
  createdAt: r.created_at,
});

const PLAN_SELECT = `SELECT p.*, s.display_name AS sent_by_name FROM weekly_plans p LEFT JOIN users s ON s.id = p.sent_by`;

weeklyPlansRouter.post('/', requireRole('admin', 'trainer'), async (req, res) => {
  const b = v.jsonObject(req.body, 'body');
  const userId = v.string(b.userId, 'userId', { max: 128, allowEmpty: false });
  const target = await loadAccount(userId);
  if (!target || target.role !== 'client') throw badRequest('Choose a user.', 'invalid_user');
  if (!isStaffFor(req.user, target)) {
    throw forbidden(req.user.role === 'trainer' ? 'You can only send plans to your assigned users.' : undefined, 'not_your_user');
  }
  if (target.is_archived) throw badRequest('This user is deactivated.', 'user_archived');

  const title = v.string(b.title, 'Title', { max: 120, allowEmpty: false }).trim();
  if (!title) throw badRequest('Please enter a title.', 'invalid_title');
  const startDate = v.dateKey(b.startDate, 'Start date');
  const weeks = v.number(b.weeks, 'Weeks', { min: 1, max: 12, integer: true });
  const note = b.note === undefined || b.note === null ? '' : v.string(b.note, 'Note', { max: 1000 });

  if (!Array.isArray(b.days) || b.days.length !== 7) throw badRequest('A weekly plan has 7 days (Monday to Sunday).', 'invalid_days');
  const days = [];
  for (const [i, d] of b.days.entries()) {
    v.jsonObject(d, `days[${i}]`);
    const weekday = v.number(d.weekday, 'weekday', { min: 0, max: 6, integer: true });
    if (days.some((x) => x.weekday === weekday)) throw badRequest('Each weekday can appear only once.', 'invalid_days');
    const rest = d.rest === true;
    if (rest) { days.push({ weekday, rest: true, title: 'Rest day', items: [] }); continue; }
    const dayTitle = (d.title === undefined || d.title === null ? '' : v.string(d.title, 'Day title', { max: 80 })).trim()
      || `${WEEKDAY_NAMES[weekday]} workout`;
    let items;
    try {
      items = await readWorkoutItems(d.items);
    } catch (e) {
      e.message = `${WEEKDAY_NAMES[weekday]}: ${e.message}`;
      throw e;
    }
    days.push({ weekday, rest: false, title: dayTitle, items });
  }
  days.sort((a, z) => a.weekday - z.weekday);
  if (days.every((d) => d.rest)) throw badRequest('Add a workout to at least one day.', 'no_workout_days');

  const id = await withTransaction(async (client) => {
    // The previous plans' days from the start date on that are not started yet are replaced.
    await client.query(
      `DELETE FROM workouts w WHERE w.user_id = $1 AND w.weekly_plan_id IS NOT NULL AND w.workout_date >= $2
         AND NOT EXISTS (SELECT 1 FROM workout_items i WHERE i.workout_id = w.id AND i.completed_at IS NOT NULL)`,
      [userId, startDate]);
    const { rows } = await client.query(
      `INSERT INTO weekly_plans (user_id, sent_by, title, start_date, weeks, note, days)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [userId, req.user.id, title, startDate, weeks, note, JSON.stringify(days)]);
    for (let n = 0; n < weeks * 7; n++) {
      const date = addDays(startDate, n);
      const day = days.find((d) => d.weekday === weekdayOf(date));
      if (!day || day.rest) continue;
      await insertWorkout(client, {
        userId, sentBy: req.user.id, title: day.title, date, note, weeklyPlanId: rows[0].id, items: day.items,
      });
    }
    return rows[0].id;
  });
  const { rows } = await query(`${PLAN_SELECT} WHERE p.id = $1`, [id]);
  const { rows: count } = await query('SELECT count(*)::int AS n FROM workouts WHERE weekly_plan_id = $1', [id]);
  res.status(201).json({ plan: toPlan(rows[0]), workoutsCreated: count[0].n });
});

weeklyPlansRouter.get('/', async (req, res) => {
  const userId = userIdOf(req);
  await accessTo(req, userId);
  const { rows } = await query(`${PLAN_SELECT} WHERE p.user_id = $1 ORDER BY p.created_at DESC LIMIT 30`, [userId]);
  const plans = rows.map(toPlan);
  res.json({ current: plans[0] ?? null, history: plans.slice(1) });
});

weeklyPlansRouter.get('/:id', async (req, res) => {
  const { rows } = await query(`${PLAN_SELECT} WHERE p.id = $1`, [req.params.id]);
  if (!rows[0]) throw notFound('Weekly plan not found.', 'plan_not_found');
  await accessTo(req, rows[0].user_id);
  res.json({ plan: toPlan(rows[0]) });
});

weeklyPlansRouter.delete('/:id', requireRole('admin', 'trainer'), async (req, res) => {
  const { rows } = await query('SELECT user_id FROM weekly_plans WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw notFound('Weekly plan not found.', 'plan_not_found');
  if ((await accessTo(req, rows[0].user_id)) !== 'staff') throw forbidden();
  await withTransaction(async (client) => {
    // Days not started yet go; days with ticked exercises stay in the user's history.
    await client.query(
      `DELETE FROM workouts w WHERE w.weekly_plan_id = $1
         AND NOT EXISTS (SELECT 1 FROM workout_items i WHERE i.workout_id = w.id AND i.completed_at IS NOT NULL)`, [req.params.id]);
    await client.query('DELETE FROM weekly_plans WHERE id = $1', [req.params.id]);
  });
  res.json({ ok: true });
});

// ── Daily follow-up ─────────────────────────────────────────────────────────

export const todayRouter = Router();
todayRouter.use(requireAuth);

/** The user's current nutrition plan: which meals it has, and their times. */
async function currentDiet(userId) {
  const { rows } = await query(
    `SELECT p.id, p.title, p.meal_times, p.created_at, array_agg(DISTINCT i.meal) AS meals
     FROM nutrition_plans p JOIN nutrition_plan_items i ON i.plan_id = p.id
     WHERE p.user_id = $1 GROUP BY p.id ORDER BY p.created_at DESC LIMIT 1`, [userId]);
  return rows[0] ?? null;
}

todayRouter.get('/', async (req, res) => {
  const userId = userIdOf(req);
  await accessTo(req, userId);
  const date = req.query.date === undefined ? new Date().toISOString().slice(0, 10) : v.dateKey(req.query.date, 'date');
  const { rows: w } = await query(
    `${WORKOUT_SELECT} WHERE w.user_id = $1 AND w.workout_date = $2 GROUP BY w.id, s.display_name, s.role ORDER BY w.created_at`,
    [userId, date]);
  const { rows: logs } = await query('SELECT meal, done_at FROM meal_logs WHERE user_id = $1 AND log_date = $2', [userId, date]);
  res.json({ date, workouts: w.map(toWorkout), mealsDone: logs.map((l) => ({ meal: l.meal, doneAt: l.done_at })) });
});

todayRouter.put('/meals', async (req, res) => {
  if (req.user.role !== 'client') throw forbidden('Only the user ticks their own meals.', 'not_your_plan');
  const b = v.jsonObject(req.body, 'body');
  const date = v.dateKey(b.date, 'date');
  const today = new Date().toISOString().slice(0, 10);
  if (date > addDays(today, 1) || date < addDays(today, -7)) {
    throw badRequest('Meals can be ticked for the last 7 days only.', 'date_out_of_range');
  }
  const meal = v.oneOf(b.meal, 'meal', MEALS);
  const done = v.boolean(b.done, 'done');
  if (done) {
    await query('INSERT INTO meal_logs (user_id, log_date, meal) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [req.user.id, date, meal]);
  } else {
    await query('DELETE FROM meal_logs WHERE user_id = $1 AND log_date = $2 AND meal = $3', [req.user.id, date, meal]);
  }
  const { rows } = await query('SELECT meal, done_at FROM meal_logs WHERE user_id = $1 AND log_date = $2', [req.user.id, date]);
  res.json({ date, mealsDone: rows.map((l) => ({ meal: l.meal, doneAt: l.done_at })) });
});

todayRouter.get('/summary', async (req, res) => {
  const userId = userIdOf(req);
  await accessTo(req, userId);
  const days = req.query.days === undefined ? 7 : v.number(Number(req.query.days), 'days', { min: 1, max: 31, integer: true });
  const to = new Date().toISOString().slice(0, 10);
  const from = addDays(to, -(days - 1));
  const { rows: ex } = await query(
    `SELECT w.workout_date AS date, count(i.id)::int AS planned, count(i.completed_at)::int AS done
     FROM workouts w JOIN workout_items i ON i.workout_id = w.id
     WHERE w.user_id = $1 AND w.workout_date BETWEEN $2 AND $3 GROUP BY w.workout_date`, [userId, from, to]);
  const { rows: meals } = await query(
    'SELECT log_date AS date, count(*)::int AS done FROM meal_logs WHERE user_id = $1 AND log_date BETWEEN $2 AND $3 GROUP BY log_date',
    [userId, from, to]);
  const diet = await currentDiet(userId);
  const mealsPerDay = diet?.meals?.length ?? 0;
  // Days before the diet was sent do not count as planned meals.
  const dietFrom = diet ? new Date(diet.created_at).toISOString().slice(0, 10) : null;
  const out = [];
  for (let n = 0; n < days; n++) {
    const date = addDays(from, n);
    const e = ex.find((x) => x.date === date);
    const mealsPlanned = dietFrom && date >= dietFrom ? mealsPerDay : 0;
    out.push({
      date,
      exercisesPlanned: e?.planned ?? 0,
      exercisesDone: e?.done ?? 0,
      mealsPlanned,
      mealsDone: Math.min(mealsPlanned || Infinity, meals.find((x) => x.date === date)?.done ?? 0),
    });
  }
  res.json({ days: out });
});
