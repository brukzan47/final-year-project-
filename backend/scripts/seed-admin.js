import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';
import { Role } from '../src/models/Role.js';
import { User } from '../src/models/User.js';

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'MySecret123';
  const full_name = process.env.ADMIN_NAME || 'Admin User';

  console.log('Seeding admin user...');

  // Ensure tables and roles exist
  await Role.createTable();
  await User.createTable();
  await Role.seedDefaults();

  const roleRes = await pool.query('SELECT role_id FROM roles WHERE role_name=$1', ['Admin']);
  if (roleRes.rowCount === 0) throw new Error('Admin role missing');
  const role_id = roleRes.rows[0].role_id;

  const hash = await bcrypt.hash(password, 10);

  const upsert = await pool.query(
    `INSERT INTO users (full_name,email,password_hash,role_id,status)
     VALUES ($1,$2,$3,$4,'active')
     ON CONFLICT (email)
     DO UPDATE SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id, status='active'
     RETURNING user_id, full_name, email, role_id;`,
    [full_name, email, hash, role_id]
  );

  const user = upsert.rows[0];
  console.log('Admin seeded:', { email: user.email, id: user.user_id });
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

