-- Phase 5: workout video library and workouts sent to users.
--
-- workout_categories  e.g. "Strength", "Cardio" (Super Admin / Admins manage)
-- workout_videos      one exercise video: uploaded file or YouTube link, with
--                     difficulty, duration and body parts
-- workouts            a session a trainer (or admin) sends to one user for a day
-- workout_items       the videos in that session, in order, each with its own
--                     note (e.g. "3 sets x 12 reps") and when the user finished it

CREATE TABLE workout_categories (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX workout_categories_name_idx ON workout_categories (lower(name));
CREATE TRIGGER workout_categories_updated_at BEFORE UPDATE ON workout_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE workout_videos (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  -- A category with videos cannot be deleted (the server says so first).
  category_id       TEXT NOT NULL REFERENCES workout_categories (id) ON DELETE RESTRICT,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  source            TEXT NOT NULL CHECK (source IN ('upload', 'youtube')),
  video_url         TEXT NOT NULL,
  thumbnail_url     TEXT,
  difficulty        TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  duration_minutes  INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 300),
  body_parts        TEXT[] NOT NULL DEFAULT '{}',
  equipment         TEXT NOT NULL DEFAULT '',
  created_by        TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX workout_videos_category_idx ON workout_videos (category_id);
CREATE TRIGGER workout_videos_updated_at BEFORE UPDATE ON workout_videos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE workouts (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- Who sent it (trainer, admin or super admin).
  sent_by       TEXT REFERENCES users (id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  workout_date  DATE NOT NULL,
  note          TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX workouts_user_date_idx ON workouts (user_id, workout_date DESC);
CREATE TRIGGER workouts_updated_at BEFORE UPDATE ON workouts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE workout_items (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workout_id    TEXT NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
  -- If the video is later deleted from the library, the item stays (with its
  -- saved title) so the user's history is not lost.
  video_id      TEXT REFERENCES workout_videos (id) ON DELETE SET NULL,
  video_title   TEXT NOT NULL,
  position      INTEGER NOT NULL,
  note          TEXT NOT NULL DEFAULT '',
  completed_at  TIMESTAMPTZ
);
CREATE INDEX workout_items_workout_idx ON workout_items (workout_id, position);
CREATE INDEX workout_items_video_idx ON workout_items (video_id);
