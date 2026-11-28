// Phase 6: food & nutrition.
//
// Food list (staff only — Super Admin, Admins and Trainers can view; only Super
// Admin and Admins can change it). Values are for ONE serving.
//   GET    /api/nutrition/categories              { categories: [{ id, name, foodCount }] }
//   POST   /api/nutrition/categories   { name }   (admin)
//   PATCH  /api/nutrition/categories/:id { name } (admin)
//   DELETE /api/nutrition/categories/:id          (admin) only when it has no foods
//   GET    /api/nutrition/foods                   { foods }
//   POST   /api/nutrition/foods        { food }   (admin)
//   PUT    /api/nutrition/foods/:id    { food }   (admin)
//   DELETE /api/nutrition/foods/:id               (admin) plans already sent keep their copy
//
// Nutrition plans (the newest one is the user's current plan):
//   POST   /api/nutrition/plans  { userId, title, note, items: [{ foodId, meal, servings, note }] }
//          trainer → only their assigned users; Admin (with "View all users") / Super Admin → any user
//   GET    /api/nutrition/plans?userId=<id>|me   { current, history }  the user or staff who may see them
//   GET    /api/nutrition/plans/:id
//   DELETE /api/nutrition/plans/:id              staff who may see that user

import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../errors.js';
import { USER_COLUMNS, isStaffFor } from '../users/userModel.js';
import * as v from '../validate.js';
import { config } from '../config.js';
import { readFileSync } from 'node:fs';

// Starter food photos are stored as "/uploads/..." paths: add this server's address.
const baseOf = (req) => config.publicBaseUrl ?? `${req.protocol}://${req.get('host')}`;
const fullUrl = (url, base) => (url && url.startsWith('/') ? base + url : url);

export const MEALS = ['breakfast', 'mid_morning', 'lunch', 'pre_workout', 'post_workout', 'evening_snack', 'dinner'];
export const DIET_TYPES = ['vegan', 'veg', 'egg', 'non_veg'];

export const nutritionRouter = Router();
nutritionRouter.use(requireAuth);

const staffOnly = requireRole('admin', 'trainer');
const round1 = (n) => Math.round(n * 10) / 10;

// ── Photo credits ───────────────────────────────────────────────────────────
// The starter food photos are free-licensed; their licenses ask us to name the
// photographer. Anyone signed in can see this list.
const CREDITS = JSON.parse(readFileSync(new URL('../../static/starter-foods/credits.json', import.meta.url), 'utf8'));
nutritionRouter.get('/photo-credits', (_req, res) => {
  res.json({ credits: CREDITS.map(({ food, author, license, source }) => ({ food, author, license, source })) });
});

// ── Categories ──────────────────────────────────────────────────────────────

function categoryName(body) {
  const name = v.string(body?.name, 'Name', { max: 60, allowEmpty: false }).trim();
  if (!name) throw badRequest('Please enter a name.', 'invalid_name');
  return name;
}

async function saveCategory(sql, params) {
  try {
    return (await query(sql, params)).rows[0];
  } catch (e) {
    if (e.code === '23505') throw conflict('A category with this name already exists.', 'category_exists');
    throw e;
  }
}

nutritionRouter.get('/categories', staffOnly, async (_req, res) => {
  const { rows } = await query(
    `SELECT fc.id, fc.name, (SELECT count(*)::int FROM foods f WHERE f.category_id = fc.id) AS food_count
     FROM food_categories fc ORDER BY lower(fc.name)`);
  res.json({ categories: rows.map((r) => ({ id: r.id, name: r.name, foodCount: r.food_count })) });
});

nutritionRouter.post('/categories', requireRole('admin'), async (req, res) => {
  const row = await saveCategory('INSERT INTO food_categories (name) VALUES ($1) RETURNING id, name', [categoryName(req.body)]);
  res.status(201).json({ category: { ...row, foodCount: 0 } });
});

nutritionRouter.patch('/categories/:id', requireRole('admin'), async (req, res) => {
  const row = await saveCategory('UPDATE food_categories SET name = $2 WHERE id = $1 RETURNING id, name', [req.params.id, categoryName(req.body)]);
  if (!row) throw notFound('Category not found.', 'category_not_found');
  res.json({ category: row });
});

