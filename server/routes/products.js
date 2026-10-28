const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

/** Public catalog JSON: omit internal fields. pick_url and cost stay in the DB and admin. */
function toPublicProduct(row) {
  const { image_visibility, primary_image_index, notes, pick_url, cost, ...rest } = row;
  return { ...rest, image_urls: catalogImageUrls(row) };
}

/** For catalog: filter by visibility and put primary image first. */
function catalogImageUrls(row) {
  const urls = Array.isArray(row.image_urls) ? row.image_urls : JSON.parse(row.image_urls || '[]');
  if (!urls.length) return [];
  let visibility = [];
  try { visibility = JSON.parse(row.image_visibility || '[]'); } catch (_) {}
  const primary = Number(row.primary_image_index);
  const primaryIdx = Number.isFinite(primary) && primary >= 0 && primary < urls.length ? primary : 0;
  const visible = urls.map((_, i) => (Array.isArray(visibility) && visibility[i] !== undefined ? !!visibility[i] : true));
  const visibleUrls = urls.filter((_, i) => visible[i]);
  if (visibleUrls.length === 0) return [];
  const primaryUrl = urls[primaryIdx];
  if (!visible[primaryIdx]) return visibleUrls;
  const others = visibleUrls.filter(u => u !== primaryUrl);
  return [primaryUrl, ...others];
}

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { types, manufacturers, status, priceRangeCount, department } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    // Customer catalog: show both available and pending (pending items show with PENDING stamp)
    const publicStatus = status || 'available';
    if (publicStatus === 'available') {
      sql += " AND status IN ('available', 'pending')";
    } else {
      sql += ' AND status = ?';
      params.push(publicStatus);
    }
    if (department && typeof department === 'string' && department.trim()) {
      sql += " AND TRIM(COALESCE(department, '')) != '' AND LOWER(TRIM(department)) = LOWER(?)";
      params.push(department.trim());
    }
    if (types && typeof types === 'string' && types.trim()) {
      const typeList = types.split(',').map((t) => t.trim()).filter(Boolean);
      if (typeList.length > 0) {
        sql += ' AND furniture_type IN (' + typeList.map(() => '?').join(',') + ')';
        params.push(...typeList);
      }
    }
    if (manufacturers && typeof manufacturers === 'string' && manufacturers.trim()) {
      const manuList = manufacturers.split(',').map((m) => m.trim()).filter(Boolean);
      if (manuList.length > 0) {
        sql += ' AND manufacturer IN (' + manuList.map(() => '?').join(',') + ')';
        params.push(...manuList);
      }
    }
    const rangeCount = Number(priceRangeCount) || 0;
    if (rangeCount > 0) {
      const orParts = [];
      const rangeParams = [];
      for (let i = 0; i < rangeCount; i++) {
        const minVal = req.query[`minPrice${i}`];
        const maxVal = req.query[`maxPrice${i}`];
        const min = minVal != null && minVal !== '' ? Number(minVal) : null;
        const max = maxVal != null && maxVal !== '' ? Number(maxVal) : null;
        if (min != null && max != null) {
          orParts.push('(price >= ? AND price <= ?)');
          rangeParams.push(min, max);
        } else if (min != null) {
          orParts.push('(price >= ?)');
          rangeParams.push(min);
        } else if (max != null) {
          orParts.push('(price <= ?)');
          rangeParams.push(max);
        }
      }
      if (orParts.length > 0) {
        sql += ' AND (' + orParts.join(' OR ') + ')';
        params.push(...rangeParams);
      }
    }
    sql += ' ORDER BY created_at DESC';
    const rows = db.prepare(sql).all(...params);
    const products = rows.map(toPublicProduct);
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

