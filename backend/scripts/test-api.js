// End-to-end checks for the Phase 3 data API against the local database,
// including access rules (who may read/change what).
// Creates temporary accounts/rows and removes them afterwards.
// Creates its own temporary admin account.
//
//   npm run test:api

import { createApp } from '../src/app.js';
import { query, closePool } from '../src/db.js';
import { createTestUser, TEST_PASSWORD } from './lib/test-users.js';

const TAG = `autotest-${Date.now()}`;
let base;
let passed = 0;
let failed = 0;

async function api(method, path, { body, token } = {}) {
  const res = await fetch(base + path, {
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
    console.log(`  FAIL  ${name}${detail ? `  → ${JSON.stringify(detail)}` : ''}`);
  }
}

async function register(label) {
  const r = await api('POST', '/api/auth/register', {
    body: { email: `${TAG}-${label}@local.dev`, password: 'test123', displayName: `${TAG} ${label}` },
  });
  if (r.status !== 201) throw new Error(`could not create ${label}: ${JSON.stringify(r)}`);
  return { id: r.data.user.uid, token: r.data.token };
}

async function login(email, password = TEST_PASSWORD) {
  const r = await api('POST', '/api/auth/login', { body: { email, password } });
  if (r.status !== 200) throw new Error(`login failed for ${email}`);
  return { id: r.data.user.uid, token: r.data.token };
}

let originalBranding;

async function run() {
  const adminUser = await createTestUser(TAG, 'admin');
  const admin = await login(adminUser.email);
  const clientA = await register('clientA');
  const clientB = await register('clientB');
  const trainer = await register('trainer');
  await query(`UPDATE users SET role = 'trainer' WHERE id = $1`, [trainer.id]);
  const A = clientA.token;

  // ── Users ────────────────────────────────────────────────────────────────
  console.log('Users & access rules');
  check('client reads own user via /me', (await api('GET', '/api/users/me', { token: A })).data?.user?.uid === clientA.id);
  check('client cannot read another client → 403',
    (await api('GET', `/api/users/${clientB.id}`, { token: A })).status === 403);
  check('trainer cannot read a client → 403 (same as Firestore rules)',
    (await api('GET', `/api/users/${clientA.id}`, { token: trainer.token })).status === 403);
  check('admin can read any client', (await api('GET', `/api/users/${clientA.id}`, { token: admin.token })).status === 200);
  check('no token → 401', (await api('GET', `/api/users/${clientA.id}`)).status === 401);
  check('client cannot list users → 403', (await api('GET', '/api/users', { token: A })).status === 403);
  const list = await api('GET', '/api/users?role=client&archived=false', { token: admin.token });
  check('admin lists clients', list.status === 200 && list.data.users.some((u) => u.uid === clientA.id), list.status);

  const rename = await api('PATCH', '/api/users/me', { token: A, body: { displayName: `${TAG} renamed` } });
  check('client updates own display name', rename.data?.user?.displayName === `${TAG} renamed`);
  check('nobody can change their role (roles are locked) → 400',
    (await api('PATCH', '/api/users/me', { token: A, body: { role: 'admin' } })).status === 400);
  check('client cannot un-archive / change status → 403',
    (await api('PATCH', '/api/users/me', { token: A, body: { status: 'active' } })).status === 403);
  check('unknown field rejected → 400',
    (await api('PATCH', '/api/users/me', { token: A, body: { password_hash: 'x' } })).status === 400);
  check('admin cannot archive themselves → 400',
    (await api('PATCH', '/api/users/me', { token: admin.token, body: { isArchived: true } })).status === 400);
  const archive = await api('PATCH', `/api/users/${clientB.id}`, { token: admin.token, body: { isArchived: true } });
  check('admin archives a client', archive.data?.user?.isArchived === true);
  check('archived client is locked out → 403', (await api('GET', '/api/users/me', { token: clientB.token })).status === 403);
  await api('PATCH', `/api/users/${clientB.id}`, { token: admin.token, body: { isArchived: false } });

  const tc = await api('PUT', `/api/users/${admin.id}/test-clients`, { token: admin.token, body: { clientIds: [clientA.id] } });
  check('admin sets test clients', tc.status === 200 && tc.data.testClients[0] === clientA.id, tc);
  check('test client must be a client → 400',
    (await api('PUT', `/api/users/${admin.id}/test-clients`, { token: admin.token, body: { clientIds: [trainer.id] } })).status === 400);
  await api('PUT', `/api/users/${admin.id}/test-clients`, { token: admin.token, body: { clientIds: [] } });

  const stats = await api('GET', '/api/admin/stats', { token: admin.token });
  check('admin dashboard stats', stats.status === 200 && stats.data.clients >= 2 && stats.data.trainers >= 1, stats);
  check('client cannot see stats → 403', (await api('GET', '/api/admin/stats', { token: A })).status === 403);

  // ── Profile ──────────────────────────────────────────────────────────────
  console.log('Profile (roadmap/current)');
  check('new client has no profile', (await api('GET', '/api/users/me/profile', { token: A })).data?.profile === null);
  const done = await api('POST', '/api/users/me/complete-profile', {
    token: A, body: { profile: { firstName: 'Ann', goal: 'strength', currentStreak: 0 } },
  });
  check('complete onboarding marks profileCompleted', done.data?.user?.profileCompleted === true, done);
  const merged = await api('PATCH', '/api/users/me/profile', { token: A, body: { profile: { currentStreak: 4 } } });
  check('streak update merges (keeps other fields)',
    merged.data?.profile?.currentStreak === 4 && merged.data?.profile?.firstName === 'Ann', merged);
  check('admin reads client profile',
    (await api('GET', `/api/users/${clientA.id}/profile`, { token: admin.token })).data?.profile?.goal === 'strength');
  check('other client cannot read profile → 403',
    (await api('GET', `/api/users/${clientA.id}/profile`, { token: clientB.token })).status === 403);

  // ── Plans ────────────────────────────────────────────────────────────────
  console.log('Day plans');
  const plan = { workout: { title: 'Push day', exercises: [{ id: 'ex_0', sets: 3 }] }, nutrition: { meals: [] } };
  check('admin saves a plan for a client',
    (await api('PUT', `/api/users/${clientA.id}/plans/2026-11-10`, { token: admin.token, body: { plan } })).status === 200);
  await api('PUT', '/api/users/me/plans/2026-11-12', { token: A, body: { plan: { workout: { title: 'Legs' } } } });
  const one = await api('GET', '/api/users/me/plans/2026-11-10', { token: A });
  check('client reads the plan', one.data?.plan?.workout?.title === 'Push day', one);
  check('missing day → plan null', (await api('GET', '/api/users/me/plans/2026-11-11', { token: A })).data?.plan === null);
  const range = await api('GET', '/api/users/me/plans?from=2026-11-01&to=2026-11-30', { token: A });
  check('date range returns both days', Object.keys(range.data?.plans ?? {}).join() === '2026-11-10,2026-11-12', range);
  check('invalid date → 400', (await api('GET', '/api/users/me/plans/2026-02-30', { token: A })).status === 400);
  check('other client cannot write plans → 403',
    (await api('PUT', `/api/users/${clientA.id}/plans/2026-11-10`, { token: clientB.token, body: { plan } })).status === 403);
  await api('DELETE', '/api/users/me/plans/2026-11-12', { token: A });
  check('plan deleted', (await api('GET', '/api/users/me/plans/2026-11-12', { token: A })).data?.plan === null);

  // ── Weight ───────────────────────────────────────────────────────────────
  console.log('Weight');
  const start = new Date(Date.now() - 8 * 86400000).toISOString(); // first week is overdue
  const init = await api('POST', '/api/users/me/diary-weigh-ins/initialize', { token: A, body: { startDate: start } });
  check('diary initialized', init.data?.created === true, init);
  check('initialize again does nothing',
    (await api('POST', '/api/users/me/diary-weigh-ins/initialize', { token: A, body: {} })).data?.created === false);
  const diary = await api('GET', '/api/users/me/diary-weigh-ins', { token: A });
  check('4 weekly weigh-ins', diary.data?.weighIns?.length === 4, diary.data?.weighIns?.length);

  check('client cannot create admin weight request → 403',
    (await api('POST', '/api/users/me/weight-requests', { token: A })).status === 403);
  await api('POST', `/api/users/${clientA.id}/weight-requests`, { token: admin.token });
  await api('POST', `/api/users/${clientA.id}/weight-requests`, { token: admin.token }); // accidental duplicate
  const pend = await api('GET', '/api/users/me/weight-requests?status=pending', { token: A });
  check('client sees 2 pending requests', pend.data?.requests?.length === 2, pend);

  const log = await api('POST', '/api/users/me/weight/log', { token: A, body: { weight: 82.5 } });
  check('log weight completes request + latest due diary week',
    log.status === 200 && log.data.adminRequestId && log.data.diaryWeighInId === diary.data.weighIns[1].id, log);
  check('duplicate pending request removed',
    (await api('GET', '/api/users/me/weight-requests?status=pending', { token: A })).data?.requests?.length === 0);
  const specific = await api('POST', `/api/users/me/diary-weigh-ins/${diary.data.weighIns[0].id}/complete`,
    { token: A, body: { weight: 83.1 } });
  check('complete a specific diary week', specific.data?.weighIn?.status === 'completed', specific);
  check('unrealistic weight → 400',
    (await api('POST', '/api/users/me/weight/log', { token: A, body: { weight: -5 } })).status === 400);
  const hist = await api('GET', '/api/users/me/weight/history', { token: A });
  check('history has 3 entries (admin + 2 diary)', hist.data?.history?.length === 3, hist);
  check('client cannot clear weight data → 403', (await api('DELETE', '/api/users/me/weight', { token: A })).status === 403);
  await api('DELETE', `/api/users/${clientA.id}/weight`, { token: admin.token, body: {} });
  const after = await api('GET', '/api/users/me/weight/history', { token: A });
  const fresh = await api('GET', '/api/users/me/diary-weigh-ins', { token: A });
  check('admin clear resets history and re-creates diary',
    after.data?.history?.length === 0 && fresh.data?.weighIns?.length === 4);

  // ── Exercises ────────────────────────────────────────────────────────────
  console.log('Exercises');
  const ex = { name: `${TAG} Bench Press`, bodyPart: 'Chest', setup: ['Lie on bench'], presetSets: [{ reps: 10, weight: 40 }] };
  check('client cannot add exercise → 403', (await api('POST', '/api/exercises', { token: A, body: { exercise: ex } })).status === 403);
  const created = await api('POST', '/api/exercises', { token: admin.token, body: { exercise: ex } });
  check('admin adds exercise', created.status === 201 && created.data.exercise.presetSets[0].reps === 10, created);
  const exId = created.data?.exercise?.id;
  check('client reads exercise list', (await api('GET', '/api/exercises', { token: A })).data?.exercises?.some((e) => e.id === exId));
  const upd = await api('PUT', `/api/exercises/${exId}`, { token: admin.token, body: { exercise: { ...ex, bodyPart: 'Upper chest' } } });
  check('admin edits exercise', upd.data?.exercise?.bodyPart === 'Upper chest', upd);
  const bulk = await api('POST', '/api/exercises/bulk', {
    token: admin.token, body: { exercises: [{ id: `${TAG}-ex1`, name: `${TAG} Squat` }, { id: `${TAG}-ex2`, name: `${TAG} Plank` }] },
  });
  check('admin bulk-imports exercises', bulk.data?.count === 2, bulk);
  check('exercise without name → 400',
    (await api('POST', '/api/exercises', { token: admin.token, body: { exercise: { bodyPart: 'x' } } })).status === 400);
  check('admin deletes exercise', (await api('DELETE', `/api/exercises/${exId}`, { token: admin.token })).status === 200);

  // ── Media library ────────────────────────────────────────────────────────
  console.log('Media library');
  const folder = await api('POST', '/api/media', { token: admin.token, body: { name: `${TAG} Folder`, type: 'folder' } });
  const sub = await api('POST', '/api/media', { token: admin.token, body: { name: `${TAG} Sub`, type: 'folder', parentId: folder.data.item.id } });
  const vid = await api('POST', '/api/media', {
    token: admin.token, body: { name: `${TAG} Video`, type: 'video', parentId: sub.data.item.id, url: 'https://example.com/v.mp4' },
  });
  check('admin creates folder, sub-folder, video', folder.status === 201 && sub.status === 201 && vid.status === 201);
  check('client cannot create media → 403',
    (await api('POST', '/api/media', { token: A, body: { name: 'x', type: 'folder' } })).status === 403);
  const inSub = await api('GET', `/api/media?parentId=${sub.data.item.id}`, { token: A });
  check('client browses a folder', inSub.data?.items?.length === 1 && inSub.data.items[0].type === 'video');
  const all = await api('GET', '/api/media?all=true', { token: A });
  check('?all=true lists items in every folder',
    [folder, sub, vid].every((x) => all.data?.items?.some((i) => i.id === x.data.item.id)), all.status);
  check('folder cannot be moved inside its own sub-folder → 400',
    (await api('PATCH', `/api/media/${folder.data.item.id}`, { token: admin.token, body: { parentId: sub.data.item.id } })).status === 400);
  check('video without url → 400',
    (await api('POST', '/api/media', { token: admin.token, body: { name: 'v', type: 'video' } })).status === 400);
  await api('DELETE', `/api/media/${folder.data.item.id}`, { token: admin.token });
  check('deleting a folder removes its contents',
    (await query('SELECT count(*)::int AS n FROM media_items WHERE name LIKE $1', [`${TAG}%`])).rows[0].n === 0);

  // ── Feedback ─────────────────────────────────────────────────────────────
  console.log('Feedback');
  const fb = await api('POST', '/api/feedback', { token: A, body: { category: 'Bug Report', message: `${TAG} hello`, rating: 4 } });
  check('client sends feedback', fb.status === 201, fb);
  check('client cannot read feedback → 403', (await api('GET', '/api/feedback', { token: A })).status === 403);
  const fbList = await api('GET', '/api/feedback', { token: admin.token });
  const mine = fbList.data?.feedback?.find((f) => f.message === `${TAG} hello`);
  check('admin reads feedback; sender taken from login', mine?.uid === clientA.id, mine);
  check('rating out of range → 400',
    (await api('POST', '/api/feedback', { token: A, body: { category: 'x', message: 'y', rating: 9 } })).status === 400);

  // ── Branding ─────────────────────────────────────────────────────────────
  console.log('Branding');
  originalBranding = (await query(`SELECT * FROM branding_settings WHERE id = 'active_branding'`)).rows[0] ?? null;
  check('anyone can read branding (no login)', (await api('GET', '/api/branding')).status === 200);
  check('client cannot change branding → 403',
    (await api('PUT', '/api/branding', { token: A, body: { activeStyleId: 'x', customStyles: [] } })).status === 403);
  const br = await api('PUT', '/api/branding', {
    token: admin.token, body: { activeStyleId: `${TAG}-style`, customStyles: [{ id: `${TAG}-style`, name: 'Test' }] },
  });
  check('admin saves branding', br.data?.activeStyleId === `${TAG}-style` && br.data.customStyles.length === 1, br);

  // ── Account deletion ─────────────────────────────────────────────────────
  console.log('Account deletion');
  check('client cannot delete another client → 403',
    (await api('DELETE', `/api/users/${clientA.id}`, { token: clientB.token })).status === 403);
  check('client deletes own account', (await api('DELETE', '/api/users/me', { token: clientB.token })).status === 200);
  check('deleted account token no longer works', (await api('GET', '/api/users/me', { token: clientB.token })).status === 401);
  const cascade = await query(
    `SELECT (SELECT count(*) FROM client_profiles WHERE user_id = $1)
          + (SELECT count(*) FROM day_plans WHERE user_id = $1)
          + (SELECT count(*) FROM diary_weigh_ins WHERE user_id = $1) AS n`, [clientA.id]);
  check('(control) client A data still exists', Number(cascade.rows[0].n) > 0);
}

const server = createApp().listen(0);
await new Promise((resolve) => server.once('listening', resolve));
base = `http://127.0.0.1:${server.address().port}`;

try {
  await run();
} catch (err) {
  failed++;
  console.error(`Test run crashed: ${err.stack}`);
} finally {
  // Clean up everything this run created.
  await query('DELETE FROM feedback WHERE message LIKE $1', [`${TAG}%`]);
  await query('DELETE FROM exercises WHERE name LIKE $1', [`${TAG}%`]);
  await query('DELETE FROM media_items WHERE name LIKE $1', [`${TAG}%`]);
  await query('DELETE FROM users WHERE email LIKE $1', [`${TAG}%`]);
  if (originalBranding) {
    await query(`UPDATE branding_settings SET active_style_id = $1, custom_styles = $2 WHERE id = 'active_branding'`,
      [originalBranding.active_style_id, JSON.stringify(originalBranding.custom_styles)]);
  } else if (originalBranding === null) {
    await query(`DELETE FROM branding_settings WHERE id = 'active_branding'`);
  }
  server.close();
  await closePool();
  console.log(`\n${passed} passed, ${failed} failed (temporary test data removed)`);
  process.exitCode = failed > 0 ? 1 : 0;
}
