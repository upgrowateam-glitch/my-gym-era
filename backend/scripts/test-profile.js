// End-to-end checks for Phase 2: the User fitness profile
// (personal, body/BMI, health, goals, routine, food, sleep, finish).
// Creates temporary accounts and removes them afterwards.
//
//   npm run test:profile

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

async function login(email, password = TEST_PASSWORD) {
  const r = await api('POST', '/api/auth/login', { body: { email, password } });
  return { id: r.data?.user?.uid, token: r.data?.token };
}

const save = (token, step, data, who = 'me') => api('PUT', `/api/users/${who}/fitness-profile/${step}`, { token, body: { data } });
const yearsAgo = (n) => { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - n); return d.toISOString().slice(0, 10); };

const GOOD = {
  personal: { displayName: 'Priya P', gender: 'female', dateOfBirth: yearsAgo(28), whatsapp: '+91 98765 43210' },
  body: { heightCm: 165, weightKg: 68, targetWeightKg: 60 },
  health: { injuries: 'Old knee injury', medicalConditions: '', smoking: 'never' },
  goals: { mainGoal: 'lose_weight', extraGoals: ['get_fitter', 'lose_weight', 'flexibility'], experience: 'beginner' },
  routine: { workType: 'desk', activityLevel: 'light', workoutDays: 4, workoutTime: 'morning' },
  food: { dietType: 'eggetarian', mealsPerDay: 4, waterLitres: 2.5, avoidFoods: 'Peanuts', eatingOut: 'weekly' },
  sleep: { bedtime: '23:30', wakeTime: '06:30', quality: 'good' },
};

