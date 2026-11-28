// End-to-end checks for Phase 6: food list (categories, foods) and nutrition
// plans (send, view current + history) — including who may do what.
// Creates temporary accounts / foods and removes them afterwards.
//
//   npm run test:nutrition

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

async function run() {
  const sa = await login((await createTestUser(TAG, 'super_admin')).email);
  const admin = await login((await createTestUser(TAG, 'admin')).email);
  const noUsersAdmin = await login((await createTestUser(TAG, 'admin', { permissions: ['invite_trainers'] })).email);
  const trainer = await login((await createTestUser(TAG, 'trainer')).email);
  const otherTrainer = await login((await createTestUser(TAG, 'trainer')).email);
  const user = await login((await createTestUser(TAG, 'client')).email);
  const otherUser = await login((await createTestUser(TAG, 'client')).email);
  await query('UPDATE users SET trainer_id = $1 WHERE id = $2', [trainer.id, user.id]);
  await query('UPDATE users SET trainer_id = $1 WHERE id = $2', [otherTrainer.id, otherUser.id]);

  // ── Starter list ──────────────────────────────────────────────────────────
  console.log('Starter food list');
  const starter = await api('GET', '/api/nutrition/foods', { token: trainer.token });
  const rice = starter.data?.foods?.find((f) => f.name === 'White rice, cooked');
  check('starter foods are there (with numbers, not text)', starter.status === 200 && starter.data.foods.length >= 60
    && rice?.calories === 205 && rice.protein === 4.3 && rice.servingSize === '1 cup (158 g)', rice);
  check('starter foods have a full photo address', rice?.imageUrl === `${base}/uploads/starter-foods/white-rice-cooked.jpg`, rice?.imageUrl);
  check('every starter food has a photo', starter.data?.foods?.filter((f) => f.imageUrl?.includes('/uploads/starter-foods/')).length >= 66);
  const photo = await fetch(rice.imageUrl);
  check('the photo loads (JPEG, cached)', photo.status === 200 && photo.headers.get('content-type') === 'image/jpeg'
    && /max-age/.test(photo.headers.get('cache-control') ?? ''), { status: photo.status, type: photo.headers.get('content-type') });
  const credits = await api('GET', '/api/nutrition/photo-credits', { token: user.token });
  check('photo credits list (author + license for each photo)', credits.data?.credits?.length >= 66
    && credits.data.credits.every((c) => c.author && c.license && c.source?.startsWith('https://commons.wikimedia.org/')), credits.data?.credits?.[0]);

  // ── Categories ────────────────────────────────────────────────────────────
  console.log('Categories');
  const cat = await api('POST', '/api/nutrition/categories', { token: admin.token, body: { name: `${TAG} Breakfast` } });
  check('Admin adds a food category', cat.status === 201, cat);
  check('duplicate name refused → 409', (await api('POST', '/api/nutrition/categories', {
    token: sa.token, body: { name: `${TAG} BREAKFAST` } })).status === 409);
  check('Trainer cannot add a category → 403', (await api('POST', '/api/nutrition/categories', {
    token: trainer.token, body: { name: `${TAG} X` } })).status === 403);
  check('User cannot see the food list → 403', (await api('GET', '/api/nutrition/foods', { token: user.token })).status === 403);

  // ── Foods ─────────────────────────────────────────────────────────────────
  console.log('Foods');
  const good = { name: `${TAG} Upma`, categoryId: cat.data.category.id, servingSize: '1 cup (200 g)', calories: 250, protein: 6.5, carbs: 38.2, fat: 8, dietType: 'vegan' };
  const food = await api('POST', '/api/nutrition/foods', { token: admin.token, body: { food: good } });
  check('Admin adds a food', food.status === 201 && food.data.food.calories === 250 && food.data.food.carbs === 38.2, food);
  const foodId = food.data?.food?.id;
  check('negative calories refused → 400', (await api('POST', '/api/nutrition/foods', {
    token: admin.token, body: { food: { ...good, calories: -5 } } })).status === 400);
  check('missing serving size refused → 400', (await api('POST', '/api/nutrition/foods', {
    token: admin.token, body: { food: { ...good, servingSize: '' } } })).status === 400);
  check('unknown diet type refused → 400', (await api('POST', '/api/nutrition/foods', {
    token: admin.token, body: { food: { ...good, dietType: 'keto' } } })).status === 400);
  check('photo must be an uploaded picture → 400', (await api('POST', '/api/nutrition/foods', {
    token: admin.token, body: { food: { ...good, imageUrl: 'https://example.com/a.jpg' } } })).data?.code === 'invalid_image');
  check('Trainer cannot add a food → 403', (await api('POST', '/api/nutrition/foods', { token: trainer.token, body: { food: good } })).status === 403);
  const upd = await api('PUT', `/api/nutrition/foods/${foodId}`, { token: sa.token, body: { food: { ...good, calories: 230, fat: 6.5 } } });
  check('Super Admin updates a food', upd.data?.food?.calories === 230 && upd.data.food.fat === 6.5, upd);
  check('category with foods cannot be deleted → 409', (await api('DELETE', `/api/nutrition/categories/${cat.data.category.id}`, {
    token: admin.token })).data?.code === 'category_not_empty');

  // ── Plans ─────────────────────────────────────────────────────────────────
  console.log('Nutrition plans');
  const plan = {
    userId: user.id, title: 'Fat loss – week 1', note: 'Drink 3 L of water',
    items: [
      { foodId, meal: 'dinner', servings: 1 },
      { foodId: rice.id, meal: 'lunch', servings: 1.5, note: 'with dal' },
      { foodId, meal: 'breakfast', servings: 0.5 },
    ],
  };
  const sent = await api('POST', '/api/nutrition/plans', { token: trainer.token, body: plan });
  check('Trainer sends a plan to their user', sent.status === 201 && sent.data.plan.items.length === 3, sent);
  check('meals are put in the order of the day', sent.data?.plan?.items.map((i) => i.meal).join() === 'breakfast,lunch,dinner', sent.data?.plan?.items);
  // 0.5×230 + 1.5×205 + 1×230 = 652.5 → 653 kcal; protein 0.5×6.5 + 1.5×4.3 + 6.5 = 16.2
  check('totals are calculated', sent.data?.plan?.totals?.calories === 653 && sent.data.plan.totals.protein === 16.2, sent.data?.plan?.totals);
  check('Trainer cannot send to someone else\'s user → 403', (await api('POST', '/api/nutrition/plans', {
    token: trainer.token, body: { ...plan, userId: otherUser.id } })).status === 403);
  check('Admin (view users) can send to any user', (await api('POST', '/api/nutrition/plans', {
    token: admin.token, body: { ...plan, userId: otherUser.id } })).status === 201);
  check('Admin without "view users" cannot send → 403', (await api('POST', '/api/nutrition/plans', {
    token: noUsersAdmin.token, body: plan })).status === 403);
  check('User cannot send plans → 403', (await api('POST', '/api/nutrition/plans', { token: user.token, body: plan })).status === 403);
  check('plan without foods refused → 400', (await api('POST', '/api/nutrition/plans', {
    token: trainer.token, body: { ...plan, items: [] } })).status === 400);
  check('servings must be in steps of 0.25 → 400', (await api('POST', '/api/nutrition/plans', {
    token: trainer.token, body: { ...plan, items: [{ foodId, meal: 'lunch', servings: 1.3 }] } })).data?.code === 'invalid_servings');
  check('unknown meal refused → 400', (await api('POST', '/api/nutrition/plans', {
    token: trainer.token, body: { ...plan, items: [{ foodId, meal: 'brunch', servings: 1 }] } })).status === 400);

  // ── Viewing ───────────────────────────────────────────────────────────────
  console.log('Viewing');
  const mine = await api('GET', '/api/nutrition/plans?userId=me', { token: user.token });
  check('User sees their current plan', mine.data?.current?.id === sent.data.plan.id && mine.data.history.length === 0, mine.data);
  check('another user cannot see it → 403', (await api('GET', `/api/nutrition/plans/${sent.data.plan.id}`, { token: otherUser.token })).status === 403);
  check('another trainer cannot see it → 403', (await api('GET', `/api/nutrition/plans?userId=${user.id}`, { token: otherTrainer.token })).status === 403);
  const second = await api('POST', '/api/nutrition/plans', { token: trainer.token, body: { ...plan, title: 'Week 2' } });
  const now = await api('GET', `/api/nutrition/plans?userId=${user.id}`, { token: trainer.token });
  check('a new plan becomes current; the old one moves to history',
    now.data?.current?.id === second.data?.plan?.id && now.data.history[0]?.id === sent.data.plan.id, now.data);

  // ── Deleting ──────────────────────────────────────────────────────────────
  console.log('Deleting');
  check('Admin deletes the food', (await api('DELETE', `/api/nutrition/foods/${foodId}`, { token: admin.token })).status === 200);
  const kept = await api('GET', `/api/nutrition/plans/${second.data.plan.id}`, { token: user.token });
  check('sent plan keeps the food after it is deleted', kept.data?.plan?.items.some((i) => i.name === `${TAG} Upma` && i.foodId === null), kept.data);
  check('User cannot delete their plan → 403', (await api('DELETE', `/api/nutrition/plans/${second.data.plan.id}`, { token: user.token })).status === 403);
  check('Trainer deletes the plan', (await api('DELETE', `/api/nutrition/plans/${second.data.plan.id}`, { token: trainer.token })).status === 200);
  const back = await api('GET', '/api/nutrition/plans?userId=me', { token: user.token });
  check('…and the previous plan is current again', back.data?.current?.id === sent.data.plan.id, back.data);
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
  // Plans go with their users (ON DELETE CASCADE); test foods / categories are removed here.
  await query('DELETE FROM users WHERE email LIKE $1', [`${TAG}%`]);
  await query('DELETE FROM foods WHERE name LIKE $1', [`${TAG}%`]);
  await query('DELETE FROM food_categories WHERE name LIKE $1', [`${TAG}%`]);
  server.close();
  await closePool();
  console.log(`\n${passed} passed, ${failed} failed (temporary test data removed)`);
  process.exitCode = failed > 0 ? 1 : 0;
}
