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

import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
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
  const tmpPath = req.file.path;
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
    return { url: `${baseUrl}/uploads/${relDir}/${fileName}`, type: detected.type, size: req.file.size };
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

uploadsRouter.post('/media', requireRole('admin'), receiveFile(200), async (req, res) => {
  const kind = req.query.kind === undefined ? 'media' : v.oneOf(req.query.kind, 'kind', ['media', 'exercises', 'workouts', 'foods']);
  const folder = { media: 'media_library', exercises: 'exercises', workouts: 'workout_videos', foods: 'foods' }[kind];
  res.status(201).json(await store(req, folder, ['video', 'image']));
});
