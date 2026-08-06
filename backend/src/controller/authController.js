import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import { isImporterLike } from "../utils/roles.js";

function roleMissing(role) {
  return !String(role || "").trim();
}

export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCK_MINUTES = 30;
  try {
    const result = await pool.query(
      `SELECT u.user_id, u.full_name, u.password_hash, u.preferred_language, u.must_change_password, u.failed_login_attempts, u.locked_until, r.role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.role_id
       WHERE u.email = $1 AND u.status = 'active'`,
      [email]
    );
    if (result.rowCount === 0) return res.status(401).json({ message: "User not found" });
    const user = result.rows[0];
    const now = new Date();

    if (user.locked_until && new Date(user.locked_until) > now) {
      return res.status(423).json({
        message: "Account is locked. Try again later.",
        locked_until: user.locked_until,
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const nextAttempts = Number(user.failed_login_attempts || 0) + 1;
      if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
        await pool.query(
          `UPDATE users
           SET failed_login_attempts = 0,
               locked_until = now() + ($1::text || ' minutes')::interval
           WHERE user_id = $2`,
          [String(LOCK_MINUTES), user.user_id]
        );
        return res.status(423).json({
          message: `Account locked after ${MAX_LOGIN_ATTEMPTS} failed attempts. Try again in ${LOCK_MINUTES} minutes.`,
        });
      }

      await pool.query(
        "UPDATE users SET failed_login_attempts=$1 WHERE user_id=$2",
        [nextAttempts, user.user_id]
      );
      return res.status(401).json({ message: "Invalid password" });
    }

    await pool.query(
      "UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE user_id=$1",
      [user.user_id]
    );

    if (roleMissing(user.role_name)) {
      return res.status(403).json({
        message: "Account has no role assigned. Contact system administrator.",
      });
    }

    const token = jwt.sign(
      { id: user.user_id, role: user.role_name, name: user.full_name, email, preferred_language: user.preferred_language || "en" },
      env.jwtSecret,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      role: user.role_name,
      name: user.full_name,
      email,
      preferred_language: user.preferred_language || "en",
      must_change_password: !!user.must_change_password,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const registerUser = async (req, res) => {
  try {
    const { full_name, email, password } = req.body || {};
    if (!full_name || !email || !password) {
      return res.status(400).json({ message: "full_name, email, password are required" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }
    const requestedRole = String(req.body?.role || "").trim();
    const role = requestedRole || "Importer";
    if (role !== "Importer") {
      return res.status(403).json({
        message: "Self-registration is allowed only for Importer.",
      });
    }

    const roleRes = await pool.query("SELECT role_id, role_name FROM roles WHERE role_name=$1 LIMIT 1", [role]);
    if (roleRes.rowCount === 0) {
      return res.status(400).json({ message: `Unknown role: ${role}` });
    }
    const roleRow = roleRes.rows[0];

    const exists = await pool.query("SELECT 1 FROM users WHERE email=$1 LIMIT 1", [email]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);
    const created = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role_id, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING user_id, full_name, email`,
      [full_name, email, hash, roleRow.role_id]
    );
    const user = created.rows[0];

    const token = jwt.sign(
      { id: user.user_id, role: roleRow.role_name, name: user.full_name, email: user.email, preferred_language: "en" },
      env.jwtSecret,
      { expiresIn: "8h" }
    );

    res.status(201).json({
      token,
      role: roleRow.role_name,
      name: user.full_name,
      email: user.email,
      preferred_language: "en",
      message: "Registration successful",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const uq = await pool.query(
      `SELECT preferred_language FROM users WHERE user_id=$1 LIMIT 1`,
      [req.user.id]
    );
    const preferred_language = uq.rows?.[0]?.preferred_language || "en";
    const me = { id: req.user.id, role: req.user.role, name: req.user.name, email: req.user.email, preferred_language };
    let importer_id = null;
    if (isImporterLike(req.user.role) && req.user.email) {
      const r = await pool.query("SELECT importer_id FROM importers WHERE contact_email=$1 LIMIT 1", [req.user.email]);
      if (r.rowCount > 0) importer_id = r.rows[0].importer_id;
    }
    res.json({ ...me, importer_id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, email, preferred_language } = req.body || {};
    if (!full_name && !email && !preferred_language) return res.status(400).json({ message: "Nothing to update" });
    let normLang = null;
    if (preferred_language !== undefined) {
      normLang = String(preferred_language || "").trim().toLowerCase();
      if (!["en", "am"].includes(normLang)) {
        return res.status(400).json({ message: "preferred_language must be 'en' or 'am'" });
      }
    }

    if (email) {
      const exists = await pool.query("SELECT 1 FROM users WHERE email=$1 AND user_id<>$2", [email, userId]);
      if (exists.rowCount > 0) return res.status(409).json({ message: "Email already in use" });
    }

    const fields = [];
    const values = [];
    let idx = 1;
    if (full_name) {
      fields.push(`full_name = $${idx++}`);
      values.push(full_name);
    }
    if (email) {
      fields.push(`email = $${idx++}`);
      values.push(email);
    }
    if (normLang) {
      fields.push(`preferred_language = $${idx++}`);
      values.push(normLang);
    }
    values.push(userId);
    await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE user_id=$${idx}`, values);

    const r = await pool.query(
      `SELECT u.full_name, u.email, u.preferred_language, rr.role_name
       FROM users u
       LEFT JOIN roles rr ON u.role_id = rr.role_id
       WHERE u.user_id=$1`,
      [userId]
    );
    const row = r.rows[0];
    if (roleMissing(row?.role_name)) {
      return res.status(403).json({ message: "Account has no role assigned. Contact system administrator." });
    }

    const token = jwt.sign(
      { id: userId, role: row.role_name, name: row.full_name, email: row.email, preferred_language: row.preferred_language || "en" },
      env.jwtSecret,
      { expiresIn: "8h" }
    );
    res.json({ token, role: row.role_name, name: row.full_name, email: row.email, preferred_language: row.preferred_language || "en" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password, confirm_password } = req.body || {};
    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({ message: "current_password, new_password, confirm_password are required" });
    }
    if (new_password !== confirm_password) return res.status(400).json({ message: "New password and confirmation do not match" });

    const r = await pool.query("SELECT password_hash FROM users WHERE user_id=$1", [userId]);
    if (r.rowCount === 0) return res.status(404).json({ message: "User not found" });
    const ok = await bcrypt.compare(current_password, r.rows[0].password_hash);
    if (!ok) return res.status(401).json({ message: "Current password is incorrect" });

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query("UPDATE users SET password_hash=$1, must_change_password=false WHERE user_id=$2", [hash, userId]);
    res.json({ message: "Password changed", must_change_password: false });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
