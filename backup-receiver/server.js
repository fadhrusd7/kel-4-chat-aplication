const http = require('http');
const { pipeline } = require('stream/promises');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

// Configuration (fallbacks for Windows defaults)
const PORT = process.env.BACKUP_RECEIVER_PORT ? Number(process.env.BACKUP_RECEIVER_PORT) : 4000;
const STORAGE_PATH = process.env.BACKUP_STORAGE_PATH || 'D:\\Backup-Chat';
const TOKEN = process.env.BACKUP_TOKEN || '';
const MAX_SIZE = 500 * 1024 * 1024; // 500 MB

// Ensure storage directory exists
fs.mkdirSync(STORAGE_PATH, { recursive: true });

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/upload') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }

  // ----- Auth -----
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== TOKEN) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'error', message: 'Invalid token' }));
  }

  // ----- Filename handling -----
  const rawName = (req.headers['x-backup-filename'] || '').toString();
  const safeBase = rawName && /^[\w.-]+$/.test(rawName) ? rawName : `backup_${Date.now()}.sql`;
  const uniqueName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${safeBase}`;
  const destPath = path.join(STORAGE_PATH, uniqueName);

  // ----- Size guard -----
  let received = 0;
  req.on('data', chunk => {
    received += chunk.length;
    if (received > MAX_SIZE) {
      req.destroy();
    }
  });

  try {
    await pipeline(req, fs.createWriteStream(destPath));
    const stats = await fs.promises.stat(destPath);
    if (stats.size === 0) throw new Error('Empty file');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', savedAs: uniqueName }));
  } catch (e) {
    await fs.promises.unlink(destPath).catch(() => {});
    const code = e.message.includes('Empty file') ? 400 : 500;
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: e.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Backup Receiver listening on http://0.0.0.0:${PORT}/upload`);
  console.log(`Saving backups to ${STORAGE_PATH}`);
});
