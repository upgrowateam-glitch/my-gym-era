-- App-wide settings set by the Super Admin (e.g. the support WhatsApp number
-- shown to deactivated users on the sign-in page). One row per setting.
CREATE TABLE app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_by  TEXT REFERENCES users (id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
