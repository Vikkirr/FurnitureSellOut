const express = require('express');
const XLSX = require('xlsx');
const multer = require('multer');
const router = express.Router();
const { getDb } = require('../db');
const { requireAdmin, requireAdminOrImportToken } = require('../middleware/auth');
const importTokens = require('../importTokens');
const settings = require('../settings');
const { fetchProductFromUrl } = require('../aiProductFetch');
const productExport = require('../productExport');
const { pushToSheet, pullFromSheet } = require('../sheetsSync');
const { syncDbFromProd } = require('../syncDbFromProd');
const { syncDbToProd } = require('../syncDbToProd');
const { syncDbFromDev } = require('../syncDbFromDev');
const OPTION_COLUMNS = productExport.OPTION_COLUMNS;
const EXCEL_COLUMNS = productExport.EXCEL_COLUMNS;
const rowToExcelRow = productExport.rowToExcelRow;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function sendTemplateResponse(res) {
  try {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([EXCEL_COLUMNS]);
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.status(200);
    res.setHeader('Content-Disposition', 'attachment; filename=catalog-template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('Export template error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to export template' });
    }
  }
}

router.get('/export-template', (req, res) => {
  sendTemplateResponse(res);
});

router.post('/login', (req, res) => {
  const { password } = req.body;
  const correct = process.env.ADMIN_PASSWORD || 'changeme';
  if (password !== correct) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  req.session.admin = true;
  req.session.save((err) => {
    if (err) {
      console.error('Session save error:', err);
      return res.status(500).json({ error: 'Session error' });
    }
    const importToken = importTokens.add();
    res.json({ ok: true, importToken });
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (req.session && req.session.admin) {
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Not authenticated' });
});

function getCell(row, ...keys) {
  for (const k of keys) {
    if (row[k] != null && row[k] !== '') return row[k];
    const lower = k.toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === lower) return row[key];
    }
  }
  return undefined;
}

function yesNoToInt(v) {
  if (v == null || v === '') return 0;
  const s = String(v).trim().toLowerCase();
  if (s === 'yes' || s === 'y' || s === '1' || s === 'true') return 1;
  return 0;
}

function handleImport(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    const db = getDb();
    const optionPlaceholders = OPTION_COLUMNS.map(() => '?').join(', ');
    const insert = db.prepare(`
      INSERT INTO products (name, manufacturer, sku, description, dimensions, weight, color, department, price, fb_marketplace_url, pick_url, image_urls, furniture_type, status, quantity, cost, retail_price, notes, guidelines, ${OPTION_COLUMNS.map(o => o.key).join(', ')})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${optionPlaceholders})
    `);
    const update = db.prepare(`
      UPDATE products SET name=?, manufacturer=?, sku=?, description=?, dimensions=?, weight=?, color=?, department=?, price=?, fb_marketplace_url=?, pick_url=?, image_urls=?, furniture_type=?, status=?, quantity=?, cost=?, retail_price=?, notes=?, guidelines=?, ${OPTION_COLUMNS.map(o => o.key + '=?').join(', ')}, updated_at=datetime('now') WHERE id=?
    `);
    let added = 0, updated = 0, alreadyInCatalog = 0;
    const errors = [];
    const getExistingByName = db.prepare('SELECT id FROM products WHERE LOWER(TRIM(name)) = LOWER(?)');
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = (getCell(r, 'Name', 'name') != null ? String(getCell(r, 'Name', 'name')).trim() : '') || '';
      const manufacturer = (getCell(r, 'Brand', 'brand', 'manufacturer') != null ? String(getCell(r, 'Brand', 'brand', 'manufacturer')).trim() : '') || '';
      const priceVal = getCell(r, 'Price', 'price');
      const price = Number(priceVal);
      if (!name || !manufacturer || isNaN(price) || price < 0) {
        errors.push({ row: i + 2, message: 'Missing Name, Brand, or invalid Price' });
        continue;
      }
      const sku = getCell(r, 'SKU', 'sku');
      const description = getCell(r, 'Features', 'features', 'description');
      const dimensions = getCell(r, 'Dimensions', 'dimensions');
      const weight = getCell(r, 'Weight', 'weight');
      const color = getCell(r, 'Color', 'color');
      const department = getCell(r, 'Department', 'department');
      const furnitureType = (getCell(r, 'Style', 'style', 'furniture_type') != null ? String(getCell(r, 'Style', 'style', 'furniture_type')).trim() : '') || 'Other';
      const url = getCell(r, 'URL', 'url', 'fb_marketplace_url');
      const pickUrl = getCell(r, 'Pick URL', 'pick_url', 'pick url');
      const costVal = getCell(r, 'Cost', 'cost');
      const cost = costVal != null && costVal !== '' ? Number(costVal) : null;
      const retailPriceVal = getCell(r, 'Retail Price', 'Retail Price', 'retail_price');
      const retailPrice = retailPriceVal != null && retailPriceVal !== '' ? Number(retailPriceVal) : null;
      const quantityVal = getCell(r, 'Quantity', 'quantity');
      const quantity = quantityVal != null && quantityVal !== '' ? parseInt(quantityVal, 10) : 1;
      const imagesVal = getCell(r, 'Images', 'images', 'image_urls');
      let imageUrls = '[]';
      if (imagesVal != null && imagesVal !== '') {
        if (typeof imagesVal === 'string' && (imagesVal.startsWith('[') || imagesVal.startsWith('http'))) {
          imageUrls = imagesVal.startsWith('[') ? imagesVal : JSON.stringify(imagesVal.split(',').map((s) => s.trim()).filter(Boolean));
        } else {
          imageUrls = JSON.stringify(String(imagesVal).split(',').map((s) => s.trim()).filter(Boolean));
        }
      }
      const id = getCell(r, 'id', 'ID');
      const skuStr = sku != null ? String(sku).trim() : null;
      const optionVals = OPTION_COLUMNS.map(o => yesNoToInt(getCell(r, o.excel, o.key)));
      const existingById = id != null && Number(id) > 0 ? db.prepare('SELECT id FROM products WHERE id = ?').get(Number(id)) : null;
      const existingBySku = skuStr ? db.prepare('SELECT id FROM products WHERE sku = ?').get(skuStr) : null;
      const existingByName = getExistingByName.get(name);
      const departmentStr = department != null && department !== '' ? String(department).trim() : null;
      const pickUrlStr = pickUrl != null && pickUrl !== '' ? String(pickUrl).trim() : null;
      const notesVal = getCell(r, 'Notes', 'notes');
      const notesStr = notesVal != null && notesVal !== '' ? String(notesVal).trim() : null;
      const guidelinesVal = getCell(r, 'Guidelines', 'guidelines');
      const guidelinesStr = guidelinesVal != null && guidelinesVal !== '' ? String(guidelinesVal).trim() : null;

      if (existingById) {
        update.run(
          name, manufacturer, skuStr, description != null ? String(description).trim() : null,
          dimensions != null ? String(dimensions).trim() : null, weight != null ? String(weight).trim() : null, color != null ? String(color).trim() : null, departmentStr,
          price, url != null ? String(url).trim() : null, pickUrlStr, imageUrls, furnitureType, 'available', quantity != null && !isNaN(quantity) ? quantity : 1, cost, retailPrice,
          notesStr, guidelinesStr, ...optionVals, existingById.id
        );
        updated++;
      } else if (existingBySku || existingByName) {
        alreadyInCatalog++;
      } else {
        insert.run(
          name, manufacturer, skuStr, description != null ? String(description).trim() : null,
          dimensions != null ? String(dimensions).trim() : null, weight != null ? String(weight).trim() : null, color != null ? String(color).trim() : null, departmentStr,
          price, url != null ? String(url).trim() : null, pickUrlStr, imageUrls, furnitureType, 'available', quantity != null && !isNaN(quantity) ? quantity : 1, cost, retailPrice,
          notesStr, guidelinesStr, ...optionVals
        );
        added++;
      }
    }
    res.json({ added, updated, alreadyInCatalog, errors });
  } catch (err) {
    console.error('Import error:', err);
    const message = err && typeof err.message === 'string' ? err.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to import', message });
  }
}

