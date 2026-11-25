import bcrypt from 'bcryptjs';

const ROUNDS = 12;

/** Minimum password length. */
export const MIN_PASSWORD_LENGTH = 6;

export function hashPassword(plain) {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(plain, hash);
}

// Used when the email does not exist, so a failed login takes the same time
// either way (does not reveal which emails are registered).
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', ROUNDS);
export function burnTime(plain) {
  return bcrypt.compare(plain, DUMMY_HASH);
}
