/**
 * Sync DB to Prod: push local catalog.db, catalog.db-wal, catalog.db-shm to the Prod server.
 * Used on Dev to upload Dev's DB to Prod. Uses same SYNC_PROD_* env as syncDbFromProd.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { closeDb, getDb, dataDir } = require('./db');
const { getKeyPath, getProdHost, getProdUser, getProdDataPath } = require('./syncDbFromProd');
const { stripProductNotesInDir, copyCatalogFiles } = require('./notesPreserve');

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
 * Push local catalog.db* to Prod. Stops Prod app, rsyncs a copy with Notes cleared, then starts Prod app.
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

  const sshOpts = `-i "${keyPath}" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15`;
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'furniture-prod-stage-'));

  try {
    runSsh(`systemctl stop ${SYNC_PROD_SERVICE_NAME}`);
  } catch (e) {
    console.warn('sync/db-to-prod: could not stop Prod app (is SYNC_PROD_SERVICE_NAME correct?):', e.message);
  }

  try {
    copyCatalogFiles(localDir, stageDir);
    stripProductNotesInDir(stageDir);

    const names = ['catalog.db', 'catalog.db-wal', 'catalog.db-shm'];
    const stageFiles = names.filter((n) => fs.existsSync(path.join(stageDir, n))).map((n) => path.join(stageDir, n));
    if (stageFiles.length === 0) throw new Error('No catalog.db files found in staging dir');
    const remote = `${user}@${host}:${remotePath}/`;
    const list = stageFiles.map((f) => `"${f}"`).join(' ');
    const rsyncCmd = `rsync -avz --progress --checksum -e "ssh ${sshOpts}" ${list} "${remote}"`;

    try {
      runSsh(`rm -f ${remotePath}/catalog.db ${remotePath}/catalog.db-wal ${remotePath}/catalog.db-shm`);
    } catch (e) {
      console.warn('sync/db-to-prod: could not remove old remote DB files:', e.message);
    }

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
    fs.rmSync(stageDir, { recursive: true, force: true });
    getDb();
  }

  return { ok: true, message: 'DB synced to Prod. Notes were not copied. Prod app was stopped during sync and restarted.' };
}

module.exports = { syncDbToProd };
