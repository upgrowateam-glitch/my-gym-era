-- My Gym Era: initial PostgreSQL schema
-- Mirrors the Firestore structure used by the Flutter app.
--
-- IDs are TEXT; new rows get a random UUID as text.
-- (The Firebase password columns below were removed again in 002.)

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: keep updated_at current on every UPDATE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- users  ←  Firestore users/{uid}
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email                  TEXT NOT NULL,
  -- Our own login (bcrypt). NULL for users imported without a password yet.
  password_hash          TEXT,
  -- Firebase Auth password hash/salt, kept only so imported users can log in
  -- with their old password (Phase 7). Never sent to the app.
  firebase_password_hash TEXT,
  firebase_password_salt TEXT,
  auth_provider          TEXT NOT NULL DEFAULT 'password'
                         CHECK (auth_provider IN ('password', 'google', 'apple')),
  display_name           TEXT NOT NULL DEFAULT '',
  role                   TEXT NOT NULL DEFAULT 'client'
                         CHECK (role IN ('client', 'trainer', 'admin')),
  profile_completed      BOOLEAN NOT NULL DEFAULT false,
  is_archived            BOOLEAN NOT NULL DEFAULT false,
  status                 TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'pending', 'suspended')),
  subscription_plan      TEXT,
  discount_applied       NUMERIC(5, 2),
  avatar_url             TEXT,
  joined_date            TIMESTAMPTZ NOT NULL DEFAULT now(),
  workout_days_filled    INTEGER NOT NULL DEFAULT 0,
  nutrition_days_filled  INTEGER NOT NULL DEFAULT 0,
  -- Any Firestore fields that have no dedicated column (kept, not lost).
  extra                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));
CREATE INDEX users_role_idx ON users (role);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- users.testClients (admin → list of client uids)
CREATE TABLE admin_test_clients (
  admin_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  client_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_id, client_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- client_profiles  ←  users/{uid}/roadmap/current  (ClientProfile JSON,
-- including streak data). Stored as JSONB because the onboarding profile has
-- many optional fields that change often.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE client_profiles (
  user_id    TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER client_profiles_updated_at BEFORE UPDATE ON client_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- day_plans  ←  users/{uid}/roadmap/{yyyy-MM-dd}  (DayPlan JSON)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE day_plans (
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  plan_date  DATE NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, plan_date)
);
CREATE TRIGGER day_plans_updated_at BEFORE UPDATE ON day_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- weight_requests  ←  users/{uid}/weight_requests  (admin ad-hoc requests)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE weight_requests (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'completed')),
  weight       NUMERIC(6, 2),
  completed_at TIMESTAMPTZ
);
CREATE INDEX weight_requests_user_status_idx ON weight_requests (user_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- diary_weigh_ins  ←  users/{uid}/diary_weigh_ins  (weekly scheduled weigh-ins)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE diary_weigh_ins (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id        TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  scheduled_date TIMESTAMPTZ NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'completed')),
  weight         NUMERIC(6, 2),
  completed_at   TIMESTAMPTZ
);
CREATE INDEX diary_weigh_ins_user_date_idx ON diary_weigh_ins (user_id, scheduled_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- chats  ←  chats/{clientId}   (one conversation per client)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE chats (
  client_id           TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  client_name         TEXT NOT NULL DEFAULT '',
  last_message        TEXT NOT NULL DEFAULT '',
  last_message_time   TIMESTAMPTZ NOT NULL DEFAULT now(),
  unread_admin_count  INTEGER NOT NULL DEFAULT 0,
  unread_client_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX chats_last_message_time_idx ON chats (last_message_time DESC);

-- messages  ←  chats/{clientId}/messages
CREATE TABLE messages (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id   TEXT NOT NULL REFERENCES chats (client_id) ON DELETE CASCADE,
  sender_id   TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'admin')),
  text        TEXT NOT NULL DEFAULT '',
  image_url   TEXT,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_read     BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX messages_client_sent_idx ON messages (client_id, sent_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- exercises  ←  exercises
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE exercises (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name              TEXT NOT NULL,
  body_part         TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL DEFAULT 'weight',
  sub_category      TEXT NOT NULL DEFAULT '',
  image_url         TEXT NOT NULL DEFAULT '',
  target_weight     TEXT NOT NULL DEFAULT '0',
  target_reps       TEXT NOT NULL DEFAULT '0',
  instructions      TEXT NOT NULL DEFAULT '',
  setup             TEXT[] NOT NULL DEFAULT '{}',
  execution         TEXT[] NOT NULL DEFAULT '{}',
  tips              TEXT[] NOT NULL DEFAULT '{}',
  mistakes          TEXT[] NOT NULL DEFAULT '{}',
  primary_muscles   TEXT[] NOT NULL DEFAULT '{}',
  secondary_muscles TEXT[] NOT NULL DEFAULT '{}',
  workout_tool      TEXT NOT NULL DEFAULT 'strength',
  enabled_metrics   TEXT[] NOT NULL DEFAULT '{sets,reps,weight}',
  preset_sets       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX exercises_category_idx ON exercises (category);
CREATE TRIGGER exercises_updated_at BEFORE UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- media_items  ←  media_library  (folders + videos, nested via parent_id)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE media_items (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('folder', 'video')),
  parent_id  TEXT REFERENCES media_items (id) ON DELETE CASCADE,
  url        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX media_items_parent_idx ON media_items (parent_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- feedback  ←  system_feedback
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE feedback (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  -- No foreign key: Firestore allowed 'anonymous' and deleted users.
  user_id      TEXT,
  email        TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL,
  message      TEXT NOT NULL,
  rating       INTEGER CHECK (rating BETWEEN 1 AND 5),
  status       TEXT NOT NULL DEFAULT 'new',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX feedback_created_idx ON feedback (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- branding_settings  ←  system_settings/active_branding
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE branding_settings (
  id              TEXT PRIMARY KEY DEFAULT 'active_branding',
  active_style_id TEXT,
  custom_styles   JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER branding_settings_updated_at BEFORE UPDATE ON branding_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
