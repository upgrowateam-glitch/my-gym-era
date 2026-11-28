// Frees disk space: removes uploaded library files (workout videos, their
// cover pictures, food photos) that nothing uses any more.
//
//  - removeIfUnused(url): after a video / food is deleted or its file replaced.
//  - sweepOrphans(): every 6 hours, files that were uploaded but never saved
//    (e.g. the form was closed) and are older than a day.
//
// Only files under uploads/workout_videos and uploads/foods are touched, and
// only when no workout video or food points to them. Starter food photos
// (backend/static) and chat images are never removed here.

import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { query } from './db.js';
import { config } from './config.js';

const FOLDERS = ['workout_videos', 'foods'];

/** "uploads/<folder>/<yyyy-mm>/<file>" relative path for an upload URL, or null. */
function relPathOf(url) {
  if (!url) return null;
  let pathname;
  try { pathname = new URL(url, 'http://x').pathname; } catch { return null; }
  const m = /^\/uploads\/((workout_videos|foods)\/\d{4}-\d{2}\/[A-Za-z0-9-]+\.[a-z0-9]+)$/.exec(pathname);
  return m ? m[1] : null;
}

async function inUse(rel) {
  const like = `%/uploads/${rel}`;
  const { rows } = await query(
    `SELECT EXISTS (SELECT 1 FROM workout_videos WHERE video_url LIKE $1 OR thumbnail_url LIKE $1)
         OR EXISTS (SELECT 1 FROM foods WHERE image_url LIKE $1) AS used`, [like]);
  return rows[0].used;
}

/** Deletes the uploaded file behind `url` if no video or food uses it. Never throws. */
export async function removeIfUnused(url) {
  try {
    const rel = relPathOf(url);
    if (!rel || await inUse(rel)) return false;
    await unlink(path.join(config.uploadDir, rel));
    return true;
  } catch {
    return false; // already gone, or not ours: nothing to do
  }
}

/** Removes library uploads older than `minAgeMs` that nothing uses. Returns how many. */
export async function sweepOrphans(minAgeMs = 24 * 60 * 60 * 1000) {
  let removed = 0;
  for (const folder of FOLDERS) {
    let months = [];
    try { months = await readdir(path.join(config.uploadDir, folder)); } catch { continue; }
    for (const month of months) {
      let files = [];
      try { files = await readdir(path.join(config.uploadDir, folder, month)); } catch { continue; }
      for (const f of files) {
        const rel = `${folder}/${month}/${f}`;
        try {
          const info = await stat(path.join(config.uploadDir, rel));
          if (!info.isFile() || Date.now() - info.mtimeMs < minAgeMs) continue;
          if (!relPathOf(`/uploads/${rel}`) || await inUse(rel)) continue;
          await unlink(path.join(config.uploadDir, rel));
          removed++;
        } catch { /* skip this file */ }
      }
    }
  }
  return removed;
}

/** Starts the regular clean-up (call once when the server starts). */
export function startUploadSweeper() {
  const run = () => sweepOrphans().then((n) => { if (n) console.log(`Removed ${n} unused upload(s).`); }).catch(() => {});
  setTimeout(run, 60 * 1000).unref();
  setInterval(run, 6 * 60 * 60 * 1000).unref();
}
