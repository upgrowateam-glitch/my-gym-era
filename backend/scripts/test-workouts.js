// End-to-end checks for Phase 5: workout video library (categories, videos)
// and workouts sent to users (send, view, mark done) — including who may do what.
// Creates temporary accounts / library items and removes them afterwards.
//
//   npm run test:workouts

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

const categoryIds = [];

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

  // ── Categories ────────────────────────────────────────────────────────────
  console.log('Categories');
  const cat = await api('POST', '/api/library/categories', { token: admin.token, body: { name: `${TAG} Strength` } });
  check('Admin adds a category', cat.status === 201 && cat.data.category.name === `${TAG} Strength`, cat);
  categoryIds.push(cat.data?.category?.id);
  check('duplicate name refused → 409', (await api('POST', '/api/library/categories', {
    token: sa.token, body: { name: `${TAG} strength` } })).status === 409);
  check('Trainer cannot add a category → 403', (await api('POST', '/api/library/categories', {
    token: trainer.token, body: { name: `${TAG} X` } })).status === 403);
  check('User cannot see the library → 403', (await api('GET', '/api/library/categories', { token: user.token })).status === 403);
  const renamed = await api('PATCH', `/api/library/categories/${cat.data.category.id}`, { token: sa.token, body: { name: `${TAG} Strength 2` } });
  check('Super Admin renames a category', renamed.data?.category?.name === `${TAG} Strength 2`, renamed);

  // ── Videos ────────────────────────────────────────────────────────────────
  console.log('Videos');
  const good = {
    title: 'Push-ups', categoryId: cat.data.category.id, description: 'Keep your back straight.', source: 'youtube',
    videoUrl: 'https://youtu.be/IODxDxX7oi4', difficulty: 'beginner', durationMinutes: 5, bodyParts: ['chest', 'arms'], equipment: 'None',
  };
  const vid = await api('POST', '/api/library/videos', { token: admin.token, body: { video: good } });
  check('Admin adds a YouTube video', vid.status === 201 && vid.data.video.videoUrl === 'https://www.youtube.com/watch?v=IODxDxX7oi4'
    && vid.data.video.thumbnailUrl.includes('IODxDxX7oi4') && vid.data.video.categoryName === `${TAG} Strength 2`, vid);
  const videoId = vid.data?.video?.id;
  check('not a YouTube link refused → 400', (await api('POST', '/api/library/videos', {
    token: admin.token, body: { video: { ...good, videoUrl: 'https://example.com/x' } } })).data?.code === 'invalid_youtube');
  check('upload source must be an uploaded file → 400', (await api('POST', '/api/library/videos', {
    token: admin.token, body: { video: { ...good, source: 'upload', videoUrl: 'https://example.com/x.mp4' } } })).data?.code === 'invalid_upload');
  check('uploaded file link accepted', (await api('POST', '/api/library/videos', {
    token: admin.token, body: { video: { ...good, title: 'Squats', source: 'upload', videoUrl: 'https://fitzone.example/uploads/workout_videos/2026-11/a.mp4', bodyParts: ['legs'] } } })).status === 201);
  check('bad difficulty refused → 400', (await api('POST', '/api/library/videos', {
    token: admin.token, body: { video: { ...good, difficulty: 'expert' } } })).status === 400);
  check('duration 0 refused → 400', (await api('POST', '/api/library/videos', {
    token: admin.token, body: { video: { ...good, durationMinutes: 0 } } })).status === 400);
  check('no body part refused → 400', (await api('POST', '/api/library/videos', {
    token: admin.token, body: { video: { ...good, bodyParts: [] } } })).status === 400);
  check('Trainer cannot add a video → 403', (await api('POST', '/api/library/videos', {
    token: trainer.token, body: { video: good } })).status === 403);
  const list = await api('GET', '/api/library/videos', { token: trainer.token });
  check('Trainer sees the videos', list.status === 200 && list.data.videos.some((x) => x.id === videoId));
  const upd = await api('PUT', `/api/library/videos/${videoId}`, { token: admin.token, body: { video: { ...good, title: 'Push-ups (knees)', difficulty: 'intermediate' } } });
  check('Admin updates a video', upd.data?.video?.title === 'Push-ups (knees)' && upd.data.video.difficulty === 'intermediate', upd);
  check('category with videos cannot be deleted → 409', (await api('DELETE', `/api/library/categories/${cat.data.category.id}`, {
    token: admin.token })).data?.code === 'category_not_empty');

  // ── Sending workouts ──────────────────────────────────────────────────────
  console.log('Sending workouts');
  const today = new Date().toISOString().slice(0, 10);
  const workout = { userId: user.id, title: 'Chest day', date: today, note: 'Warm up first', items: [{ videoId, note: '3 x 12' }] };
  const sent = await api('POST', '/api/workouts', { token: trainer.token, body: workout });
  check('Trainer sends a workout to their user', sent.status === 201 && sent.data.workout.items.length === 1
    && sent.data.workout.items[0].note === '3 x 12' && sent.data.workout.date === today, sent);
  const workoutId = sent.data?.workout?.id;
  check('Trainer cannot send to someone else\'s user → 403', (await api('POST', '/api/workouts', {
    token: trainer.token, body: { ...workout, userId: otherUser.id } })).status === 403);
  check('Admin (view users) can send to any user', (await api('POST', '/api/workouts', {
    token: admin.token, body: { ...workout, userId: otherUser.id } })).status === 201);
  check('Admin without "view users" cannot send → 403', (await api('POST', '/api/workouts', {
    token: noUsersAdmin.token, body: workout })).status === 403);
  check('User cannot send workouts → 403', (await api('POST', '/api/workouts', { token: user.token, body: workout })).status === 403);
  check('workout without videos refused → 400', (await api('POST', '/api/workouts', {
    token: trainer.token, body: { ...workout, items: [] } })).status === 400);
  check('unknown video refused → 400', (await api('POST', '/api/workouts', {
    token: trainer.token, body: { ...workout, items: [{ videoId: 'nope' }] } })).data?.code === 'invalid_video');
  check('bad date refused → 400', (await api('POST', '/api/workouts', {
    token: trainer.token, body: { ...workout, date: '2026-13-40' } })).status === 400);

  // ── Viewing and completing ────────────────────────────────────────────────
  console.log('Viewing and completing');
  const mine = await api('GET', '/api/workouts?userId=me', { token: user.token });
  check('User sees the workout sent to them', mine.data?.workouts?.some((w) => w.id === workoutId)
    && mine.data.workouts[0].items[0].video?.videoUrl?.includes('youtube'), mine.data);
  check('another user cannot see it → 403', (await api('GET', `/api/workouts/${workoutId}`, { token: otherUser.token })).status === 403);
  check('another trainer cannot see it → 403', (await api('GET', `/api/workouts?userId=${user.id}`, { token: otherTrainer.token })).status === 403);
  check('their trainer sees it', (await api('GET', `/api/workouts?userId=${user.id}`, { token: trainer.token })).data?.workouts?.length >= 1);
  const itemId = sent.data.workout.items[0].id;
  check('trainer cannot tick it done for the user → 403', (await api('PATCH', `/api/workouts/${workoutId}/items/${itemId}`, {
    token: trainer.token, body: { done: true } })).status === 403);
  const done = await api('PATCH', `/api/workouts/${workoutId}/items/${itemId}`, { token: user.token, body: { done: true } });
  check('User marks the video done → workout complete', done.data?.workout?.completed === true && !!done.data.workout.items[0].completedAt, done);
  const seen = await api('GET', `/api/workouts/${workoutId}`, { token: trainer.token });
  check('trainer sees it completed', seen.data?.workout?.doneCount === 1, seen.data);
  const undone = await api('PATCH', `/api/workouts/${workoutId}/items/${itemId}`, { token: user.token, body: { done: false } });
  check('User can undo', undone.data?.workout?.completed === false, undone.data);

  // ── Uploading a large video in pieces ─────────────────────────────────────
  console.log('Uploading in pieces');
  const size = 9 * 1024 * 1024 + 123; // 3 pieces of up to 4 MB
  const file = Buffer.alloc(size, 7);
  file.write('ftypisom', 4, 'latin1'); // looks like an MP4
  const startUp = await api('POST', '/api/uploads/chunked/start', { token: admin.token, body: { kind: 'workouts', size } });
  check('Admin starts an upload', startUp.status === 201 && !!startUp.data.uploadId, startUp);
  check('Trainer cannot upload → 403', (await api('POST', '/api/uploads/chunked/start', {
    token: trainer.token, body: { kind: 'workouts', size } })).status === 403);
  check('over 200 MB refused with a clear message → 413', (await api('POST', '/api/uploads/chunked/start', {
    token: admin.token, body: { kind: 'workouts', size: 300 * 1024 * 1024 } })).data?.code === 'file_too_large');
  const id = startUp.data?.uploadId;
  const chunk = startUp.data?.chunkSize;
  const put = (offset, piece, token = admin.token) => fetch(`${base}/api/uploads/chunked/${id}?offset=${offset}`, {
    method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' }, body: piece,
  });
  check('finishing too early refused → 400', (await api('POST', `/api/uploads/chunked/${id}/finish`, { token: admin.token })).data?.code === 'upload_incomplete');
  check('another admin cannot add to it → 404', (await put(0, file.subarray(0, chunk), sa.token)).status === 404);
  check('first piece accepted', (await put(0, file.subarray(0, chunk))).status === 200);
  check('the same piece again (a retry) is fine', (await put(0, file.subarray(0, chunk))).status === 200);
  check('a piece out of order → 409', (await put(chunk * 2, file.subarray(chunk * 2))).status === 409);
  for (let off = chunk; off < size; off += chunk) await put(off, file.subarray(off, off + chunk));
  const finished = await api('POST', `/api/uploads/chunked/${id}/finish`, { token: admin.token });
  check('upload finishes with the video address', finished.status === 201 && finished.data.type === 'video' && finished.data.size === size
    && finished.data.url.includes('/uploads/workout_videos/'), finished.data);
  const served = finished.data?.url ? await fetch(finished.data.url.replace(/^https?:\/\/[^/]+/, base)) : null;
  check('…and the whole file is there', served?.status === 200 && Number(served.headers.get('content-length')) === size);
  if (finished.data?.url) {
    const { unlink } = await import('node:fs/promises');
    const { config } = await import('../src/config.js');
    await unlink(`${config.uploadDir}/${finished.data.url.split('/uploads/')[1]}`).catch(() => {});
  }
  check('upload id cannot be used again → 404', (await api('POST', `/api/uploads/chunked/${id}/finish`, { token: admin.token })).status === 404);

  // ── Deleting ──────────────────────────────────────────────────────────────
  console.log('Deleting');
  check('Trainer cannot delete a library video → 403', (await api('DELETE', `/api/library/videos/${videoId}`, { token: trainer.token })).status === 403);
  check('Admin deletes the video', (await api('DELETE', `/api/library/videos/${videoId}`, { token: admin.token })).status === 200);
  const kept = await api('GET', `/api/workouts/${workoutId}`, { token: user.token });
  check('sent workout keeps the video title after deletion', kept.data?.workout?.items[0]?.title === 'Push-ups (knees)'
    && kept.data.workout.items[0].video === null, kept.data);
  check('User cannot delete their workout → 403', (await api('DELETE', `/api/workouts/${workoutId}`, { token: user.token })).status === 403);
  check('Trainer cancels the workout', (await api('DELETE', `/api/workouts/${workoutId}`, { token: trainer.token })).status === 200);
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
  // Workouts go with their users (ON DELETE CASCADE); library items are removed here.
  await query('DELETE FROM users WHERE email LIKE $1', [`${TAG}%`]);
  await query(`DELETE FROM workout_videos WHERE category_id IN (SELECT id FROM workout_categories WHERE name LIKE $1)`, [`${TAG}%`]);
  await query('DELETE FROM workout_categories WHERE name LIKE $1', [`${TAG}%`]);
  server.close();
  await closePool();
  console.log(`\n${passed} passed, ${failed} failed (temporary test data removed)`);
  process.exitCode = failed > 0 ? 1 : 0;
}
