/**
 * Sync DB to Prod: push local catalog.db, catalog.db-wal, catalog.db-shm to the Prod server.
 * Used on Dev to upload Dev's DB to Prod. Uses same SYNC_PROD_* env as syncDbFromProd.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { closeDb, getDb, dataDir } = require('./db');
const { getKeyPath, getProdHost, getProdUser, getProdDataPath } = require('./syncDbFromProd');

const SYNC_PROD_SERVICE_NAME = (process.env.SYNC_PROD_SERVICE_NAME || 'furnitureapp').trim();

function runSsh(cmd) {
  const keyPath = getKeyPath();
  try {
    fs.chmodSync(keyPath, 0o600);
  } catch (_) {}
  const host = getProdHost();
  const user = getProdUser();
  const sshOpts = `-i "${keyPath}" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15`;
  execSync(`ssh ${sshOpts} ${user}@${host} ${cmd}`, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: 30000,
  });
}

/**
 * Push local catalog.db* to Prod. Optionally stops Prod app, rsyncs, then starts Prod app.
 */
function syncDbToProd() {
  const keyPath = getKeyPath();
  try {
    fs.chmodSync(keyPath, 0o600);
  } catch (_) {}
  const host = getProdHost();
  const user = getProdUser();
  const remotePath = getProdDataPath();
  const localDir = dataDir;
  if (!fs.existsSync(localDir)) throw new Error('Local data dir not found: ' + localDir);

  closeDb();

  const names = ['catalog.db', 'catalog.db-wal', 'catalog.db-shm'];
  const localFiles = names.filter((n) => fs.existsSync(path.join(localDir, n))).map((n) => path.join(localDir, n));
  if (localFiles.length === 0) throw new Error('No catalog.db files found in ' + localDir);

  const remote = `${user}@${host}:${remotePath}/`;
  const sshOpts = `-i "${keyPath}" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15`;
  const list = localFiles.map((f) => `"${f}"`).join(' ');
  const rsyncCmd = `rsync -avz --progress --checksum -e "ssh ${sshOpts}" ${list} "${remote}"`;

  try {
    runSsh(`systemctl stop ${SYNC_PROD_SERVICE_NAME}`);
  } catch (e) {
    console.warn('sync/db-to-prod: could not stop Prod app (is SYNC_PROD_SERVICE_NAME correct?):', e.message);
  }

  try {
    runSsh(`rm -f ${remotePath}/catalog.db ${remotePath}/catalog.db-wal ${remotePath}/catalog.db-shm`);
  } catch (e) {
    console.warn('sync/db-to-prod: could not remove old remote DB files:', e.message);
  }

  try {
    execSync(rsyncCmd, {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } finally {
    try {
      runSsh(`systemctl start ${SYNC_PROD_SERVICE_NAME}`);
    } catch (e) {
      console.warn('sync/db-to-prod: could not start Prod app:', e.message);
    }
    getDb();
  }

  return { ok: true, message: 'DB synced to Prod. Prod app was stopped during sync and restarted.' };
}

module.exports = { syncDbToProd };
