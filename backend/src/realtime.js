// Live updates over Socket.IO (chat).
//
// The app connects with its login token:
//   io('http://localhost:4000', { auth: { token } })
//
// Rooms are assigned by the server, never chosen by the app:
//   - a user (client) joins only their own chat room   "chat:<their id>"
//   - a trainer joins "trainer:<their id>" and gets events for their users' chats
//   - admins join the "admins" room and receive events for every chat
//
// Events sent to the app:
//   message:new   { clientId, message }   a new chat message
//   chat:updated  { chat }                last message / unread counts changed

import { Server } from 'socket.io';
import { verifyToken } from './auth/tokens.js';
import { query } from './db.js';

let io = null;

export function attachRealtime(httpServer) {
  io = new Server(httpServer, { cors: { origin: '*' } });

  io.use(async (socket, next) => {
    try {
      const payload = verifyToken(socket.handshake.auth?.token);
      const { rows } = await query('SELECT id, role, is_archived FROM users WHERE id = $1', [payload.sub]);
      const user = rows[0];
      if (!user || user.is_archived) return next(new Error('unauthorized'));
      socket.data.user = user;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (user.role === 'admin' || user.role === 'super_admin') socket.join('admins');
    else if (user.role === 'trainer') socket.join(`trainer:${user.id}`);
    else socket.join(`chat:${user.id}`);
  });

  return io;
}

/**
 * Sends an event to the user who owns the chat, their trainer (if any) and
 * all admins.
 */
export function emitToChat(clientId, event, payload, trainerId = null) {
  if (!io) return;
  let target = io.to(`chat:${clientId}`).to('admins');
  if (trainerId) target = target.to(`trainer:${trainerId}`);
  target.emit(event, payload);
}

export async function closeRealtime() {
  if (io) {
    await io.close();
    io = null;
  }
}
