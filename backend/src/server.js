import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { closePool } from './db.js';
import { attachRealtime, closeRealtime } from './realtime.js';

const server = http.createServer(createApp());
attachRealtime(server);

server.listen(config.port, () => {
  console.log(`My Gym Era API listening on http://localhost:${config.port}`);
  console.log(`Health check: http://localhost:${config.port}/api/health`);
});

async function shutdown() {
  await closeRealtime();
  server.close();
  await closePool();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
