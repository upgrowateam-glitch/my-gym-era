// Coach ↔ user chat; live updates go out over Socket.IO.
// One conversation per user (client). The "staff side" of a conversation is
// the user's trainer plus all admins.
//
//   GET  /api/chats                          (admin: all, trainer: their users) newest first
//   GET  /api/chats/unread-count             staff: unread from users; user: own unread
//   GET  /api/chats/:clientId                one conversation (counts)
//   GET  /api/chats/:clientId/messages?limit=50&before=<ISO time>   newest first
//   POST /api/chats/:clientId/messages { text, imageUrl? }
//   POST /api/chats/:clientId/read           reset my unread count
//
// `:clientId` is the user the chat belongs to ("me" for a user's own chat).
// A user can only use their own chat; their trainer and admins can use it too.

import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { badRequest, forbidden, notFound } from '../errors.js';
import { emitToChat } from '../realtime.js';
import { isStaffFor, isAdminRole } from '../users/userModel.js';
import * as v from '../validate.js';

export const chatsRouter = Router();
chatsRouter.use(requireAuth);

const toChat = (r) => ({
  id: r.client_id,
  clientId: r.client_id,
  clientName: r.client_name,
  lastMessage: r.last_message,
  lastMessageTime: r.last_message_time,
  unreadAdminCount: r.unread_admin_count,
  unreadClientCount: r.unread_client_count,
});

const toMessage = (r) => ({
  id: r.id,
  senderId: r.sender_id,
  senderRole: r.sender_role,
  text: r.text,
  imageUrl: r.image_url,
  timestamp: r.sent_at,
  isRead: r.is_read,
});

const emptyChat = (client) => ({
  id: client.id, clientId: client.id, clientName: client.display_name, lastMessage: '',
  lastMessageTime: null, unreadAdminCount: 0, unreadClientCount: 0,
});

chatsRouter.get('/', requireRole('admin', 'trainer'), async (req, res) => {
  const { rows } = isAdminRole(req.user.role)
    ? await query('SELECT * FROM chats ORDER BY last_message_time DESC')
    : await query(
      `SELECT c.* FROM chats c JOIN users u ON u.id = c.client_id
       WHERE u.trainer_id = $1 ORDER BY c.last_message_time DESC`, [req.user.id]);
  res.json({ chats: rows.map(toChat) });
});

chatsRouter.get('/unread-count', async (req, res) => {
  const { rows } = isAdminRole(req.user.role)
    ? await query('SELECT COALESCE(sum(unread_admin_count), 0)::int AS n FROM chats')
    : req.user.role === 'trainer'
    ? await query(
      `SELECT COALESCE(sum(c.unread_admin_count), 0)::int AS n FROM chats c
       JOIN users u ON u.id = c.client_id WHERE u.trainer_id = $1`, [req.user.id])
    : await query('SELECT COALESCE(sum(unread_client_count), 0)::int AS n FROM chats WHERE client_id = $1', [req.user.id]);
  res.json({ unread: rows[0].n });
});

// Access check + load the chat's client for everything under /:clientId
async function chatAccess(req, _res, next) {
  const id = req.params.clientId === 'me' ? req.user.id : req.params.clientId;
  const self = id === req.user.id;
  if (!self && req.user.role === 'client') throw forbidden();
  const { rows } = await query('SELECT id, display_name, role, trainer_id FROM users WHERE id = $1', [id]);
  // A trainer may only open chats of users assigned to them.
  if (!self && req.user.role === 'trainer' && (!rows[0] || !isStaffFor(req.user, rows[0]))) throw forbidden();
  if (!rows[0]) throw notFound('User not found.', 'user_not_found');
  if (rows[0].role !== 'client') throw badRequest('Chats belong to user accounts.', 'not_a_client');
  req.chatClient = rows[0];
  next();
}

const chatRouter = Router({ mergeParams: true });
chatsRouter.use('/:clientId', chatAccess, chatRouter);

