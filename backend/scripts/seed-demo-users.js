import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';
import { Role } from '../src/models/Role.js';
import { User } from '../src/models/User.js';

async function upsertUser({ full_name, email, password, role_name }) {
  const role = await pool.query('SELECT role_id FROM roles WHERE role_name=$1', [role_name]);
  if (role.rowCount === 0) throw new Error(`Missing role: ${role_name}`);
  const role_id = role.rows[0].role_id;
  const hash = await bcrypt.hash(password, 10);
  const res = await pool.query(
    `INSERT INTO users (full_name,email,password_hash,role_id,status)
     VALUES ($1,$2,$3,$4,'active')
     ON CONFLICT (email)
     DO UPDATE SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id, status='active'
     RETURNING user_id, email, role_id;`,
    [full_name, email, hash, role_id]
  );
  return res.rows[0];
}

async function main() {
  // Ensure schema and default roles
  await Role.createTable();
  await User.createTable();
  await Role.seedDefaults();

  const users = [
    { full_name: 'System Admin', email: 'admin@customs.et', password: 'admin123', role_name: 'Admin' },
    { full_name: 'Customs Officer', email: 'officer@customs.et', password: 'officer123', role_name: 'Customs Officer' },
    { full_name: 'Finance Officer', email: 'finance@customs.et', password: 'finance123', role_name: 'Finance Officer' },
    { full_name: 'ABC Imports', email: 'importer@customs.et', password: 'importer123', role_name: 'Importer' },
  ];

  for (const u of users) {
    const saved = await upsertUser(u);
    console.log('Seeded user:', saved.email);
  }
}

main()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });
