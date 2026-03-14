const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
const API = BASE + '/api';

export type Product = {
  id: number;
  name: string;
  manufacturer: string;
  sku: string | null;
  notes: string | null;
  description: string | null;
  dimensions: string | null;
  weight: string | null;
  color: string | null;
  department: string | null;
  price: number;
  guidelines: string | null;
  fb_marketplace_url: string | null;
  pick_url: string | null;
  image_urls: string[];
  /** Admin only: per-image visibility (same length as image_urls). Catalog gets computed image_urls. */
  image_visibility?: number[];
  /** Admin only: index of primary/thumbnail image. Catalog gets computed image_urls. */
  primary_image_index?: number;
  furniture_type: string;
  status: 'available' | 'pending' | 'sold';
  quantity?: number;
  cost?: number | null;
  retail_price?: number | null;
  brand_new?: number;
  open_box?: number;
  was_never_used?: number;
  was_never_assembled?: number;
  free_local_curbside_delivery?: number;
  local_curbside_delivery_fee?: number;
  meetup_public_place?: number;
  pickup?: number;
  assembly_required?: number;
  created_at: string;
  updated_at: string;
};

export type PriceRange = { min?: number; max?: number };

export type Filters = {
  types?: string[];
  manufacturers?: string[];
  priceRanges?: PriceRange[];
  status?: string;
  department?: string;
};

export async function getProducts(filters: Filters = {}): Promise<Product[]> {
  const params = new URLSearchParams();
  if (filters.department) params.set('department', filters.department);
  if (filters.types?.length) params.set('types', filters.types.join(','));
  if (filters.manufacturers?.length) params.set('manufacturers', filters.manufacturers.join(','));
  if (filters.priceRanges?.length) {
    filters.priceRanges.forEach((r, i) => {
      if (r.min != null) params.set(`minPrice${i}`, String(r.min));
      if (r.max != null) params.set(`maxPrice${i}`, String(r.max));
    });
    params.set('priceRangeCount', String(filters.priceRanges.length));
  }
  if (filters.status) params.set('status', filters.status);
  const url = `${API}/products?${params}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}

export async function getProduct(id: string): Promise<Product> {
  const res = await fetch(`${API}/products/${id}`);
  if (!res.ok) throw new Error('Product not found');
  return res.json();
}

export async function getSellerProfileUrl(): Promise<string | null> {
  const res = await fetch(`${API}/seller-profile-url`, { cache: 'no-store' });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  const url = data?.sellerProfileUrl;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}

export type FilterMeta = {
  furnitureTypes: string[];
  manufacturers: string[];
  departments: string[];
};

export type FilterCounts = {
  typeCounts: Record<string, number>;
  manufacturerCounts: Record<string, number>;
  priceRangeCounts: { id: string; count: number }[];
};

export async function getFilters(): Promise<FilterMeta> {
  const res = await fetch(`${API}/products/filters`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch filters');
  return res.json();
}

export async function getFilterCounts(filters: Filters = {}): Promise<FilterCounts> {
  const params = new URLSearchParams();
  params.set('status', filters.status || 'available');
  if (filters.department) params.set('department', filters.department);
  if (filters.types?.length) params.set('types', filters.types.join(','));
  if (filters.manufacturers?.length) params.set('manufacturers', filters.manufacturers.join(','));
  if (filters.priceRanges?.length) {
    filters.priceRanges.forEach((r, i) => {
      if (r.min != null) params.set(`minPrice${i}`, String(r.min));
      if (r.max != null) params.set(`maxPrice${i}`, String(r.max));
    });
    params.set('priceRangeCount', String(filters.priceRanges.length));
  }
  const res = await fetch(`${API}/products/filter-counts?${params}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch filter counts');
  return res.json();
}

