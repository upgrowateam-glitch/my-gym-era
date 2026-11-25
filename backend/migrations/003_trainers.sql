-- Roles: admin, trainer, client ("User" in the app).
-- Each user (client) can be assigned to one trainer by an admin.

-- Assigned trainer (NULL = unassigned; the admin team coaches them).
ALTER TABLE users ADD COLUMN trainer_id TEXT REFERENCES users (id) ON DELETE SET NULL;
CREATE INDEX users_trainer_idx ON users (trainer_id);

-- Accounts created by an admin with a temporary password must set their own
-- password at first login.
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Chat messages can now also be sent by trainers.
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_role_check;
ALTER TABLE messages ADD CONSTRAINT messages_sender_role_check
  CHECK (sender_role IN ('client', 'trainer', 'admin'));

-- Note: chats.unread_admin_count now means "unread by the coaching staff"
-- (the user's trainer or any admin).
