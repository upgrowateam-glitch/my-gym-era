// Phase 5: workout video library + workouts sent to users.
//
// Library (staff only — Super Admin, Admins, Trainers can view; only Super Admin
// and Admins can change it):
//   GET    /api/library/categories                 { categories: [{ id, name, videoCount }] }
//   POST   /api/library/categories    { name }     (admin)
//   PATCH  /api/library/categories/:id { name }    (admin)
//   DELETE /api/library/categories/:id             (admin) only when it has no videos
//   GET    /api/library/videos                     { videos } (filter in the app)
//   GET    /api/library/videos/:id
//   POST   /api/library/videos        { video }    (admin)
//   PUT    /api/library/videos/:id    { video }    (admin)
//   DELETE /api/library/videos/:id                 (admin) sent workouts keep the item title
//
// Workouts (a session of several videos for one user on one day):
//   POST   /api/workouts  { userId, title, date, note, items: [{ videoId, note }] }
//          trainer → only their assigned users; Admin (with "View all users") / Super Admin → any user
//   GET    /api/workouts?userId=<id>|me   the user themself, or staff who may see that user
//   GET    /api/workouts/:id
//   DELETE /api/workouts/:id              staff who may see that user (cancel a workout)
//   PATCH  /api/workouts/:id/items/:itemId  { done }   only the user themself