// Import is public so it works when session cookie is not sent (e.g. some proxies).
// Restrict access at the network level (firewall, VPN) if needed.
router.post('/import', upload.single('file'), handleImport);

router.use(requireAdmin);

router.get('/settings', (req, res) => {
  try {
    const data = settings.load();
    if (req.query.debug === '1') {
      const p = require('path');
      const dir = settings.getDataDir?.() ?? null;
      data._debug = { dataDir: dir, settingsPath: dir ? p.join(dir, 'settings.json') : null, cwd: process.cwd() };
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

router.put('/settings', (req, res) => {
  try {
    const body = req.body || {};
    const openaiApiKey = body.openaiApiKey;
    const extractionPrompt = body.extractionPrompt;
    const stampImagePath = body.stampImagePath;
    const updates = {};
    if (extractionPrompt !== undefined && extractionPrompt !== null) updates.extractionPrompt = String(extractionPrompt);
    if (stampImagePath !== undefined && stampImagePath !== null) updates.stampImagePath = String(stampImagePath || '').trim();
    if (openaiApiKey !== undefined && openaiApiKey !== null && openaiApiKey !== '' && !String(openaiApiKey).startsWith('sk-…')) {
      updates.openaiApiKey = String(openaiApiKey).trim();
    }
    settings.save(updates);
    const loaded = settings.load();
    res.json(loaded);
  } catch (err) {
    console.error('PUT /settings error:', err);
    const pathUsed = err.settingsPath || 'data/settings.json';
    let message = err.message || 'Failed to save settings';
    if (err.code === 'EACCES') message = `Permission denied writing to ${pathUsed}. Fix: chmod or chown the data/ folder so the server can write.`;
    else if (err.code === 'ENOENT') message = `Path invalid: ${pathUsed}. Ensure the server is started from the project root.`;
    res.status(500).json({ error: message, code: err.code });
  }
});

router.post('/fetch-product-from-url', async (req, res) => {
  try {
    const { url } = req.body || {};
    const product = await fetchProductFromUrl(url);
    res.json(product);
  } catch (err) {
    console.error('fetch-product-from-url:', err);
    const message = err && err.message ? err.message : 'Failed to fetch product from URL';
    res.status(400).json({ error: message });
  }
});

router.get('/import-token', (req, res) => {
  const token = importTokens.add();
  res.json({ importToken: token });
});

router.get('/products', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
    res.json(rows.map(row => {
      let image_visibility = [];
      try { image_visibility = JSON.parse(row.image_visibility || '[]'); } catch (_) {}
      return {
        ...row,
        image_urls: JSON.parse(row.image_urls || '[]'),
        image_visibility,
        primary_image_index: row.primary_image_index != null ? Number(row.primary_image_index) : 0,
      };
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

function optionInt(p, key) {
  const v = p[key];
  if (v === true || v === 1 || v === '1') return 1;
  if (v === false || v === 0 || v === '0' || v === '' || v == null) return 0;
  return 0;
}

router.post('/products', (req, res) => {
  try {
    const db = getDb();
    const p = req.body;
    const imageUrls = Array.isArray(p.image_urls) ? JSON.stringify(p.image_urls) : (p.image_urls || '[]');
    const optionVals = OPTION_COLUMNS.map(o => optionInt(p, o.key));
    const stmt = db.prepare(`
      INSERT INTO products (name, manufacturer, sku, description, dimensions, weight, color, department, price, fb_marketplace_url, pick_url, image_urls, furniture_type, status, quantity, cost, retail_price, notes, guidelines, ${OPTION_COLUMNS.map(o => o.key).join(', ')})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${OPTION_COLUMNS.map(() => '?').join(', ')})
    `);
    const result = stmt.run(
      p.name || '',
      p.manufacturer || '',
      p.sku || null,
      p.description || null,
      p.dimensions || null,
      p.weight || null,
      p.color || null,
      p.department || null,
      Number(p.price) || 0,
      p.fb_marketplace_url || null,
      p.pick_url || null,
      imageUrls,
      p.furniture_type || 'Other',
      p.status || 'available',
      p.quantity != null ? parseInt(p.quantity, 10) : 1,
      p.cost != null && p.cost !== '' ? Number(p.cost) : null,
      p.retail_price != null && p.retail_price !== '' ? Number(p.retail_price) : null,
      p.notes != null && p.notes !== '' ? String(p.notes).trim() : null,
      p.guidelines != null && p.guidelines !== '' ? String(p.guidelines).trim() : null,
      ...optionVals
    );
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ ...row, image_urls: JSON.parse(row.image_urls || '[]') });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

function toNumOrNull(v) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

router.patch('/products/:id', (req, res) => {
  try {
    const db = getDb();
    const id = req.params.id;
    const p = req.body;
    const allowed = ['name', 'manufacturer', 'sku', 'description', 'dimensions', 'weight', 'color', 'department', 'price', 'fb_marketplace_url', 'pick_url', 'image_urls', 'image_visibility', 'primary_image_index', 'furniture_type', 'status', 'quantity', 'cost', 'retail_price', 'notes', 'guidelines'];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (p[key] !== undefined) {
        if (key === 'image_urls') {
          updates.push('image_urls = ?');
          values.push(Array.isArray(p[key]) ? JSON.stringify(p[key]) : p[key]);
        } else if (key === 'image_visibility') {
          updates.push('image_visibility = ?');
          values.push(Array.isArray(p[key]) ? JSON.stringify(p[key].map(v => v ? 1 : 0)) : '[]');
        } else if (key === 'primary_image_index') {
          updates.push('primary_image_index = ?');
          values.push(Number(p[key]) >= 0 ? Number(p[key]) : 0);
        } else if (key === 'cost' || key === 'retail_price') {
          const val = toNumOrNull(p[key]);
          updates.push(`${key} = ?`);
          values.push(val);
        } else {
          updates.push(`${key} = ?`);
          values.push(p[key]);
        }
      }
    }
    // Always apply all option columns on PATCH so checkbox state is saved (use body value or 0)
    for (const o of OPTION_COLUMNS) {
      updates.push(`${o.key} = ?`);
      values.push(optionInt(p, o.key));
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Product not found' });
    let image_visibility = [];
    try { image_visibility = JSON.parse(row.image_visibility || '[]'); } catch (_) {}
    res.json({
      ...row,
      image_urls: JSON.parse(row.image_urls || '[]'),
      image_visibility,
      primary_image_index: row.primary_image_index != null ? Number(row.primary_image_index) : 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.delete('/products/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

router.post('/products/bulk-price', (req, res) => {
  try {
    const db = getDb();
    const { ids, price } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || price == null) {
      return res.status(400).json({ error: 'ids array and price required' });
    }
    const stmt = db.prepare("UPDATE products SET price = ?, updated_at = datetime('now') WHERE id = ?");
    for (const id of ids) {
      stmt.run(Number(price), id);
    }
    res.json({ updated: ids.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update prices' });
  }
});

router.post('/products/bulk-status', (req, res) => {
  try {
    const db = getDb();
    const body = req.body || {};
    const rawIds = Array.isArray(body.ids) ? body.ids : [];
    const status = body.status;
    if (!['available', 'pending', 'sold'].includes(status)) {
      return res.status(400).json({ error: 'ids array and status (available|pending|sold) required' });
    }
    const ids = rawIds.map((id) => Number(id)).filter((n) => Number.isFinite(n));
    if (ids.length === 0) {
      return res.status(400).json({ error: 'ids array and status (available|pending|sold) required' });
    }
    const run = db.transaction(() => {
      const stmt = db.prepare("UPDATE products SET status = ?, updated_at = datetime('now') WHERE id = ?");
      for (const id of ids) {
        stmt.run(status, id);
      }
    });
    run();
    res.json({ updated: ids.length });
  } catch (err) {
    console.error('bulk-status error:', err);
    const payload = { error: 'Failed to update status' };
    if (err && err.message) payload.message = err.message;
    res.status(500).json(payload);
  }
});

router.get('/export', (req, res) => {
  try {
    const XLSX = require('xlsx');
    const db = getDb();
    const rows = db.prepare('SELECT * FROM products ORDER BY id').all();
    const data = rows.map(rowToExcelRow);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data, { header: EXCEL_COLUMNS });
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=catalog.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export' });
  }
});

router.post('/sync-to-sheet', requireAdmin, async (req, res) => {
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

router.get('/sync/capabilities', requireAdmin, (req, res) => {
  const fromProd = !!(process.env.SYNC_PROD_SSH_KEY_PATH && process.env.SYNC_PROD_SSH_KEY_PATH.trim());
  const fromDev = !!(process.env.SYNC_DEV_SSH_KEY_PATH && process.env.SYNC_DEV_SSH_KEY_PATH.trim());
  res.json({ fromProd, fromDev });
});

router.post('/sync/db-from-prod', requireAdmin, (req, res) => {
  try {
    const result = syncDbFromProd();
    res.json(result);
  } catch (err) {
    console.error('sync/db-from-prod:', err);
    res.status(400).json({ error: err.message || 'Failed to sync DB from Prod' });
  }
});

router.post('/sync/db-to-prod', requireAdmin, (req, res) => {
  try {
    const result = syncDbToProd();
    res.json(result);
  } catch (err) {
    console.error('sync/db-to-prod:', err);
    res.status(400).json({ error: err.message || 'Failed to sync DB to Prod' });
  }
});

router.post('/sync/db-from-dev', requireAdmin, (req, res) => {
  try {
    const result = syncDbFromDev();
    res.json(result);
  } catch (err) {
    console.error('sync/db-from-dev:', err);
    res.status(400).json({ error: err.message || 'Failed to sync DB from Dev' });
  }
});

module.exports = router;
module.exports.sendTemplateResponse = sendTemplateResponse;
module.exports.importUpload = upload;
module.exports.handleImport = handleImport;
