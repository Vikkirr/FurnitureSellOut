ery' },
  { key: 'local_curbside_delivery_fee', excel: 'Local Curbside Delivery (Fee)' },
  { key: 'meetup_public_place', excel: 'Meet Up (Public Place)' },
  { key: 'pickup', excel: 'Pick Up' },
];

const EXCEL_COLUMNS = [
  'Quantity', 'SKU', 'Name', 'Notes', 'Brand', 'Features', 'Weight', 'Dimensions',
  'Color', 'Department', 'Style', 'URL', 'Pick URL', 'Cost', 'Retail Price', '10% Margin', '5% Margin', '20% loss', 'Price', 'Guidelines', 'Images',
  ...OPTION_COLUMNS.map(o => o.excel),
];

function rowToExcelRow(row) {
  const cost = row.cost != null ? Number(row.cost) : null;
  const price = row.price != null ? Number(row.price) : 0;
  const retailPrice = row.retail_price != null ? Number(row.retail_price) : null;
  const margin10 = cost != null && cost#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const serverDir = path.join(ROOT, 'server');
const clientSrc = path.join(ROOT, 'client', 'src');

// ---------- server/productExport.js ----------
fs.writeFileSync(path.join(serverDir, 'productExport.js'), `/**
 * Shared product ↔ export/sheet row mapping. Used by admin export and Google Sheets sync.
 */
const OPTION_COLUMNS = [
  { key: 'brand_new', excel: 'Brand New' },
  { key: 'was_never_used', excel: 'Never Used' },
  { key: 'was_never_assembled', excel: 'Never Assembled' },
  { key: 'open_box', excel: 'Open Box' },
  { key: 'assembly_required', excel: 'Original Packaging' },
  { key: 'free_local_curbside_delivery', excel: 'Free Local Curbside Deliv > 0 ? Math.round((cost / 0.9) * 100) / 100 : '';
  const margin5 = cost != null && cost > 0 ? Math.round((cost / 0.95) * 100) / 100 : '';
  const loss20 = cost != null && cost > 0 ? Math.round((cost * 0.8) * 100) / 100 : '';
  const imageUrls = row.image_urls ? (typeof row.image_urls === 'string' ? row.image_urls : JSON.stringify(row.image_urls || [])) : '[]';
  let imagesStr = '';
  try {
    imagesStr = imageUrls.startsWith('[') ? (JSON.parse(imageUrls || '[]') || []).join(', ') : imageUrls;
  } catch (_) {
    imagesStr = imageUrls;
  }
  return {
    'Quantity': row.quantity != null ? row.quantity : 1,
    'SKU': row.sku ?? '',
    'Name': row.name ?? '',
    'Notes': row.notes ?? '',
    'Brand': row.manufacturer ?? '',
    'Features': row.description ?? '',
    'Weight': row.weight ?? '',
    'Dimensions': row.dimensions ?? '',
    'Color': row.color ?? '',
    'Department': row.department ?? '',
    'Style': row.furniture_type ?? '',
    'URL': row.fb_marketplace_url ?? '',
    'Pick URL': row.pick_url ?? '',
    'Cost': cost ?? '',
    'Retail Price': retailPrice ?? '',
    '10% Margin': margin10,
    '5% Margin': margin5,
    '20% loss': loss20,
    'Price': price,
    'Guidelines': row.guidelines ?? '',
    'Images': imagesStr,
    ...Object.fromEntries(OPTION_COLUMNS.map(o => [o.excel, row[o.key] ? 'Yes' : 'No'])),
  };
}

function optionInt(val) {
  if (val === true || val === 1 || val === '1' || (typeof val === 'string' && val.toLowerCase() === 'yes')) return 1;
  if (val === false || val === 0 || val === '0' || val === '' || val == null) return 0;
  return 0;
}

function excelRowToDbRow(excelRow) {
  const get = (key) => excelRow[key] != null && String(excelRow[key]).trim() !== '' ? excelRow[key] : null;
  const num = (key) => {
    const v = get(key);
    if (v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  let imagesStr = (get('Images') || '').toString().trim();
  if (imagesStr && !imagesStr.startsWith('[')) {
    const urls = imagesStr.split(/[,\\s]+/).filter(Boolean);
    imagesStr = JSON.stringify(urls);
  } else if (!imagesStr) {
    imagesStr = '[]';
  }
  return {
    quantity: num('Quantity') != null ? num('Quantity') : 1,
    sku: get('SKU'),
    name: (get('Name') || '').toString().trim() || '',
    manufacturer: (get('Brand') || '').toString().trim() || '',
    description: get('Features'),
    dimensions: get('Dimensions'),
    weight: get('Weight'),
    color: get('Color'),
    department: get('Department'),
    furniture_type: (get('Style') || '').toString().trim() || 'Other',
    fb_marketplace_url: get('URL'),
    pick_url: get('Pick URL'),
    cost: num('Cost'),
    retail_price: num('Retail Price'),
    price: num('Price') != null ? num('Price') : 0,
    notes: get('Notes'),
    guidelines: get('Guidelines'),
    image_urls: imagesStr,
    status: 'available',
    ...Object.fromEntries(OPTION_COLUMNS.map(o => [o.key, optionInt(excelRow[o.excel])])),
  };
}

module.exports = {
  OPTION_COLUMNS,
  EXCEL_COLUMNS,
  rowToExcelRow,
  excelRowToDbRow,
};
`);
console.log('Created server/productExport.js');

// ---------- server/sheetsSync.js ----------
fs.writeFileSync(path.join(serverDir, 'sheetsSync.js'), `const fs = require('fs');
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

const SHEET_NAME = 'Sheet1';

async function pushToSheet() {
  const sheetId = getSheetId();
  const sheets = await getSheetsClient();
  const db = getDb();
  const rows = db.prepare('SELECT * FROM products ORDER BY id').all();
  const header = ['ID', ...EXCEL_COLUMNS];
  const data = rows.map((row) => [row.id, ...EXCEL_COLUMNS.map((col) => rowToExcelRow(row)[col] ?? '')]);
  const range = SHEET_NAME + '!A1';
  await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: SHEET_NAME + '!A:ZZ' }).catch(() => {});
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [header, ...data] },
  });
  return { rows: rows.length };
}

async function pullFromSheet() {
  const sheetId = getSheetId();
  const sheets = await getSheetsClient();
  const db = getDb();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: SHEET_NAME + '!A:ZZ',
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
`);
console.log('Created server/sheetsSync.js');

// ---------- server/routes/admin.js ----------
const adminPath = path.join(serverDir, 'routes', 'admin.js');
let admin = fs.readFileSync(adminPath, 'utf8');
if (!admin.includes("require('../sheetsSync')")) {
  admin = admin.replace(
    "const { fetchProductFromUrl } = require('../aiProductFetch');\n\nconst upload = multer",
    "const { fetchProductFromUrl } = require('../aiProductFetch');\nconst productExport = require('../productExport');\nconst { pushToSheet, pullFromSheet } = require('../sheetsSync');\nconst OPTION_COLUMNS = productExport.OPTION_COLUMNS;\nconst EXCEL_COLUMNS = productExport.EXCEL_COLUMNS;\nconst rowToExcelRow = productExport.rowToExcelRow;\n\nconst upload = multer"
  );
  admin = admin.replace(
    /\nconst OPTION_COLUMNS = \[\s*\{ key: 'brand_new', excel: 'Brand New' \},[\s\S]*?\{ key: 'pickup', excel: 'Pick Up' \},\s*\];\s*\nconst EXCEL_COLUMNS = /,
    '\nconst EXCEL_COLUMNS_REMOVED_USE_PRODUCT_EXPORT = '
  );
  admin = admin.replace(
    /\nconst EXCEL_COLUMNS_REMOVED_USE_PRODUCT_EXPORT = \[\s*'Quantity', 'SKU',[\s\S]*?\.\.\.OPTION_COLUMNS\.map\(o => o\.excel\),\s*\];\s*\nfunction sendTemplateResponse/,
    '\nfunction sendTemplateResponse'
  );
  admin = admin.replace(
    /\nfunction rowToExcelRow\(row\) \{\s*const cost = row\.cost[\s\S]*?\n\s*\.\.\.Object\.fromEntries\(OPTION_COLUMNS\.map\(o => \[o\.excel, row\[o\.key\] \? 'Yes' : 'No'\]\)\),\s*\};[\s\S]*?\}\s*\n\nrouter\.get\('\/export'/,
    "\n\nrouter.get('/export'"
  );
  admin = admin.replace(
    "module.exports = router;\nmodule.exports.sendTemplateResponse",
    `router.post('/sync-to-sheet', requireAdmin, async (req, res) => {
  try {
    const result = await pushToSheet();
    res.json({ ok: true, rows: result.rows });
  } catch (err) {
    console.error('sync-to-sheet:', err);
    res.status(400).json({ error: err.message || 'Failed to push to Google Sheet' });
  }
});
router.post('/sync-from-sheet', requireAdmin, async (req, res) => {
  try {
    const result = await pullFromSheet();
    res.json({ ok: true, updated: result.updated, inserted: result.inserted });
  } catch (err) {
    console.error('sync-from-sheet:', err);
    res.status(400).json({ error: err.message || 'Failed to pull from Google Sheet' });
  }
});

module.exports = router;
module.exports.sendTemplateResponse`
  );
  fs.writeFileSync(adminPath, admin);
  console.log('Updated server/routes/admin.js');
} else {
  console.log('server/routes/admin.js already wired');
}

// ---------- client/src/api.ts ----------
const apiPath = path.join(clientSrc, 'api.ts');
let api = fs.readFileSync(apiPath, 'utf8');
if (!api.includes('adminSyncToSheet')) {
  api = api.replace(
    "export function adminExportUrl(): string {",
    `export async function adminSyncToSheet(): Promise<{ ok: boolean; rows?: number; error?: string }> {
  const res = await adminFetch(\\\`\${API}/admin/sync-to-sheet\\\`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: (data as { error?: string }).error || 'Failed' };
  return data as { ok: boolean; rows?: number };
}
export async function adminSyncFromSheet(): Promise<{ ok: boolean; updated?: number; inserted?: number; error?: string }> {
  const res = await adminFetch(\\\`\${API}/admin/sync-from-sheet\\\`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: (data as { error?: string }).error || 'Failed' };
  return data as { ok: boolean; updated?: number; inserted?: number };
}

export function adminExportUrl(): string {`
  );
  fs.writeFileSync(apiPath, api);
  console.log('Updated client/src/api.ts');
} else {
  console.log('client/src/api.ts already has sync functions');
}

// ---------- client/src/components/AdminPanel.tsx ----------
const panelPath = path.join(clientSrc, 'components', 'AdminPanel.tsx');
let panel = fs.readFileSync(panelPath, 'utf8');
if (!panel.includes('adminSyncToSheet')) {
  panel = panel.replace(
    "  adminFetchProductFromUrl,\n  type Product,",
    "  adminFetchProductFromUrl,\n  adminSyncToSheet,\n  adminSyncFromSheet,\n  type Product,"
  );
  panel = panel.replace(
    '<ExportExcelButton />',
    \`<ExportExcelButton />
          <button type="button" onClick={async () => { setMessage(''); try { const r = await adminSyncToSheet(); if (r.ok && r.rows != null) setMessage(\\\`Pushed \\\${r.rows} rows to Google Sheet.\\\`); else setMessage(r.error || 'Push failed'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Push failed'); } }}>Push to Google Sheet</button>
          <button type="button" onClick={async () => { setMessage(''); try { const r = await adminSyncFromSheet(); if (r.ok) { setMessage(\\\`Updated \\\${r.updated ?? 0}, inserted \\\${r.inserted ?? 0}.\\\`); load(); } else setMessage(r.error || 'Pull failed'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Pull failed'); } }}>Pull from Google Sheet</button>\`
  );
  fs.writeFileSync(panelPath, panel);
  console.log('Updated client/src/components/AdminPanel.tsx');
} else {
  console.log('AdminPanel.tsx already has sync buttons');
}

console.log('\\nDone. Ensure .env has GOOGLE_SHEET_ID and GOOGLE_APPLICATION_CREDENTIALS.');
