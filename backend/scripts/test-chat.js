// End-to-end checks for chat (REST + live Socket.IO events) and uploads.
// Creates temporary accounts and files and removes them afterwards.
// Creates its own temporary admin account.
//
//   npm run test:chat

import http from 'node:http';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { io as connect } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { attachRealtime, closeRealtime } from '../src/realtime.js';
import { query, closePool } from '../src/db.js';
import { createTestUser, TEST_PASSWORD } from './lib/test-users.js';
import { config } from '../src/config.js';

const TAG = `autotest-${Date.now()}`;
let base;
let passed = 0;
let failed = 0;
const sockets = [];
const uploadedUrls = [];

async function api(method, p, { body, token, form } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
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

async function register(label) {
  const r = await api('POST', '/api/auth/register', {
    body: { email: `${TAG}-${label}@local.dev`, password: 'test123', displayName: `${TAG} ${label}` },
  });
  if (r.status !== 201) throw new Error(`could not create ${label}`);
  return { id: r.data.user.uid, token: r.data.token };
}

/** Connects a socket and records every event it receives. */
function openSocket(token) {
  return new Promise((resolve, reject) => {
    const s = connect(base, { auth: { token }, transports: ['websocket'], reconnection: false });
    s.events = [];
    s.onAny((event, payload) => s.events.push({ event, payload }));
    s.once('connect', () => resolve(s));
    s.once('connect_error', (err) => reject(err));
    sockets.push(s);
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function fileForm(bytes, name) {
  const form = new FormData();
  form.append('file', new Blob([bytes]), name);
  return form;
}

// 1×1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
// Minimal MP4 header ("ftyp" box)
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(16)]);

async function run() {
  const adminUser = await createTestUser(TAG, 'admin');
  const adminLogin = await api('POST', '/api/auth/login', { body: { email: adminUser.email, password: TEST_PASSWORD } });
  const admin = { id: adminLogin.data.user.uid, token: adminLogin.data.token };
  const clientA = await register('clientA');
  const clientB = await register('clientB');

  // ── Live connection ──────────────────────────────────────────────────────
  console.log('Live connection (Socket.IO)');
  const sockA = await openSocket(clientA.token);
  const sockB = await openSocket(clientB.token);
  const sockAdmin = await openSocket(admin.token);
  check('client and admin connect with their login token', sockA.connected && sockAdmin.connected);
  let rejected = false;
  try { await openSocket('not-a-token'); } catch { rejected = true; }
  check('connection without a valid token is refused', rejected);

  // ── Messages ─────────────────────────────────────────────────────────────
  console.log('Chat messages');
  const m1 = await api('POST', '/api/chats/me/messages', { token: clientA.token, body: { text: 'Hi coach!' } });
  check('client sends a message', m1.status === 201 && m1.data.message.senderRole === 'client', m1);
  check('admin unread count = 1', m1.data?.chat?.unreadAdminCount === 1);
  await wait(300);
  check('admin receives it live', sockAdmin.events.some((e) => e.event === 'message:new' && e.payload.message.text === 'Hi coach!'));
  check('client A receives own message event', sockA.events.some((e) => e.event === 'message:new'));
  check('client B receives nothing from A\'s chat (private)', sockB.events.length === 0, sockB.events);

  const r1 = await api('POST', `/api/chats/${clientA.id}/messages`, { token: admin.token, body: { text: 'Welcome!' } });
  check('admin replies', r1.status === 201 && r1.data.message.senderRole === 'admin' && r1.data.chat.unreadClientCount === 1, r1);
  await wait(300);
  check('client A receives reply live', sockA.events.some((e) => e.event === 'message:new' && e.payload.message.text === 'Welcome!'));

  const msgs = await api('GET', '/api/chats/me/messages', { token: clientA.token });
  check('history newest first', msgs.data?.messages?.map((m) => m.text).join('|') === 'Welcome!|Hi coach!', msgs.data);
  const page = await api('GET', `/api/chats/me/messages?limit=1&before=${encodeURIComponent(msgs.data.messages[0].timestamp)}`, { token: clientA.token });
  check('older messages page (before + limit)', page.data?.messages?.length === 1 && page.data.messages[0].text === 'Hi coach!', page.data);

  check('client unread count = 1', (await api('GET', '/api/chats/unread-count', { token: clientA.token })).data?.unread === 1);
  check('admin total unread = 1', (await api('GET', '/api/chats/unread-count', { token: admin.token })).data?.unread >= 1);
  const read = await api('POST', '/api/chats/me/read', { token: clientA.token });
  check('client marks as read → own unread 0, admin unread unchanged',
    read.data?.chat?.unreadClientCount === 0 && read.data.chat.unreadAdminCount === 1, read.data);
  const adminRead = await api('POST', `/api/chats/${clientA.id}/read`, { token: admin.token });
  check('admin marks as read → admin unread 0', adminRead.data?.chat?.unreadAdminCount === 0);
  const after = await api('GET', '/api/chats/me/messages', { token: clientA.token });
  check('messages flagged as read', after.data.messages.every((m) => m.isRead));

  const list = await api('GET', '/api/chats', { token: admin.token });
  check('admin chat list shows the conversation',
    list.data?.chats?.some((c) => c.clientId === clientA.id && c.lastMessage === 'Welcome!' && c.clientName === `${TAG} clientA`), list.data);

  // ── Chat access rules ────────────────────────────────────────────────────
  console.log('Chat access rules');
  check('client B cannot read A\'s messages → 403',
    (await api('GET', `/api/chats/${clientA.id}/messages`, { token: clientB.token })).status === 403);
  check('client B cannot post into A\'s chat → 403',
    (await api('POST', `/api/chats/${clientA.id}/messages`, { token: clientB.token, body: { text: 'x' } })).status === 403);
  check('client cannot list all chats → 403', (await api('GET', '/api/chats', { token: clientA.token })).status === 403);
  check('empty message → 400',
    (await api('POST', '/api/chats/me/messages', { token: clientA.token, body: { text: '' } })).status === 400);
  check('admin chat with a non-client → 400',
    (await api('GET', `/api/chats/${admin.id}/messages`, { token: admin.token })).status === 400);

  // ── Uploads ──────────────────────────────────────────────────────────────
  console.log('Uploads');
  const img = await api('POST', '/api/uploads/chat-image', { token: clientA.token, form: fileForm(PNG, 'photo.png') });
  check('client uploads a chat image', img.status === 201 && img.data.type === 'image' && img.data.url.endsWith('.png'), img);
  if (img.data?.url) uploadedUrls.push(img.data.url);
  const served = await fetch(img.data.url);
  check('uploaded image is served back', served.status === 200 && served.headers.get('content-type') === 'image/png');

  const withImage = await api('POST', '/api/chats/me/messages', { token: clientA.token, body: { imageUrl: img.data.url } });
  check('image-only message shows "📷 Image" in chat list', withImage.data?.chat?.lastMessage === '📷 Image', withImage.data);

  const fake = await api('POST', '/api/uploads/chat-image', {
    token: clientA.token, form: fileForm(Buffer.from('<script>alert(1)</script>'), 'evil.png'),
  });
  check('fake image (script renamed .png) rejected → 400', fake.status === 400, fake);
  check('video as chat image rejected → 400',
    (await api('POST', '/api/uploads/chat-image', { token: clientA.token, form: fileForm(MP4, 'clip.png') })).status === 400);
  check('no file → 400', (await api('POST', '/api/uploads/chat-image', { token: clientA.token, form: new FormData() })).status === 400);
  check('upload without login → 401', (await api('POST', '/api/uploads/chat-image', { form: fileForm(PNG, 'a.png') })).status === 401);
  check('client cannot upload library media → 403',
    (await api('POST', '/api/uploads/media', { token: clientA.token, form: fileForm(MP4, 'v.mp4') })).status === 403);

  const vid = await api('POST', '/api/uploads/media?kind=media', { token: admin.token, form: fileForm(MP4, 'workout.mp4') });
  check('admin uploads a library video', vid.status === 201 && vid.data.type === 'video' && vid.data.url.includes('/media_library/'), vid);
  if (vid.data?.url) uploadedUrls.push(vid.data.url);
  const exImg = await api('POST', '/api/uploads/media?kind=exercises', { token: admin.token, form: fileForm(PNG, 'squat.png') });
  check('admin uploads an exercise image', exImg.status === 201 && exImg.data.url.includes('/exercises/'), exImg);
  if (exImg.data?.url) uploadedUrls.push(exImg.data.url);

  check('missing file URL → 404', (await fetch(`${base}/uploads/chat_images/nope.png`)).status === 404);
  check('temp folder is never served', (await fetch(`${base}/uploads/.tmp/anything`)).status === 404);
}

const server = http.createServer(createApp());
attachRealtime(server);
await new Promise((resolve) => server.listen(0, resolve));
base = `http://127.0.0.1:${server.address().port}`;

try {
  await run();
} catch (err) {
  failed++;
  console.error(`Test run crashed: ${err.stack}`);
} finally {
  sockets.forEach((s) => s.close());
  for (const url of uploadedUrls) {
    const rel = new URL(url).pathname.replace(/^\/uploads\//, '');
    await rm(path.join(config.uploadDir, rel), { force: true });
  }
  await query('DELETE FROM users WHERE email LIKE $1', [`${TAG}%`]); // also removes their chats/messages
  await closeRealtime();
  server.close();
  await closePool();
  console.log(`\n${passed} passed, ${failed} failed (temporary test data and files removed)`);
  process.exitCode = failed > 0 ? 1 : 0;
}
