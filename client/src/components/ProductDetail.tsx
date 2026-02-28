import type { Product } from '../api';
import ImageGallery from './ImageGallery';
import ProductDetailOptions from './ProductDetailOptions';

type Props = {
  product: Product;
  onClose: () => void;
};

export default function ProductDetail({ product, onClose }: Props) {
  return (
    <div className="product-detail" role="dialog" aria-label={`Details for ${product.name}`}>
      <button type="button" className="product-detail-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="product-detail-content">
        <div className="product-detail-gallery">
          <ImageGallery images={product.image_urls || []} name={product.name} />
        </div>
        <div className="product-detail-specs">
          <h2 className="product-detail-name">{product.name}</h2>
          <p className="product-detail-manufacturer">Manufacturer: {product.manufacturer}</p>
          {product.sku && <p className="product-detail-sku">SKU: {product.sku}</p>}
          <div className="product-detail-prices">
            {product.retail_price != null && Number(product.retail_price) > Number(product.price) && (
              <span className="price-retail">${Number(product.retail_price).toFixed(2)}</span>
            )}
            <p className="product-detail-price">${Number(product.price).toFixed(2)}</p>
          </div>
          <div className="product-detail-fb-row">
            {product.fb_marketplace_url ? (
              <a
                href={product.fb_marketplace_url}
                target="_blank"
                rel="noopener noreferrer"
                className="product-detail-fb"
              >
                View on Facebook Marketplace
              </a>
            ) : <span />}
            <div className="product-detail-quantity">
              <span className="product-detail-quantity-label">
                <span>Quantity</span>
                <span>in stock</span>
              </span>
              <span className="product-detail-quantity-value">{product.quantity ?? 0}</span>
            </div>
          </div>
          <ProductDetailOptions product={product} />
          {product.description && (
            <div className="product-detail-features">
              <h4>Features</h4>
              <p className="product-detail-features-text">{product.description}</p>
            </div>
          )}
          {product.dimensions && <p><strong>Dimensions:</strong> {product.dimensions}</p>}
          {product.weight && <p><strong>Weight:</strong> {product.weight}</p>}
          {product.color && <p><strong>Color:</strong> {product.color}</p>}
          {product.assembly_required ? (
            <p className="product-detail-assembly-note">*Some Assembly May be Required</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
