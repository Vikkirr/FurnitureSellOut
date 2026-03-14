import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  adminGetProducts,
  adminAddProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminBulkStatus,
  adminImport,
  adminRefreshImportToken,
  adminFetchProductFromUrl,
  adminSyncToSheet,
  adminSyncFromSheet,
  adminGetSyncCapabilities,
  adminSyncDbFromProd,
  adminSyncDbToProd,
  type Product,
} from '../api';

function ExportExcelButton() {
  const [loading, setLoading] = useState(false);
  const exportExcel = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/export', { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'catalog.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  return (
    <button type="button" onClick={exportExcel} disabled={loading}>
      {loading ? 'Exporting…' : 'Export Excel'}
    </button>
  );
}

const OPTION_EXCEL_HEADERS = [
  'Brand New', 'Never Used', 'Never Assembled', 'Open Box', 'Original Packaging',
  'Free Local Curbside Delivery', 'Local Curbside Delivery (Fee)', 'Meet Up (Public Place)', 'Pick Up',
];

const TEMPLATE_COLUMNS = [
  'Quantity', 'SKU', 'Name', 'Notes', 'Brand', 'Features', 'Weight', 'Dimensions',
  'Color', 'Department', 'Style', 'URL', 'Pick URL', 'Cost', 'Retail Price', '10% Margin', '5% Margin', '20% loss', 'Price', 'Guidelines', 'Images',
  ...OPTION_EXCEL_HEADERS,
];

const OPTION_KEYS = [
  'brand_new', 'was_never_used', 'was_never_assembled', 'open_box', 'assembly_required',
  'free_local_curbside_delivery', 'local_curbside_delivery_fee', 'meetup_public_place', 'pickup',
] as const;

/** Two-line header text for option columns (line1 \n line2). Same order as OPTION_KEYS. */
const OPTION_HEADER_LINES = [
  'Brand\nNew',
  'Never\nUsed',
  'Was Never\nAssembled',
  'Open\nBox',
  'Original\nPackaging',
  'Free Local\nCurbside Delivery',
  'Local Curbside\nDelivery (Fee)',
  'Meet Up\n(Public Place)',
  'Pick\nUp',
];

type EditableField =
  | 'quantity' | 'sku' | 'name' | 'notes' | 'manufacturer' | 'description' | 'weight' | 'dimensions' | 'color' | 'department'
  | 'furniture_type' | 'fb_marketplace_url' | 'pick_url' | 'cost' | 'retail_price' | 'price' | 'guidelines' | 'image_urls' | 'status'
  | (typeof OPTION_KEYS)[number];

function getSortValue(p: Product, key: string): number | string {
  switch (key) {
    case 'quantity': return p.quantity ?? 0;
    case 'sku': return (p.sku ?? '').toLowerCase();
    case 'name': return (p.name ?? '').toLowerCase();
    case 'notes': return (p.notes ?? '').toLowerCase();
    case 'manufacturer': return (p.manufacturer ?? '').toLowerCase();
    case 'description': return (p.description ?? '').toLowerCase();
    case 'weight': return (p.weight ?? '').toLowerCase();
    case 'dimensions': return (p.dimensions ?? '').toLowerCase();
    case 'color': return (p.color ?? '').toLowerCase();
    case 'department': return (p.department ?? '').toLowerCase();
    case 'furniture_type': return (p.furniture_type ?? '').toLowerCase();
    case 'fb_marketplace_url': return (p.fb_marketplace_url ?? '').toLowerCase();
    case 'pick_url': return (p.pick_url ?? '').toLowerCase();
    case 'cost': return p.cost != null ? Number(p.cost) : -Infinity;
    case 'retail_price': return p.retail_price != null ? Number(p.retail_price) : -Infinity;
    case 'margin10': return p.cost != null && p.cost > 0 ? p.cost / 0.9 : -Infinity;
    case 'margin5': return p.cost != null && p.cost > 0 ? p.cost / 0.95 : -Infinity;
    case 'loss20': return p.cost != null && p.cost > 0 ? p.cost * 0.8 : -Infinity;
    case 'price': return Number(p.price) ?? 0;
    case 'guidelines': return (p.guidelines ?? '').toLowerCase();
    case 'images': return (p.image_urls || []).length;
    case 'status': return (p.status ?? '').toLowerCase();
    case 'created_at': return (p.created_at ?? '').toLowerCase();
    default:
      if (OPTION_KEYS.includes(key as (typeof OPTION_KEYS)[number])) return (p as Record<string, number>)[key] ?? 0;
      return '';
  }
}

function compareSort(a: number | string, b: number | string, dir: 'asc' | 'desc'): number {
  const mult = dir === 'asc' ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return mult * (a - b);
  return mult * String(a).localeCompare(String(b), undefined, { numeric: true });
}

function TemplateDownloadButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const downloadTemplate = async () => {
    setLoading(true);
    setError(null);
    try {
      const mod = await import('xlsx');
      const XLSX = mod.default ?? mod;
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS]);
      XLSX.utils.book_append_sheet(wb, ws, 'Products');
      XLSX.writeFile(wb, 'catalog-template.xlsx');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Template download failed');
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <button
        type="button"
        onClick={downloadTemplate}
        disabled={loading}
        className="admin-btn-primary"
      >
        {loading ? 'Downloading…' : 'Template download'}
      </button>
      {error && <span className="admin-error">{error}</span>}
    </>
  );
}

type AdminPanelProps = { onUnauthorized?: () => void };