/** Departments from active (not sold) items — for top menu links */
export async function getDepartments(): Promise<{ departments: string[] }> {
  const res = await fetch(`${API}/products/departments`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch departments');
  return res.json();
}

// Admin API (with credentials for cookies)
const adminFetch = (url: string, options: RequestInit = {}) =>
  fetch(url, { ...options, credentials: 'include' });

const IMPORT_TOKEN_KEY = 'adminImportToken';

export async function adminLogin(password: string): Promise<void> {
  const res = await adminFetch(`${API}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Login failed');
  }
  const data = await res.json().catch(() => ({}));
  if (data.importToken) {
    try {
      sessionStorage.setItem(IMPORT_TOKEN_KEY, data.importToken);
    } catch (_) {}
  }
}

export async function adminLogout(): Promise<void> {
  try {
    sessionStorage.removeItem(IMPORT_TOKEN_KEY);
  } catch (_) {}
  await adminFetch(`${API}/admin/logout`, { method: 'POST' });
}

export async function adminMe(): Promise<boolean> {
  const res = await adminFetch(`${API}/admin/me`);
  return res.ok;
}

/** Fetch a fresh import token (use when admin panel loads so import has a valid token). */
export async function adminRefreshImportToken(): Promise<void> {
  const res = await adminFetch(`${API}/admin/import-token`);
  if (!res.ok) return;
  const data = await res.json().catch(() => ({}));
  if (data.importToken) {
    try {
      sessionStorage.setItem(IMPORT_TOKEN_KEY, data.importToken);
    } catch (_) {}
  }
}

export async function adminGetProducts(): Promise<Product[]> {
  const res = await adminFetch(`${API}/admin/products`);
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}

export async function adminAddProduct(product: Partial<Product>): Promise<Product> {
  const res = await adminFetch(`${API}/admin/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to add');
  return res.json();
}

export async function adminUpdateProduct(id: number, updates: Partial<Product>): Promise<Product> {
  const res = await adminFetch(`${API}/admin/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to update');
  return res.json();
}

export async function adminDeleteProduct(id: number): Promise<void> {
  const res = await adminFetch(`${API}/admin/products/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to delete');
}

export async function adminBulkPrice(ids: number[], price: number): Promise<{ updated: number }> {
  const res = await adminFetch(`${API}/admin/products/bulk-price`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, price }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
  return res.json();
}

export type AdminSettings = {
  openaiApiKeyMasked?: string;
  extractionPrompt?: string;
  stampImagePath?: string;
  sellerProfileUrl?: string;
};

export async function adminGetSettings(debug?: boolean): Promise<AdminSettings & { _debug?: { dataDir: string | null; settingsPath: string | null; cwd: string } }> {
  const url = debug ? `${API}/admin/settings?debug=1` : `${API}/admin/settings`;
  const res = await adminFetch(url);
  if (!res.ok) throw new Error('Failed to load settings');
  return res.json();
}

export async function adminPutSettings(settings: Partial<AdminSettings & { openaiApiKey?: string }>): Promise<AdminSettings> {
  const res = await adminFetch(`${API}/admin/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = 'Failed to save settings';
    try {
      const data = JSON.parse(text);
      if (data && typeof data.error === 'string') msg = data.error;
    } catch (_) {
      if (text) msg = `${res.status}: ${text.slice(0, 200)}`;
    }
    throw new Error(msg);
  }
  return res.json();
}

export async function adminFetchProductFromUrl(url: string): Promise<Partial<Product>> {
  const res = await adminFetch(`${API}/admin/fetch-product-from-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch product from URL');
  }
  return res.json();
}

export async function adminBulkStatus(ids: number[], status: 'available' | 'pending' | 'sold'): Promise<{ updated: number }> {
  const res = await adminFetch(`${API}/admin/products/bulk-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, status }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string; message?: string };
    const msg = data.message || data.error || 'Failed to update status';
    throw new Error(msg);
  }
  return res.json();
}

export async function adminSyncToSheet(): Promise<{ ok: boolean; rows?: number; error?: string }> {
  const res = await adminFetch(`${API}/admin/sync-to-sheet`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: (data as { error?: string }).error || 'Failed' };
  return data as { ok: boolean; rows?: number };
}
export async function adminSyncFromSheet(): Promise<{ ok: boolean; updated?: number; inserted?: number; error?: string }> {
  const res = await adminFetch(`${API}/admin/sync-from-sheet`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: (data as { error?: string }).error || 'Failed' };
  return data as { ok: boolean; updated?: number; inserted?: number };
}

export async function adminGetSyncCapabilities(): Promise<{ fromProd: boolean; fromDev: boolean }> {
  const res = await adminFetch(`${API}/admin/sync/capabilities`);
  if (!res.ok) return { fromProd: false, fromDev: false };
  return res.json();
}

export async function adminSyncDbFromProd(): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await adminFetch(`${API}/admin/sync/db-from-prod`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: (data as { error?: string }).error || 'Failed' };
  return data as { ok: boolean; message?: string };
}

export async function adminSyncDbToProd(): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await adminFetch(`${API}/admin/sync/db-to-prod`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: (data as { error?: string }).error || 'Failed' };
  return data as { ok: boolean; message?: string };
}

export async function adminSyncDbFromDev(): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await adminFetch(`${API}/admin/sync/db-from-dev`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: (data as { error?: string }).error || 'Failed' };
  return data as { ok: boolean; message?: string };
}

export function adminExportUrl(): string {
  return `${API}/admin/export`;
}

async function doImportRequest(file: File): Promise<Response> {
  const form = new FormData();
  form.append('file', file);
  try {
    const token = sessionStorage.getItem(IMPORT_TOKEN_KEY);
    if (token) {
      form.append('import_token', token);
    }
  } catch (_) {}
  const headers: Record<string, string> = {};
  try {
    const token = sessionStorage.getItem(IMPORT_TOKEN_KEY);
    if (token) headers['X-Import-Token'] = token;
  } catch (_) {}
  return adminFetch(`${API}/import`, {
    method: 'POST',
    body: form,
    credentials: 'include',
    headers,
  });
}

export async function adminImport(file: File): Promise<{ added: number; updated: number; alreadyInCatalog: number; errors: { row: number; message: string }[] }> {
  let res = await doImportRequest(file);
  if (res.status === 401) {
    await adminRefreshImportToken();
    res = await doImportRequest(file);
  }
  if (res.status === 401) {
    try {
      sessionStorage.removeItem(IMPORT_TOKEN_KEY);
    } catch (_) {}
    throw new Error('Session expired. Please log in again.');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data.error || data.message || `Import failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : 'Import failed');
  }
  return res.json();
}
