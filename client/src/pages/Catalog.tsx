import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import ProductGrid from '../components/ProductGrid';
import { getProducts, getFilters, getFilterCounts, type Product, type Filters, type FilterMeta, type FilterCounts } from '../api';

export default function Catalog() {
  const [searchParams] = useSearchParams();
  const departmentFromUrl = searchParams.get('department');
  const [products, setProducts] = useState<Product[]>([]);
  const [filterMeta, setFilterMeta] = useState<FilterMeta | null>(null);
  const [filterCounts, setFilterCounts] = useState<FilterCounts | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [loading, setLoading] = useState(true);
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);

  useEffect(() => {
    getFilters().then(setFilterMeta).catch(console.error);
  }, []);

  useEffect(() => {
    const dep = searchParams.get('department') || undefined;
    const effectiveFilters: Filters = { ...filters, department: dep, status: 'available' };
    getFilterCounts(effectiveFilters).then(setFilterCounts).catch(console.error);
  }, [filters, searchParams.toString()]);

  useEffect(() => {
    if (departmentFromUrl) setFilters((prev) => ({ ...prev, department: departmentFromUrl }));
    else setFilters((prev) => ({ ...prev, department: undefined }));
  }, [departmentFromUrl]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const dep = searchParams.get('department') || undefined;
    const effectiveFilters: Filters = {
      ...filters,
      department: dep,
      status: 'available',
    };
    getProducts(effectiveFilters)
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch((err) => {
        if (!cancelled) console.error(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, searchParams.toString()]);

  const hasActiveFilters =
    (filters.types?.length ?? 0) > 0 ||
    (filters.manufacturers?.length ?? 0) > 0 ||
    (filters.priceRanges?.length ?? 0) > 0;

  return (
    <>
      <Header />
      <div className="catalog-layout">
        <div className="catalog-sidebar-wrap">
          <Sidebar
            filterMeta={filterMeta}
            filterCounts={filterCounts}
            filters={filters}
            onFiltersChange={setFilters}
            resultCount={products.length}
          />
        </div>
        <main className="catalog-main">
          <p className="catalog-mobile-department" aria-live="polite">
            {searchParams.get('department') || 'All'}
          </p>
          <button
            type="button"
            className="catalog-filters-button-mobile"
            onClick={() => setFiltersPanelOpen(true)}
          >
            Filters
            {hasActiveFilters && (
              <span className="catalog-filters-button-badge"> · {products.length} items</span>
            )}
          </button>
          <ProductGrid products={products} loading={loading} />
        </main>
      </div>
      {filtersPanelOpen && (
        <div className="filters-panel-overlay" role="dialog" aria-label="Filters">
          <div className="filters-panel-backdrop" onClick={() => setFiltersPanelOpen(false)} aria-hidden />
          <div className="filters-panel">
            <div className="filters-panel-header">
              <h2 className="filters-panel-title">Filters</h2>
              <button
                type="button"
                className="filters-panel-close"
                onClick={() => setFiltersPanelOpen(false)}
                aria-label="Close"
              >
                Done
              </button>
            </div>
            <div className="filters-panel-body">
              <Sidebar
                filterMeta={filterMeta}
                filterCounts={filterCounts}
                filters={filters}
                onFiltersChange={setFilters}
                resultCount={products.length}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
