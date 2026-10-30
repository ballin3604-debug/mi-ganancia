import { motion } from 'motion/react';

function CardImage({ imageData, name }) {
  if (!imageData) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--mg-bg-elevated)] text-[var(--mg-text-faint)]">
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
    );
  }
  return (
    <img
      src={imageData}
      alt={name}
      className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-108"
    />
  );
}

export function StockLabel({ stock, minStock, isDish, isAvailable = true }) {
  const isOut = Number(stock || 0) <= 0;
  if (isAvailable === false || isOut) {
    return (
      <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full border text-[10px] font-black bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] border-[var(--mg-danger-border)]">
        {isDish ? '🍽️ Agotado' : 'Sin stock'}
      </span>
    );
  }

  const isLow = !isOut && Number(stock) <= (minStock || 5);

  const styles = isOut
    ? 'bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] border-[var(--mg-danger-border)]'
    : isLow
      ? 'bg-[var(--mg-warning-bg)] text-[var(--mg-warning)] border-[var(--mg-gold-border)]'
      : 'bg-[var(--mg-success-bg)] text-[var(--mg-success-text)] border-[var(--mg-success-border)]';

  return (
    <span className={`inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full border text-[10px] font-black ${styles}`}>
      {isOut ? 'Sin stock' : `Stock ${stock}`}
    </span>
  );
}

export default function ProductCatalogCard({ product, priceLabel, metaLabel, selected, disabled, onSelect, actionArea }) {
  return (
    <motion.div
      whileHover={disabled ? undefined : { y: -4, scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-[var(--mg-bg-surface)] shadow-sm transition-all duration-300 hover:shadow-md ${
        selected
          ? 'border-transparent ring-2 ring-[var(--mg-brand)]'
          : 'border-[var(--mg-border)] hover:border-[var(--mg-border-hover)]'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className="w-full text-left flex flex-col disabled:cursor-not-allowed"
      >
        <div className="aspect-[4/3] w-full overflow-hidden bg-[var(--mg-bg-elevated)] border-b border-[var(--mg-separator)] flex items-center justify-center p-2">
          <CardImage imageData={product.imageData} name={product.name} />
        </div>

        <div className="p-3 pr-11">
          <p className="min-h-[2.5rem] font-extrabold text-sm leading-snug tracking-tight text-[var(--mg-text-primary)] line-clamp-2 transition-colors group-hover:text-[var(--mg-brand-text)]">
            {product.name}
          </p>

          {product.brand && (
            <p className="text-[10px] font-bold text-[var(--mg-text-muted)] mt-0.5 truncate uppercase tracking-wider">
              {product.brand}
            </p>
          )}

          <p className="font-black text-[var(--mg-text-primary)] text-sm mt-1.5 tracking-tight">{priceLabel}</p>
          {metaLabel}
        </div>
      </button>

      {actionArea && (
        <div className="absolute bottom-2.5 right-2.5">{actionArea}</div>
      )}
    </motion.div>
  );
}
