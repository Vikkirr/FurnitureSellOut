const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { reconcileSheetProducts } = require('../reconcileSheetProducts');

function database(t) {
  let db;
  try {
    db = new (require('better-sqlite3'))(':memory:');
  } catch (error) {
    // The shared workspace may have Linux native dependencies on a Mac host.
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(':memory:');
    db.transaction = callback => () => {
      db.exec('BEGIN');
      try { const result = callback(); db.exec('COMMIT'); return result; }
      catch (err) { db.exec('ROLLBACK'); throw err; }
    };
  }
  t.after(() => db.close());
  const source = fs.readFileSync(path.join(__dirname, '../db.js'), 'utf8');
  db.exec(source.match(/database\.exec\(`([\s\S]*?)`\);/)[1]);
  db.exec('ALTER TABLE products ADD COLUMN notes TEXT; ALTER TABLE products ADD COLUMN guidelines TEXT');
  db.exec("INSERT INTO products (id,name,manufacturer,price,furniture_type) VALUES (1,'Keep','Brand',10,'Chair'),(2,'Remove','Brand',20,'Table')");
  return db;
}
const snapshot = db => db.prepare('SELECT * FROM products ORDER BY id').all().map(row => ({...row}));

test('updates, inserts and deletes missing products together; blank rows are ignored', t => {
  const db = database(t);
  assert.deepEqual(reconcileSheetProducts(db, [['ID','Name','Price'],[1,'Updated',25],[],['','New',30]]), {updated:1,inserted:1,deleted:1});
  assert.deepEqual(snapshot(db).map(p => [p.id,p.name,p.price]), [[1,'Updated',25],[3,'New',30]]);
});

test('explicit IDs stay stable on repeated pulls and do not collide with blank IDs', t => {
  const db = database(t);
  const sheet = [['ID','Name'],['','New'],[3,'Explicit'],[1,'Keep']];
  reconcileSheetProducts(db, sheet);
  assert.deepEqual(snapshot(db).map(p => [p.id,p.name]), [[1,'Keep'],[3,'Explicit'],[4,'New']]);
  assert.deepEqual(reconcileSheetProducts(db, [['ID','Name'],[1,'Keep'],[3,'Explicit'],[4,'New']]), {updated:3,inserted:0,deleted:0});
});

test('empty and invalid sheets leave the database unchanged', t => {
  const db = database(t), before = snapshot(db);
  for (const sheet of [[],[['ID','Name']],[['ID','Name'],[]],[['Name'],['Wrong tab']],[['ID','Name'],[1,'Good'],[1,'Duplicate']],[['ID','Name'],['1oops','Bad']],[['ID','Name'],[1,'Good'],[2,'']]]) {
    assert.throws(() => reconcileSheetProducts(db,sheet));
    assert.deepEqual(snapshot(db),before);
  }
});

test('a failure during deletion rolls back earlier updates and inserts', t => {
  const db = database(t), before = snapshot(db);
  db.exec("CREATE TRIGGER fail_delete BEFORE DELETE ON products BEGIN SELECT RAISE(ABORT, 'test failure'); END");
  assert.throws(() => reconcileSheetProducts(db,[['ID','Name'],[1,'Changed'],['','New']]), /test failure/);
  assert.deepEqual(snapshot(db),before);
});
