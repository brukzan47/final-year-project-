import { Importer } from "../models/Importer.js";
import { pool } from "../config/db.js";
import bcrypt from "bcryptjs";

// Helper to find role id by name (compat with different schemas)
async function getRoleIdByName(roleName) {
  const r = await pool.query("SELECT role_id, id FROM roles WHERE role_name=$1 OR name=$1 LIMIT 1", [roleName]);
  if (r.rowCount === 0) return null;
  const row = r.rows[0];
  return row.role_id || row.id;
}

export const getImporters = async (req, res) => {
  try {
    const data = await Importer.getAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin / Officer creates importer; importer user active immediately
export const createImporter = async (req, res) => {
  try {
    const payload = { ...req.body };

    // Create importer record (uses existing Importer model)
    const importer = await Importer.create(payload);

    // set resource id for audit
    res.locals.resourceId = importer.importer_id || importer.id || null;

    // If contact_email provided, attempt to create login user and activate immediately
    const contactEmail = String(payload.contact_email || "").trim().toLowerCase();
    const requestedPassword = String(req.body?.login_password || "").trim();
    const autoUser = { attempted: false, created: false, email: contactEmail || null, message: null };

    if (contactEmail) {
      autoUser.attempted = true;
      const roleId = await getRoleIdByName("Importer");
      if (!roleId) {
        autoUser.message = "Importer role not found. Importer login user was not created.";
      } else {
        const exists = await pool.query("SELECT user_id, id FROM users WHERE email=$1 LIMIT 1", [contactEmail]);
        if (exists.rowCount > 0) {
          autoUser.message = "User with this contact_email already exists. Reusing existing login.";
        } else {
          const generatedPassword = requestedPassword || `Imp#${Math.random().toString(36).slice(-8)}A1`;
          const passwordHash = await bcrypt.hash(generatedPassword, 10);
          const fullName = String(payload.contact_person || payload.company_name || "Importer User").trim();

          // Support both users table schemas (role_id int or role uuid in id)
          const roleCol = 'role_id';

          await pool.query(
            `INSERT INTO users (full_name, email, password_hash, ${roleCol}, must_change_password, status)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [fullName, contactEmail, passwordHash, roleId, requestedPassword ? false : true, 'active']
          );

          autoUser.created = true;
          autoUser.message = requestedPassword
            ? "Importer login user created with provided password."
            : "Importer login user created with generated temporary password.";
        }
      }
    }

    res.status(201).json({ ...importer, login_user: autoUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Self-registration endpoint for importers. Creates importer record with pending status and creates a user with pending/inactive status.
export const createImporterSelf = async (req, res) => {
  try {
    const payload = { ...req.body };

    // Enforce that self-registrations cannot set status directly
    payload.status = 'pending';

    // Create importer record
    const importer = await Importer.create(payload);

    // set resource id for audit
    res.locals.resourceId = importer.importer_id || importer.id || null;

    // Create user account if contact_email provided; mark as pending/inactive
    const contactEmail = String(payload.contact_email || "").trim().toLowerCase();
    const requestedPassword = String(req.body?.login_password || "").trim();
    const autoUser = { attempted: false, created: false, email: contactEmail || null, message: null };

    if (contactEmail) {
      autoUser.attempted = true;
      const roleId = await getRoleIdByName("Importer");
      const exists = await pool.query("SELECT user_id, id FROM users WHERE email=$1 LIMIT 1", [contactEmail]);
      if (exists.rowCount > 0) {
        autoUser.message = "User with this contact_email already exists. Importer created and linked to existing user.";
      } else {
        const generatedPassword = requestedPassword || `Imp#${Math.random().toString(36).slice(-8)}A1`;
        const passwordHash = await bcrypt.hash(generatedPassword, 10);
        const fullName = String(payload.contact_person || payload.company_name || "Importer User").trim();

        // Store user with status 'pending' (admin must approve)
        const roleCol = 'role_id';
        await pool.query(
          `INSERT INTO users (full_name, email, password_hash, ${roleCol}, must_change_password, status)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [fullName, contactEmail, passwordHash, roleId, requestedPassword ? false : true, 'pending']
        );

        autoUser.created = true;
        autoUser.message = "User created and awaiting admin approval.";
        autoUser.temporary_password = requestedPassword ? null : generatedPassword;
      }
    }

    res.status(201).json({ importer, login_user: autoUser, message: 'Registration received; admin approval required to activate account.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin approval endpoint
export const approveImporter = async (req, res) => {
  try {
    const importerId = req.params.id;
    // Find importer by importer_id or id
    const impRes = await pool.query('SELECT * FROM importers WHERE importer_id=$1 OR id::text=$1 LIMIT 1', [importerId]);
    if (impRes.rowCount === 0) return res.status(404).json({ message: 'Importer not found' });
    const importer = impRes.rows[0];

    // Update importer status to active
    await pool.query('UPDATE importers SET status=$1, updated_at=now() WHERE importer_id=$2 OR id::text=$2', ['active', importerId]);

    // Set resource id for audit
    res.locals.resourceId = importer.importer_id || importer.id || null;

    // Activate associated user(s) by contact_email if present
    if (importer.contact_email) {
      await pool.query("UPDATE users SET status='active', updated_at=now() WHERE LOWER(email)=LOWER($1)", [importer.contact_email]);
    }

    // Optionally create a notification for importer (placeholder)
    await pool.query(
      `INSERT INTO notifications (recipient_id, channel, title, body, metadata)
       SELECT u.user_id, 'in_app', 'Account approved', 'Your importer account has been approved by admin', jsonb_build_object('importer_id', $1)
       FROM users u WHERE LOWER(u.email)=LOWER($2) RETURNING id`,
      [res.locals.resourceId, importer.contact_email]
    ).catch(() => {});

    res.json({ message: 'Importer approved and user activated', importer_id: res.locals.resourceId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
