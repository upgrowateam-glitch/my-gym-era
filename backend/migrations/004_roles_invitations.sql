-- Step 1: four roles (super_admin, admin, trainer, client = "User") and
-- invitations (Super Admin → Admin / Trainer, Admin → Trainer).

-- New role: super_admin.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('client', 'trainer', 'admin', 'super_admin'));

-- Contact number, admin access switches, and who manages a trainer.
ALTER TABLE users ADD COLUMN whatsapp TEXT;
-- Admin access switches: 'invite_trainers', 'manage_trainers', 'view_users'.
ALTER TABLE users ADD COLUMN permissions TEXT[] NOT NULL DEFAULT '{}';
-- The admin (or super admin) who invited this trainer.
ALTER TABLE users ADD COLUMN managed_by TEXT REFERENCES users (id) ON DELETE SET NULL;
CREATE INDEX users_managed_by_idx ON users (managed_by);

-- Accounts are now created through invitations (own password), so the
-- temporary-password flag from 003 is no longer needed.
ALTER TABLE users DROP COLUMN IF EXISTS must_change_password;

-- The existing admin account(s) become Super Admin.
UPDATE users SET role = 'super_admin' WHERE role = 'admin';

CREATE TABLE invitations (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  -- SHA-256 of the secret link code; the code itself is never stored.
  token_hash  TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'trainer')),
  name        TEXT NOT NULL,
  email       TEXT,
  whatsapp    TEXT,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  invited_by  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  used_by     TEXT REFERENCES users (id) ON DELETE SET NULL,
  revoked_at  TIMESTAMPTZ,
  CHECK (email IS NOT NULL OR whatsapp IS NOT NULL)
);
CREATE INDEX invitations_invited_by_idx ON invitations (invited_by, created_at DESC);
