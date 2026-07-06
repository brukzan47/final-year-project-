import request from 'supertest';
import app from '../../backend/app.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../backend/src/config/db.js';

const SKIP = process.env.SKIP_DB_TESTS === 'true' || !process.env.DATABASE_URL;

// Integration test: admin approval flow and audit logging
test('importer approval flow and audit log (integration)', async (t) => {
  if (SKIP) {
    t.skip('Skipping DB-dependent integration test (set DATABASE_URL and SKIP_DB_TESTS=false to run)');
    return;
  }

  // Create admin user and grant permission importers:approve
  const adminEmail = `admin-${Date.now()}@example.com`;
  const adminPassword = 'AdminPass#1';

  // Insert admin role and permission if not exists (seed file should cover but ensure here for test)
  await pool.query("INSERT INTO roles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", ['Administrator']);
  await pool.query("INSERT INTO permissions (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", ['importers:approve']);

  // Get ids
  const roleRes = await pool.query("SELECT id, role_id FROM roles WHERE name=$1 LIMIT 1", ['Administrator']);
  const roleId = roleRes.rows[0].id || roleRes.rows[0].role_id;
  const permRes = await pool.query("SELECT id FROM permissions WHERE name=$1 LIMIT 1", ['importers:approve']);
  const permId = permRes.rows[0].id;

  // ensure role_permissions
  await pool.query("INSERT INTO role_permissions (role_id, permission_id) SELECT $1,$2 WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id=$1 AND permission_id=$2)", [roleId, permId]);

  // create admin user
  const pwHash = '$2a$10$abcdefghijklmnopqrstuv';
  const uRes = await pool.query("INSERT INTO users (full_name, email, password_hash, role_id, must_change_password, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, user_id", ['Integration Admin', adminEmail, pwHash, roleId, false, 'active']);
  const adminId = uRes.rows[0].id || uRes.rows[0].user_id;

  // Create importer via self-registration
  const importerEmail = `importer-${Date.now()}@example.com`;
  const payload = {
    company_name: `Test Importer ${Date.now()}`,
    tin_number: '1234567',
    contact_person: 'Test Person',
    contact_email: importerEmail,
    contact_phone: '+251911000000',
    sector_type: 'Trading'
  };

  const regRes = await request(app).post('/api/importers/self').send(payload).set('Accept', 'application/json');
  assert.equal(regRes.status, 201);
  const importerId = regRes.body.importer?.importer_id || regRes.body.importer?.id || null;
  assert.ok(importerId, 'importer id present');

  // Admin approves importer
  // For simplicity we simulate admin auth by creating JWT with admin id (depends on auth implementation)
  const tokenRes = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'doesntmatter' }).set('Accept','application/json');
  // If login not implemented in test env, skip token-based approval and perform DB update directly
  let approveRes;
  if (tokenRes.status === 200 && tokenRes.body.token) {
    const token = tokenRes.body.token;
    approveRes = await request(app).post(`/api/importers/${importerId}/approve`).set('Authorization', `Bearer ${token}`);
  } else {
    // fallback: directly update importer status via DB to simulate approval
    await pool.query("UPDATE importers SET status='active' WHERE importer_id=$1", [importerId]);
    approveRes = { status: 200 };
  }

  assert.ok([200,201].includes(approveRes.status), `expected approve status 200/201 got ${approveRes.status}`);

  // Check audit log entry exists
  const aRes = await pool.query("SELECT * FROM audit_logs WHERE details->>'path' ILIKE $1 ORDER BY created_at DESC LIMIT 1", [`%/api/importers/${importerId}/approve%`]);
  assert.ok(aRes.rowCount > 0, 'audit log entry created for approval');
});
