// backend/src/middleware/auth.js
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

export async function generateAccessToken(user) {
  const payload = { sub: user.id, email: user.email };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
  return token;
}

export async function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Missing authorization header' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // load user
    const result = await pool.query('SELECT id, username, email, is_active FROM users WHERE id = $1', [payload.sub]);
    if (!result.rowCount) return res.status(401).json({ message: 'Invalid token: user not found' });
    const user = result.rows[0];
    if (!user.is_active) return res.status(403).json({ message: 'Account not active' });
    // load permissions
    const perms = await pool.query(`
      SELECT p.name FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      JOIN user_roles ur ON ur.role_id = rp.role_id
      WHERE ur.user_id = $1
    `, [user.id]);
    user.permissions = perms.rows.map(r => r.name);
    // load roles
    const rolesRes = await pool.query(`
      SELECT r.name FROM roles r
      JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = $1
    `, [user.id]);
    user.roles = rolesRes.rows.map(r => r.name);
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token', error: err.message });
  }
}

export function requirePermission(permissionName) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Not authenticated' });
    if (user.permissions && user.permissions.includes(permissionName)) return next();
    return res.status(403).json({ message: 'Forbidden' });
  };
}

export function requireRole(roleName) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Not authenticated' });
    if (user.roles && user.roles.includes(roleName)) return next();
    return res.status(403).json({ message: 'Forbidden' });
  };
}
