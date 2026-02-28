import type { Product } from '../api';

type OptionEntry = { key: keyof Product; label: string };

const CONDITION_OPTIONS: OptionEntry[] = [
  { key: 'brand_new', label: 'Brand New' },
  { key: 'was_never_used', label: 'Never Used' },
  { key: 'was_never_assembled', label: 'Never Assembled' },
  { key: 'open_box', label: 'Open Box' },
  { key: 'assembly_required', label: 'Original Packaging' },
];

const DELIVERY_OPTIONS: OptionEntry[] = [
  { key: 'free_local_curbside_delivery', label: 'Free Local Curbside Delivery' },
  { key: 'local_curbside_delivery_fee', label: 'Local Curbside Delivery (fee)' },
  { key: 'meetup_public_place', label: 'Meet up (public place)' },
  { key: 'pickup', label: 'Pick up' },
];

function OptionGrid({
  options,
  product,
  signVariant,
}: {
  options: typeof CONDITION_OPTIONS;
  product: Product;
  signVariant: 'condition' | 'delivery';
}) {
  const selected = options.filter((o) => (product as Record<string, number>)[o.key]);
  if (selected.length === 0) return null;
  return (
    <div className="product-detail-options-grid">
      {selected.map(({ key, label }) => (
        <span
          key={key}
          className={`product-detail-option-sign product-detail-option-sign--${signVariant}`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

type Props = { product: Product };

export default function ProductDetailOptions({ product }: Props) {
  const hasConditions = CONDITION_OPTIONS.some((o) => (product as Record<string, number>)[o.key]);
  const hasDelivery = DELIVERY_OPTIONS.some((o) => (product as Record<string, number>)[o.key]);
  if (!hasConditions && !hasDelivery) return null;

  return (
    <div className="product-detail-options">
      {hasConditions && (
        <div className="product-detail-options-section">
          <h4 className="product-detail-options-title">Condition</h4>
          <OptionGrid options={CONDITION_OPTIONS} product={product} signVariant="condition" />
        </div>
      )}
      {hasDelivery && (
        <div className="product-detail-options-section">
          <h4 className="product-detail-options-title">Pickup and Delivery Options</h4>
          <OptionGrid options={DELIVERY_OPTIONS} product={product} signVariant="delivery" />
        </div>
      )}
    </div>
  );
}
