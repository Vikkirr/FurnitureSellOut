const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { stripProductNotes, copyCatalogFiles, stripProductNotesInDir } = require('../notesPreserve');
const { excelRowToDbRow, sheetNotesByProductId, rowToExcelRow } = require('../productExport');

function memoryDb(t) {
  let db;
  try {
    db = new (require('better-sqlite3'))(':memory:');
  } catch (error) {
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(':memory:');
  }
  t.after(() => db.close());
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, notes TEXT)`);
  db.exec(`INSERT INTO products (id,name,notes) VALUES (1,'Keep','secret'),(2,'Gone','also-secret')`);
  return db;
}

test('stripProductNotes clears every notes value', t => {
  const db = memoryDb(t);
  stripProductNotes(db);
  const rows = db.prepare('SELECT id, notes FROM products ORDER BY id').all();
  assert.deepEqual(rows, [
    { id: 1, notes: null },
    { id: 2, notes: null },
  ]);
});

test('sheet pull mapping never copies Notes into the DB row', () => {
  const row = excelRowToDbRow({ Name: 'Chair', Notes: 'do not import', Price: 10 });
  assert.equal(row.notes, null);
  assert.equal(rowToExcelRow({ name: 'Chair', notes: 'db-note', price: 10 }).Notes, '');
});

test('sheetNotesByProductId keeps spreadsheet notes keyed by ID', () => {
  const map = sheetNotesByProductId([
    ['ID', 'Name', 'Notes'],
    [1, 'Chair', 'internal'],
    ['', 'New', 'ignored'],
    [2, 'Table', 'keep-me'],
  ]);
  assert.equal(map.get(1), 'internal');
  assert.equal(map.get(2), 'keep-me');
  assert.equal(map.has(0), false);
});

test('staging copy then strip leaves notes empty on disk', t => {
  const Database = require('better-sqlite3');
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-src-'));
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-dest-'));
  t.after(() => {
    fs.rmSync(src, { recursive: true, force: true });
    fs.rmSync(dest, { recursive: true, force: true });
  });
  const srcDb = new Database(path.join(src, 'catalog.db'));
  srcDb.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, notes TEXT)`);
  srcDb.exec(`INSERT INTO products (id,notes) VALUES (1,'secret')`);
  srcDb.close();
  copyCatalogFiles(src, dest);
  stripProductNotesInDir(dest);
  const destDb = new Database(path.join(dest, 'catalog.db'));
  t.after(() => destDb.close());
  assert.equal(destDb.prepare('SELECT notes FROM products WHERE id = 1').get().notes, null);
});
