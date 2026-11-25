// End-to-end checks for Step 1: four roles (Super Admin, Admin, Trainer,
// User), invitations, access switches and trainer privacy.
// Creates temporary accounts / invitations and removes them afterwards.
//
//   npm run test:roles

import { createApp } from '../src/app.js';
import { query, closePool } from '../src/db.js';
import { createTestUser, TEST_PASSWORD } from './lib/test-users.js';

const TAG = `autotest-${Date.now()}`;
const mail = (label) => `${TAG}-${label}@test.local`;
let base;
let passed = 0;
let failed = 0;

async function api(method, p, { body, token } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail !== undefined ? `  → ${JSON.stringify(detail)}` : ''}`);
  }
}

async function login(email, password = TEST_PASSWORD) {
  const r = await api('POST', '/api/auth/login', { body: { email, password } });
  return { status: r.status, id: r.data?.user?.uid, token: r.data?.token, user: r.data?.user, code: r.data?.code };
}

async function run() {
  const saAcc = await createTestUser(TAG, 'super_admin', { name: 'Test Super' });
  const sa = await login(saAcc.email);

  // ── Super Admin → Admin invitation ────────────────────────────────────────
  console.log('Super Admin invites an Admin');
  const adminInvite = await api('POST', '/api/invitations', {
    token: sa.token,
    body: {
      name: 'Anna Admin', email: mail('anna'), whatsapp: '+44 7700 900123', role: 'admin',
      permissions: ['invite_trainers', 'view_users'], expiresInDays: 3,
    },
  });
  check('invitation created with a link code', adminInvite.status === 201 && adminInvite.data.token?.length >= 40, adminInvite);
  const stored = await query('SELECT token_hash FROM invitations WHERE id = $1', [adminInvite.data.invitation.id]);
  check('only a scrambled copy of the link code is stored', stored.rows[0].token_hash !== adminInvite.data.token);
  check('WhatsApp number cleaned up', adminInvite.data.invitation.whatsapp === '+447700900123');
  const expiresInDays = (new Date(adminInvite.data.invitation.expiresAt) - Date.now()) / 86400000;
  check('expiry = the chosen 3 days', expiresInDays > 2.9 && expiresInDays <= 3.01, expiresInDays);

  const t1 = adminInvite.data.token;
  const info = await api('GET', `/api/invitations/token/${t1}`);
  check('anyone with the link sees the invitation details',
    info.status === 200 && info.data.invitation.role === 'admin' && info.data.invitation.invitedByName === 'Test Super', info);
  check('a made-up link → 404', (await api('GET', `/api/invitations/token/${'x'.repeat(43)}`)).status === 404);

  const wrongEmail = await api('POST', `/api/invitations/token/${t1}/accept`, {
    body: { name: 'Anna', email: mail('other'), password: 'anna-pass-1' },
  });
  check('email-bound invitation refuses a different email → 400', wrongEmail.status === 400 && wrongEmail.data.code === 'email_mismatch');
  const accepted = await api('POST', `/api/invitations/token/${t1}/accept`, {
    body: { name: 'Anna Admin', password: 'anna-pass-1', role: 'super_admin', permissions: ['manage_trainers'] },
  });
  check('accepting creates the account with the INVITATION\'s role (typed role ignored)',
    accepted.status === 201 && accepted.data.user.role === 'admin', accepted);
  check('access switches come from the invitation (typed ones ignored)',
    JSON.stringify(accepted.data.user.permissions) === JSON.stringify(['invite_trainers', 'view_users']), accepted.data?.user?.permissions);
  check('signed in straight away', !!accepted.data.token);
  check('a used invitation is refused → 410', (await api('POST', `/api/invitations/token/${t1}/accept`, {
    body: { name: 'X', password: 'xxxxxxx1' },
  })).data?.code === 'invitation_used');
  check('opening a used link → 410', (await api('GET', `/api/invitations/token/${t1}`)).status === 410);
  const admin = await login(mail('anna'), 'anna-pass-1');
  check('the new Admin can log in (role admin)', admin.status === 200 && admin.user.role === 'admin');

  // ── Admin → Trainer invitation ────────────────────────────────────────────
  console.log('Admin invites a Trainer');
  check('Admin cannot invite an Admin → 403', (await api('POST', '/api/invitations', {
    token: admin.token, body: { name: 'X', email: mail('x1'), role: 'admin', expiresInDays: 7 },
  })).status === 403);
  const trainerInvite = await api('POST', '/api/invitations', {
    token: admin.token, body: { name: 'Tom Trainer', whatsapp: '07700900456', role: 'trainer', expiresInDays: 7 },
  });
  check('Admin invites a Trainer (WhatsApp only, no email)', trainerInvite.status === 201 && trainerInvite.data.invitation.email === null, trainerInvite);
  const noEmail = await api('POST', `/api/invitations/token/${trainerInvite.data.token}/accept`, {
    body: { name: 'Tom', password: 'tom-pass-1' },
  });
  check('without an email on the invite, the person must type one → 400', noEmail.status === 400);
  const tomAcc = await api('POST', `/api/invitations/token/${trainerInvite.data.token}/accept`, {
    body: { name: 'Tom Trainer', email: mail('tom'), password: 'tom-pass-1', role: 'admin' },
  });
  check('trainer account created with role trainer', tomAcc.status === 201 && tomAcc.data.user.role === 'trainer', tomAcc);
  check('trainer is managed by the inviting Admin', tomAcc.data?.user?.managedBy === admin.id);
  const tom = await login(mail('tom'), 'tom-pass-1');

  console.log('Invitation rules');
  check('needs an email or a WhatsApp number → 400', (await api('POST', '/api/invitations', {
    token: sa.token, body: { name: 'X', role: 'trainer', expiresInDays: 7 },
  })).data?.code === 'contact_required');
  check('expiry must be 1, 3, 7 or 14 days → 400', (await api('POST', '/api/invitations', {
    token: sa.token, body: { name: 'X', email: mail('x2'), role: 'trainer', expiresInDays: 5 },
  })).data?.code === 'invalid_expiry');
  check('invalid WhatsApp number → 400', (await api('POST', '/api/invitations', {
    token: sa.token, body: { name: 'X', whatsapp: 'abc', role: 'trainer' },
  })).data?.code === 'invalid_whatsapp');
  check('email already has an account → 409', (await api('POST', '/api/invitations', {
    token: sa.token, body: { name: 'X', email: mail('tom'), role: 'trainer' },
  })).status === 409);
  check('cannot invite a User or Super Admin role → 400', (await api('POST', '/api/invitations', {
    token: sa.token, body: { name: 'X', email: mail('x3'), role: 'super_admin' },
  })).status === 400);

  const expiring = await api('POST', '/api/invitations', {
    token: sa.token, body: { name: 'Late', email: mail('late'), role: 'trainer', expiresInDays: 1 },
  });
  await query(`UPDATE invitations SET expires_at = now() - interval '1 minute' WHERE id = $1`, [expiring.data.invitation.id]);
  check('expired link → 410 when opened', (await api('GET', `/api/invitations/token/${expiring.data.token}`)).data?.code === 'invitation_expired');
  check('expired link → 410 when accepted', (await api('POST', `/api/invitations/token/${expiring.data.token}/accept`, {
    body: { name: 'Late', password: 'late-pass-1' },
  })).data?.code === 'invitation_expired');
  const renewed = await api('POST', `/api/invitations/${expiring.data.invitation.id}/renew`, { token: sa.token, body: { expiresInDays: 7 } });
  check('renewing gives a new working link', renewed.status === 200 && renewed.data.invitation.status === 'pending'
    && (await api('GET', `/api/invitations/token/${renewed.data.token}`)).status === 200, renewed);
  check('…and the old link stops working', (await api('GET', `/api/invitations/token/${expiring.data.token}`)).status === 404);

  const toRevoke = await api('POST', '/api/invitations', {
    token: admin.token, body: { name: 'Gone', email: mail('gone'), role: 'trainer', expiresInDays: 7 },
  });
  const revoked = await api('POST', `/api/invitations/${toRevoke.data.invitation.id}/revoke`, { token: admin.token });
  check('inviter can revoke', revoked.data?.invitation?.status === 'revoked', revoked);
  check('revoked link → 410', (await api('GET', `/api/invitations/token/${toRevoke.data.token}`)).data?.code === 'invitation_revoked');

  const adminList = await api('GET', '/api/invitations', { token: admin.token });
  check('Admin sees only their own invitations',
    adminList.data?.invitations?.length === 2 && adminList.data.invitations.every((i) => i.invitedBy === admin.id), adminList.data?.invitations?.length);
  const saList = await api('GET', '/api/invitations', { token: sa.token });
  check('Super Admin sees all invitations (incl. the Admin\'s)',
    saList.data?.invitations?.some((i) => i.id === toRevoke.data.invitation.id));
  const saInviteId = adminInvite.data.invitation.id;
  check('Admin cannot touch the Super Admin\'s invitations → 404',
    (await api('POST', `/api/invitations/${saInviteId}/revoke`, { token: admin.token })).status === 404);

  // ── Access switches ───────────────────────────────────────────────────────
  console.log('Admin access switches');
  const noInviteAdmin = await createTestUser(TAG, 'admin', { permissions: ['view_users'] });
  const nia = await login(noInviteAdmin.email);
  check('Admin without "invite trainers" cannot invite → 403', (await api('POST', '/api/invitations', {
    token: nia.token, body: { name: 'X', email: mail('x4'), role: 'trainer' },
  })).data?.code === 'no_permission');

  const userAcc = await api('POST', '/api/auth/register', {
    body: { email: mail('user'), password: 'user-pass-1', displayName: 'Uma User', role: 'admin' },
  });
  check('self-registration always creates a User', userAcc.status === 201 && userAcc.data.user.role === 'client');
  const user = { id: userAcc.data.user.uid, token: userAcc.data.token };

  const blindAdmin = await createTestUser(TAG, 'admin', { permissions: ['invite_trainers'] });
  const ba = await login(blindAdmin.email);
  const blindList = await api('GET', '/api/users?role=client', { token: ba.token });
  check('Admin without "view users" sees no users', blindList.status === 200 && !blindList.data.users.some((u) => u.uid === user.id));
  check('…and cannot open a user → 403', (await api('GET', `/api/users/${user.id}`, { token: ba.token })).status === 403);
  const seeingList = await api('GET', '/api/users?role=client', { token: admin.token });
  check('Admin with "view users" sees all users (one gym)', seeingList.data?.users?.some((u) => u.uid === user.id));

  check('Admin without "manage trainers" cannot deactivate their trainer → 403', (await api('PATCH', `/api/users/${tom.id}`, {
    token: admin.token, body: { isArchived: true },
  })).data?.code === 'no_permission');
  const granted = await api('PATCH', `/api/users/${admin.id}`, {
    token: sa.token, body: { permissions: ['invite_trainers', 'view_users', 'manage_trainers'] },
  });
  check('Super Admin changes an Admin\'s access', granted.status === 200 && granted.data.user.permissions.includes('manage_trainers'), granted);
  check('Admin cannot change their own access → 403', (await api('PATCH', '/api/users/me', {
    token: admin.token, body: { permissions: [] },
  })).status === 403);
  const off = await api('PATCH', `/api/users/${tom.id}`, { token: admin.token, body: { isArchived: true } });
  check('Admin deactivates their trainer', off.status === 200 && off.data.user.isArchived === true, off);
  check('deactivated trainer cannot log in → 403', (await login(mail('tom'), 'tom-pass-1')).code === 'account_archived');
  await api('PATCH', `/api/users/${tom.id}`, { token: admin.token, body: { isArchived: false } });
  check('reactivated trainer can log in again', (await login(mail('tom'), 'tom-pass-1')).status === 200);

  const otherTrainer = await createTestUser(TAG, 'trainer', { managedBy: noInviteAdmin.id });
  check('Admin cannot see another Admin\'s trainer → 403',
    (await api('GET', `/api/users/${otherTrainer.id}`, { token: admin.token })).status === 403);
  const trainers = await api('GET', '/api/admin/trainers', { token: admin.token });
  check('Admin\'s trainer list = only their trainers',
    trainers.data?.trainers?.length === 1 && trainers.data.trainers[0].uid === tom.id, trainers.data?.trainers?.map((t) => t.displayName));

  // ── Admin limits / Super Admin powers ─────────────────────────────────────
  console.log('Admin limits and Super Admin powers');
  check('Admin cannot deactivate another Admin → 403',
    (await api('PATCH', `/api/users/${noInviteAdmin.id}`, { token: admin.token, body: { isArchived: true } })).status === 403);
  check('Admin cannot touch the Super Admin → 403',
    (await api('PATCH', `/api/users/${sa.id}`, { token: admin.token, body: { isArchived: true } })).status === 403);
  check('nobody can change roles, not even the Super Admin → 400',
    (await api('PATCH', `/api/users/${admin.id}`, { token: sa.token, body: { role: 'super_admin' } })).data?.code === 'role_locked');
  check('Super Admin cannot deactivate themselves → 400',
    (await api('PATCH', '/api/users/me', { token: sa.token, body: { isArchived: true } })).data?.code === 'self_lockout');
  const saOff = await api('PATCH', `/api/users/${admin.id}`, { token: sa.token, body: { isArchived: true } });
  check('Super Admin deactivates an Admin', saOff.data?.user?.isArchived === true);
  check('deactivated Admin cannot log in → 403', (await login(mail('anna'), 'anna-pass-1')).code === 'account_archived');
  check('…and their open session stops working → 403', (await api('GET', '/api/admin/stats', { token: admin.token })).status === 403);
  await api('PATCH', `/api/users/${admin.id}`, { token: sa.token, body: { isArchived: false } });
  const all = await api('GET', '/api/users', { token: sa.token });
  check('Super Admin sees all admins, trainers and users',
    ['admin', 'trainer', 'client', 'super_admin'].every((r) => all.data?.users?.some((u) => u.role === r)));
  const stats = await api('GET', '/api/admin/stats', { token: sa.token });
  check('dashboard counts include pending invitations', stats.status === 200 && stats.data.pendingInvitations >= 1, stats.data);

  // ── Who may use which area ────────────────────────────────────────────────
  console.log('Area access');
  check('User cannot use admin endpoints → 403', (await api('GET', '/api/admin/stats', { token: user.token })).status === 403);
  check('User cannot create invitations → 403', (await api('POST', '/api/invitations', {
    token: user.token, body: { name: 'X', email: mail('x5'), role: 'trainer' },
  })).status === 403);
  check('User cannot use the trainer area → 403', (await api('GET', '/api/trainer/users', { token: user.token })).status === 403);
  check('Trainer cannot use admin endpoints → 403', (await api('GET', '/api/admin/stats', { token: tom.token })).status === 403);
  check('Trainer cannot create invitations → 403', (await api('POST', '/api/invitations', {
    token: tom.token, body: { name: 'X', email: mail('x6'), role: 'trainer' },
  })).status === 403);
  check('Trainer cannot list users → 403', (await api('GET', '/api/users', { token: tom.token })).status === 403);

  // ── Trainer privacy ───────────────────────────────────────────────────────
  console.log('Trainer privacy');
  const tom2 = await login(mail('tom'), 'tom-pass-1');
  const ot = await login(otherTrainer.email);
  await api('PUT', `/api/users/${user.id}/trainer`, { token: sa.token, body: { trainerId: tom.id } });
  check('trainer sees their assigned user', (await api('GET', `/api/users/${user.id}`, { token: tom2.token })).status === 200);
  check('another trainer cannot see that user → 403', (await api('GET', `/api/users/${user.id}`, { token: ot.token })).status === 403);
  check('…nor their profile → 403', (await api('GET', `/api/users/${user.id}/profile`, { token: ot.token })).status === 403);
  check('…nor their chat → 403', (await api('GET', `/api/chats/${user.id}/messages`, { token: ot.token })).status === 403);
  check('other trainer\'s "my users" list is empty', (await api('GET', '/api/trainer/users', { token: ot.token })).data?.users?.length === 0);
  check('trainer cannot see other trainers\' accounts → 403', (await api('GET', `/api/users/${otherTrainer.id}`, { token: tom2.token })).status === 403);

  // ── Own profile ───────────────────────────────────────────────────────────
  console.log('Own profile');
  const prof = await api('PATCH', '/api/users/me', { token: user.token, body: { displayName: 'Uma U.', whatsapp: '+91 98765 43210' } });
  check('User updates own name and WhatsApp', prof.data?.user?.displayName === 'Uma U.' && prof.data.user.whatsapp === '+919876543210', prof);
  check('empty name refused → 400', (await api('PATCH', '/api/users/me', { token: user.token, body: { displayName: ' ' } })).status === 400);
  check('trainer views own profile', (await api('GET', '/api/users/me', { token: tom2.token })).data?.user?.role === 'trainer');
}

const server = createApp().listen(0);
await new Promise((r) => server.once('listening', r));
base = `http://127.0.0.1:${server.address().port}`;

try {
  await run();
} catch (err) {
  failed++;
  console.error(`Test run crashed: ${err.stack}`);
} finally {
  // Invitations are removed with their inviter (ON DELETE CASCADE).
  await query('DELETE FROM users WHERE email LIKE $1', [`${TAG}%`]);
  server.close();
  await closePool();
  console.log(`\n${passed} passed, ${failed} failed (temporary test data removed)`);
  process.exitCode = failed > 0 ? 1 : 0;
}
