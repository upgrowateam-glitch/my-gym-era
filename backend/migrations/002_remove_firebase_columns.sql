-- The app no longer uses Firebase: remove the columns that held imported
-- Firebase Auth password hashes.
ALTER TABLE users DROP COLUMN IF EXISTS firebase_password_hash;
ALTER TABLE users DROP COLUMN IF EXISTS firebase_password_salt;
