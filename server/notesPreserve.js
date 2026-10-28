/**
 * Notes are spreadsheet-only. Full-file DB sync copies catalog.db*, so Notes
 * must be cleared on a staging copy (or after a pull) so they never land in Prod
 * or the public product feed.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const CATALOG_FILES = ['catalog.db', 'catalog.db-wal', 'catalog.db-shm'];

function stripProductNotes(db) {
  try {
    return db.prepare('UPDATE products SET notes = NULL').run().changes;
  } catch (err) {
    if (String(err.message || err).includes('no such column: notes')) return 0;
    throw err;
  }
}

function openCatalogInDir(dir) {
  const file = path.join(dir, 'catalog.db');
  if (!fs.existsSync(file)) throw new Error('catalog.db not found in ' + dir);
  return new Database(file);
}

function stripProductNotesInDir(dir) {
  const db = openCatalogInDir(dir);
  try {
    return stripProductNotes(db);
  } finally {
    db.close();
  }
}

function copyCatalogFiles(fromDir, toDir) {
  fs.mkdirSync(toDir, { recursive: true });
  const copied = [];
  for (const name of CATALOG_FILES) {
    const src = path.join(fromDir, name);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(toDir, name));
      copied.push(name);
    }
  }
  if (copied.length === 0) throw new Error('No catalog.db files found in ' + fromDir);
  return copied;
}

module.exports = {
  CATALOG_FILES,
  stripProductNotes,
  stripProductNotesInDir,
  copyCatalogFiles,
};
