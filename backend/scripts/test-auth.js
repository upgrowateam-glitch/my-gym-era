// End-to-end checks for the login API against the local database.
// Starts the API on a free port, runs the scenarios, and removes the temporary
// test accounts afterwards.
//
//   npm run test:auth

import { createApp } from '../src/app.js';
import { query, closePool } from '../src/db.js';
import { createTestUser, TEST_PASSWORD } from './lib/test-users.js';

const TAG = `autotest-${Date.now()}`;
const TEMP_EMAIL = `${TAG}-register@test.local`;
let base;
let passed = 0;
let failed = 0;

async function api(method, path, { body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

async function run() {
  console.log('Each role can log in');
  const users = {};
  for (const role of ['client', 'trainer', 'admin']) {
    users[role] = await createTestUser(TAG, role);
    const r = await api('POST', '/api/auth/login', { body: { email: users[role].email, password: TEST_PASSWORD } });
    check(`${role} can log in`, r.status === 200 && r.data?.user?.role === role && !!r.data?.token,
      JSON.stringify(r));
  }
  const client = users.client;
  const upper = await api('POST', '/api/auth/login', { body: { email: ` ${client.email.toUpperCase()} `, password: TEST_PASSWORD } });
  check('email is case-insensitive', upper.status === 200);

  console.log('Wrong credentials');
  const wrongPw = await api('POST', '/api/auth/login', { body: { email: client.email, password: 'nope123' } });
  check('wrong password → 401', wrongPw.status === 401);
  const noUser = await api('POST', '/api/auth/login', { body: { email: 'nobody@local.dev', password: 'nope123' } });
  check('unknown email → 401 with same message', noUser.status === 401 && noUser.data?.error === wrongPw.data?.error);
  const badEmail = await api('POST', '/api/auth/login', { body: { email: 'not-an-email', password: 'x' } });
  check('invalid email → 400', badEmail.status === 400);

  console.log('Session (/me)');
  const login = await api('POST', '/api/auth/login', { body: { email: client.email, password: TEST_PASSWORD } });
  const me = await api('GET', '/api/auth/me', { token: login.data.token });
  check('/me returns the user', me.status === 200 && me.data?.user?.email === client.email);
  const json = JSON.stringify(me.data);
  check('no password data is ever returned', !/password_hash|passwordHash/i.test(json));
  check('/me without token → 401', (await api('GET', '/api/auth/me')).status === 401);
  check('/me with fake token → 401', (await api('GET', '/api/auth/me', { token: 'abc.def.ghi' })).status === 401);

  console.log('Register');
  const reg = await api('POST', '/api/auth/register', {
    body: { email: TEMP_EMAIL, password: 'first123', displayName: 'Auto Test', role: 'admin' },
  });
  check('register → 201, always a client (role in request ignored)',
    reg.status === 201 && reg.data?.user?.role === 'client' && reg.data?.user?.profileCompleted === false,
    JSON.stringify(reg));
  const dup = await api('POST', '/api/auth/register', { body: { email: TEMP_EMAIL.toUpperCase(), password: 'first123' } });
  check('duplicate email → 409', dup.status === 409);
  const short = await api('POST', '/api/auth/register', { body: { email: `x${TEMP_EMAIL}`, password: '123' } });
  check('short password → 400', short.status === 400);

  console.log('Change password');
  const token = reg.data.token;
  const wrongCur = await api('POST', '/api/auth/change-password', {
    token, body: { currentPassword: 'wrong999', newPassword: 'second123' },
  });
  check('wrong current password → 401', wrongCur.status === 401);
  const changed = await api('POST', '/api/auth/change-password', {
    token, body: { currentPassword: 'first123', newPassword: 'second123' },
  });
  check('change password → 200', changed.status === 200);
  check('old password no longer works',
    (await api('POST', '/api/auth/login', { body: { email: TEMP_EMAIL, password: 'first123' } })).status === 401);
  check('new password works',
    (await api('POST', '/api/auth/login', { body: { email: TEMP_EMAIL, password: 'second123' } })).status === 200);

  console.log('Archived account');
  await query('UPDATE users SET is_archived = true WHERE lower(email) = $1', [TEMP_EMAIL]);
  const archLogin = await api('POST', '/api/auth/login', { body: { email: TEMP_EMAIL, password: 'second123' } });
  check('archived user cannot log in → 403', archLogin.status === 403 && archLogin.data?.code === 'account_archived');
  check('archived user\'s existing token is rejected → 403',
    (await api('GET', '/api/auth/me', { token })).status === 403);
}

const server = createApp().listen(0);
await new Promise((resolve) => server.once('listening', resolve));
base = `http://127.0.0.1:${server.address().port}`;

try {
  await run();
} catch (err) {
  failed++;
  console.error(`Test run crashed: ${err.message}`);
} finally {
  await query('DELETE FROM users WHERE email LIKE $1', [`${TAG}%`]);
  server.close();
  await closePool();
  console.log(`\n${passed} passed, ${failed} failed (temporary test account removed)`);
  process.exitCode = failed > 0 ? 1 : 0;
}
