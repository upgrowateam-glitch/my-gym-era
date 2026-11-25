// Smaller endpoints:
//
//   POST /api/feedback  { category, message, rating }    any signed-in user
//   GET  /api/feedback?limit=100                         (admin)
//
//   GET  /api/branding                                   public (needed before login for the theme)
//   PUT  /api/branding  { activeStyleId, customStyles }  (admin)

import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { badRequest } from '../errors.js';
import * as v from '../validate.js';

// ── Feedback (Firestore system_feedback) ────────────────────────────────────
export const feedbackRouter = Router();
feedbackRouter.use(requireAuth);

feedbackRouter.post('/', async (req, res) => {
  const category = v.string(req.body?.category, 'category', { max: 100, allowEmpty: false });
  const message = v.string(req.body?.message, 'message', { max: 5000, allowEmpty: false });
  const rating = v.number(req.body?.rating, 'rating', { min: 1, max: 5, integer: true });
  // Who sent it comes from the login, never from the request body.
  const { rows } = await query(
    `INSERT INTO feedback (user_id, email, display_name, category, message, rating)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
    [req.user.id, req.user.email, req.user.display_name, category, message, rating]);
  res.status(201).json({ id: rows[0].id, createdAt: rows[0].created_at });
});

feedbackRouter.get('/', requireRole('admin'), async (req, res) => {
  const limit = req.query.limit === undefined ? 100 : v.number(Number(req.query.limit), 'limit', { min: 1, max: 1000, integer: true });
  const { rows } = await query('SELECT * FROM feedback ORDER BY created_at DESC LIMIT $1', [limit]);
  res.json({
    feedback: rows.map((r) => ({
      id: r.id, uid: r.user_id, email: r.email, displayName: r.display_name, category: r.category,
      message: r.message, rating: r.rating, status: r.status, createdAt: r.created_at,
    })),
  });
});

// ── Branding (Firestore system_settings/active_branding) ────────────────────
export const brandingRouter = Router();

brandingRouter.get('/', async (_req, res) => {
  const { rows } = await query(`SELECT * FROM branding_settings WHERE id = 'active_branding'`);
  const r = rows[0];
  res.json({
    activeStyleId: r?.active_style_id ?? null,
    customStyles: r?.custom_styles ?? [],
    updatedAt: r?.updated_at ?? null,
  });
});

brandingRouter.put('/', requireAuth, requireRole('admin'), async (req, res) => {
  const activeStyleId = v.string(req.body?.activeStyleId, 'activeStyleId', { max: 200, allowEmpty: false });
  const customStyles = req.body?.customStyles;
  if (!Array.isArray(customStyles) || customStyles.length > 200 ||
      customStyles.some((s) => s === null || typeof s !== 'object' || Array.isArray(s))) {
    throw badRequest('customStyles must be a list of style objects.', 'invalid_body');
  }
  const { rows } = await query(
    `INSERT INTO branding_settings (id, active_style_id, custom_styles) VALUES ('active_branding', $1, $2)
     ON CONFLICT (id) DO UPDATE SET active_style_id = EXCLUDED.active_style_id, custom_styles = EXCLUDED.custom_styles
     RETURNING *`,
    [activeStyleId, JSON.stringify(customStyles)]);
  res.json({ activeStyleId: rows[0].active_style_id, customStyles: rows[0].custom_styles, updatedAt: rows[0].updated_at });
});
