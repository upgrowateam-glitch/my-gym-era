-- Phase 7: weekly plans, exercise details, meal timings and daily follow-up.
--
-- workout_items   + sets, reps (or a time in seconds for moves like a plank),
--                   rest between sets
-- weekly_plans    a trainer's weekly workout plan for one user: one week
--                   (Mon–Sun) that repeats for 1–12 weeks from a start date. The
--                   app creates each day's workout from it (workouts.weekly_plan_id).
-- nutrition_plans + meal_times: { "breakfast": "08:00", "lunch": "13:30", … }
-- meal_logs       which meals the user ticked as eaten on which day

ALTER TABLE workout_items
  ADD COLUMN sets INTEGER CHECK (sets BETWEEN 1 AND 20),
  ADD COLUMN reps INTEGER CHECK (reps BETWEEN 1 AND 200),
  ADD COLUMN duration_seconds INTEGER CHECK (duration_seconds BETWEEN 5 AND 3600),
  ADD COLUMN rest_seconds INTEGER CHECK (rest_seconds BETWEEN 0 AND 600);

CREATE TABLE weekly_plans (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  sent_by     TEXT REFERENCES users (id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  start_date  DATE NOT NULL,
  weeks       INTEGER NOT NULL CHECK (weeks BETWEEN 1 AND 12),
  note        TEXT NOT NULL DEFAULT '',
  -- The week as the trainer built it (to show and to start the next plan from):
  -- [{ weekday: 0-6 (Mon-Sun), rest, title, items: [{ videoId, title, sets, reps, durationSeconds, restSeconds, note }] }]
  days        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX weekly_plans_user_idx ON weekly_plans (user_id, created_at DESC);

-- Workouts made from a weekly plan point to it. If the plan is deleted, the
-- days already done stay in the user's history.
ALTER TABLE workouts ADD COLUMN weekly_plan_id TEXT REFERENCES weekly_plans (id) ON DELETE SET NULL;
CREATE INDEX workouts_weekly_plan_idx ON workouts (weekly_plan_id);

ALTER TABLE nutrition_plans ADD COLUMN meal_times JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE meal_logs (
  user_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  log_date  DATE NOT NULL,
  meal      TEXT NOT NULL CHECK (meal IN ('breakfast', 'mid_morning', 'lunch', 'pre_workout', 'post_workout', 'evening_snack', 'dinner')),
  done_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, log_date, meal)
);
