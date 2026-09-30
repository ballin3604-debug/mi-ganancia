import { motion } from 'motion/react';

function CardImage({ imageData, name }) {
  if (!imageData) {
    return (
      <div className="w-full h-full flex items-center justify-center text-4xl text-[var(--mg-text-faint)] bg-[var(--mg-bg-elevated)]">
        📦
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

export function StockLabel({ stock, minStock }) {
  const isOut = stock === 0;
  const isLow = stock > 0 && stock <= (minStock || 5);

  const styles = isOut
    ? 'bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] border-red-200'
    : isLow
      ? 'bg-[var(--mg-warning-bg)] text-[var(--mg-warning)] border-amber-200'
      : 'bg-[var(--mg-success-bg)] text-[var(--mg-success-text)] border-green-200';

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
      className={`group rounded-[22px] overflow-hidden border bg-[var(--mg-bg-surface)] shadow-xs hover:shadow-lg transition-shadow duration-300 relative flex flex-col ${
        selected
          ? 'ring-2 ring-[var(--mg-accent)] border-transparent'
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
          <p className="font-extrabold text-[var(--mg-text-primary)] text-xs leading-snug line-clamp-2 min-h-[2rem] tracking-tight group-hover:text-[var(--mg-accent)] transition-colors">
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
