import React, { useState } from 'react';
import type { Product } from '../api';
import ProductCard from './ProductCard';
import ProductDetail from './ProductDetail';

type Props = {
  products: Product[];
  loading: boolean;
};

export default function ProductGrid({ products, loading }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="product-grid-loading">
        <p>Loading products…</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="product-grid-empty">
        <p>No products match your filters.</p>
      </div>
    );
  }

  return (
    <div className="product-grid-wrapper">
      <div className="product-grid">
        {products.map((product, index) => (
          <React.Fragment key={product.id}>
            <ProductCard
              product={product}
              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              isExpanded={expandedIndex === index}
            />
            {expandedIndex === index && (
              <div className="product-detail-wrap">
                <ProductDetail
                  product={product}
                  onClose={() => setExpandedIndex(null)}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
