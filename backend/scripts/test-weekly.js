// End-to-end checks for Phase 7: exercise details (sets / reps / time / rest),
// weekly plans (repeat a week), meal times, ticking meals, and the daily summary.
// Creates temporary accounts / library items and removes them afterwards.
//
//   npm run test:weekly

import { createApp } from '../src/app.js';
import { query, closePool } from '../src/db.js';
import { createTestUser, TEST_PASSWORD } from './lib/test-users.js';

const TAG = `autotest-${Date.now()}`;
let base;
let passed = 0;
let failed = 0;

async function api(method, p, { body, token } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail !== undefined ? `  → ${JSON.stringify(detail)}` : ''}`);
  }
}

async function login(email) {
  const r = await api('POST', '/api/auth/login', { body: { email, password: TEST_PASSWORD } });
  return { id: r.data?.user?.uid, token: r.data?.token };
}

const DAY = 86400000;
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const weekdayOf = (date) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

async function run() {
  const admin = await login((await createTestUser(TAG, 'admin')).email);
  const trainer = await login((await createTestUser(TAG, 'trainer')).email);
  const otherTrainer = await login((await createTestUser(TAG, 'trainer')).email);
  const user = await login((await createTestUser(TAG, 'client')).email);
  await query('UPDATE users SET trainer_id = $1 WHERE id = $2', [trainer.id, user.id]);

  const cat = await api('POST', '/api/library/categories', { token: admin.token, body: { name: `${TAG} Strength` } });
  const vid = await api('POST', '/api/library/videos', { token: admin.token, body: { video: {
    title: 'Push-ups', categoryId: cat.data.category.id, source: 'youtube', videoUrl: 'https://youtu.be/IODxDxX7oi4',
    difficulty: 'beginner', durationMinutes: 5, bodyParts: ['chest'] } } });
  const plank = await api('POST', '/api/library/videos', { token: admin.token, body: { video: {
    title: 'Plank', categoryId: cat.data.category.id, source: 'youtube', videoUrl: 'https://youtu.be/pSHjTRCQxIw',
    difficulty: 'beginner', durationMinutes: 2, bodyParts: ['core'] } } });
  const videoId = vid.data.video.id;
  const today = new Date().toISOString().slice(0, 10);

  // ── Exercise details ──────────────────────────────────────────────────────
  console.log('Sets, reps, time and rest');
  const single = await api('POST', '/api/workouts', { token: trainer.token, body: {
    userId: user.id, title: 'Quick session', date: addDays(today, 30),
    items: [{ videoId, sets: 3, reps: 12, restSeconds: 60 }, { videoId: plank.data.video.id, sets: 3, durationSeconds: 45, restSeconds: 30 }] } });
  const it = single.data?.workout?.items;
  check('workout keeps sets / reps / rest', it?.[0]?.sets === 3 && it[0].reps === 12 && it[0].restSeconds === 60, it?.[0]);
  check('…and a timed exercise (seconds instead of reps)', it?.[1]?.durationSeconds === 45 && it[1].reps === null, it?.[1]);
  check('reps AND a time together refused → 400', (await api('POST', '/api/workouts', { token: trainer.token, body: {
    userId: user.id, title: 'x', date: today, items: [{ videoId, reps: 10, durationSeconds: 30 }] } })).data?.code === 'reps_or_time');
  check('25 sets refused → 400', (await api('POST', '/api/workouts', { token: trainer.token, body: {
    userId: user.id, title: 'x', date: today, items: [{ videoId, sets: 25 }] } })).status === 400);
  await api('DELETE', `/api/workouts/${single.data.workout.id}`, { token: trainer.token });

  // ── Weekly plan ───────────────────────────────────────────────────────────
  console.log('Weekly plan');
  const start = today;
  const workoutDay = (weekday, title) => ({ weekday, rest: false, title, items: [{ videoId, sets: 3, reps: 12, restSeconds: 60, note: 'slow' }] });
  const restDay = (weekday) => ({ weekday, rest: true, items: [] });
  // Monday (0) and Thursday (3) are workout days; the rest are rest days.
  const days = [0, 1, 2, 3, 4, 5, 6].map((d) => (d === 0 ? workoutDay(0, 'Chest day') : d === 3 ? workoutDay(3, 'Legs day') : restDay(d)));
  const plan = { userId: user.id, title: 'Strength block', startDate: start, weeks: 2, note: 'Warm up first', days };
  const sent = await api('POST', '/api/weekly-plans', { token: trainer.token, body: plan });
  check('Trainer sends a 2-week plan: 2 workout days × 2 weeks = 4 workouts', sent.status === 201 && sent.data.workoutsCreated === 4, sent.data);
  check('plan end date = start + 13 days', sent.data?.plan?.endDate === addDays(start, 13), sent.data?.plan);
  const mine = await api('GET', '/api/workouts?userId=me', { token: user.token });
  const fromPlan = mine.data?.workouts?.filter((w) => w.weeklyPlanId === sent.data.plan.id) ?? [];
  check('the user sees the workouts on the right weekdays',
    fromPlan.length === 4 && fromPlan.every((w) => [0, 3].includes(weekdayOf(w.date)) && w.date >= start && w.date <= addDays(start, 13)),
    fromPlan.map((w) => [w.date, w.title]));
  check('each exercise keeps its sets / reps / rest', fromPlan[0]?.items[0]?.sets === 3 && fromPlan[0].items[0].restSeconds === 60);
  check('another trainer cannot send to this user → 403', (await api('POST', '/api/weekly-plans', { token: otherTrainer.token, body: plan })).status === 403);
  check('a week without 7 days refused → 400', (await api('POST', '/api/weekly-plans', {
    token: trainer.token, body: { ...plan, days: days.slice(0, 5) } })).data?.code === 'invalid_days');
  check('a week of only rest days refused → 400', (await api('POST', '/api/weekly-plans', {
    token: trainer.token, body: { ...plan, days: [0, 1, 2, 3, 4, 5, 6].map(restDay) } })).data?.code === 'no_workout_days');
  check('13 weeks refused → 400', (await api('POST', '/api/weekly-plans', { token: trainer.token, body: { ...plan, weeks: 13 } })).status === 400);

  // The user ticks one exercise on the first workout day, then the trainer sends a new plan.
  const first = [...fromPlan].sort((a, z) => a.date.localeCompare(z.date))[0];
  await api('PATCH', `/api/workouts/${first.id}/items/${first.items[0].id}`, { token: user.token, body: { done: true } });
  const second = await api('POST', '/api/weekly-plans', { token: trainer.token, body: { ...plan, title: 'New block', weeks: 1 } });
  const after = (await api('GET', '/api/workouts?userId=me', { token: user.token })).data.workouts;
  check('a new plan replaces the old plan\'s days not started yet', !after.some((w) => w.weeklyPlanId === sent.data.plan.id && w.id !== first.id));
  check('…but keeps a day the user already worked on', after.some((w) => w.id === first.id));
  const plans = await api('GET', `/api/weekly-plans?userId=${user.id}`, { token: trainer.token });
  check('the newest plan is current, the old one in history', plans.data?.current?.id === second.data.plan.id && plans.data.history[0]?.id === sent.data.plan.id);
  check('the user can see their plan', (await api('GET', `/api/weekly-plans/${second.data.plan.id}`, { token: user.token })).status === 200);
  check('the user cannot delete it → 403', (await api('DELETE', `/api/weekly-plans/${second.data.plan.id}`, { token: user.token })).status === 403);
  await api('DELETE', `/api/weekly-plans/${second.data.plan.id}`, { token: trainer.token });
  const gone = (await api('GET', '/api/workouts?userId=me', { token: user.token })).data.workouts;
  check('deleting a plan removes its days not started yet', !gone.some((w) => w.weeklyPlanId === second.data.plan.id));

  // ── Meal times and ticking meals ──────────────────────────────────────────
  console.log('Meals');
  const foods = (await api('GET', '/api/nutrition/foods', { token: trainer.token })).data.foods;
  const rice = foods.find((f) => f.name === 'White rice, cooked');
  const oats = foods.find((f) => f.name === 'Oats, dry');
  const diet = await api('POST', '/api/nutrition/plans', { token: trainer.token, body: {
    userId: user.id, title: 'Daily diet', mealTimes: { breakfast: '08:00', lunch: '13:30' },
    items: [{ foodId: oats.id, meal: 'breakfast', servings: 1 }, { foodId: rice.id, meal: 'lunch', servings: 1 }] } });
  check('meal times saved', diet.data?.plan?.mealTimes?.breakfast === '08:00' && diet.data.plan.mealTimes.lunch === '13:30', diet.data?.plan?.mealTimes);
  check('a wrong time refused → 400', (await api('POST', '/api/nutrition/plans', { token: trainer.token, body: {
    userId: user.id, title: 'x', mealTimes: { breakfast: '25:00' }, items: [{ foodId: rice.id, meal: 'lunch', servings: 1 }] } })).data?.code === 'invalid_time');

  const tick = await api('PUT', '/api/today/meals', { token: user.token, body: { date: today, meal: 'breakfast', done: true } });
  check('the user ticks breakfast as eaten', tick.status === 200 && tick.data.mealsDone.some((m) => m.meal === 'breakfast'), tick.data);
  check('the trainer cannot tick for the user → 403', (await api('PUT', '/api/today/meals', {
    token: trainer.token, body: { date: today, meal: 'lunch', done: true } })).status === 403);
  check('ticking a meal 30 days ago refused → 400', (await api('PUT', '/api/today/meals', {
    token: user.token, body: { date: addDays(today, -30), meal: 'lunch', done: true } })).data?.code === 'date_out_of_range');
  const day = await api('GET', `/api/today?userId=${user.id}&date=${today}`, { token: trainer.token });
  check('the trainer sees the user\'s day (workouts + meals ticked)', day.status === 200 && day.data.mealsDone.length === 1, day.data);
  check('another trainer cannot → 403', (await api('GET', `/api/today?userId=${user.id}`, { token: otherTrainer.token })).status === 403);

  const sum = await api('GET', `/api/today/summary?userId=${user.id}&days=7`, { token: trainer.token });
  const t = sum.data?.days?.find((d) => d.date === today);
  check('summary: 7 days, today 1 of 2 meals eaten', sum.data?.days?.length === 7 && t?.mealsPlanned === 2 && t.mealsDone === 1, t);
  const yesterday = sum.data?.days?.find((d) => d.date === addDays(today, -1));
  check('days before the diet was sent count no planned meals', yesterday?.mealsPlanned === 0, yesterday);
  const untick = await api('PUT', '/api/today/meals', { token: user.token, body: { date: today, meal: 'breakfast', done: false } });
  check('the user can untick', untick.data?.mealsDone?.length === 0, untick.data);
}

const server = createApp().listen(0);
await new Promise((r) => server.once('listening', r));
base = `http://127.0.0.1:${server.address().port}`;

try {
  await run();
} catch (err) {
  failed++;
  console.error(`Test run crashed: ${err.stack}`);
} finally {
  await query('DELETE FROM users WHERE email LIKE $1', [`${TAG}%`]);
  await query('DELETE FROM workout_videos WHERE category_id IN (SELECT id FROM workout_categories WHERE name LIKE $1)', [`${TAG}%`]);
  await query('DELETE FROM workout_categories WHERE name LIKE $1', [`${TAG}%`]);
  server.close();
  await closePool();
  console.log(`\n${passed} passed, ${failed} failed (temporary test data removed)`);
  process.exitCode = failed > 0 ? 1 : 0;
}
