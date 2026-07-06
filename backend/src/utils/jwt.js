// backend/src/utils/jwt.js
import jwt from 'jsonwebtoken';

export function signToken(user, options = {}) {
  const payload = { sub: user.id, email: user.email };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', { expiresIn: process.env.JWT_EXPIRES_IN || '1h', ...options });
  return token;
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
}
