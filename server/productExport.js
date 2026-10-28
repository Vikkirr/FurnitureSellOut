/**
 * Shared product ↔ export/sheet row mapping. Used by admin export and Google Sheets sync.
 */
const OPTION_COLUMNS = [
  { key: 'brand_new', excel: 'Brand New' },
  { key: 'was_never_used', excel: 'Never Used' },
  { key: 'was_never_assembled', excel: 'Never Assembled' },
  { key: 'open_box', excel: 'Open Box' },
  { key: 'assembly_required', excel: 'Original Packaging' },
  { key: 'free_local_curbside_delivery', excel: 'Free Local Curbside Delivery' },
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
  const margin10 = cost != null && cost > 0 ? Math.round((cost / 0.9) * 100) / 100 : '';
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
    // Notes live only in the Google Sheet. Never copy DB notes back onto the sheet.
    'Notes': '',
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
    const urls = imagesStr.split(/[,\s]+/).filter(Boolean);
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
    notes: null,
    guidelines: get('Guidelines'),
    image_urls: imagesStr,
    status: 'available',
    ...Object.fromEntries(OPTION_COLUMNS.map(o => [o.key, optionInt(excelRow[o.excel])])),
  };
}

/** Read Notes from a sheet values grid, keyed by product ID. Used so push does not wipe sheet notes. */
function sheetNotesByProductId(raw) {
  const map = new Map();
  if (!raw || raw.length < 2) return map;
  const headers = raw[0].map((h) => (h != null ? String(h).trim() : ''));
  const idIdx = headers.findIndex((h) => h === 'ID' || h === 'Id');
  const notesIdx = headers.findIndex((h) => h === 'Notes' || h === 'notes');
  if (idIdx < 0 || notesIdx < 0) return map;
  for (const row of raw.slice(1)) {
    const idText = String(row[idIdx] ?? '').trim();
    if (!/^\d+$/.test(idText)) continue;
    map.set(Number(idText), row[notesIdx] != null ? String(row[notesIdx]) : '');
  }
  return map;
}

module.exports = {
  OPTION_COLUMNS,
  EXCEL_COLUMNS,
  rowToExcelRow,
  excelRowToDbRow,
  sheetNotesByProductId,
};
