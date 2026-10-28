const { excelRowToDbRow, OPTION_COLUMNS } = require('./productExport');

// Reconcile a validated, nonempty sheet atomically with the local catalog.
function reconcileSheetProducts(db, raw) {
  if (raw.length < 2) throw new Error('Sheet is empty. Catalog was not changed.');
  const headers = raw[0].map((h) => (h != null ? String(h).trim() : ''));
  const idIdx = headers.findIndex((h) => h === 'ID' || h === 'Id');
  if (idIdx < 0 || !headers.includes('Name')) {
    throw new Error('Sheet must contain ID and Name columns. Catalog was not changed.');
  }
  const seenIds = new Set();
  const entries = raw.slice(1).flatMap((row, index) => {
    if (row.every(value => value == null || String(value).trim() === '')) return [];
    const rowObj = {};
    headers.forEach((h, j) => { if (h) rowObj[h] = row[j] != null ? row[j] : ''; });
    const idText = String(row[idIdx] ?? '').trim();
    const idVal = idText ? Number(idText) : null;
    if (idText && (!/^\d+$/.test(idText) || !Number.isSafeInteger(idVal) || idVal <= 0)) {
      throw new Error(`Invalid ID on sheet row ${index + 2}. Catalog was not changed.`);
    }
    if (idVal != null && seenIds.has(idVal)) {
      throw new Error(`Duplicate ID on sheet row ${index + 2}. Catalog was not changed.`);
    }
    if (idVal != null) seenIds.add(idVal);
    const product = excelRowToDbRow(rowObj);
    if (!product.name) throw new Error(`Missing Name on sheet row ${index + 2}. Catalog was not changed.`);
    return [{ idVal, product }];
  });
  if (!entries.length) throw new Error('Sheet is empty. Catalog was not changed.');
  return db.transaction(() => {
    const originalIds = db.prepare('SELECT id FROM products').all();
    const retainedIds = new Set();
    const optionKeys = OPTION_COLUMNS.map((o) => o.key);
    let updated = 0;
    let inserted = 0;
    const insertStmt = db.prepare(
      'INSERT INTO products (id, name, manufacturer, sku, description, dimensions, weight, color, department, price, fb_marketplace_url, pick_url, image_urls, furniture_type, status, quantity, cost, retail_price, notes, guidelines, ' +
      optionKeys.join(', ') +
      ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ' +
      optionKeys.map(() => '?').join(', ') +
      ')'
    );
    const updateStmt = db.prepare(
      'UPDATE products SET name=?, manufacturer=?, sku=?, description=?, dimensions=?, weight=?, color=?, department=?, price=?, fb_marketplace_url=?, pick_url=?, image_urls=?, furniture_type=?, status=?, quantity=?, cost=?, retail_price=?, notes=?, guidelines=?, ' +
      optionKeys.map((k) => k + '=?').join(', ') +
      ", updated_at=datetime('now') WHERE id=?"
    );
    // Insert explicit IDs before assigning IDs to new rows.
    for (const { idVal, product: p } of entries.filter(e => e.idVal != null).concat(entries.filter(e => e.idVal == null))) {
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
          retainedIds.add(idVal);
          updated++;
          continue;
        }
      }
      const result = insertStmt.run(
        idVal, p.name, p.manufacturer, p.sku, p.description, p.dimensions, p.weight, p.color, p.department,
        p.price, p.fb_marketplace_url, p.pick_url, p.image_urls, p.furniture_type, p.status || 'available',
        p.quantity, p.cost, p.retail_price, p.notes, p.guidelines,
        ...optionVals
      );
      retainedIds.add(Number(result.lastInsertRowid));
      inserted++;
    }
    const deleteStmt = db.prepare('DELETE FROM products WHERE id = ?');
    let deleted = 0;
    for (const { id } of originalIds) {
      if (!retainedIds.has(id)) deleted += deleteStmt.run(id).changes;
    }
    return { updated, inserted, deleted };
  })();
}

module.exports = { reconcileSheetProducts };
