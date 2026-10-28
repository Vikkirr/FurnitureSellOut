const fs = require('fs');
const path = require('path');
const { getDb } = require('./db');
const { reconcileSheetProducts } = require('./reconcileSheetProducts');
const { rowToExcelRow, EXCEL_COLUMNS, sheetNotesByProductId } = require('./productExport');

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
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: a1Range(sheetName, 'A:ZZ'),
  }).catch(() => ({ data: { values: [] } }));
  const notesById = sheetNotesByProductId(existing.data.values || []);
  const db = getDb();
  const rows = db.prepare('SELECT * FROM products ORDER BY id').all();
  const header = ['ID', ...EXCEL_COLUMNS];
  const data = rows.map((row) => {
    const excel = rowToExcelRow(row);
    excel.Notes = notesById.has(row.id) ? notesById.get(row.id) : '';
    return [row.id, ...EXCEL_COLUMNS.map((col) => excel[col] ?? '')];
  });
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
  return reconcileSheetProducts(db, res.data.values || []);
}

module.exports = { pushToSheet, pullFromSheet };