import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../errors.js';
import { USER_COLUMNS, isStaffFor } from '../users/userModel.js';
import * as v from '../validate.js';
import { removeIfUnused } from '../uploadCleanup.js';

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
export const BODY_PARTS = [
  'full_body', 'chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'glutes', 'cardio', 'mobility',
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** YouTube video id from the usual link shapes, or null. */
export function youtubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else {
        const m = /^\/(embed|shorts|live|v)\/([^/?#]+)/.exec(u.pathname);
        if (m) id = m[2];
      }
    }
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

const VIDEO_COLUMNS = `wv.id, wv.category_id, wc.name AS category_name, wv.title, wv.description, wv.source,
  wv.video_url, wv.thumbnail_url, wv.difficulty, wv.duration_minutes, wv.body_parts, wv.equipment,
  wv.created_at, wv.updated_at`;
const VIDEO_FROM = 'FROM workout_videos wv JOIN workout_categories wc ON wc.id = wv.category_id';

const toVideo = (r) => ({
  id: r.id,
  categoryId: r.category_id,
  categoryName: r.category_name,
  title: r.title,
  description: r.description,
  source: r.source,
  videoUrl: r.video_url,
  thumbnailUrl: r.thumbnail_url,
  difficulty: r.difficulty,
  durationMinutes: r.duration_minutes,
  bodyParts: r.body_parts,
  equipment: r.equipment,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

function httpUrl(value, field) {
  const s = v.string(value, field, { max: 2000, allowEmpty: false });
  let u;
  try { u = new URL(s); } catch { throw badRequest(`${field} must be a web link.`, 'invalid_url'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw badRequest(`${field} must be a web link.`, 'invalid_url');
  return s;
}

/** Validates the video body from the app. */
async function readVideo(body) {
  const b = v.jsonObject(body, 'video');
  const title = v.string(b.title, 'Title', { max: 120, allowEmpty: false }).trim();
  if (!title) throw badRequest('Please enter a title.', 'invalid_title');
  const categoryId = v.string(b.categoryId, 'Category', { max: 128, allowEmpty: false });
  const { rows } = await query('SELECT 1 FROM workout_categories WHERE id = $1', [categoryId]);
  if (!rows[0]) throw badRequest('Choose a category.', 'invalid_category');

  const source = v.oneOf(b.source, 'source', ['upload', 'youtube']);
  let videoUrl = httpUrl(b.videoUrl, 'Video');
  let thumbnailUrl = b.thumbnailUrl ? httpUrl(b.thumbnailUrl, 'Cover image') : null;
  if (source === 'youtube') {
    const id = youtubeId(videoUrl);
    if (!id) throw badRequest('That is not a YouTube video link.', 'invalid_youtube');
    videoUrl = `https://www.youtube.com/watch?v=${id}`;
    thumbnailUrl = thumbnailUrl ?? `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  } else if (!new URL(videoUrl).pathname.startsWith('/uploads/')) {
    throw badRequest('Upload the video file first.', 'invalid_upload');
  }

  const bodyParts = [...new Set(v.stringArray(b.bodyParts ?? [], 'bodyParts', { maxItems: BODY_PARTS.length }))];
  for (const p of bodyParts) v.oneOf(p, 'bodyParts', BODY_PARTS);
  if (bodyParts.length === 0) throw badRequest('Choose at least one body part.', 'invalid_body_parts');

  return {
    title,
    categoryId,
    description: b.description === undefined || b.description === null ? '' : v.string(b.description, 'Description', { max: 2000 }),
    source,
    videoUrl,
    thumbnailUrl,
    difficulty: v.oneOf(b.difficulty, 'difficulty', DIFFICULTIES),
    durationMinutes: v.number(b.durationMinutes, 'Duration (minutes)', { min: 1, max: 300, integer: true }),
    bodyParts,
    equipment: b.equipment === undefined || b.equipment === null ? '' : v.string(b.equipment, 'Equipment', { max: 120 }),
  };
}

async function loadVideo(id) {
  const { rows } = await query(`SELECT ${VIDEO_COLUMNS} ${VIDEO_FROM} WHERE wv.id = $1`, [id]);
  if (!rows[0]) throw notFound('Video not found.', 'video_not_found');
  return toVideo(rows[0]);
}

// ── Library ─────────────────────────────────────────────────────────────────

export const libraryRouter = Router();
libraryRouter.use(requireAuth, requireRole('admin', 'trainer'));

libraryRouter.get('/categories', async (_req, res) => {
  const { rows } = await query(
    `SELECT wc.id, wc.name, (SELECT count(*)::int FROM workout_videos wv WHERE wv.category_id = wc.id) AS video_count
     FROM workout_categories wc ORDER BY lower(wc.name)`);
  res.json({ categories: rows.map((r) => ({ id: r.id, name: r.name, videoCount: r.video_count })) });
});

function categoryName(body) {
  const name = v.string(body?.name, 'Name', { max: 60, allowEmpty: false }).trim();
  if (!name) throw badRequest('Please enter a name.', 'invalid_name');
  return name;
}

async function saveCategory(sql, params) {
  try {
    const { rows } = await query(sql, params);
    return rows[0];
  } catch (e) {
    if (e.code === '23505') throw conflict('A category with this name already exists.', 'category_exists');
    throw e;
  }
}

libraryRouter.post('/categories', requireRole('admin'), async (req, res) => {
  const row = await saveCategory('INSERT INTO workout_categories (name) VALUES ($1) RETURNING id, name', [categoryName(req.body)]);
  res.status(201).json({ category: { ...row, videoCount: 0 } });
});

libraryRouter.patch('/categories/:id', requireRole('admin'), async (req, res) => {
  const row = await saveCategory('UPDATE workout_categories SET name = $2 WHERE id = $1 RETURNING id, name',
    [req.params.id, categoryName(req.body)]);
  if (!row) throw notFound('Category not found.', 'category_not_found');
  res.json({ category: row });
});

libraryRouter.delete('/categories/:id', requireRole('admin'), async (req, res) => {
  const { rows } = await query('SELECT count(*)::int AS n FROM workout_videos WHERE category_id = $1', [req.params.id]);
  if (rows[0].n > 0) {
    throw conflict(`This category still has ${rows[0].n} ${rows[0].n === 1 ? 'video' : 'videos'}. Move or delete them first.`, 'category_not_empty');
  }
  const { rowCount } = await query('DELETE FROM workout_categories WHERE id = $1', [req.params.id]);
  if (!rowCount) throw notFound('Category not found.', 'category_not_found');
  res.json({ ok: true });
});

libraryRouter.get('/videos', async (_req, res) => {
  const { rows } = await query(`SELECT ${VIDEO_COLUMNS} ${VIDEO_FROM} ORDER BY wv.created_at DESC`);
  res.json({ videos: rows.map(toVideo) });
});

libraryRouter.get('/videos/:id', async (req, res) => {
  res.json({ video: await loadVideo(req.params.id) });
});

libraryRouter.post('/videos', requireRole('admin'), async (req, res) => {
  const x = await readVideo(req.body?.video);
  const { rows } = await query(
    `INSERT INTO workout_videos (category_id, title, description, source, video_url, thumbnail_url, difficulty,
       duration_minutes, body_parts, equipment, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [x.categoryId, x.title, x.description, x.source, x.videoUrl, x.thumbnailUrl, x.difficulty, x.durationMinutes,
      x.bodyParts, x.equipment, req.user.id]);
  res.status(201).json({ video: await loadVideo(rows[0].id) });
});

libraryRouter.put('/videos/:id', requireRole('admin'), async (req, res) => {
  const x = await readVideo(req.body?.video);
  const { rows: before } = await query('SELECT video_url, thumbnail_url FROM workout_videos WHERE id = $1', [req.params.id]);
  const { rowCount } = await query(
    `UPDATE workout_videos SET category_id = $2, title = $3, description = $4, source = $5, video_url = $6,
       thumbnail_url = $7, difficulty = $8, duration_minutes = $9, body_parts = $10, equipment = $11
     WHERE id = $1`,
    [req.params.id, x.categoryId, x.title, x.description, x.source, x.videoUrl, x.thumbnailUrl, x.difficulty,
      x.durationMinutes, x.bodyParts, x.equipment]);
  if (!rowCount) throw notFound('Video not found.', 'video_not_found');
  // A replaced video file or cover picture: free its disk space.
  for (const old of [before[0]?.video_url, before[0]?.thumbnail_url]) await removeIfUnused(old);
  res.json({ video: await loadVideo(req.params.id) });
});

libraryRouter.delete('/videos/:id', requireRole('admin'), async (req, res) => {
  const { rows } = await query('DELETE FROM workout_videos WHERE id = $1 RETURNING video_url, thumbnail_url', [req.params.id]);
  if (!rows[0]) throw notFound('Video not found.', 'video_not_found');
  // Free the disk space of the uploaded video and its cover picture.
  for (const url of [rows[0].video_url, rows[0].thumbnail_url]) await removeIfUnused(url);
  res.json({ ok: true });
});

// ── Workouts ────────────────────────────────────────────────────────────────

export const workoutsRouter = Router();
workoutsRouter.use(requireAuth);

async function loadAccount(id) {
  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/** May the signed-in person see this user's workouts? ('self' | 'staff' | throws) */
async function accessTo(req, userId) {
  if (userId === req.user.id) {
    if (req.user.role !== 'client') throw badRequest('Only User accounts have workouts.', 'not_a_user_account');
    return 'self';
  }
  if (req.user.role === 'client') throw forbidden();
  const target = await loadAccount(userId);
  if (!target || !isStaffFor(req.user, target)) throw forbidden();
  return 'staff';
}

const WORKOUT_SELECT = `
  SELECT w.id, w.user_id, w.title, w.workout_date, w.note, w.created_at, w.sent_by,
         s.display_name AS sent_by_name, s.role AS sent_by_role,
         COALESCE(json_agg(json_build_object(
           'id', wi.id, 'videoId', wi.video_id, 'title', COALESCE(wv.title, wi.video_title), 'note', wi.note,
           'position', wi.position, 'completedAt', wi.completed_at,
           'video', CASE WHEN wv.id IS NULL THEN NULL ELSE json_build_object(
             'id', wv.id, 'source', wv.source, 'videoUrl', wv.video_url, 'thumbnailUrl', wv.thumbnail_url,
             'difficulty', wv.difficulty, 'durationMinutes', wv.duration_minutes, 'bodyParts', wv.body_parts,
             'equipment', wv.equipment, 'description', wv.description) END
         ) ORDER BY wi.position) FILTER (WHERE wi.id IS NOT NULL), '[]') AS items
  FROM workouts w
  LEFT JOIN users s ON s.id = w.sent_by
  LEFT JOIN workout_items wi ON wi.workout_id = w.id
  LEFT JOIN workout_videos wv ON wv.id = wi.video_id`;

const toWorkout = (r) => {
  const items = r.items;
  const done = items.filter((i) => i.completedAt).length;
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    date: typeof r.workout_date === 'string' ? r.workout_date : r.workout_date.toISOString().slice(0, 10),
    note: r.note,
    sentBy: r.sent_by,
    sentByName: r.sent_by_name,
    sentByRole: r.sent_by_role,
    createdAt: r.created_at,
    items,
    doneCount: done,
    completed: items.length > 0 && done === items.length,
  };
};

async function loadWorkout(id) {
  const { rows } = await query(`${WORKOUT_SELECT} WHERE w.id = $1 GROUP BY w.id, s.display_name, s.role`, [id]);
  if (!rows[0]) throw notFound('Workout not found.', 'workout_not_found');
  return toWorkout(rows[0]);
}

workoutsRouter.get('/', async (req, res) => {
  const userId = req.query.userId === undefined || req.query.userId === 'me'
    ? req.user.id : v.string(req.query.userId, 'userId', { max: 128 });
  await accessTo(req, userId);
  const { rows } = await query(
    `${WORKOUT_SELECT} WHERE w.user_id = $1 GROUP BY w.id, s.display_name, s.role
     ORDER BY w.workout_date DESC, w.created_at DESC LIMIT 200`, [userId]);
  res.json({ workouts: rows.map(toWorkout) });
});

workoutsRouter.get('/:id', async (req, res) => {
  const w = await loadWorkout(req.params.id);
  await accessTo(req, w.userId);
  res.json({ workout: w });
});

workoutsRouter.post('/', requireRole('admin', 'trainer'), async (req, res) => {
  const b = v.jsonObject(req.body, 'body');
  const userId = v.string(b.userId, 'userId', { max: 128, allowEmpty: false });
  const target = await loadAccount(userId);
  if (!target || target.role !== 'client') throw badRequest('Choose a user.', 'invalid_user');
  if (!isStaffFor(req.user, target)) {
    throw forbidden(req.user.role === 'trainer' ? 'You can only send workouts to your assigned users.' : undefined, 'not_your_user');
  }
  if (target.is_archived) throw badRequest('This user is deactivated.', 'user_archived');

  const title = v.string(b.title, 'Title', { max: 120, allowEmpty: false }).trim();
  if (!title) throw badRequest('Please enter a title.', 'invalid_title');
  const date = v.dateKey(b.date, 'Date');
  const note = b.note === undefined || b.note === null ? '' : v.string(b.note, 'Note', { max: 1000 });
  if (!Array.isArray(b.items) || b.items.length === 0) throw badRequest('Add at least one video.', 'no_items');
  if (b.items.length > 30) throw badRequest('A workout can have up to 30 videos.', 'too_many_items');
  const items = b.items.map((it, i) => {
    v.jsonObject(it, `items[${i}]`);
    return {
      videoId: v.string(it.videoId, 'videoId', { max: 128, allowEmpty: false }),
      note: it.note === undefined || it.note === null ? '' : v.string(it.note, 'Video note', { max: 300 }),
    };
  });
  const { rows: vids } = await query('SELECT id, title FROM workout_videos WHERE id = ANY($1)', [items.map((i) => i.videoId)]);
  const titles = new Map(vids.map((r) => [r.id, r.title]));
  if (items.some((i) => !titles.has(i.videoId))) throw badRequest('One of the videos no longer exists.', 'invalid_video');

  const id = await withTransaction(async (client) => {
    const { rows } = await client.query(
      'INSERT INTO workouts (user_id, sent_by, title, workout_date, note) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [userId, req.user.id, title, date, note]);
    for (const [i, it] of items.entries()) {
      await client.query(
        'INSERT INTO workout_items (workout_id, video_id, video_title, position, note) VALUES ($1,$2,$3,$4,$5)',
        [rows[0].id, it.videoId, titles.get(it.videoId), i, it.note]);
    }
    return rows[0].id;
  });
  res.status(201).json({ workout: await loadWorkout(id) });
});

workoutsRouter.delete('/:id', requireRole('admin', 'trainer'), async (req, res) => {
  const w = await loadWorkout(req.params.id);
  if ((await accessTo(req, w.userId)) !== 'staff') throw forbidden();
  await query('DELETE FROM workouts WHERE id = $1', [w.id]);
  res.json({ ok: true });
});

workoutsRouter.patch('/:id/items/:itemId', async (req, res) => {
  const w = await loadWorkout(req.params.id);
  if (w.userId !== req.user.id) throw forbidden('Only the user can mark their workout as done.', 'not_your_workout');
  const done = v.boolean(req.body?.done, 'done');
  const { rowCount } = await query(
    `UPDATE workout_items SET completed_at = CASE WHEN $3 THEN COALESCE(completed_at, now()) ELSE NULL END
     WHERE id = $1 AND workout_id = $2`, [req.params.itemId, w.id, done]);
  if (!rowCount) throw notFound('Item not found.', 'item_not_found');
  res.json({ workout: await loadWorkout(w.id) });
});
