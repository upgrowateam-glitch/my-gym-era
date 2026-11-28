import express from 'express';
import cors from 'cors';
import { query } from './db.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { exercisesRouter } from './routes/exercises.js';
import { mediaRouter } from './routes/media.js';
import { feedbackRouter, brandingRouter } from './routes/misc.js';
import { adminRouter } from './routes/admin.js';
import { trainerRouter } from './routes/trainer.js';
import { invitationsRouter } from './routes/invitations.js';
import { chatsRouter } from './routes/chats.js';
import { uploadsRouter } from './routes/uploads.js';
import { libraryRouter, workoutsRouter } from './routes/workouts.js';
import { nutritionRouter } from './routes/nutrition.js';
import { config } from './config.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // Health check: confirms the server is up and the database is reachable.
  app.get('/api/health', async (_req, res) => {
    try {
      const { rows } = await query(
        `SELECT current_database() AS database,
                (SELECT count(*)::int FROM schema_migrations) AS migrations`,
      );
      res.json({ status: 'ok', database: rows[0].database, migrations: rows[0].migrations });
    } catch (err) {
      res.status(503).json({ status: 'error', database: 'unreachable', message: err.message });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/exercises', exercisesRouter);
  app.use('/api/media', mediaRouter);
  app.use('/api/feedback', feedbackRouter);
  app.use('/api/branding', brandingRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/trainer', trainerRouter);
  app.use('/api/invitations', invitationsRouter);
  app.use('/api/chats', chatsRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/library', libraryRouter);
  app.use('/api/workouts', workoutsRouter);
  app.use('/api/nutrition', nutritionRouter);

  // Uploaded files. Names are random UUIDs; dot-folders (the temp folder) are never served.
  app.use('/uploads', express.static(config.uploadDir, {
    index: false,
    dotfiles: 'ignore', // hidden folders answer 404, as if they did not exist
    fallthrough: false,
    setHeaders: (res) => {
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }));

  // Unknown routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler: known errors send their message; anything else is logged
  // and returned as a generic 500 (no stack traces or SQL in responses).
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON body', code: 'invalid_json' });
    }
    const status = err.status ?? 500;
    if (status >= 500) console.error(err);
    if (status === 404 && !err.expose) err = { message: 'Not found', expose: true };
    res.status(status).json({
      error: err.expose ? err.message : 'Internal server error',
      ...(err.expose && err.code ? { code: err.code } : {}),
      ...(err.expose && err.details ? { details: err.details } : {}),
    });
  });

  return app;
}
