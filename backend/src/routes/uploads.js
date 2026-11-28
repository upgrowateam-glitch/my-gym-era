// File uploads (replaces Cloudinary). Files are stored on this server under
// backend/uploads/ and served at /uploads/... with random, unguessable names
// (the same privacy model as the Cloudinary URLs used today).
//
//   POST /api/uploads/chat-image        (any signed-in user)  image, max 10 MB
//   POST /api/uploads/media?kind=media|exercises|workouts|foods  (admin)  video or image, max 200 MB
//
// Send as multipart/form-data with a single field named "file".
// Response: { url, type: 'image'|'video', size }
//
// The file type is detected from the file's actual bytes, not its name, so a
// renamed file (e.g. a script called photo.jpg) is rejected.

import express, { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, open, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { config } from '../config.js';
import { HttpError, badRequest } from '../errors.js';
import * as v from '../validate.js';

export const uploadsRouter = Router();
uploadsRouter.use(requireAuth);

const TMP_DIR = path.join(config.uploadDir, '.tmp'); // dot-folder: never served

/** Detects the real file type from its first bytes. */
function sniff(b) {
  const ascii = (start, end) => b.subarray(start, end).toString('latin1');
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', type: 'image' };
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', type: 'image' };
  if (ascii(0, 4) === 'GIF8') return { ext: 'gif', type: 'image' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { ext: 'webp', type: 'image' };
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    if (['heic', 'heix', 'mif1', 'msf1', 'heif'].includes(brand)) return { ext: 'heic', type: 'image' };
    if (brand === 'qt  ') return { ext: 'mov', type: 'video' };
    return { ext: 'mp4', type: 'video' };
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { ext: 'webm', type: 'video' };
  return null;
}

/** Multer middleware for one file, with friendly errors. */
function receiveFile(maxMb) {
  const handler = multer({ dest: TMP_DIR, limits: { fileSize: maxMb * 1024 * 1024, files: 1 } }).single('file');
  return (req, res, next) =>
    handler(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, `File is too large (max ${maxMb} MB).`, 'file_too_large'));
      next(badRequest(`Upload failed: ${err.message}`, 'upload_error'));
    });
}

/** Validates the received temp file and moves it into uploads/<folder>/<yyyy-mm>/. */
async function store(req, folder, allowedTypes) {
  if (!req.file) throw badRequest('Attach the file in a form field named "file".', 'no_file');
  return storeFile(req, req.file.path, req.file.size, folder, allowedTypes);
}

async function storeFile(req, tmpPath, size, folder, allowedTypes) {
  try {
    const fh = await open(tmpPath, 'r');
    const head = Buffer.alloc(16);
    await fh.read(head, 0, 16, 0);
    await fh.close();

    const detected = sniff(head);
    if (!detected || !allowedTypes.includes(detected.type)) {
      throw badRequest(`Unsupported file. Allowed: ${allowedTypes.join(' or ')}.`, 'unsupported_file');
    }

    const month = new Date().toISOString().slice(0, 7);
    const relDir = path.posix.join(folder, month);
    const fileName = `${randomUUID()}.${detected.ext}`;
    await mkdir(path.join(config.uploadDir, relDir), { recursive: true });
    await rename(tmpPath, path.join(config.uploadDir, relDir, fileName));

    const baseUrl = config.publicBaseUrl ?? `${req.protocol}://${req.get('host')}`;
    return { url: `${baseUrl}/uploads/${relDir}/${fileName}`, type: detected.type, size };
  } catch (err) {
    await unlink(tmpPath).catch(() => {});
    throw err;
  }
}

// Make sure the temp folder exists before multer writes into it.
uploadsRouter.use(async (_req, _res, next) => {
  await mkdir(TMP_DIR, { recursive: true });
  next();
});

uploadsRouter.post('/chat-image', receiveFile(10), async (req, res) => {
  res.status(201).json(await store(req, 'chat_images', ['image']));
});

const MEDIA_FOLDERS = { media: 'media_library', exercises: 'exercises', workouts: 'workout_videos', foods: 'foods' };
const readKind = (k) => (k === undefined ? 'media' : v.oneOf(k, 'kind', Object.keys(MEDIA_FOLDERS)));

uploadsRouter.post('/media', requireRole('admin'), receiveFile(200), async (req, res) => {
  res.status(201).json(await store(req, MEDIA_FOLDERS[readKind(req.query.kind)], ['video', 'image']));
});

// ── Uploads in pieces (large videos over slow phone connections) ────────────
// One big request can be cut off by the connection or a proxy timeout, so the
// app sends the file in small pieces, in order:
//   POST /api/uploads/chunked/start  { kind, size }   → { uploadId, chunkSize }
//   PUT  /api/uploads/chunked/:id?offset=<bytes so far>   body: the piece (application/octet-stream)
//   POST /api/uploads/chunked/:id/finish               → { url, type, size }  (checked like a normal upload)
// A piece that arrives twice (a retry) is ignored. Unfinished uploads are deleted after 2 hours.

const MEDIA_MAX = 200 * 1024 * 1024;
const CHUNK_SIZE = 4 * 1024 * 1024;
const sessions = new Map(); // uploadId → { userId, folder, path, size, received, touched }

setInterval(() => {
  const old = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, s] of sessions) {
    if (s.touched < old) { sessions.delete(id); void unlink(s.path).catch(() => {}); }
  }
}, 10 * 60 * 1000).unref();

function sessionFor(req) {
  const s = sessions.get(req.params.id);
  if (!s || s.userId !== req.user.id) throw new HttpError(404, 'Upload not found. Please start again.', 'upload_not_found');
  s.touched = Date.now();
  return s;
}

uploadsRouter.post('/chunked/start', requireRole('admin'), async (req, res) => {
  const kind = readKind(req.body?.kind);
  const size = v.number(req.body?.size, 'size', { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true });
  if (size > MEDIA_MAX) {
    throw new HttpError(413, `This file is ${Math.round(size / 1024 / 1024)} MB. The limit is 200 MB — trim the video or use a YouTube link.`, 'file_too_large');
  }
  const id = randomUUID();
  const tmp = path.join(TMP_DIR, `chunked-${id}`);
  await (await open(tmp, 'w')).close();
  sessions.set(id, { userId: req.user.id, folder: MEDIA_FOLDERS[kind], path: tmp, size, received: 0, touched: Date.now() });
  res.status(201).json({ uploadId: id, chunkSize: CHUNK_SIZE });
});

uploadsRouter.put('/chunked/:id', requireRole('admin'),
  express.raw({ type: 'application/octet-stream', limit: CHUNK_SIZE + 1024 * 1024 }),
  async (req, res) => {
    const s = sessionFor(req);
    const offset = v.number(Number(req.query.offset), 'offset', { min: 0, max: s.size, integer: true });
    const piece = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (offset + piece.length <= s.received) return res.json({ received: s.received }); // a repeated piece
    if (offset !== s.received) {
      throw new HttpError(409, 'Pieces arrived out of order.', 'wrong_offset');
    }
    if (s.received + piece.length > s.size) throw badRequest('More data than the file size.', 'too_much_data');
    await appendFile(s.path, piece);
    s.received += piece.length;
    res.json({ received: s.received });
  });

uploadsRouter.post('/chunked/:id/finish', requireRole('admin'), async (req, res) => {
  const s = sessionFor(req);
  if (s.received !== s.size) throw badRequest(`Upload not complete (${s.received} of ${s.size} bytes).`, 'upload_incomplete');
  sessions.delete(req.params.id);
  res.status(201).json(await storeFile(req, s.path, s.size, s.folder, ['video', 'image']));
});
