import { motion } from 'motion/react';

function CardImage({ imageData, name, large = false }) {
  if (!imageData) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--mg-bg-elevated)] text-[var(--mg-text-faint)]">
        <svg
          className={large ? 'h-12 w-12' : 'h-8 w-8'}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.6}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
    );
  }
  return (
    <img
      src={imageData}
      alt={name}
      className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
    />
  );
}

export function StockLabel({ stock, minStock, isDish, isAvailable = true, size = 'sm' }) {
  const pill = size === 'md'
    ? 'mt-2 px-2.5 py-1 text-xs'
    : 'mt-1.5 px-2 py-0.5 text-[10px]';
  const isOut = Number(stock || 0) <= 0;
  if (isAvailable === false || isOut) {
    return (
      <span className={`inline-flex items-center rounded-full border font-black bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] border-[var(--mg-danger-border)] ${pill}`}>
        {isDish ? '🍽️ Agotado' : 'Sin stock'}
      </span>
    );
  }

  const isLow = !isOut && Number(stock) <= (minStock || 5);

  const styles = isLow
    ? 'bg-[var(--mg-warning-bg)] text-[var(--mg-warning)] border-[var(--mg-gold-border)]'
    : 'bg-[var(--mg-success-bg)] text-[var(--mg-success-text)] border-[var(--mg-success-border)]';

  return (
    <span className={`inline-flex items-center rounded-full border font-black ${pill} ${styles}`}>
      {`Stock ${stock}`}
    </span>
  );
}

export default function ProductCatalogCard({
  product,
  priceLabel,
  metaLabel,
  selected,
  disabled,
  onSelect,
  actionArea,
  size = 'compact',
  animateLayout = false,
}) {
  const large = size === 'large';
  return (
    <motion.div
      layout={animateLayout ? true : undefined}
      whileHover={disabled ? undefined : { y: -4, scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28, layout: { duration: 0.28, ease: 'easeOut' } }}
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
          <CardImage imageData={product.imageData} name={product.name} large={large} />
        </div>

        <div className={large ? 'p-4 pr-16' : 'p-3 pr-11'}>
          <p className={
            large
              ? 'min-h-[3.25rem] text-lg font-semibold leading-snug tracking-tight text-[var(--mg-text-primary)] line-clamp-2 transition-colors group-hover:text-[var(--mg-brand-text)]'
              : 'min-h-[2.5rem] font-extrabold text-sm leading-snug tracking-tight text-[var(--mg-text-primary)] line-clamp-2 transition-colors group-hover:text-[var(--mg-brand-text)]'
          }>
            {product.name}
          </p>

          {product.brand && (
            <p className={`font-bold text-[var(--mg-text-muted)] uppercase tracking-wider truncate ${
              large ? 'mt-1 text-[11px]' : 'mt-0.5 text-[10px]'
            }`}>
              {product.brand}
            </p>
          )}

          <p className={`mt-1.5 tracking-tight text-[var(--mg-text-primary)] ${
            large ? 'text-lg font-bold' : 'text-sm font-black'
          }`}>{priceLabel}</p>
          {metaLabel}
        </div>
      </button>

      {actionArea && (
        <div className={large ? 'absolute bottom-3.5 right-3.5' : 'absolute bottom-2.5 right-2.5'}>{actionArea}</div>
      )}
    </motion.div>
  );
}