async function run() {
  // A brand-new User from the normal sign-up.
  const email = `${TAG}-newuser@test.local`;
  const reg = await api('POST', '/api/auth/register', { body: { email, password: TEST_PASSWORD, displayName: 'Priya' } });
  check('new User signs up (profile not completed yet)', reg.status === 201 && reg.data.user.profileCompleted === false, reg);
  const user = { id: reg.data?.user?.uid, token: reg.data?.token };

  console.log('Empty profile');
  const empty = await api('GET', '/api/users/me/fitness-profile', { token: user.token });
  check('empty profile lists all 7 steps as missing', empty.status === 200 && empty.data.fitness.missing.length === 7 && empty.data.fitness.bmi === null, empty);
  const early = await api('POST', '/api/users/me/fitness-profile/complete', { token: user.token });
  check('cannot finish an empty profile → 400 profile_incomplete', early.status === 400 && early.data.code === 'profile_incomplete', early);

  console.log('Personal information');
  check('missing name refused', (await save(user.token, 'personal', { ...GOOD.personal, displayName: '  ' })).status === 400);
  check('unknown gender refused', (await save(user.token, 'personal', { ...GOOD.personal, gender: 'robot' })).status === 400);
  check('impossible date refused', (await save(user.token, 'personal', { ...GOOD.personal, dateOfBirth: '1990-02-30' })).status === 400);
  const young = await save(user.token, 'personal', { ...GOOD.personal, dateOfBirth: yearsAgo(10) });
  check('under-13 refused → invalid_age', young.status === 400 && young.data.code === 'invalid_age', young);
  check('bad phone refused', (await save(user.token, 'personal', { ...GOOD.personal, whatsapp: 'abc' })).status === 400);
  check('unknown field refused', (await save(user.token, 'personal', { ...GOOD.personal, role: 'admin' })).status === 400);
  const pers = await save(user.token, 'personal', GOOD.personal);
  check('personal step saved', pers.status === 200 && pers.data.fitness.personal.gender === 'female', pers);
  check('age calculated (28)', pers.data?.fitness.age === 28, pers.data?.fitness);
  check('name + WhatsApp saved on the account', pers.data?.user?.displayName === 'Priya P' && pers.data.user.whatsapp === '+919876543210', pers.data?.user);
  check('role unchanged', pers.data?.user?.role === 'client');

  console.log('Height, weight and BMI');
  check('height below 100 cm refused', (await save(user.token, 'body', { ...GOOD.body, heightCm: 40 })).status === 400);
  check('weight above 300 kg refused', (await save(user.token, 'body', { ...GOOD.body, weightKg: 500 })).status === 400);
  check('text instead of number refused', (await save(user.token, 'body', { ...GOOD.body, weightKg: '68' })).status === 400);
  const body = await save(user.token, 'body', GOOD.body);
  check('BMI calculated by the server: 68 kg / 1.65 m² = 25.0 (overweight)',
    body.data?.fitness.bmi?.value === 25 && body.data.fitness.bmi.category === 'overweight', body.data?.fitness.bmi);
  const b2 = await save(user.token, 'body', { heightCm: 180, weightKg: 70 });
  check('BMI 21.6 → normal; target weight optional', b2.data?.fitness.bmi?.value === 21.6 && b2.data.fitness.bmi.category === 'normal' && b2.data.fitness.body.targetWeightKg === null, b2.data?.fitness);
  const b3 = await save(user.token, 'body', { heightCm: 170, weightKg: 50 });
  check('BMI 17.3 → underweight', b3.data?.fitness.bmi?.category === 'underweight', b3.data?.fitness.bmi);
  const b4 = await save(user.token, 'body', { heightCm: 160, weightKg: 90 });
  check('BMI 35.2 → obese', b4.data?.fitness.bmi?.value === 35.2 && b4.data.fitness.bmi.category === 'obese', b4.data?.fitness.bmi);
  await save(user.token, 'body', GOOD.body);

  console.log('Health');
  check('unknown smoking answer refused', (await save(user.token, 'health', { ...GOOD.health, smoking: 'sometimes' })).status === 400);
  const health = await save(user.token, 'health', { smoking: 'quit' });
  check('injuries / conditions are optional', health.status === 200 && health.data.fitness.health.injuries === '', health);
  await save(user.token, 'health', GOOD.health);

  console.log('Fitness goals');
  check('unknown goal refused', (await save(user.token, 'goals', { ...GOOD.goals, mainGoal: 'fly' })).status === 400);
  check('unknown extra goal refused', (await save(user.token, 'goals', { ...GOOD.goals, extraGoals: ['fly'] })).status === 400);
  const goals = await save(user.token, 'goals', GOOD.goals);
  check('main goal removed from extra goals', JSON.stringify(goals.data?.fitness.goals.extraGoals) === '["get_fitter","flexibility"]', goals.data?.fitness.goals);

  console.log('Daily routine');
  check('8 workout days refused', (await save(user.token, 'routine', { ...GOOD.routine, workoutDays: 8 })).status === 400);
  check('2.5 workout days refused', (await save(user.token, 'routine', { ...GOOD.routine, workoutDays: 2.5 })).status === 400);
  check('routine saved', (await save(user.token, 'routine', GOOD.routine)).status === 200);

  console.log('Food habits');
  check('unknown diet refused', (await save(user.token, 'food', { ...GOOD.food, dietType: 'keto' })).status === 400);
  check('20 litres of water refused', (await save(user.token, 'food', { ...GOOD.food, waterLitres: 20 })).status === 400);
  for (const diet of ['vegetarian', 'non_vegetarian', 'vegan', 'jain']) {
    check(`diet "${diet}" accepted`, (await save(user.token, 'food', { ...GOOD.food, dietType: diet })).status === 200);
  }
  const food = await save(user.token, 'food', GOOD.food);
  check('food habits saved', food.data?.fitness.food.dietType === 'eggetarian' && food.data.fitness.food.avoidFoods === 'Peanuts', food.data?.fitness.food);

  // Not finished yet: sleep is still missing.
  const notYet = await api('POST', '/api/users/me/fitness-profile/complete', { token: user.token });
  check('finish refused while a step is missing (sleep)', notYet.status === 400 && /sleep/.test(notYet.data.error ?? notYet.data.message ?? ''), notYet.data);

  console.log('Sleep schedule');
  check('bad time refused', (await save(user.token, 'sleep', { ...GOOD.sleep, bedtime: '25:00' })).status === 400);
  check('same bedtime and wake time refused', (await save(user.token, 'sleep', { ...GOOD.sleep, wakeTime: '23:30' })).status === 400);
  const sleep = await save(user.token, 'sleep', { ...GOOD.sleep, sleepHours: 12 });
  check('the app cannot send its own sleep hours', sleep.status === 400, sleep);
  const sleep2 = await save(user.token, 'sleep', GOOD.sleep);
  check('sleep hours calculated across midnight (23:30 → 06:30 = 7 h)', sleep2.data?.fitness.sleep.sleepHours === 7, sleep2.data?.fitness.sleep);
  const sleep3 = await save(user.token, 'sleep', { bedtime: '01:15', wakeTime: '08:45', quality: 'fair' });
  check('sleep hours same day (01:15 → 08:45 = 7.5 h)', sleep3.data?.fitness.sleep.sleepHours === 7.5, sleep3.data?.fitness.sleep);
  check('unknown step refused', (await save(user.token, 'mood', {})).status === 400);

  console.log('Finish');
  const done = await api('POST', '/api/users/me/fitness-profile/complete', { token: user.token });
  check('profile finished', done.status === 200 && done.data.user.profileCompleted === true && !!done.data.fitness.completedAt, done);
  check('nothing missing any more', done.data?.fitness.missing.length === 0);
  const me = await api('GET', '/api/users/me', { token: user.token });
  check('account now shows profile completed', me.data?.user?.profileCompleted === true, me.data?.user);
  const edit = await save(user.token, 'body', { heightCm: 165, weightKg: 66 });
  check('can still update a step after finishing', edit.status === 200 && edit.data.fitness.completedAt !== null && edit.data.fitness.bmi.value === 24.2, edit.data?.fitness);

  console.log('Old profile routes cannot overwrite the fitness profile');
  const sneak = await api('PATCH', '/api/users/me/profile', { token: user.token, body: { profile: { fitness: { body: { heightCm: 1 } } } } });
  check('PATCH /profile with "fitness" refused', sneak.status === 400 && sneak.data.code === 'use_fitness_profile', sneak);
  await api('PUT', '/api/users/me/profile', { token: user.token, body: { profile: { note: 'x' } } });
  const kept = await api('GET', '/api/users/me/fitness-profile', { token: user.token });
  check('PUT /profile keeps the fitness profile', kept.data?.fitness.body?.weightKg === 66 && kept.data.fitness.missing.length === 0, kept.data?.fitness);

  console.log('Who can see and change it');
  const trainerAcc = await createTestUser(TAG, 'trainer', { name: 'Tara Trainer' });
  const trainer = await login(trainerAcc.email);
  check('unassigned trainer cannot read it', (await api('GET', `/api/users/${user.id}/fitness-profile`, { token: trainer.token })).status === 403);
  await query('UPDATE users SET trainer_id = $1 WHERE id = $2', [trainer.id, user.id]);
  const tRead = await api('GET', `/api/users/${user.id}/fitness-profile`, { token: trainer.token });
  check('assigned trainer can read it', tRead.status === 200 && tRead.data.fitness.food.dietType === 'eggetarian', tRead);
  check('trainer cannot change it', (await save(trainer.token, 'body', GOOD.body, user.id)).status === 403);
  check('trainer cannot use the old profile route either', (await api('PATCH', `/api/users/${user.id}/profile`, { token: trainer.token, body: { profile: { x: 1 } } })).status === 403);
  check('trainer has no fitness profile of their own', (await api('GET', '/api/users/me/fitness-profile', { token: trainer.token })).status === 400);

  const adminAcc = await createTestUser(TAG, 'admin', { name: 'Ada Admin' });
  const admin = await login(adminAcc.email);
  const aEdit = await save(admin.token, 'routine', { ...GOOD.routine, workoutDays: 5 }, user.id);
  check('admin (with "view users") can update it', aEdit.status === 200 && aEdit.data.fitness.routine.workoutDays === 5, aEdit);

  const otherAcc = await createTestUser(TAG, 'client', { name: 'Other User' });
  const other = await login(otherAcc.email);
  check('another User cannot read it', (await api('GET', `/api/users/${user.id}/fitness-profile`, { token: other.token })).status === 403);
  check('another User cannot change it', (await save(other.token, 'body', GOOD.body, user.id)).status === 403);
  check('not signed in → 401', (await api('GET', '/api/users/me/fitness-profile')).status === 401);
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
  // Profiles are removed with their accounts (ON DELETE CASCADE).
  await query('DELETE FROM users WHERE email LIKE $1', [`${TAG}%`]);
  server.close();
  await closePool();
  console.log(`\n${passed} passed, ${failed} failed (temporary test data removed)`);
  process.exitCode = failed > 0 ? 1 : 0;
}
