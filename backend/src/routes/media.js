// Video library folders/videos (Firestore `media_library`). Everyone signed in
// can read; only admins can change it. File uploads come in Phase 4 — for now
// a video is saved with an existing URL.
//
//   GET    /api/media?parentId=<id>     items in a folder (no parentId = top level)
//   GET    /api/media?all=true          every item, in every folder
//   GET    /api/media/folders           all folders (for "move to" pickers)
//   POST   /api/media  { name, type: 'folder'|'video', parentId?, url? }   (admin)
//   PATCH  /api/media/:id  { name?, parentId? }   rename / move              (admin)
//   DELETE /api/media/:id                 deletes a folder and everything in it (admin)

import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { badRequest, notFound } from '../errors.js';
import * as v from '../validate.js';

export const mediaRouter = Router();
mediaRouter.use(requireAuth);

const toItem = (r) => ({
  id: r.id,
  name: r.name,
  type: r.type,
  parentId: r.parent_id,
  url: r.url,
  createdAt: r.created_at,
});

async function assertFolder(id) {
  const { rows } = await query(`SELECT type FROM media_items WHERE id = $1`, [id]);
  if (!rows[0]) throw notFound('Folder not found.', 'folder_not_found');
  if (rows[0].type !== 'folder') throw badRequest('parentId must be a folder.', 'not_a_folder');
}

mediaRouter.get('/', async (req, res) => {
  // ?all=true → every item in every folder (used to avoid duplicate videos).
  if (req.query.all === 'true') {
    const { rows } = await query('SELECT * FROM media_items ORDER BY created_at');
    return res.json({ items: rows.map(toItem) });
  }
  const parentId = req.query.parentId ? String(req.query.parentId) : null;
  const { rows } = await query(
    `SELECT * FROM media_items WHERE parent_id IS NOT DISTINCT FROM $1
     ORDER BY type = 'folder' DESC, name`, [parentId]);
  res.json({ items: rows.map(toItem) });
});

mediaRouter.get('/folders', async (_req, res) => {
  const { rows } = await query(`SELECT * FROM media_items WHERE type = 'folder' ORDER BY name`);
  res.json({ folders: rows.map(toItem) });
});

mediaRouter.post('/', requireRole('admin'), async (req, res) => {
  const name = v.string(req.body?.name, 'name', { max: 200, allowEmpty: false });
  const type = v.oneOf(req.body?.type, 'type', ['folder', 'video']);
  const parentId = req.body?.parentId ? v.string(req.body.parentId, 'parentId', { max: 128 }) : null;
  const url = type === 'video' ? v.string(req.body?.url, 'url', { max: 2000, allowEmpty: false }) : null;
  if (parentId) await assertFolder(parentId);

  const { rows } = await query(
    'INSERT INTO media_items (name, type, parent_id, url) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, type, parentId, url]);
  res.status(201).json({ item: toItem(rows[0]) });
});

mediaRouter.patch('/:id', requireRole('admin'), async (req, res) => {
  const sets = [];
  const params = [];
  if (req.body?.name !== undefined) {
    params.push(v.string(req.body.name, 'name', { max: 200, allowEmpty: false }));
    sets.push(`name = $${params.length}`);
  }
  if (req.body?.parentId !== undefined) {
    const parentId = req.body.parentId === null ? null : v.string(req.body.parentId, 'parentId', { max: 128 });
    if (parentId) {
      await assertFolder(parentId);
      // A folder cannot be moved into itself or one of its own sub-folders.
      const { rows } = await query(
        `WITH RECURSIVE ancestors AS (
           SELECT id, parent_id FROM media_items WHERE id = $1
           UNION ALL
           SELECT m.id, m.parent_id FROM media_items m JOIN ancestors a ON m.id = a.parent_id
         ) SELECT 1 FROM ancestors WHERE id = $2`, [parentId, req.params.id]);
      if (rows.length) throw badRequest('A folder cannot be moved inside itself.', 'invalid_move');
    }
    params.push(parentId);
    sets.push(`parent_id = $${params.length}`);
  }
  if (!sets.length) throw badRequest('Nothing to update.', 'empty_update');

  params.push(req.params.id);
  const { rows } = await query(
    `UPDATE media_items SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
  if (!rows[0]) throw notFound('Item not found.', 'media_not_found');
  res.json({ item: toItem(rows[0]) });
});

mediaRouter.delete('/:id', requireRole('admin'), async (req, res) => {
  const { rowCount } = await query('DELETE FROM media_items WHERE id = $1', [req.params.id]);
  if (rowCount === 0) throw notFound('Item not found.', 'media_not_found');
  res.json({ ok: true });
});
