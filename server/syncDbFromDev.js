/**
 * Sync DB from Dev: replace local catalog.db, catalog.db-wal, catalog.db-shm
 * with copies from the Dev server via SSH (rsync). Requires SYNC_DEV_SSH_KEY_PATH in .env.
 * Used when running on Prod to pull DB from Dev.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { closeDb, getDb, dataDir } = require('./db');

function getKeyPath() {
  const p = process.env.SYNC_DEV_SSH_KEY_PATH;
  if (!p || !p.trim()) throw new Error('SYNC_DEV_SSH_KEY_PATH is not set in .env. Set it to the path of your private key for vik@dev.');
  const resolved = path.isAbsolute(p) ? p.trim() : path.resolve(process.cwd(), p.trim());
  if (!fs.existsSync(resolved)) throw new Error('SSH key file not found: ' + resolved);
  return resolved;
}

function getDevHost() {
  return (process.env.SYNC_DEV_HOST || '192.168.2.64').trim();
}

function getDevUser() {
  return (process.env.SYNC_DEV_USER || 'vik').trim();
}

function getDevDataPath() {
  return (process.env.SYNC_DEV_DATA_PATH || '/home/vik/Documents/FurnitureCatalogWeb/data').trim().replace(/\/$/, '');
}

/**
 * Pull catalog.db, catalog.db-wal, catalog.db-shm from Dev into local data/.
 * Closes DB, runs rsync, reopens DB.
 */
function syncDbFromDev() {
  const keyPath = getKeyPath();
  try {
    fs.chmodSync(keyPath, 0o600);
  } catch (_) {}
  const host = getDevHost();
  const user = getDevUser();
  const remotePath = getDevDataPath();
  const localDir = dataDir;
  if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

  closeDb();

  try {
    const remote = `${user}@${host}:${remotePath}/catalog.db*`;
    const sshOpts = `-i "${keyPath}" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15`;
    const cmd = `rsync -avz --progress -e "ssh ${sshOpts}" "${remote}" "${localDir}/"`;
    execSync(cmd, {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } finally {
    getDb();
  }

  return { ok: true, message: 'DB synced from Dev. Restart the server if you see stale data.' };
}

module.exports = { syncDbFromDev, getKeyPath, getDevHost, getDevUser, getDevDataPath };