nutritionRouter.delete('/categories/:id', requireRole('admin'), async (req, res) => {
  const { rows } = await query('SELECT count(*)::int AS n FROM foods WHERE category_id = $1', [req.params.id]);
  if (rows[0].n > 0) {
    throw conflict(`This category still has ${rows[0].n} ${rows[0].n === 1 ? 'food' : 'foods'}. Move or delete them first.`, 'category_not_empty');
  }
  const { rowCount } = await query('DELETE FROM food_categories WHERE id = $1', [req.params.id]);
  if (!rowCount) throw notFound('Category not found.', 'category_not_found');
  res.json({ ok: true });
});

// ── Foods ───────────────────────────────────────────────────────────────────

const FOOD_SELECT = `SELECT f.id, f.category_id, fc.name AS category_name, f.name, f.serving_size, f.calories, f.protein_g,
  f.carbs_g, f.fat_g, f.diet_type, f.image_url, f.created_at, f.updated_at
  FROM foods f JOIN food_categories fc ON fc.id = f.category_id`;

const toFood = (r, base) => ({
  id: r.id,
  categoryId: r.category_id,
  categoryName: r.category_name,
  name: r.name,
  servingSize: r.serving_size,
  calories: Number(r.calories),
  protein: Number(r.protein_g),
  carbs: Number(r.carbs_g),
  fat: Number(r.fat_g),
  dietType: r.diet_type,
  imageUrl: fullUrl(r.image_url, base),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

async function loadFood(id, base) {
  const { rows } = await query(`${FOOD_SELECT} WHERE f.id = $1`, [id]);
  if (!rows[0]) throw notFound('Food not found.', 'food_not_found');
  return toFood(rows[0], base);
}

async function readFood(body) {
  const b = v.jsonObject(body, 'food');
  const name = v.string(b.name, 'Name', { max: 100, allowEmpty: false }).trim();
  if (!name) throw badRequest('Please enter a name.', 'invalid_name');
  const servingSize = v.string(b.servingSize, 'Serving size', { max: 60, allowEmpty: false }).trim();
  if (!servingSize) throw badRequest('Please enter the serving size, e.g. "1 cup (150 g)".', 'invalid_serving');
  const categoryId = v.string(b.categoryId, 'Category', { max: 128, allowEmpty: false });
  if (!(await query('SELECT 1 FROM food_categories WHERE id = $1', [categoryId])).rows[0]) {
    throw badRequest('Choose a category.', 'invalid_category');
  }
  let imageUrl = null;
  if (b.imageUrl) {
    imageUrl = v.string(b.imageUrl, 'Photo', { max: 2000 });
    let u;
    try { u = new URL(imageUrl); } catch { throw badRequest('Photo must be an uploaded picture.', 'invalid_image'); }
    if (!u.pathname.startsWith('/uploads/')) throw badRequest('Photo must be an uploaded picture.', 'invalid_image');
  }
  return {
    name,
    servingSize,
    categoryId,
    calories: round1(v.number(b.calories, 'Calories', { min: 0, max: 5000 })),
    protein: round1(v.number(b.protein, 'Protein (g)', { min: 0, max: 500 })),
    carbs: round1(v.number(b.carbs, 'Carbohydrates (g)', { min: 0, max: 500 })),
    fat: round1(v.number(b.fat, 'Fat (g)', { min: 0, max: 500 })),
    dietType: b.dietType === undefined || b.dietType === null ? null : v.oneOf(b.dietType, 'dietType', DIET_TYPES),
    imageUrl,
  };
}

nutritionRouter.get('/foods', staffOnly, async (_req, res) => {
  const { rows } = await query(`${FOOD_SELECT} ORDER BY lower(fc.name), lower(f.name)`);
  const base = baseOf(_req);
  res.json({ foods: rows.map((r) => toFood(r, base)) });
});

nutritionRouter.get('/foods/:id', staffOnly, async (req, res) => {
  res.json({ food: await loadFood(req.params.id, baseOf(req)) });
});

nutritionRouter.post('/foods', requireRole('admin'), async (req, res) => {
  const x = await readFood(req.body?.food);
  const { rows } = await query(
    `INSERT INTO foods (category_id, name, serving_size, calories, protein_g, carbs_g, fat_g, diet_type, image_url, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [x.categoryId, x.name, x.servingSize, x.calories, x.protein, x.carbs, x.fat, x.dietType, x.imageUrl, req.user.id]);
  res.status(201).json({ food: await loadFood(rows[0].id, baseOf(req)) });
});

nutritionRouter.put('/foods/:id', requireRole('admin'), async (req, res) => {
  const x = await readFood(req.body?.food);
  const { rowCount } = await query(
    `UPDATE foods SET category_id = $2, name = $3, serving_size = $4, calories = $5, protein_g = $6, carbs_g = $7,
       fat_g = $8, diet_type = $9, image_url = $10 WHERE id = $1`,
    [req.params.id, x.categoryId, x.name, x.servingSize, x.calories, x.protein, x.carbs, x.fat, x.dietType, x.imageUrl]);
  if (!rowCount) throw notFound('Food not found.', 'food_not_found');
  res.json({ food: await loadFood(req.params.id, baseOf(req)) });
});

nutritionRouter.delete('/foods/:id', requireRole('admin'), async (req, res) => {
  const { rowCount } = await query('DELETE FROM foods WHERE id = $1', [req.params.id]);
  if (!rowCount) throw notFound('Food not found.', 'food_not_found');
  res.json({ ok: true });
});

// ── Plans ───────────────────────────────────────────────────────────────────

async function loadAccount(id) {
  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/** 'self' | 'staff', or throws if the signed-in person may not see this user's plans. */
async function accessTo(req, userId) {
  if (userId === req.user.id) {
    if (req.user.role !== 'client') throw badRequest('Only User accounts have nutrition plans.', 'not_a_user_account');
    return 'self';
  }
  if (req.user.role === 'client') throw forbidden();
  const target = await loadAccount(userId);
  if (!target || !isStaffFor(req.user, target)) throw forbidden();
  return 'staff';
}

const PLAN_SELECT = `
  SELECT p.id, p.user_id, p.title, p.note, p.created_at, p.sent_by, s.display_name AS sent_by_name,
         COALESCE(json_agg(json_build_object(
           'id', i.id, 'foodId', i.food_id, 'meal', i.meal, 'position', i.position, 'servings', i.servings, 'note', i.note,
           'name', i.food_name, 'servingSize', i.serving_size, 'calories', i.calories, 'protein', i.protein_g,
           'carbs', i.carbs_g, 'fat', i.fat_g, 'imageUrl', fd.image_url
         ) ORDER BY i.position) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
  FROM nutrition_plans p
  LEFT JOIN users s ON s.id = p.sent_by
  LEFT JOIN nutrition_plan_items i ON i.plan_id = p.id
  LEFT JOIN foods fd ON fd.id = i.food_id`;

function toPlan(r, base) {
  const items = r.items.map((i) => ({
    ...i, imageUrl: fullUrl(i.imageUrl, base), servings: Number(i.servings), calories: Number(i.calories), protein: Number(i.protein), carbs: Number(i.carbs), fat: Number(i.fat),
  }));
  const sum = (k) => round1(items.reduce((n, i) => n + i[k] * i.servings, 0));
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    note: r.note,
    sentBy: r.sent_by,
    sentByName: r.sent_by_name,
    createdAt: r.created_at,
    items,
    totals: { calories: Math.round(sum('calories')), protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat') },
  };
}

async function loadPlan(id, base) {
  const { rows } = await query(`${PLAN_SELECT} WHERE p.id = $1 GROUP BY p.id, s.display_name`, [id]);
  if (!rows[0]) throw notFound('Nutrition plan not found.', 'plan_not_found');
  return toPlan(rows[0], base);
}

nutritionRouter.get('/plans', async (req, res) => {
  const userId = req.query.userId === undefined || req.query.userId === 'me'
    ? req.user.id : v.string(req.query.userId, 'userId', { max: 128 });
  await accessTo(req, userId);
  const { rows } = await query(
    `${PLAN_SELECT} WHERE p.user_id = $1 GROUP BY p.id, s.display_name ORDER BY p.created_at DESC LIMIT 50`, [userId]);
  const base = baseOf(req);
  const plans = rows.map((r) => toPlan(r, base));
  res.json({ current: plans[0] ?? null, history: plans.slice(1) });
});

nutritionRouter.get('/plans/:id', async (req, res) => {
  const plan = await loadPlan(req.params.id, baseOf(req));
  await accessTo(req, plan.userId);
  res.json({ plan });
});

nutritionRouter.post('/plans', staffOnly, async (req, res) => {
  const b = v.jsonObject(req.body, 'body');
  const userId = v.string(b.userId, 'userId', { max: 128, allowEmpty: false });
  const target = await loadAccount(userId);
  if (!target || target.role !== 'client') throw badRequest('Choose a user.', 'invalid_user');
  if (!isStaffFor(req.user, target)) {
    throw forbidden(req.user.role === 'trainer' ? 'You can only send plans to your assigned users.' : undefined, 'not_your_user');
  }
  if (target.is_archived) throw badRequest('This user is deactivated.', 'user_archived');

  const title = v.string(b.title, 'Title', { max: 120, allowEmpty: false }).trim();
  if (!title) throw badRequest('Please enter a title.', 'invalid_title');
  const note = b.note === undefined || b.note === null ? '' : v.string(b.note, 'Note', { max: 1000 });
  if (!Array.isArray(b.items) || b.items.length === 0) throw badRequest('Add at least one food.', 'no_items');
  if (b.items.length > 60) throw badRequest('A plan can have up to 60 foods.', 'too_many_items');
  const items = b.items.map((it, i) => {
    v.jsonObject(it, `items[${i}]`);
    const servings = v.number(it.servings, 'Servings', { min: 0.25, max: 20 });
    if (Math.round(servings * 4) !== servings * 4) throw badRequest('Servings go in steps of 1/4 (0.25).', 'invalid_servings');
    return {
      foodId: v.string(it.foodId, 'foodId', { max: 128, allowEmpty: false }),
      meal: v.oneOf(it.meal, 'meal', MEALS),
      servings,
      note: it.note === undefined || it.note === null ? '' : v.string(it.note, 'Food note', { max: 200 }),
    };
  });
  const { rows: foodRows } = await query(
    'SELECT id, name, serving_size, calories, protein_g, carbs_g, fat_g FROM foods WHERE id = ANY($1)', [items.map((i) => i.foodId)]);
  const foods = new Map(foodRows.map((r) => [r.id, r]));
  if (items.some((i) => !foods.has(i.foodId))) throw badRequest('One of the foods no longer exists.', 'invalid_food');

  // Keep the meals in the usual order of the day.
  items.sort((a, z) => MEALS.indexOf(a.meal) - MEALS.indexOf(z.meal));
  const id = await withTransaction(async (client) => {
    const { rows } = await client.query(
      'INSERT INTO nutrition_plans (user_id, sent_by, title, note) VALUES ($1,$2,$3,$4) RETURNING id',
      [userId, req.user.id, title, note]);
    for (const [i, it] of items.entries()) {
      const f = foods.get(it.foodId);
      await client.query(
        `INSERT INTO nutrition_plan_items (plan_id, food_id, meal, position, servings, note, food_name, serving_size,
           calories, protein_g, carbs_g, fat_g) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [rows[0].id, f.id, it.meal, i, it.servings, it.note, f.name, f.serving_size, f.calories, f.protein_g, f.carbs_g, f.fat_g]);
    }
    return rows[0].id;
  });
  res.status(201).json({ plan: await loadPlan(id, baseOf(req)) });
});

nutritionRouter.delete('/plans/:id', staffOnly, async (req, res) => {
  const plan = await loadPlan(req.params.id);
  if ((await accessTo(req, plan.userId)) !== 'staff') throw forbidden();
  await query('DELETE FROM nutrition_plans WHERE id = $1', [plan.id]);
  res.json({ ok: true });
});
