import type { Product } from '../api';

type Props = {
  product: Product;
  onClick: () => void;
  isExpanded: boolean;
};

export default function ProductCard({ product, onClick, isExpanded }: Props) {
  const imageUrl = product.image_urls && product.image_urls[0];
  return (
    <article className={`product-card ${isExpanded ? 'expanded' : ''}`}>
      <button type="button" className="product-card-button" onClick={onClick}>
        <div className="product-card-image">
          {imageUrl ? (
            <img src={imageUrl} alt="" loading="lazy" />
          ) : (
            <div className="product-card-placeholder">No image</div>
          )}
        </div>
        <div className="product-card-info">
          <span className="product-card-manufacturer product-card-manufacturer-standalone">{product.manufacturer}</span>
          <h3 className="product-card-name">{product.name}</h3>
          <div className="product-card-prices">
            {product.retail_price != null && Number(product.retail_price) > Number(product.price) && (
              <span className="price-retail">${Number(product.retail_price).toFixed(2)}</span>
            )}
            <span className="product-card-price">${Number(product.price).toFixed(2)}</span>
          </div>
        </div>
      </button>
    </article>
  );
}
