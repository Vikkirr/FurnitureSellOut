const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.resolve(process.env.DATABASE_PATH || path.join(dataDir, 'catalog.db'));
let db;

function getDb() {
  if (!db) {
    console.log('Database path:', dbPath);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

function closeDb() {
  if (db) {
    try { db.close(); } catch (_) {}
    db = null;
  }
}

function initDb() {
  const database = getDb();
  database.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      sku TEXT,
      description TEXT,
      dimensions TEXT,
      weight TEXT,
      color TEXT,
      department TEXT,
      price REAL NOT NULL,
      fb_marketplace_url TEXT,
      pick_url TEXT,
      image_urls TEXT DEFAULT '[]',
      furniture_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'pending', 'sold')),
      quantity INTEGER DEFAULT 1,
      cost REAL,
      retail_price REAL,
      brand_new INTEGER DEFAULT 0,
      open_box INTEGER DEFAULT 0,
      was_never_used INTEGER DEFAULT 0,
      was_never_assembled INTEGER DEFAULT 0,
      free_local_curbside_delivery INTEGER DEFAULT 0,
      local_curbside_delivery_fee INTEGER DEFAULT 0,
      meetup_public_place INTEGER DEFAULT 0,
      pickup INTEGER DEFAULT 0,
      assembly_required INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    CREATE INDEX IF NOT EXISTS idx_products_furniture_type ON products(furniture_type);
    CREATE INDEX IF NOT EXISTS idx_products_manufacturer ON products(manufacturer);
    CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
  `);
  try {
    database.exec(`ALTER TABLE products ADD COLUMN quantity INTEGER DEFAULT 1`);
  } catch (_) {}
  try {
    database.exec(`ALTER TABLE products ADD COLUMN cost REAL`);
  } catch (_) {}
  try {
    database.exec(`ALTER TABLE products ADD COLUMN retail_price REAL`);
  } catch (_) {}
  try {
    database.exec(`ALTER TABLE products ADD COLUMN department TEXT`);
  } catch (_) {}
  try {
    database.exec(`ALTER TABLE products ADD COLUMN pick_url TEXT`);
  } catch (_) {}
  try {
    database.exec(`ALTER TABLE products ADD COLUMN image_visibility TEXT DEFAULT '[]'`);
  } catch (_) {}
  try {
    database.exec(`ALTER TABLE products ADD COLUMN primary_image_index INTEGER DEFAULT 0`);
  } catch (_) {}
  try {
    database.exec(`ALTER TABLE products ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))`);
  } catch (_) {}
  try {
    database.exec(`ALTER TABLE products ADD COLUMN created_at TEXT DEFAULT (datetime('now'))`);
  } catch (_) {}
  try {
    database.exec(`ALTER TABLE products ADD COLUMN notes TEXT`);
  } catch (_) {}
  try {
    database.exec(`ALTER TABLE products ADD COLUMN guidelines TEXT`);
  } catch (_) {}
  const optionCols = [
    'brand_new', 'open_box', 'was_never_used', 'was_never_assembled',
    'free_local_curbside_delivery', 'local_curbside_delivery_fee', 'meetup_public_place', 'pickup', 'assembly_required'
  ];
  for (const col of optionCols) {
    try {
      database.exec(`ALTER TABLE products ADD COLUMN ${col} INTEGER DEFAULT 0`);
    } catch (_) {}
  }
  const count = database.prepare('SELECT COUNT(*) as n FROM products').get();
  if (count.n === 0) {
    database.prepare(`
      INSERT INTO products (name, manufacturer, sku, description, dimensions, weight, color, department, price, fb_marketplace_url, pick_url, image_urls, furniture_type, status, quantity, cost) VALUES
      ('Modern Accent Chair', 'West Elm', 'WE-AC-001', 'Clean-lined accent chair, perfect for living room or office.', '28" W x 32" D x 32" H', '28 lbs', 'Charcoal', 'Chairs', 249.99, 'https://www.facebook.com/marketplace', null, '[]', 'Chair', 'available', 1, 180),
      ('Solid Oak Dining Table', 'IKEA', 'IKE-DT-002', 'Sturdy solid oak table, seats 6. Unfinished wood.', '72" L x 39" W x 30" H', '95 lbs', 'Natural Oak', 'Dining Table', 399.00, 'https://www.facebook.com/marketplace', null, '[]', 'Table', 'available', 1, 280),
      ('3-Seater Sofa', 'Article', 'ART-S3-003', 'Mid-century style three-seater with wooden legs.', '84" W x 34" D x 32" H', '120 lbs', 'Grey', 'Sofa', 699.00, 'https://www.facebook.com/marketplace', null, '[]', 'Sofa', 'available', 1, 520)
    `).run();
  }
  return database;
}

module.exports = { getDb, closeDb, initDb, dbPath, dataDir };
