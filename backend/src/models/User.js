import { pool } from "../config/db.js";
import bcrypt from "bcryptjs";

export const User = {
  async createTable() {
    const query = `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE TABLE IF NOT EXISTS users (
        user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(120) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role_id INT REFERENCES roles(role_id),
        preferred_language VARCHAR(8) DEFAULT 'en',
        must_change_password BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'active',
        failed_login_attempts INT DEFAULT 0,
        locked_until TIMESTAMPTZ NULL,
        created_at TIMESTAMP DEFAULT now()
      );
    `;
    await pool.query(query);
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(8) DEFAULT 'en';");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ NULL;");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_role_audit (
        audit_id BIGSERIAL PRIMARY KEY,
        target_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        actor_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
        old_role_id INT REFERENCES roles(role_id),
        new_role_id INT REFERENCES roles(role_id),
        note TEXT,
        changed_at TIMESTAMPTZ DEFAULT now()
      );
    `);
  },

  async create({ full_name, email, password, role_id, preferred_language = "en" }) {
    const hash = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO users (full_name, email, password_hash, role_id, preferred_language)
      VALUES ($1, $2, $3, $4, $5) RETURNING user_id, full_name, email, preferred_language;
    `;
    const values = [full_name, email, hash, role_id, preferred_language || "en"];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async findByEmail(email) {
    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1 AND status='active';",
      [email]
    );
    return result.rows[0];
  },

  async getAll({ missingRole = false } = {}) {
    const result = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, u.role_id, r.role_name, u.preferred_language, u.status, u.created_at
              , u.failed_login_attempts, u.locked_until
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.role_id
       WHERE ($1::boolean = false OR u.role_id IS NULL)
       ORDER BY u.created_at DESC`,
      [!!missingRole]
    );
    return result.rows;
  },
};
