import jwt from 'jsonwebtoken';
import { config } from '../config.js';

/** Signed login token for a user. Contains only the user id and role. */
export function signToken(user) {
  return jwt.sign({ role: user.role }, config.jwt.secret, {
    subject: user.id,
    expiresIn: config.jwt.expiresIn,
    algorithm: 'HS256',
  });
}

/** Returns the token payload, or throws if it is invalid or expired. */
export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
}
