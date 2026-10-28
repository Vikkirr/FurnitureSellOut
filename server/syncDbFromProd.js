/**
 * Sync DB from Prod: replace local catalog.db, catalog.db-wal, catalog.db-shm
 * with copies from the Prod server via SSH (rsync). Requires SYNC_PROD_SSH_KEY_PATH in .env.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { closeDb, getDb, dataDir } = require('./db');
const { stripProductNotes } = require('./notesPreserve');

function getKeyPath() {
  const p = process.env.SYNC_PROD_SSH_KEY_PATH;
  if (!p || !p.trim()) throw new Error('SYNC_PROD_SSH_KEY_PATH is not set in .env. Set it to the path of your private key for root@prod.');
  const resolved = path.isAbsolute(p) ? p.trim() : path.resolve(process.cwd(), p.trim());
  if (!fs.existsSync(resolved)) throw new Error('SSH key file not found: ' + resolved);
  return resolved;
}

function getProdHost() {
  return (process.env.SYNC_PROD_HOST || '159.65.174.226').trim();
}

function getProdUser() {
  return (process.env.SYNC_PROD_USER || 'root').trim();
}

function getProdDataPath() {
  return (process.env.SYNC_PROD_DATA_PATH || '/srv/furnitureapp/data').trim().replace(/\/$/, '');
}

/**
 * Pull catalog.db, catalog.db-wal, catalog.db-shm from Prod into local data/.
 * Closes DB, runs rsync, reopens DB. Notes are cleared so they stay spreadsheet-only.
 */
function syncDbFromProd() {
  const keyPath = getKeyPath();
  try {
    fs.chmodSync(keyPath, 0o600);
  } catch (_) {}
  const host = getProdHost();
  const user = getProdUser();
  const remotePath = getProdDataPath();
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
    const db = getDb();
    try {
      stripProductNotes(db);
    } catch (e) {
      console.warn('sync/db-from-prod: could not clear Notes:', e.message);
    }
  }

  return { ok: true, message: 'DB synced from Prod. Notes were not copied. Restart the server if you see stale data.' };
}

module.exports = { syncDbFromProd, getKeyPath, getProdHost, getProdUser, getProdDataPath };
