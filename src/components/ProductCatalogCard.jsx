function CardImage({ imageData, name }) {
  if (!imageData) {
    return (
      <div className="w-full h-full flex items-center justify-center text-4xl bg-[var(--mg-bg-elevated)]">
        📦
      </div>
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center bg-[var(--mg-bg-elevated)]">
      <img src={imageData} alt={name} className="w-full h-full object-contain" />
    </div>
  );
}

export function StockLabel({ stock, minStock }) {
  const isOut = stock === 0;
  const isLow = stock > 0 && stock <= (minStock || 5);
  const color = isOut ? 'text-red-500' : isLow ? 'text-amber-600' : 'text-green-600';
  return <p className={`text-[11px] font-bold mt-1 ${color}`}>{isOut ? 'Sin stock' : `Stock: ${stock}`}</p>;
}

export default function ProductCatalogCard({ product, priceLabel, metaLabel, selected, disabled, onSelect, actionArea }) {
  return (
    <div
      className={`rounded-2xl overflow-hidden border bg-[var(--mg-bg-surface)] shadow-sm hover:shadow-md transition-all relative flex flex-col ${
        selected ? 'ring-2 ring-[var(--mg-accent)] border-transparent' : 'border-[var(--mg-border)]'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className="w-full text-left active:scale-[0.98] transition-transform flex flex-col"
      >
        <div className="h-36 w-full overflow-hidden">
          <CardImage imageData={product.imageData} name={product.name} />
        </div>
        <div className="p-2.5 pr-11">
          <p className="font-bold text-[var(--mg-text-primary)] text-xs leading-snug line-clamp-2 min-h-[2rem]">
            {product.name}
          </p>
          {product.brand && (
            <p className="text-[10px] text-[var(--mg-text-faint)] mt-0.5 truncate uppercase tracking-wide">{product.brand}</p>
          )}
          <p className="font-black text-[var(--mg-text-primary)] text-sm mt-1">{priceLabel}</p>
          {metaLabel}
        </div>
      </button>

      {actionArea && (
        <div className="absolute bottom-2.5 right-2.5">{actionArea}</div>
      )}
    </div>
  );
}
