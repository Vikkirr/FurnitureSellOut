import { useState } from 'react';
import type { Filters, FilterMeta, FilterCounts, PriceRange } from '../api';

const MANUFACTURER_SHOW_COUNT = 8;

const PRICE_RANGES: { label: string; value: PriceRange; id: string }[] = [
  { label: '$0 – $100', value: { min: 0, max: 100 }, id: '0-100' },
  { label: '$100 – $250', value: { min: 100, max: 250 }, id: '100-250' },
  { label: '$250 – $500', value: { min: 250, max: 500 }, id: '250-500' },
  { label: 'Over $500', value: { min: 500 }, id: 'over500' },
];

function sameRange(a: PriceRange, b: PriceRange) {
  const amin = a.min ?? null;
  const amax = a.max ?? null;
  const bmin = b.min ?? null;
  const bmax = b.max ?? null;
  return amin === bmin && amax === bmax;
}

type Props = {
  filterMeta: FilterMeta | null;
  filterCounts: FilterCounts | null;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  resultCount: number;
};

export default function Sidebar({ filterMeta, filterCounts, filters, onFiltersChange, resultCount }: Props) {
  const [manufacturerExpanded, setManufacturerExpanded] = useState(false);
  const types = filters.types ?? [];
  const manufacturers = filters.manufacturers ?? [];
  const priceRanges = filters.priceRanges ?? [];

  const toggleType = (t: string) => {
    const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t];
    onFiltersChange({ ...filters, types: next.length ? next : undefined });
  };

  const toggleManufacturer = (m: string) => {
    const next = manufacturers.includes(m) ? manufacturers.filter((x) => x !== m) : [...manufacturers, m];
    onFiltersChange({ ...filters, manufacturers: next.length ? next : undefined });
  };

  const togglePriceRange = (r: PriceRange) => {
    const isSelected = priceRanges.some((pr) => sameRange(pr, r));
    let next: PriceRange[];
    if (isSelected) {
      next = priceRanges.filter((pr) => !sameRange(pr, r));
    } else {
      next = [...priceRanges, r];
    }
    onFiltersChange({ ...filters, priceRanges: next.length ? next : undefined });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasFilters =
    (types?.length ?? 0) > 0 ||
    (manufacturers?.length ?? 0) > 0 ||
    (priceRanges?.length ?? 0) > 0;

  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <h2 className="sidebar-title">Filters</h2>
        {hasFilters && (
          <button type="button" className="sidebar-clear" onClick={clearFilters}>
            Clear filters
          </button>
        )}
        <p className="sidebar-count">{resultCount} items</p>

        {filterMeta && filterMeta.furnitureTypes.length > 0 && (
          <div className="sidebar-section">
            <h3>Style</h3>
            <ul className="sidebar-list sidebar-list-toggles">
              {filterMeta.furnitureTypes.map((t) => {
                const on = types.includes(t);
                const count = filterCounts?.typeCounts?.[t] ?? null;
                return (
                  <li key={t} className="sidebar-list-item-with-count">
                    <label className="sidebar-toggle">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleType(t)}
                      />
                      <span className="sidebar-toggle-label">{t}</span>
                    </label>
                    {count !== null && <span className="sidebar-filter-count">({count})</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {filterMeta && filterMeta.manufacturers.length > 0 && (
          <div className="sidebar-section">
            <h3>Manufacturer</h3>
            <ul className="sidebar-list sidebar-list-toggles">
              {(manufacturerExpanded
                ? filterMeta.manufacturers
                : filterMeta.manufacturers.slice(0, MANUFACTURER_SHOW_COUNT)
              ).map((m) => {
                const on = manufacturers.includes(m);
                const count = filterCounts?.manufacturerCounts?.[m] ?? null;
                return (
                  <li key={m} className="sidebar-list-item-with-count">
                    <label className="sidebar-toggle">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleManufacturer(m)}
                      />
                      <span className="sidebar-toggle-label">{m}</span>
                    </label>
                    {count !== null && <span className="sidebar-filter-count">({count})</span>}
                  </li>
                );
              })}
            </ul>
            {filterMeta.manufacturers.length > MANUFACTURER_SHOW_COUNT && (
              <button
                type="button"
                className="sidebar-expand-toggle"
                onClick={() => setManufacturerExpanded((v) => !v)}
              >
                {manufacturerExpanded ? 'Show less' : 'Show All'}
              </button>
            )}
          </div>
        )}

        <div className="sidebar-section">
          <h3>Price Range</h3>
          <ul className="sidebar-list sidebar-list-toggles">
            {PRICE_RANGES.map(({ label, value, id }) => {
              const on = priceRanges.some((pr) => sameRange(pr, value));
              const count = filterCounts?.priceRangeCounts?.find((p) => p.id === id)?.count ?? null;
              return (
                <li key={id} className="sidebar-list-item-with-count">
                  <label className="sidebar-toggle">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => togglePriceRange(value)}
                    />
                    <span className="sidebar-toggle-label">{label}</span>
                  </label>
                  {count !== null && <span className="sidebar-filter-count">({count})</span>}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </aside>
  );
}
