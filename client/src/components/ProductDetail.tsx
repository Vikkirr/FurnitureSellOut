import { useState, useCallback, useEffect } from 'react';
import type { Product } from '../api';
import { getSellerProfileUrl } from '../api';
import ImageGallery from './ImageGallery';
import ProductDetailOptions from './ProductDetailOptions';

/** Copy text to clipboard; works on PC, Mac, and mobile (user gesture required). */
function copyToClipboard(text: string): boolean {
  if (!text) return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  const prevFocus = document.activeElement as HTMLElement | null;
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    // ignore
  }
  document.body.removeChild(textarea);
  if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
  return ok;
}

type Props = {
  product: Product;
  onClose: () => void;
};

export default function ProductDetail({ product, onClose }: Props) {
  const [fbMessage, setFbMessage] = useState<string | null>(null);
  const [sellerProfileUrl, setSellerProfileUrl] = useState<string | null>(null);

  useEffect(() => {
    if (product.fb_marketplace_url) {
      getSellerProfileUrl().then(setSellerProfileUrl);
    }
  }, [product.fb_marketplace_url]);

  const handleCopyAndViewFb = useCallback(async () => {
    const toCopy = product.sku?.trim() || product.name;
    let didCopy = copyToClipboard(toCopy);
    if (!didCopy && typeof navigator?.clipboard?.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(toCopy);
        didCopy = true;
      } catch {
        // ignore
      }
    }
    setFbMessage(didCopy ? toCopy : `${toCopy} (if not copied, select and copy above)`);
  }, [product.sku, product.name]);

  const handleContinueToFb = useCallback(() => {
    const url = sellerProfileUrl || product.fb_marketplace_url;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    setFbMessage(null);
  }, [sellerProfileUrl, product.fb_marketplace_url]);

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
          {product.status === 'pending' && (
            <span className="product-detail-badge product-detail-badge-pending">PENDING</span>
          )}
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
              <div className="product-detail-fb-wrap">
                <button
                  type="button"
                  className="product-detail-fb"
                  onClick={handleCopyAndViewFb}
                >
                  Copy item and view on Facebook Marketplace
                </button>
                {fbMessage !== null && (
                  <div className="product-detail-fb-message" role="alert">
                    <p><strong>Copied:</strong> <span className="product-detail-fb-copied-value" style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>{product.sku?.trim() || product.name}</span></p>
                    {fbMessage.includes('if not copied') && (
                      <button type="button" className="product-detail-fb-copy-again" onClick={handleCopyAndViewFb}>
                        Copy again
                      </button>
                    )}
                    <p>You will be redirected to the seller&apos;s profile. Scroll down and paste this item in the search bar to find the listing.</p>
                    <button type="button" className="product-detail-fb-continue" onClick={handleContinueToFb}>
                      Continue to Facebook Marketplace
                    </button>
                  </div>
                )}
              </div>
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
