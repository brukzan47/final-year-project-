// backend/tests/jwt.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signToken, verifyToken } from '../src/utils/jwt.js';

test('sign and verify JWT token', async (t) => {
  const user = { id: '00000000-0000-0000-0000-000000000001', email: 'test@example.com' };
  const token = signToken(user, { expiresIn: '1h' });
  assert.ok(token, 'token should be returned');
  const payload = verifyToken(token);
  assert.equal(payload.sub, user.id);
  assert.equal(payload.email, user.email);
});