chatRouter.get('/', async (req, res) => {
  const { rows } = await query('SELECT * FROM chats WHERE client_id = $1', [req.chatClient.id]);
  res.json({ chat: rows[0] ? toChat(rows[0]) : emptyChat(req.chatClient) });
});

chatRouter.get('/messages', async (req, res) => {
  const limit = req.query.limit === undefined
    ? 50 : v.number(Number(req.query.limit), 'limit', { min: 1, max: 200, integer: true });
  const params = [req.chatClient.id, limit];
  let before = '';
  if (req.query.before !== undefined) {
    params.push(v.timestamp(req.query.before, 'before'));
    before = 'AND sent_at < $3';
  }
  const { rows } = await query(
    `SELECT * FROM messages WHERE client_id = $1 ${before} ORDER BY sent_at DESC, id DESC LIMIT $2`, params);
  res.json({ messages: rows.map(toMessage) });
});

chatRouter.post('/messages', async (req, res) => {
  const text = req.body?.text === undefined ? '' : v.string(req.body.text, 'text', { max: 5000 });
  let imageUrl = null;
  if (req.body?.imageUrl !== undefined && req.body.imageUrl !== null) {
    imageUrl = v.string(req.body.imageUrl, 'imageUrl', { max: 2000 });
    if (!/^https?:\/\//i.test(imageUrl)) throw badRequest('imageUrl must be a web address.', 'invalid_body');
  }
  if (!text && !imageUrl) throw badRequest('A message needs text or an image.', 'empty_message');

  // 'client' | 'trainer' | 'admin' (super admins appear as admin)
  const senderRole = req.user.role === 'super_admin' ? 'admin' : req.user.role;
  const fromStaff = senderRole !== 'client';
  const clientId = req.chatClient.id;
  // Same as the app: show something meaningful in the chat list for image-only messages.
  const lastMessage = text || '📷 Image';

  const { chat, message } = await withTransaction(async (client) => {
    const c = await client.query(
      `INSERT INTO chats (client_id, client_name, last_message, last_message_time,
                          unread_admin_count, unread_client_count)
       VALUES ($1, $2, $3, now(), $4, $5)
       ON CONFLICT (client_id) DO UPDATE SET
         client_name = EXCLUDED.client_name,
         last_message = EXCLUDED.last_message,
         last_message_time = EXCLUDED.last_message_time,
         unread_admin_count = chats.unread_admin_count + EXCLUDED.unread_admin_count,
         unread_client_count = chats.unread_client_count + EXCLUDED.unread_client_count
       RETURNING *`,
      [clientId, req.chatClient.display_name, lastMessage,
        fromStaff ? 0 : 1, fromStaff ? 1 : 0]);
    const m = await client.query(
      `INSERT INTO messages (client_id, sender_id, sender_role, text, image_url, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [clientId, req.user.id, senderRole, text, imageUrl, c.rows[0].last_message_time]);
    return { chat: toChat(c.rows[0]), message: toMessage(m.rows[0]) };
  });

  emitToChat(clientId, 'message:new', { clientId, message }, req.chatClient.trainer_id);
  emitToChat(clientId, 'chat:updated', { chat }, req.chatClient.trainer_id);
  res.status(201).json({ message, chat });
});

chatRouter.post('/read', async (req, res) => {
  const asStaff = req.user.role !== 'client';
  const clientId = req.chatClient.id;
  const { chat } = await withTransaction(async (client) => {
    // Messages from the other side are now read.
    await client.query(
      `UPDATE messages SET is_read = true WHERE client_id = $1 AND NOT is_read
         AND (sender_role = 'client') = $2`,
      [clientId, asStaff]);
    const { rows } = await client.query(
      `UPDATE chats SET ${asStaff ? 'unread_admin_count' : 'unread_client_count'} = 0
       WHERE client_id = $1 RETURNING *`, [clientId]);
    return { chat: rows[0] ? toChat(rows[0]) : emptyChat(req.chatClient) };
  });
  emitToChat(clientId, 'chat:updated', { chat }, req.chatClient.trainer_id);
  res.json({ chat });
});