export default function AdminPanel({ onUnauthorized }: AdminPanelProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: number; field: EditableField } | null>(null);
  const [editImageUrls, setEditImageUrls] = useState<string[]>([]);
  const [editImageVisibility, setEditImageVisibility] = useState<boolean[]>([]);
  const [editPrimaryIndex, setEditPrimaryIndex] = useState(0);
  const [editImageAddUrl, setEditImageAddUrl] = useState('');
  const [fetchAiLoadingId, setFetchAiLoadingId] = useState<number | null>(null);
  const [addFormPrefill, setAddFormPrefill] = useState<Partial<Product> | null>(null);
  const [addFormPrefillKey, setAddFormPrefillKey] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [syncCapabilities, setSyncCapabilities] = useState<{ fromProd: boolean; fromDev: boolean } | null>(null);

  useEffect(() => {
    adminGetSyncCapabilities().then(setSyncCapabilities).catch(() => setSyncCapabilities({ fromProd: false, fromDev: false }));
  }, []);

  useEffect(() => {
    if (editing) {
      const urls = editing.image_urls || [];
      const vis = (editing.image_visibility || []).map(v => !!v);
      const padded = urls.map((_, i) => (i < vis.length ? vis[i] : true));
      setEditImageUrls(urls);
      setEditImageVisibility(padded);
      setEditPrimaryIndex(Math.min(editing.primary_image_index ?? 0, Math.max(0, urls.length - 1)));
      setEditImageAddUrl('');
    }
  }, [editing?.id]);

  const load = () => {
    setLoadError('');
    setLoading(true);
    setLoadError(null);
    adminGetProducts()
      .then((data) => {
        setProducts(data);
        setLoadError(null);
      })
      .catch((err) => {
        console.error(err);
        const is401 = err && typeof err === 'object' && 'is401' in err && (err as { is401?: boolean }).is401;
        const message = is401
          ? 'Session expired or not recognized. Use Retry or log out and log in again.'
          : (err instanceof Error ? err.message : 'Failed to load products');
        setLoadError(message);
        // Do not call onUnauthorized here: it was kicking users back to login right after
        // a successful login (e.g. cookie not yet sent on first request). User can use
        // Retry or log out from the sidebar if needed.
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Short delay so session cookie is fully applied after login before first request
    const t = setTimeout(() => {
      load();
      adminRefreshImportToken().catch(() => {});
    }, 50);
    return () => clearTimeout(t);
  }, []);

  const getOptionFromForm = (form: HTMLFormElement, key: string) =>
    ((form.elements.namedItem(key) as HTMLInputElement | null)?.checked ? 1 : 0) as number;

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const product: Partial<Product> = {
      name: String(data.get('name') || '').trim(),
      manufacturer: String(data.get('manufacturer') || '').trim(),
      sku: String(data.get('sku') || '').trim() || undefined,
      notes: String(data.get('notes') || '').trim() || undefined,
      description: String(data.get('description') || '').trim() || undefined,
      dimensions: String(data.get('dimensions') || '').trim() || undefined,
      weight: String(data.get('weight') || '').trim() || undefined,
      color: String(data.get('color') || '').trim() || undefined,
      department: String(data.get('department') || '').trim() || undefined,
      price: Number(data.get('price')) || 0,
      guidelines: String(data.get('guidelines') || '').trim() || undefined,
      fb_marketplace_url: String(data.get('fb_marketplace_url') || '').trim() || undefined,
      pick_url: String(data.get('pick_url') || '').trim() || undefined,
      furniture_type: String(data.get('furniture_type') || 'Other').trim(),
      status: (data.get('status') as Product['status']) || 'available',
      image_urls: String(data.get('image_urls') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      quantity: data.get('quantity') !== '' ? Number(data.get('quantity')) || 1 : 1,
      cost: data.get('cost') !== '' && data.get('cost') != null ? Number(data.get('cost')) : undefined,
      retail_price: data.get('retail_price') !== '' && data.get('retail_price') != null ? Number(data.get('retail_price')) : null,
      ...Object.fromEntries(OPTION_KEYS.map(k => [k, getOptionFromForm(form, k)])),
    };
    try {
      await adminAddProduct(product);
      setMessage('Product added');
      setShowForm(false);
      form.reset();
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const retailPriceRaw = data.get('retail_price');
    const retail_price = retailPriceRaw !== '' && retailPriceRaw != null && retailPriceRaw !== undefined
      ? Number(retailPriceRaw)
      : null;
    const updates: Partial<Product> = {
      name: String(data.get('name') || '').trim(),
      manufacturer: String(data.get('manufacturer') || '').trim(),
      sku: String(data.get('sku') || '').trim() || undefined,
      notes: String(data.get('notes') || '').trim() || undefined,
      description: String(data.get('description') || '').trim() || undefined,
      dimensions: String(data.get('dimensions') || '').trim() || undefined,
      weight: String(data.get('weight') || '').trim() || undefined,
      color: String(data.get('color') || '').trim() || undefined,
      department: String(data.get('department') || '').trim() || undefined,
      price: Number(data.get('price')) || 0,
      guidelines: String(data.get('guidelines') || '').trim() || undefined,
      fb_marketplace_url: String(data.get('fb_marketplace_url') || '').trim() || undefined,
      pick_url: String(data.get('pick_url') || '').trim() || undefined,
      furniture_type: String(data.get('furniture_type') || 'Other').trim(),
      status: (data.get('status') as Product['status']) || 'available',
      image_urls: editImageUrls,
      image_visibility: editImageVisibility.map(b => (b ? 1 : 0)),
      primary_image_index: editPrimaryIndex,
      quantity: data.get('quantity') !== '' ? Number(data.get('quantity')) || 1 : 1,
      cost: data.get('cost') !== '' && data.get('cost') != null ? Number(data.get('cost')) : undefined,
      retail_price: Number.isFinite(retail_price) ? retail_price : null,
      ...Object.fromEntries(OPTION_KEYS.map(k => [k, getOptionFromForm(form, k)])),
    };
    try {
      await adminUpdateProduct(editing.id, updates);
      setMessage('Product updated');
      setEditing(null);
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this product?')) return;
    try {
      await adminDeleteProduct(id);
      setMessage('Product deleted');
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleFetchWithAi = async (p: Product) => {
    const url = (p.pick_url || '').trim();
    if (!url) {
      setMessage('Pick URL is empty. Set a link first.');
      return;
    }
    setFetchAiLoadingId(p.id);
    setMessage('');
    try {
      const data = await adminFetchProductFromUrl(url);
      const merged = { ...p, ...data };
      setEditing(merged);
      setShowForm(false);
      setEditImageUrls(Array.isArray(merged.image_urls) ? merged.image_urls : []);
      setEditImageVisibility((Array.isArray(merged.image_urls) ? merged.image_urls : []).map(() => true));
      setEditPrimaryIndex(0);
      setEditImageAddUrl('');
      setMessage('Fetched. Review and click Update to save.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Fetch with AI failed');
    } finally {
      setFetchAiLoadingId(null);
    }
  };

  const handleBulkStatus = async (status: 'available' | 'pending' | 'sold') => {
    if (selectedIds.size === 0) {
      setMessage('Select products first');
      return;
    }
    try {
      await adminBulkStatus([...selectedIds], status);
      setMessage(`Marked ${selectedIds.size} as ${status}`);
      setSelectedIds(new Set());
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      setMessage('Select products first');
      return;
    }
    if (!confirm(`Delete ${selectedIds.size} selected product(s)? This cannot be undone.`)) return;
    try {
      for (const id of selectedIds) {
        await adminDeleteProduct(id);
      }
      setMessage(`Deleted ${selectedIds.size} product(s)`);
      setSelectedIds(new Set());
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      setMessage('Choose a file');
      return;
    }
    try {
      const result = await adminImport(importFile);
      const parts = [
        `${result.added} added`,
        `${result.updated} updated`,
        (result.alreadyInCatalog ?? 0) > 0 ? `${result.alreadyInCatalog} already in catalog` : null,
        result.errors.length > 0 ? `${result.errors.length} errors` : null,
      ].filter(Boolean);
      setMessage(`Imported: ${parts.join(', ')}.`);
      setImportFile(null);
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const saveInlineEdit = async (id: number, field: EditableField, value: string | number) => {
    setEditingCell(null);
    const product = products.find((p) => p.id === id);
    if (!product) return;
    const updates: Partial<Product> = { ...Object.fromEntries(OPTION_KEYS.map((k) => [k, (product as Record<string, number>)[k] ? 1 : 0])) } as Partial<Product>;
    if (field === 'quantity') {
      updates.quantity = Number(value) ?? 1;
    } else if (field === 'price' || field === 'cost' || field === 'retail_price') {
      const n = value === '' || value == null ? null : Number(value);
      (updates as Record<string, unknown>)[field] = field === 'price' ? (Number.isFinite(n) ? n : 0) : (Number.isFinite(n as number) ? n : null);
    } else if (field === 'image_urls') {
      updates.image_urls = typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
    } else if (field === 'status') {
      updates.status = (value === 'available' || value === 'pending' || value === 'sold' ? value : product.status) as Product['status'];
    } else if (OPTION_KEYS.includes(field as (typeof OPTION_KEYS)[number])) {
      (updates as Record<string, number>)[field] = value === true || value === 1 || value === '1' || value === 'yes' ? 1 : 0;
    } else {
      (updates as Record<string, string | null>)[field] = typeof value === 'string' ? value.trim() || null : String(value);
    }
    try {
      await adminUpdateProduct(id, updates);
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const searchLower = search.trim().toLowerCase();
  const filteredProducts = searchLower
    ? products.filter(
        (p) =>
          (p.sku != null && p.sku.toLowerCase().includes(searchLower)) ||
          (p.name != null && p.name.toLowerCase().includes(searchLower))
      )
    : products;

  const sortedProducts = useMemo(() => {
    if (!sortKey) return filteredProducts;
    return [...filteredProducts].sort((a, b) =>
      compareSort(getSortValue(a, sortKey), getSortValue(b, sortKey), sortDir)
    );
  }, [filteredProducts, sortKey, sortDir]);

  const handleSort = (key: string | null) => {
    if (!key) return;
    setSortKey((prev) => (prev === key ? prev : key));
    setSortDir((prev) => (prev === 'asc' && sortKey === key ? 'desc' : 'asc'));
  };
  const toggleSelectAll = () => {
    if (filteredProducts.length === 0) return;
    const allFilteredSelected = filteredProducts.every((p) => selectedIds.has(p.id));
    if (allFilteredSelected) setSelectedIds((prev) => new Set([...prev].filter((id) => !filteredProducts.some((p) => p.id === id))));
    else setSelectedIds((prev) => new Set([...prev, ...filteredProducts.map((p) => p.id)]));
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h1>Catalog <span className="admin-build-badge" title="Search and no bulk price">with search</span></h1>
        <div className="admin-panel-actions">
          <Link to="/">View catalog</Link>
          <ExportExcelButton />
        </div>
      </div>
      {message && (
        <p className="admin-message" onAnimationEnd={() => setMessage('')}>
          {message}
        </p>
      )}
      {loadError && (
        <div className="admin-message admin-load-error" role="alert">
          {loadError}
          <button type="button" onClick={() => load()} className="admin-retry-button">
            Retry
          </button>
        </div>
      )}

      <div className="admin-sync-row">
        <section className="admin-section admin-sync-col">
          <h2>Google Sheet sync</h2>
          <div className="admin-sheet-actions" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" className="admin-btn-primary" onClick={async () => { setMessage(''); try { const r = await adminSyncToSheet(); if (r.ok && r.rows != null) setMessage(`Pushed ${r.rows} rows to Google Sheet.`); else setMessage(r.error || 'Push failed'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Push failed'); } }}>
              Push to Google Sheet
            </button>
            <button type="button" className="admin-btn-primary" onClick={async () => { setMessage(''); try { const r = await adminSyncFromSheet(); if (r.ok) { setMessage(`Updated ${r.updated ?? 0}, inserted ${r.inserted ?? 0}.`); load(); } else setMessage(r.error || 'Pull failed'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Pull failed'); } }}>
              Pull from Google Sheet
            </button>
          </div>
        </section>
        <section className="admin-section admin-sync-col">
          <h2>Data Sync</h2>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" className="admin-btn-primary" disabled={!syncCapabilities?.fromProd} onClick={async () => { setMessage(''); try { const r = await adminSyncDbFromProd(); if (r.ok) { setMessage(r.message || 'DB synced from Prod.'); load(); } else setMessage(r.error || 'Sync failed'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Sync failed'); } }}>Sync DB from Prod</button>
            <button type="button" className="admin-btn-primary" disabled={!syncCapabilities?.fromProd} onClick={async () => { setMessage(''); try { const r = await adminSyncDbToProd(); if (r.ok) { setMessage(r.message || 'DB synced to Prod.'); load(); } else setMessage(r.error || 'Sync failed'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Sync failed'); } }}>Sync DB to Prod</button>
          </div>
        </section>
        <section className="admin-section admin-sync-col">
          <h2>Images Sync</h2>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" className="admin-btn-primary" disabled>Sync Images from Prod</button>
            <button type="button" className="admin-btn-primary" disabled>Sync Images from Dev</button>
          </div>
        </section>
      </div>

      <section className="admin-section">
        <h2>Bulk Import</h2>
        <p className="admin-section-hint">Download an empty template with the correct columns, fill it in, then import.</p>
        <form onSubmit={handleImport} className="admin-excel-form">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            className="admin-file-input"
          />
          <button type="submit" disabled={!importFile} className="admin-btn-primary">Import</button>
          <TemplateDownloadButton />
        </form>
      </section>

      <section className="admin-section">
        <h2>Products</h2>
        {showForm && (
          <form key={`add-${addFormPrefillKey}`} className="admin-form" onSubmit={handleAdd}>
            <h3>New product</h3>
            <div className="admin-fetch-url-row">
              <label>Fetch from URL (AI + images): <input type="url" id="add-fetch-url" placeholder="https://..." className="admin-fetch-url-input" /></label>
              <button
                type="button"
                className="admin-btn-primary"
                onClick={async () => {
                  const input = document.getElementById('add-fetch-url') as HTMLInputElement | null;
                  const url = input?.value?.trim();
                  if (!url) { setMessage('Enter a URL first.'); return; }
                  setMessage('');
                  try {
                    const data = await adminFetchProductFromUrl(url);
                    setAddFormPrefill(data);
                    setAddFormPrefillKey((k) => k + 1);
                    setMessage('Fetched. Review the form below and click Save.');
                  } catch (err) {
                    setMessage(err instanceof Error ? err.message : 'Fetch failed');
                  }
                }}
              >
                Fetch with AI
              </button>
            </div>
            <label>Quantity <input name="quantity" type="number" min={1} defaultValue={addFormPrefill?.quantity ?? 1} /></label>
            <label>SKU <input name="sku" defaultValue={addFormPrefill?.sku ?? ''} /></label>
            <label>Name * <input name="name" required defaultValue={addFormPrefill?.name ?? ''} /></label>
            <label>Notes <input name="notes" placeholder="Optional notes" defaultValue={addFormPrefill?.notes ?? ''} /></label>
            <label>Manufacturer (Brand) * <input name="manufacturer" required defaultValue={addFormPrefill?.manufacturer ?? ''} /></label>
            <label>Features (description) <textarea name="description" defaultValue={addFormPrefill?.description ?? ''} /></label>
            <label>Weight <input name="weight" defaultValue={addFormPrefill?.weight ?? ''} /></label>
            <label>Dimensions <input name="dimensions" defaultValue={addFormPrefill?.dimensions ?? ''} /></label>
            <label>Color <input name="color" defaultValue={addFormPrefill?.color ?? ''} /></label>
            <label>Department <input name="department" placeholder="e.g. Dining Set, Chairs" defaultValue={addFormPrefill?.department ?? ''} /></label>
            <label>Style (furniture type) <input name="furniture_type" placeholder="e.g. Sofa" defaultValue={addFormPrefill?.furniture_type ?? ''} /></label>
            <label>URL (FB Marketplace) <input name="fb_marketplace_url" type="url" defaultValue={addFormPrefill?.fb_marketplace_url ?? ''} /></label>
            <label>Pick URL <input name="pick_url" type="url" placeholder="https://..." defaultValue={addFormPrefill?.pick_url ?? ''} /></label>
            <label>Cost <input name="cost" type="number" step="0.01" defaultValue={addFormPrefill?.cost ?? ''} /></label>
            <label>Retail Price <input name="retail_price" type="number" step="0.01" placeholder="Avg online price" defaultValue={addFormPrefill?.retail_price ?? ''} /></label>
            <label>Price * <input name="price" type="number" step="0.01" required defaultValue={addFormPrefill?.price ?? ''} /></label>
            <label>Guidelines <input name="guidelines" placeholder="Optional guidelines" defaultValue={addFormPrefill?.guidelines ?? ''} /></label>
            <label>Status <select name="status"><option value="available">Available</option><option value="pending">Pending</option><option value="sold">Sold</option></select></label>
            <label>Images (comma-separated URLs) <input name="image_urls" placeholder="https://..." defaultValue={Array.isArray(addFormPrefill?.image_urls) ? addFormPrefill.image_urls.join(', ') : ''} /></label>
            <fieldset className="admin-options-fieldset">
              <legend>Conditions</legend>
              <label className="admin-check-label"><input type="checkbox" name="brand_new" /> Brand New</label>
              <label className="admin-check-label"><input type="checkbox" name="was_never_used" /> Never Used</label>
              <label className="admin-check-label"><input type="checkbox" name="was_never_assembled" /> Never Assembled</label>
              <label className="admin-check-label"><input type="checkbox" name="open_box" /> Open Box</label>
              <label className="admin-check-label"><input type="checkbox" name="assembly_required" /> Original Packaging</label>
            </fieldset>
            <fieldset className="admin-options-fieldset">
              <legend>Pickup & Delivery</legend>
              <label className="admin-check-label"><input type="checkbox" name="free_local_curbside_delivery" /> Free Local Curbside Delivery</label>
              <label className="admin-check-label"><input type="checkbox" name="local_curbside_delivery_fee" /> Local Curbside (fee)</label>
              <label className="admin-check-label"><input type="checkbox" name="meetup_public_place" /> Meet up (public place)</label>
              <label className="admin-check-label"><input type="checkbox" name="pickup" /> Pick up</label>
            </fieldset>
            <button type="submit">Save</button>
            <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
          </form>
        )}

        {editing && (
          <form className="admin-form admin-form-two-col" onSubmit={handleUpdate}>
            <h3>Edit: {editing.name}</h3>
            <input type="hidden" name="id" value={editing.id} />
            <div className="admin-form-grid">
              <div className="admin-form-col">
                <label>Quantity <input name="quantity" type="number" min={1} defaultValue={editing.quantity ?? 1} /></label>
                <label>SKU <input name="sku" defaultValue={editing.sku || ''} /></label>
                <label>Name * <input name="name" defaultValue={editing.name} required /></label>
                <label>Notes <input name="notes" defaultValue={editing.notes || ''} placeholder="Optional notes" /></label>
                <label>Manufacturer (Brand) * <input name="manufacturer" defaultValue={editing.manufacturer} required /></label>
                <label>Features (description) <textarea name="description" defaultValue={editing.description || ''} /></label>
                <label>Weight <input name="weight" defaultValue={editing.weight || ''} /></label>
                <label>Dimensions <input name="dimensions" defaultValue={editing.dimensions || ''} /></label>
                <label>Color <input name="color" defaultValue={editing.color || ''} /></label>
                <label>Department <input name="department" defaultValue={editing.department || ''} placeholder="e.g. Dining Set, Chairs" /></label>
                <label>Style (furniture type) <input name="furniture_type" defaultValue={editing.furniture_type} /></label>
                <label>URL (FB Marketplace) <input name="fb_marketplace_url" type="url" defaultValue={editing.fb_marketplace_url || ''} /></label>
                <label>Pick URL <input name="pick_url" type="url" defaultValue={editing.pick_url || ''} placeholder="https://..." /></label>
              </div>
              <div className="admin-form-col">
                <label>Cost <input name="cost" type="number" step="0.01" defaultValue={editing.cost ?? ''} /></label>
                <label>Retail Price <input name="retail_price" type="number" step="0.01" defaultValue={editing.retail_price ?? ''} placeholder="Avg online price" /></label>
                <label>Price * <input name="price" type="number" step="0.01" defaultValue={editing.price} required /></label>
                <label>Guidelines <input name="guidelines" defaultValue={editing.guidelines || ''} placeholder="Optional guidelines" /></label>
                <label>Status <select name="status" defaultValue={editing.status}><option value="available">Available</option><option value="pending">Pending</option><option value="sold">Sold</option></select></label>
                <fieldset className="admin-options-fieldset admin-options-toggles">
                  <legend>Conditions</legend>
                  <div className="admin-option-row"><label className="admin-toggle"><input type="checkbox" name="brand_new" defaultChecked={!!editing.brand_new} /><span className="admin-toggle-track" aria-hidden /></label><span>Brand New</span></div>
                  <div className="admin-option-row"><label className="admin-toggle"><input type="checkbox" name="was_never_used" defaultChecked={!!editing.was_never_used} /><span className="admin-toggle-track" aria-hidden /></label><span>Never Used</span></div>
                  <div className="admin-option-row"><label className="admin-toggle"><input type="checkbox" name="was_never_assembled" defaultChecked={!!editing.was_never_assembled} /><span className="admin-toggle-track" aria-hidden /></label><span>Never Assembled</span></div>
                  <div className="admin-option-row"><label className="admin-toggle"><input type="checkbox" name="open_box" defaultChecked={!!editing.open_box} /><span className="admin-toggle-track" aria-hidden /></label><span>Open Box</span></div>
                  <div className="admin-option-row"><label className="admin-toggle"><input type="checkbox" name="assembly_required" defaultChecked={!!editing.assembly_required} /><span className="admin-toggle-track" aria-hidden /></label><span>Original Packaging</span></div>
                </fieldset>
                <fieldset className="admin-options-fieldset admin-options-toggles">
                  <legend>Pickup & Delivery</legend>
                  <div className="admin-option-row"><label className="admin-toggle"><input type="checkbox" name="free_local_curbside_delivery" defaultChecked={!!editing.free_local_curbside_delivery} /><span className="admin-toggle-track" aria-hidden /></label><span>Free Local Curbside</span></div>
                  <div className="admin-option-row"><label className="admin-toggle"><input type="checkbox" name="local_curbside_delivery_fee" defaultChecked={!!editing.local_curbside_delivery_fee} /><span className="admin-toggle-track" aria-hidden /></label><span>Local Curbside (fee)</span></div>
                  <div className="admin-option-row"><label className="admin-toggle"><input type="checkbox" name="meetup_public_place" defaultChecked={!!editing.meetup_public_place} /><span className="admin-toggle-track" aria-hidden /></label><span>Meet up (public place)</span></div>
                  <div className="admin-option-row"><label className="admin-toggle"><input type="checkbox" name="pickup" defaultChecked={!!editing.pickup} /><span className="admin-toggle-track" aria-hidden /></label><span>Pick up</span></div>
                </fieldset>
                <div className="admin-form-images">
                  <div className="admin-form-images-legend">Images</div>
                  <div className="admin-form-images-add">
                    <input type="url" placeholder="Add image URL…" value={editImageAddUrl} onChange={(e) => setEditImageAddUrl(e.target.value)} />
                    <button type="button" onClick={() => { if (editImageAddUrl.trim()) { setEditImageUrls(u => [...u, editImageAddUrl.trim()]); setEditImageVisibility(v => [...v, true]); setEditImageAddUrl(''); } }}>Add</button>
                  </div>
                  <div className="admin-form-thumbnails">
                    {editImageUrls.map((url, i) => (
                      <div key={`${url}-${i}`} className={`admin-thumbnail-wrap ${!editImageVisibility[i] ? 'admin-thumbnail-hidden' : ''} ${editPrimaryIndex === i ? 'admin-thumbnail-primary' : ''}`}>
                        <img src={url} alt="" className="admin-thumbnail-img" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"/><text x="24" y="26" fill="%23666" font-size="10" text-anchor="middle">?</text></svg>'; }} />
                        <label className="admin-toggle admin-thumbnail-toggle" title="Show in client"><input type="checkbox" checked={editImageVisibility[i]} onChange={() => setEditImageVisibility(v => v.map((b, j) => (j === i ? !b : b)))} /><span className="admin-toggle-track" aria-hidden /></label>
                        <button type="button" className="admin-thumbnail-first" title="Set as first/thumbnail" onClick={() => setEditPrimaryIndex(i)}>{editPrimaryIndex === i ? '1st' : 'Set 1st'}</button>
                        <button type="button" className="admin-thumbnail-remove" title="Remove" onClick={() => { setEditImageUrls(u => u.filter((_, j) => j !== i)); setEditImageVisibility(v => v.filter((_, j) => j !== i)); setEditPrimaryIndex(p => (p === i ? 0 : p > i ? p - 1 : p)); }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="admin-form-actions">
              <button type="submit">Update</button>
              <button type="button" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        )}

        <div className="admin-bulk">
          <div className="admin-bulk-left">
            <label>Search: <input type="search" placeholder="SKU or name…" value={search} onChange={(e) => setSearch(e.target.value)} className="admin-search-input" /></label>
            <button type="button" onClick={() => handleBulkStatus('available')} disabled={selectedIds.size === 0}>Mark available</button>
            <button type="button" onClick={() => handleBulkStatus('pending')} disabled={selectedIds.size === 0}>Mark pending</button>
            <button type="button" onClick={() => handleBulkStatus('sold')} disabled={selectedIds.size === 0}>Mark sold</button>
            <button type="button" onClick={handleBulkDelete} disabled={selectedIds.size === 0}>Delete</button>
          </div>
          <button type="button" onClick={() => { setShowForm(true); setEditing(null); setAddFormPrefill(null); setAddFormPrefillKey((k) => k + 1); }} className="admin-btn-primary admin-bulk-add">
            Add product
          </button>
        </div>

        {loading ? (
          <p>Loading…</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table-scroll">
              <thead>
                <tr>
                  <th className="admin-col-chk">
                    <label className="admin-toggle" title="Select all">
                      <input type="checkbox" checked={sortedProducts.length > 0 && sortedProducts.every((p) => selectedIds.has(p.id))} onChange={toggleSelectAll} />
                      <span className="admin-toggle-track" aria-hidden />
                    </label>
                  </th>
                  <th className="admin-col-qty admin-th-sortable" onClick={() => handleSort('quantity')} title="Sort by QTY">
                    <span className="admin-th-sort">QTY{sortKey === 'quantity' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-sku admin-th-sortable" onClick={() => handleSort('sku')} title="Sort by SKU">
                    <span className="admin-th-sort">SKU{sortKey === 'sku' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-name admin-th-sortable" onClick={() => handleSort('name')} title="Sort by Name">
                    <span className="admin-th-sort">Name{sortKey === 'name' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-notes admin-th-sortable" onClick={() => handleSort('notes')} title="Sort by Notes">
                    <span className="admin-th-sort">Notes{sortKey === 'notes' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-brand admin-th-sortable" onClick={() => handleSort('manufacturer')} title="Sort by Brand">
                    <span className="admin-th-sort">Brand{sortKey === 'manufacturer' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-features admin-th-sortable" onClick={() => handleSort('description')} title="Sort by Features">
                    <span className="admin-th-sort">Features{sortKey === 'description' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-weight admin-th-sortable" onClick={() => handleSort('weight')} title="Sort by Weight">
                    <span className="admin-th-sort">Weight{sortKey === 'weight' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-dim admin-th-sortable" onClick={() => handleSort('dimensions')} title="Sort by Dimensions">
                    <span className="admin-th-sort">Dimensions{sortKey === 'dimensions' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-color admin-th-sortable" onClick={() => handleSort('color')} title="Sort by Color">
                    <span className="admin-th-sort">Color{sortKey === 'color' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-department admin-th-sortable" onClick={() => handleSort('department')} title="Sort by Department">
                    <span className="admin-th-sort">Department{sortKey === 'department' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-style admin-th-sortable" onClick={() => handleSort('furniture_type')} title="Sort by Style">
                    <span className="admin-th-sort">Style{sortKey === 'furniture_type' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-url admin-th-sortable" onClick={() => handleSort('fb_marketplace_url')} title="Sort by URL">
                    <span className="admin-th-sort">URL{sortKey === 'fb_marketplace_url' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-url admin-th-sortable" onClick={() => handleSort('pick_url')} title="Sort by Pick URL">
                    <span className="admin-th-sort">Pick URL{sortKey === 'pick_url' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-cost admin-th-sortable" onClick={() => handleSort('cost')} title="Sort by Cost">
                    <span className="admin-th-sort">Cost{sortKey === 'cost' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-retail admin-th-sortable" onClick={() => handleSort('retail_price')} title="Sort by Retail Price">
                    <span className="admin-th-sort">Retail Price{sortKey === 'retail_price' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-margin admin-th-sortable" onClick={() => handleSort('margin10')} title="Sort by 10% Margin">
                    <span className="admin-th-sort">10% Margin{sortKey === 'margin10' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-margin admin-th-sortable" onClick={() => handleSort('margin5')} title="Sort by 5% Margin">
                    <span className="admin-th-sort">5% Margin{sortKey === 'margin5' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-margin admin-th-sortable" onClick={() => handleSort('loss20')} title="Sort by 20% loss">
                    <span className="admin-th-sort">20% loss{sortKey === 'loss20' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-price admin-th-sortable" onClick={() => handleSort('price')} title="Sort by Price">
                    <span className="admin-th-sort">Price{sortKey === 'price' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-guidelines admin-th-sortable" onClick={() => handleSort('guidelines')} title="Sort by Guidelines">
                    <span className="admin-th-sort">Guidelines{sortKey === 'guidelines' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-images admin-th-sortable" onClick={() => handleSort('images')} title="Sort by Images">
                    <span className="admin-th-sort">Images{sortKey === 'images' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-status admin-th-sortable" onClick={() => handleSort('status')} title="Sort by Status">
                    <span className="admin-th-sort">Status{sortKey === 'status' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  <th className="admin-col-created admin-th-sortable" onClick={() => handleSort('created_at')} title="Sort by Created on">
                    <span className="admin-th-sort">Created on{sortKey === 'created_at' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                  </th>
                  {OPTION_KEYS.map((k, i) => {
                    const [line1, line2] = OPTION_HEADER_LINES[i].split('\n');
                    return (
                      <th key={k} className="admin-col-option admin-th-sortable" title={OPTION_EXCEL_HEADERS[i]} onClick={() => handleSort(k)}>
                        <span className="admin-th-wrap admin-th-sort">
                          <span className="admin-th-line">{line1}{sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                          <span className="admin-th-line">{line2}</span>
                        </span>
                      </th>
                    );
                  })}
                  <th className="admin-col-actions"></th>
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((p) => {
                  const cost = p.cost != null ? Number(p.cost) : null;
                  const price = Number(p.price);
                  const margin10 = cost != null && cost > 0 ? `$${(cost / 0.9).toFixed(2)}` : '—';
                  const margin5 = cost != null && cost > 0 ? `$${(cost / 0.95).toFixed(2)}` : '—';
                  const loss20 = cost != null && cost > 0 ? `$${(cost * 0.8).toFixed(2)}` : '—';
                  const images = (p.image_urls || []).join(', ');
                  const features = (p.description || '').slice(0, 40) + ((p.description || '').length > 40 ? '…' : '');
                  const imagesShort = images.length > 30 ? images.slice(0, 30) + '…' : images;
                  return (
                    <tr key={p.id}>
                      <td className="admin-col-chk">
                        <label className="admin-toggle" title="Select row">
                          <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} />
                          <span className="admin-toggle-track" aria-hidden />
                        </label>
                      </td>
                      {(() => {
                        const is = (f: EditableField) => editingCell?.id === p.id && editingCell?.field === f;
                        const blur = (f: EditableField, v: string | number) => saveInlineEdit(p.id, f, v);
                        const keyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null); };
                        const stop = (e: React.MouseEvent) => e.stopPropagation();
                        return (
                          <>
                            <td className="admin-col-qty admin-cell-editable" onClick={() => setEditingCell(is('quantity') ? null : { id: p.id, field: 'quantity' })}>
                              {is('quantity') ? <input type="number" min={1} className="admin-inline-input" defaultValue={p.quantity ?? 1} autoFocus onClick={stop} onBlur={(e) => blur('quantity', e.target.value)} onKeyDown={keyDown} /> : (p.quantity ?? 1)}
                            </td>
                            <td className="admin-col-sku admin-cell-editable" onClick={() => setEditingCell(is('sku') ? null : { id: p.id, field: 'sku' })}>
                              {is('sku') ? <input type="text" className="admin-inline-input" defaultValue={p.sku ?? ''} autoFocus onClick={stop} onBlur={(e) => blur('sku', e.target.value.trim())} onKeyDown={keyDown} /> : ((p.sku ?? '—') || '—')}
                            </td>
                            <td className="admin-col-name admin-cell-editable" onClick={() => setEditingCell(is('name') ? null : { id: p.id, field: 'name' })}>
                              {is('name') ? <input type="text" className="admin-inline-input" defaultValue={p.name} autoFocus onClick={stop} onBlur={(e) => blur('name', e.target.value.trim())} onKeyDown={keyDown} /> : p.name}
                            </td>
                            <td className="admin-col-notes admin-cell-editable" onClick={() => setEditingCell(is('notes') ? null : { id: p.id, field: 'notes' })} title={p.notes || ''}>
                              {is('notes') ? <input type="text" className="admin-inline-input" defaultValue={p.notes ?? ''} autoFocus onClick={stop} onBlur={(e) => blur('notes', e.target.value.trim())} onKeyDown={keyDown} /> : ((p.notes ?? '') || '—')}
                            </td>
                            <td className="admin-col-brand admin-cell-editable" onClick={() => setEditingCell(is('manufacturer') ? null : { id: p.id, field: 'manufacturer' })}>
                              {is('manufacturer') ? <input type="text" className="admin-inline-input" defaultValue={p.manufacturer} autoFocus onClick={stop} onBlur={(e) => blur('manufacturer', e.target.value.trim())} onKeyDown={keyDown} /> : (p.manufacturer || '—')}
                            </td>
                            <td className="admin-col-features admin-cell-editable" onClick={() => setEditingCell(is('description') ? null : { id: p.id, field: 'description' })} title={p.description || ''}>
                              {is('description') ? <input type="text" className="admin-inline-input" defaultValue={p.description ?? ''} autoFocus onClick={stop} onBlur={(e) => blur('description', e.target.value.trim())} onKeyDown={keyDown} /> : (features || '—')}
                            </td>
                            <td className="admin-col-weight admin-cell-editable" onClick={() => setEditingCell(is('weight') ? null : { id: p.id, field: 'weight' })}>
                              {is('weight') ? <input type="text" className="admin-inline-input" defaultValue={p.weight ?? ''} autoFocus onClick={stop} onBlur={(e) => blur('weight', e.target.value.trim())} onKeyDown={keyDown} /> : (p.weight ?? '—')}
                            </td>
                            <td className="admin-col-dim admin-cell-editable" onClick={() => setEditingCell(is('dimensions') ? null : { id: p.id, field: 'dimensions' })}>
                              {is('dimensions') ? <input type="text" className="admin-inline-input" defaultValue={p.dimensions ?? ''} autoFocus onClick={stop} onBlur={(e) => blur('dimensions', e.target.value.trim())} onKeyDown={keyDown} /> : (p.dimensions ?? '—')}
                            </td>
                            <td className="admin-col-color admin-cell-editable" onClick={() => setEditingCell(is('color') ? null : { id: p.id, field: 'color' })}>
                              {is('color') ? <input type="text" className="admin-inline-input" defaultValue={p.color ?? ''} autoFocus onClick={stop} onBlur={(e) => blur('color', e.target.value.trim())} onKeyDown={keyDown} /> : (p.color ?? '—')}
                            </td>
                            <td className="admin-col-department admin-cell-editable" onClick={() => setEditingCell(is('department') ? null : { id: p.id, field: 'department' })}>
                              {is('department') ? <input type="text" className="admin-inline-input" defaultValue={p.department ?? ''} autoFocus onClick={stop} onBlur={(e) => blur('department', e.target.value.trim())} onKeyDown={keyDown} /> : (p.department ?? '—')}
                            </td>
                            <td className="admin-col-style admin-cell-editable" onClick={() => setEditingCell(is('furniture_type') ? null : { id: p.id, field: 'furniture_type' })}>
                              {is('furniture_type') ? <input type="text" className="admin-inline-input" defaultValue={p.furniture_type ?? ''} autoFocus onClick={stop} onBlur={(e) => blur('furniture_type', e.target.value.trim())} onKeyDown={keyDown} /> : (p.furniture_type ?? '—')}
                            </td>
                            <td className="admin-col-url admin-cell-editable admin-cell-url" onClick={() => setEditingCell(is('fb_marketplace_url') ? null : { id: p.id, field: 'fb_marketplace_url' })} title={p.fb_marketplace_url || ''}>
                              {is('fb_marketplace_url') ? <input type="url" className="admin-inline-input" defaultValue={p.fb_marketplace_url ?? ''} autoFocus onClick={stop} onBlur={(e) => blur('fb_marketplace_url', e.target.value.trim())} onKeyDown={keyDown} /> : (p.fb_marketplace_url ? <a href={p.fb_marketplace_url} target="_blank" rel="noopener noreferrer" onClick={stop}>Link</a> : '—')}
                            </td>
                            <td className="admin-col-url admin-cell-editable admin-cell-url" onClick={() => setEditingCell(is('pick_url') ? null : { id: p.id, field: 'pick_url' })} title={p.pick_url || ''}>
                              {is('pick_url') ? <input type="url" className="admin-inline-input" defaultValue={p.pick_url ?? ''} autoFocus onClick={stop} onBlur={(e) => blur('pick_url', e.target.value.trim())} onKeyDown={keyDown} /> : (p.pick_url ? <a href={p.pick_url} target="_blank" rel="noopener noreferrer" onClick={stop}>Link</a> : '—')}
                            </td>
                            <td className="admin-col-cost admin-cell-editable" onClick={() => setEditingCell(is('cost') ? null : { id: p.id, field: 'cost' })}>
                              {is('cost') ? <input type="number" step="0.01" min="0" className="admin-inline-input" defaultValue={cost ?? ''} autoFocus onClick={stop} onBlur={(e) => blur('cost', e.target.value)} onKeyDown={keyDown} /> : (cost != null ? `$${cost.toFixed(2)}` : '—')}
                            </td>
                            <td className="admin-col-retail admin-cell-editable" onClick={() => setEditingCell(is('retail_price') ? null : { id: p.id, field: 'retail_price' })}>
                              {is('retail_price') ? <input type="number" step="0.01" min="0" className="admin-inline-input" defaultValue={p.retail_price ?? ''} autoFocus onClick={stop} onBlur={(e) => blur('retail_price', e.target.value)} onKeyDown={keyDown} /> : (p.retail_price != null ? `$${Number(p.retail_price).toFixed(2)}` : '—')}
                            </td>
                            <td className="admin-col-margin">{margin10}</td>
                            <td className="admin-col-margin">{margin5}</td>
                            <td className="admin-col-margin">{loss20}</td>
                            <td className="admin-col-price admin-cell-editable" onClick={() => setEditingCell(is('price') ? null : { id: p.id, field: 'price' })}>
                              {is('price') ? <input type="number" step="0.01" min="0" className="admin-inline-input" defaultValue={price} autoFocus onClick={stop} onBlur={(e) => blur('price', e.target.value)} onKeyDown={keyDown} /> : `$${price.toFixed(2)}`}
                            </td>
                            <td className="admin-col-guidelines admin-cell-editable" onClick={() => setEditingCell(is('guidelines') ? null : { id: p.id, field: 'guidelines' })} title={p.guidelines || ''}>
                              {is('guidelines') ? <input type="text" className="admin-inline-input" defaultValue={p.guidelines ?? ''} autoFocus onClick={stop} onBlur={(e) => blur('guidelines', e.target.value.trim())} onKeyDown={keyDown} /> : ((p.guidelines ?? '') || '—')}
                            </td>
                            <td className="admin-col-images admin-cell-editable" onClick={() => setEditingCell(is('image_urls') ? null : { id: p.id, field: 'image_urls' })} title={images}>
                              {is('image_urls') ? <input type="text" className="admin-inline-input" defaultValue={images} autoFocus onClick={stop} onBlur={(e) => blur('image_urls', e.target.value)} onKeyDown={keyDown} /> : (imagesShort || '—')}
                            </td>
                            <td className="admin-col-status admin-cell-editable" onClick={() => setEditingCell(is('status') ? null : { id: p.id, field: 'status' })}>
                              {is('status') ? (
                                <select className="admin-inline-input" defaultValue={p.status} autoFocus onClick={stop} onBlur={(e) => blur('status', e.target.value)} onKeyDown={keyDown}>
                                  <option value="available">available</option>
                                  <option value="pending">pending</option>
                                  <option value="sold">sold</option>
                                </select>
                              ) : p.status}
                            </td>
                            <td className="admin-col-created" title={p.created_at || ''}>
                              {p.created_at ? new Date(p.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) : '—'}
                            </td>
                            {OPTION_KEYS.map(k => (
                              <td key={k} className="admin-col-option">
                                <label className="admin-toggle" title={OPTION_EXCEL_HEADERS[OPTION_KEYS.indexOf(k)]}>
                                  <input
                                    type="checkbox"
                                    checked={!!(p as Record<string, number>)[k]}
                                    onChange={(e) => { e.stopPropagation(); saveInlineEdit(p.id, k, e.target.checked ? 1 : 0); }}
                                  />
                                  <span className="admin-toggle-track" aria-hidden />
                                </label>
                              </td>
                            ))}
                          </>
                        );
                      })()}
                      <td className="admin-col-actions">
                        <button
                          type="button"
                          onClick={() => handleFetchWithAi(p)}
                          disabled={!p.pick_url?.trim() || fetchAiLoadingId === p.id}
                          title={p.pick_url?.trim() ? 'Fetch details and images from URL with AI' : 'Set Pick URL first'}
                        >
                          {fetchAiLoadingId === p.id ? 'Fetching…' : 'Fetch with AI'}
                        </button>
                        <button type="button" onClick={() => { setEditing(p); setShowForm(false); }}>Edit</button>
                        <button type="button" onClick={() => handleDelete(p.id)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
