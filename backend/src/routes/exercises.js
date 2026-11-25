// Exercise library (Firestore `exercises`). Everyone signed in can read;
// only admins can change it.
//
//   GET    /api/exercises                     { exercises: [...] }  newest first
//   GET    /api/exercises/:id
//   POST   /api/exercises         { exercise } (admin)
//   PUT    /api/exercises/:id     { exercise } (admin) replace
//   DELETE /api/exercises/:id                  (admin)
//   POST   /api/exercises/bulk    { exercises: [...] } (admin) insert/replace by id (library seeding)

import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { badRequest, notFound } from '../errors.js';
import * as v from '../validate.js';

export const exercisesRouter = Router();
exercisesRouter.use(requireAuth);

const COLUMNS = `id, name, body_part, category, sub_category, image_url, target_weight,
  target_reps, instructions, setup, execution, tips, mistakes, primary_muscles,
  secondary_muscles, workout_tool, enabled_metrics, preset_sets, created_at, updated_at`;

const toExercise = (r) => ({
  id: r.id,
  name: r.name,
  bodyPart: r.body_part,
  category: r.category,
  subCategory: r.sub_category,
  imageUrl: r.image_url,
  targetWeight: r.target_weight,
  targetReps: r.target_reps,
  instructions: r.instructions,
  setup: r.setup,
  execution: r.execution,
  tips: r.tips,
  mistakes: r.mistakes,
  primaryMuscles: r.primary_muscles,
  secondaryMuscles: r.secondary_muscles,
  workoutTool: r.workout_tool,
  enabledMetrics: r.enabled_metrics,
  presetSets: r.preset_sets,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Validates an exercise from the app; returns values in COLUMN order (minus id/timestamps). */
function readExercise(body) {
  const e = v.jsonObject(body, 'exercise');
  const text = (key, def = '', max = 500) => (e[key] === undefined ? def : v.string(e[key], key, { max }));
  const list = (key, def = []) => (e[key] === undefined ? def : v.stringArray(e[key], key));
  const presetSets = e.presetSets === undefined ? [] : e.presetSets;
  if (!Array.isArray(presetSets) || presetSets.some((s) => s === null || typeof s !== 'object' || Array.isArray(s))) {
    throw badRequest('presetSets must be a list of objects.', 'invalid_body');
  }
  return [
    v.string(e.name, 'name', { max: 200, allowEmpty: false }),
    text('bodyPart'),
    text('category', 'weight', 50),
    text('subCategory', '', 100),
    text('imageUrl', '', 2000),
    text('targetWeight', '0', 100),
    text('targetReps', '0', 100),
    text('instructions', '', 10000),
    list('setup'),
    list('execution'),
    list('tips'),
    list('mistakes'),
    list('primaryMuscles'),
    list('secondaryMuscles'),
    text('workoutTool', 'strength', 50),
    list('enabledMetrics', ['sets', 'reps', 'weight']),
    JSON.stringify(presetSets),
  ];
}

const VALUE_COLUMNS = `name, body_part, category, sub_category, image_url, target_weight,
  target_reps, instructions, setup, execution, tips, mistakes, primary_muscles,
  secondary_muscles, workout_tool, enabled_metrics, preset_sets`;
const PLACEHOLDERS = (offset) => Array.from({ length: 17 }, (_, i) => `$${i + 1 + offset}`).join(', ');
const UPDATE_SET = VALUE_COLUMNS.split(',').map((c) => c.trim()).map((c) => `${c} = EXCLUDED.${c}`).join(', ');

exercisesRouter.get('/', async (_req, res) => {
  const { rows } = await query(`SELECT ${COLUMNS} FROM exercises ORDER BY created_at DESC, name`);
  res.json({ exercises: rows.map(toExercise) });
});

exercisesRouter.get('/:id', async (req, res) => {
  const { rows } = await query(`SELECT ${COLUMNS} FROM exercises WHERE id = $1`, [req.params.id]);
  if (!rows[0]) throw notFound('Exercise not found.', 'exercise_not_found');
  res.json({ exercise: toExercise(rows[0]) });
});

exercisesRouter.post('/', requireRole('admin'), async (req, res) => {
  const values = readExercise(req.body?.exercise);
  const { rows } = await query(
    `INSERT INTO exercises (${VALUE_COLUMNS}) VALUES (${PLACEHOLDERS(0)}) RETURNING ${COLUMNS}`, values);
  res.status(201).json({ exercise: toExercise(rows[0]) });
});

exercisesRouter.post('/bulk', requireRole('admin'), async (req, res) => {
  const list = req.body?.exercises;
  if (!Array.isArray(list) || list.length === 0 || list.length > 1000) {
    throw badRequest('exercises must be a list of 1 to 1000 items.', 'invalid_body');
  }
  const prepared = list.map((e) => {
    const id = v.string(e?.id, 'id', { max: 128, allowEmpty: false });
    return [id, ...readExercise(e)];
  });
  await withTransaction(async (client) => {
    for (const values of prepared) {
      await client.query(
        `INSERT INTO exercises (id, ${VALUE_COLUMNS}) VALUES ($1, ${PLACEHOLDERS(1)})
         ON CONFLICT (id) DO UPDATE SET ${UPDATE_SET}`, values);
    }
  });
  res.json({ ok: true, count: prepared.length });
});

exercisesRouter.put('/:id', requireRole('admin'), async (req, res) => {
  const values = readExercise(req.body?.exercise);
  const sets = VALUE_COLUMNS.split(',').map((c, i) => `${c.trim()} = $${i + 1}`).join(', ');
  const { rows } = await query(
    `UPDATE exercises SET ${sets} WHERE id = $18 RETURNING ${COLUMNS}`, [...values, req.params.id]);
  if (!rows[0]) throw notFound('Exercise not found.', 'exercise_not_found');
  res.json({ exercise: toExercise(rows[0]) });
});

exercisesRouter.delete('/:id', requireRole('admin'), async (req, res) => {
  const { rowCount } = await query('DELETE FROM exercises WHERE id = $1', [req.params.id]);
  if (rowCount === 0) throw notFound('Exercise not found.', 'exercise_not_found');
  res.json({ ok: true });
});
