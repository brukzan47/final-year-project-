import { Importer } from "../models/Importer.js";
import { pool } from "../config/db.js";
import bcrypt from "bcryptjs";

export const getImporters = async (req, res) => {
  try {
    const data = await Importer.getAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createImporter = async (req, res) => {
  try {
    const payload = { ...req.body };
    const requesterRole = String(req.user?.role || "").trim();
    const requesterEmail = String(req.user?.email || "").trim().toLowerCase();

    // Importer users can only register their own profile using their login email.
    if (requesterRole === "Importer" && requesterEmail) {
      payload.contact_email = requesterEmail;
    }

    const normalizedContactEmail = String(payload.contact_email || "").trim().toLowerCase();

    // Only one Economic Operator profile per contact email.
    if (normalizedContactEmail) {
      const existingByEmail = await pool.query(
        "SELECT importer_id FROM importers WHERE LOWER(contact_email)=LOWER($1) LIMIT 1",
        [normalizedContactEmail]
      );
      if (existingByEmail.rowCount > 0) {
        return res.status(409).json({
          message: "Economic Operator already registered for this email.",
          importer_id: existingByEmail.rows[0].importer_id,
        });
      }
      payload.contact_email = normalizedContactEmail;
    }

    // Auto-generate CRN if missing
    if (!payload.customs_registration_no) {
      const d = new Date();
      const y = d.getFullYear();
      let unique = null;
      for (let i = 0; i < 5; i++) {
        const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const candidate = `CRN-${y}-${rand}`;
        const exists = await pool.query('SELECT 1 FROM importers WHERE customs_registration_no=$1 LIMIT 1', [candidate]);
        if (exists.rowCount === 0) { unique = candidate; break; }
      }
      payload.customs_registration_no = unique || `CRN-${y}-${Math.floor(Math.random()*100000)}`;
    }
    const importer = await Importer.create(payload);

    // Auto-create login user for importer contact email when possible.
    const contactEmail = String(payload.contact_email || "").trim().toLowerCase();
    const requestedPassword = String(req.body?.login_password || "").trim();
    let autoUser = {
      attempted: false,
      created: false,
      email: contactEmail || null,
      temporary_password: null,
      message: null,
    };

    if (contactEmail) {
      autoUser.attempted = true;

      const roleRes = await pool.query(
        "SELECT role_id FROM roles WHERE role_name='Importer' LIMIT 1"
      );
      if (roleRes.rowCount === 0) {
        autoUser.message = "Importer role not found. Importer login user was not created.";
      } else {
        const exists = await pool.query("SELECT user_id FROM users WHERE email=$1 LIMIT 1", [contactEmail]);
        if (exists.rowCount > 0) {
          autoUser.message = "User with this contact_email already exists. Reusing existing login.";
        } else {
          const generatedPassword = requestedPassword || `Imp#${Math.random().toString(36).slice(-8)}A1`;
          const passwordHash = await bcrypt.hash(generatedPassword, 10);
          const fullName =
            String(payload.contact_person || "").trim() || String(payload.company_name || "").trim() || "Importer User";

          await pool.query(
            `INSERT INTO users (full_name, email, password_hash, role_id, must_change_password, status)
             VALUES ($1, $2, $3, $4, $5, 'active')`,
            [fullName, contactEmail, passwordHash, roleRes.rows[0].role_id, requestedPassword ? false : true]
          );

          autoUser.created = true;
          autoUser.temporary_password = requestedPassword ? null : generatedPassword;
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