/** Build WHERE clause and params for catalog filters. Accepts a query object (e.g. req.query). */
function buildFilterWhere(query) {
  const q = query || {};
  const { types, manufacturers, status, priceRangeCount, department } = q;
  const catalogStatus = status || 'available';
  let sql;
  const params = [];
  if (catalogStatus === 'available') {
    sql = " AND status IN ('available', 'pending')";
  } else {
    sql = ' AND status = ?';
    params.push(catalogStatus);
  }
  if (department && typeof department === 'string' && department.trim()) {
    sql += " AND TRIM(COALESCE(department, '')) != '' AND LOWER(TRIM(department)) = LOWER(?)";
    params.push(department.trim());
  }
  if (types && typeof types === 'string' && types.trim()) {
    const typeList = types.split(',').map((t) => t.trim()).filter(Boolean);
    if (typeList.length > 0) {
      sql += ' AND furniture_type IN (' + typeList.map(() => '?').join(',') + ')';
      params.push(...typeList);
    }
  }
  if (manufacturers && typeof manufacturers === 'string' && manufacturers.trim()) {
    const manuList = manufacturers.split(',').map((m) => m.trim()).filter(Boolean);
    if (manuList.length > 0) {
      sql += ' AND manufacturer IN (' + manuList.map(() => '?').join(',') + ')';
      params.push(...manuList);
    }
  }
  const rangeCount = Number(priceRangeCount) || 0;
  if (rangeCount > 0) {
    const orParts = [];
    const rangeParams = [];
    for (let i = 0; i < rangeCount; i++) {
      const minVal = q[`minPrice${i}`];
      const maxVal = q[`maxPrice${i}`];
      const min = minVal != null && minVal !== '' ? Number(minVal) : null;
      const max = maxVal != null && maxVal !== '' ? Number(maxVal) : null;
      if (min != null && max != null) {
        orParts.push('(price >= ? AND price <= ?)');
        rangeParams.push(min, max);
      } else if (min != null) {
        orParts.push('(price >= ?)');
        rangeParams.push(min);
      } else if (max != null) {
        orParts.push('(price <= ?)');
        rangeParams.push(max);
      }
    }
    if (orParts.length > 0) {
      sql += ' AND (' + orParts.join(' OR ') + ')';
      params.push(...rangeParams);
    }
  }
  return { sql, params };
}

/** Price ranges for facet counts (must match client PRICE_RANGES). */
const PRICE_RANGE_BOUNDS = [
  { id: '0-100', min: 0, max: 100 },
  { id: '100-250', min: 100, max: 250 },
  { id: '250-500', min: 250, max: 500 },
  { id: 'over500', min: 500, max: null },
];

router.get('/filter-counts', (req, res) => {
  try {
    const db = getDb();
    const q = req.query || {};
    const base = buildFilterWhere(q);
    const baseWhere = 'SELECT * FROM products WHERE 1=1 ' + base.sql;
    const baseParams = base.params;

    const typeWhere = buildFilterWhere({ ...q, types: undefined });
    const typeRows = db.prepare(
      'SELECT furniture_type, COUNT(*) as cnt FROM products WHERE 1=1 ' + typeWhere.sql + ' GROUP BY furniture_type'
    ).all(...typeWhere.params);
    const typeCounts = {};
    typeRows.forEach((r) => { typeCounts[r.furniture_type] = r.cnt; });

    const manuWhere = buildFilterWhere({ ...q, manufacturers: undefined });
    const manuRows = db.prepare(
      'SELECT manufacturer, COUNT(*) as cnt FROM products WHERE 1=1 ' + manuWhere.sql + ' GROUP BY manufacturer'
    ).all(...manuWhere.params);
    const manufacturerCounts = {};
    manuRows.forEach((r) => { manufacturerCounts[r.manufacturer] = r.cnt; });

    const priceWhere = buildFilterWhere({ ...q, priceRangeCount: undefined, minPrice0: undefined, maxPrice0: undefined, minPrice1: undefined, maxPrice1: undefined, minPrice2: undefined, maxPrice2: undefined, minPrice3: undefined, maxPrice3: undefined });
    const rowsForPrice = db.prepare('SELECT price FROM products WHERE 1=1 ' + priceWhere.sql).all(...priceWhere.params);
    const priceRangeCounts = PRICE_RANGE_BOUNDS.map(({ id, min, max }) => {
      const count = rowsForPrice.filter((r) => {
        const p = Number(r.price);
        if (max != null) return p >= min && p < max;
        return p >= min;
      }).length;
      return { id, count };
    });

    res.json({ typeCounts, manufacturerCounts, priceRangeCounts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch filter counts' });
  }
});

router.get('/filters', (req, res) => {
  try {
    const db = getDb();
    // Only from active (not sold) items
    const types = db.prepare("SELECT DISTINCT furniture_type FROM products WHERE status != 'sold' ORDER BY furniture_type").all();
    const manufacturers = db.prepare("SELECT DISTINCT manufacturer FROM products WHERE status != 'sold' ORDER BY manufacturer").all();
    const departments = db.prepare(
      "SELECT DISTINCT department FROM products WHERE status != 'sold' AND TRIM(COALESCE(department, '')) != '' ORDER BY department"
    ).all();
    res.json({
      furnitureTypes: types.map(r => r.furniture_type),
      manufacturers: manufacturers.map(r => r.manufacturer),
      departments: departments.map(r => (r.department != null ? r.department : '')),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
});

// Dedicated endpoint for top menu: departments from active (not sold) items only
router.get('/departments', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      "SELECT DISTINCT department FROM products WHERE status != 'sold' AND TRIM(COALESCE(department, '')) != '' ORDER BY department"
    ).all();
    res.json({ departments: rows.map(r => (r.department != null ? String(r.department) : '')).filter(Boolean) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Product not found' });
    res.json(toPublicProduct(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

module.exports = router;
