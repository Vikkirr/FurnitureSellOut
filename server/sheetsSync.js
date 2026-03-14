const fs = require('fs');
const path = require('path');
const { getDb } = require('./db');
const { rowToExcelRow, excelRowToDbRow, EXCEL_COLUMNS, OPTION_COLUMNS } = require('./productExport');

function getSheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id || !id.trim()) throw new Error('GOOGLE_SHEET_ID is not set. Add it to .env.');
  return id.trim();
}

function getCredentials() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath || !credPath.trim()) throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not set. Add path to .env.');
  const resolved = path.isAbsolute(credPath) ? credPath : path.join(process.cwd(), credPath.trim());
  if (!fs.existsSync(resolved)) throw new Error('Credentials file not found: ' + resolved);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

async function getSheetsClient() {
  const { google } = require('googleapis');
  const creds = getCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

/** Get the name of the first sheet tab (e.g. "Sheet1", "Products"). Uses env GOOGLE_SHEET_TAB if set. */
async function getSheetTabName(sheets, sheetId) {
  const tab = process.env.GOOGLE_SHEET_TAB;
  if (tab && tab.trim()) return tab.trim();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const first = meta.data.sheets && meta.data.sheets[0];
  if (first && first.properties && first.properties.title) return first.properties.title;
  return 'Sheet1';
}

/** A1 range: quote sheet name so names with spaces/special chars work. */
function a1Range(sheetName, range) {
  const quoted = /^[A-Za-z0-9_]+$/.test(sheetName) ? sheetName : "'" + sheetName.replace(/'/g, "''") + "'";
  return quoted + '!' + range;
}

async function pushToSheet() {
  const sheetId = getSheetId();
  const sheets = await getSheetsClient();
  const sheetName = await getSheetTabName(sheets, sheetId);
  const db = getDb();
  const rows = db.prepare('SELECT * FROM products ORDER BY id').all();
  const header = ['ID', ...EXCEL_COLUMNS];
  const data = rows.map((row) => [row.id, ...EXCEL_COLUMNS.map((col) => rowToExcelRow(row)[col] ?? '')]);
  const rangeFull = a1Range(sheetName, 'A:ZZ');
  const rangeA1 = a1Range(sheetName, 'A1');
  await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: rangeFull }).catch(() => {});
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: rangeA1,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [header, ...data] },
  });
  return { rows: rows.length };
}

async function pullFromSheet() {
  const sheetId = getSheetId();
  const sheets = await getSheetsClient();
  const sheetName = await getSheetTabName(sheets, sheetId);
  const db = getDb();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: a1Range(sheetName, 'A:ZZ'),
  });
  const raw = res.data.values || [];
  if (raw.length < 2) return { updated: 0, inserted: 0 };
  const headers = raw[0].map((h) => (h != null ? String(h).trim() : ''));
  const idIdx = headers.findIndex((h) => h === 'ID' || h === 'Id');
  const optionKeys = OPTION_COLUMNS.map((o) => o.key);
  let updated = 0;
  let inserted = 0;
  const insertStmt = db.prepare(
    'INSERT INTO products (name, manufacturer, sku, description, dimensions, weight, color, department, price, fb_marketplace_url, pick_url, image_urls, furniture_type, status, quantity, cost, retail_price, notes, guidelines, ' +
    optionKeys.join(', ') +
    ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ' +
    optionKeys.map(() => '?').join(', ') +
    ')'
  );
  const updateStmt = db.prepare(
    'UPDATE products SET name=?, manufacturer=?, sku=?, description=?, dimensions=?, weight=?, color=?, department=?, price=?, fb_marketplace_url=?, pick_url=?, image_urls=?, furniture_type=?, status=?, quantity=?, cost=?, retail_price=?, notes=?, guidelines=?, ' +
    optionKeys.map((k) => k + '=?').join(', ') +
    ", updated_at=datetime('now') WHERE id=?"
  );
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    const rowObj = {};
    headers.forEach((h, j) => { if (h) rowObj[h] = row[j] != null ? row[j] : ''; });
    const idVal = idIdx >= 0 && row[idIdx] != null && String(row[idIdx]).trim() !== '' ? parseInt(String(row[idIdx]).trim(), 10) : NaN;
    const p = excelRowToDbRow(rowObj);
    const optionVals = optionKeys.map((k) => p[k] || 0);
    if (Number.isFinite(idVal) && idVal > 0) {
      const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(idVal);
      if (existing) {
        updateStmt.run(
          p.name, p.manufacturer, p.sku, p.description, p.dimensions, p.weight, p.color, p.department,
          p.price, p.fb_marketplace_url, p.pick_url, p.image_urls, p.furniture_type, p.status,
          p.quantity, p.cost, p.retail_price, p.notes, p.guidelines,
          ...optionVals,
          idVal
        );
        updated++;
        continue;
      }
    }
    insertStmt.run(
      p.name, p.manufacturer, p.sku, p.description, p.dimensions, p.weight, p.color, p.department,
      p.price, p.fb_marketplace_url, p.pick_url, p.image_urls, p.furniture_type, p.status || 'available',
      p.quantity, p.cost, p.retail_price, p.notes, p.guidelines,
      ...optionVals
    );
    inserted++;
  }
  return { updated, inserted };
}

module.exports = { pushToSheet, pullFromSheet };
