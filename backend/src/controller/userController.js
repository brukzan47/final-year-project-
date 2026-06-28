import { pool } from "../config/db.js";
import { User } from "../models/User.js";
import bcrypt from "bcryptjs";
import { audit } from "../utils/audit.js";

export const getUsers = async (req, res) => {
  try {
    const missingRole = String(req.query?.missing_role || "").toLowerCase() === "true";
    const users = await User.getAll({ missingRole });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getUserDetails = async (req, res) => {
  try {
    const userId = req.params?.id;
    if (!userId) return res.status(400).json({ message: "user id is required" });

    const result = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, u.role_id, r.role_name,
              u.preferred_language, u.status, u.must_change_password,
              u.failed_login_attempts, u.locked_until, u.created_at
       FROM users u
       LEFT JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id = $1
       LIMIT 1`,
      [userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: "User not found" });
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getUserImporterRecord = async (req, res) => {
  try {
    const userId = req.params?.id;
    if (!userId) return res.status(400).json({ message: "user id is required" });

    const userRes = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, r.role_name
       FROM users u
       LEFT JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id=$1
       LIMIT 1`,
      [userId]
    );
    if (userRes.rowCount === 0) return res.status(404).json({ message: "User not found" });
    const user = userRes.rows[0];

    const importerRes = await pool.query(
      `SELECT *
       FROM importers
       WHERE LOWER(contact_email)=LOWER($1)
       ORDER BY created_at DESC
       LIMIT 1`,
      [String(user.email || "").trim()]
    );

    return res.json({
      user,
      importer_record: importerRes.rowCount ? importerRes.rows[0] : null,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getUserRoleAudit = async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query?.limit || 50), 200));
    const rows = (
      await pool.query(
        `SELECT a.audit_id, a.target_user_id, a.actor_user_id, a.note, a.changed_at,
                tu.full_name AS target_name, tu.email AS target_email,
                au.full_name AS actor_name, au.email AS actor_email,
                oldr.role_name AS old_role,
                newr.role_name AS new_role
         FROM user_role_audit a
         LEFT JOIN users tu ON tu.user_id = a.target_user_id
         LEFT JOIN users au ON au.user_id = a.actor_user_id
         LEFT JOIN roles oldr ON oldr.role_id = a.old_role_id
         LEFT JOIN roles newr ON newr.role_id = a.new_role_id
         ORDER BY a.changed_at DESC
         LIMIT $1`,
        [limit]
      )
    ).rows;

    return res.json({ total: rows.length, items: rows });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const { full_name, email, password, role } = req.body || {};
    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ message: "full_name, email, password, role are required" });
    }

    const actorRole = String(req.user?.role || "").trim();
    if (actorRole === "Customs Officer" && role !== "Importer") {
      return res.status(403).json({
        message: "Customs Officer can create only Importer accounts",
      });
    }

    const roleRes = await pool.query("SELECT role_id FROM roles WHERE role_name=$1", [role]);
    if (roleRes.rowCount === 0) {
      return res.status(400).json({ message: `Unknown role: ${role}` });
    }
    const role_id = roleRes.rows[0].role_id;

    const exists = await pool.query("SELECT 1 FROM users WHERE email=$1", [email]);
    if (exists.rowCount > 0) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const created = await User.create({ full_name, email, password, role_id });
    await audit(req, {
      action: "user_created",
      entityType: "user",
      entityId: created.user_id,
      after: { user_id: created.user_id, email: created.email, role },
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const userId = req.params?.id;
    const roleName = String(req.body?.role || "").trim();
    const note = String(req.body?.note || "").trim() || null;

    if (!userId) return res.status(400).json({ message: "user id is required" });
    if (!roleName) return res.status(400).json({ message: "role is required" });

    const roleRes = await pool.query("SELECT role_id FROM roles WHERE role_name=$1", [roleName]);
    if (roleRes.rowCount === 0) return res.status(400).json({ message: `Unknown role: ${roleName}` });
    const newRoleId = roleRes.rows[0].role_id;

    const userRes = await pool.query("SELECT user_id, role_id FROM users WHERE user_id=$1 LIMIT 1", [userId]);
    if (userRes.rowCount === 0) return res.status(404).json({ message: "User not found" });
    const oldRoleId = userRes.rows[0].role_id;

    await pool.query("UPDATE users SET role_id=$2 WHERE user_id=$1", [userId, newRoleId]);

    await pool.query(
      `INSERT INTO user_role_audit (target_user_id, actor_user_id, old_role_id, new_role_id, note)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        userId,
        req.user?.id || null,
        oldRoleId || null,
        newRoleId,
        note,
      ]
    );
    await audit(req, {
      action: "user_role_changed",
      entityType: "user",
      entityId: userId,
      reason: note,
      before: { role_id: oldRoleId || null },
      after: { role_id: newRoleId, role: roleName },
    });

    const updated = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, u.role_id, r.role_name, u.status, u.created_at
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id=$1`,
      [userId]
    );

    return res.json(updated.rows[0]);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const userId = req.params?.id;
    const status = String(req.body?.status || "").trim().toLowerCase();
    if (!userId) return res.status(400).json({ message: "user id is required" });
    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ message: "status must be active or inactive" });
    }

    const updated = await pool.query(
      `UPDATE users
       SET status=$2,
           failed_login_attempts=0,
           locked_until=NULL
       WHERE user_id=$1
       RETURNING user_id, full_name, email, status`,
      [userId, status]
    );
    if (updated.rowCount === 0) return res.status(404).json({ message: "User not found" });
    await audit(req, {
      action: "user_status_changed",
      entityType: "user",
      entityId: userId,
      after: { status },
    });
    return res.json(updated.rows[0]);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const adminResetUserPassword = async (req, res) => {
  try {
    const userId = req.params?.id;
    const newPassword = String(req.body?.new_password || "");
    if (!userId) return res.status(400).json({ message: "user id is required" });
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "new_password must be at least 8 characters" });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const updated = await pool.query(
      `UPDATE users
       SET password_hash=$2,
           must_change_password=true,
           failed_login_attempts=0,
           locked_until=NULL
       WHERE user_id=$1
       RETURNING user_id, full_name, email, must_change_password`,
      [userId, hash]
    );
    if (updated.rowCount === 0) return res.status(404).json({ message: "User not found" });
    await audit(req, {
      action: "user_password_reset",
      entityType: "user",
      entityId: userId,
      metadata: { must_change_password: true },
    });
    return res.json({ message: "Password reset successful", user: updated.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
