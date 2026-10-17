import { motion } from 'motion/react';

// Fila de producto estilo lista para celular (foto + nombre + presentación
// + precio + botón verde). Se usa en Ventas, Compras e Inventario solo en
// pantallas chicas; en desktop se sigue viendo la cuadrícula de tarjetas.
export function RowAddButton({ onAdd, disabled, title = 'Agregar' }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onAdd?.();
      }}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="w-11 h-11 min-w-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center justify-center active:scale-90 transition-all font-black text-2xl leading-none shrink-0 disabled:opacity-40"
    >
      +
    </button>
  );
}

export default function ProductListRow({
  product,
  subtitle,
  priceLabel,
  meta = null,
  selected = false,
  disabled = false,
  onSelect,
  actionArea,
}) {
  return (
    <motion.div
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={disabled ? undefined : onSelect}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect?.();
        }
      }}
      className={`w-full flex items-center gap-3 bg-[var(--mg-bg-surface)] rounded-2xl border p-2.5 pr-3 text-left shadow-xs transition-colors min-h-[76px] ${
        disabled ? 'opacity-50' : 'cursor-pointer'
      } ${
        selected
          ? 'ring-2 ring-[var(--mg-accent)] border-transparent'
          : 'border-[var(--mg-border)]'
      }`}
    >
      <span className="w-14 h-16 rounded-xl bg-[var(--mg-bg-elevated)] border border-[var(--mg-separator)] flex items-center justify-center overflow-hidden p-1 shrink-0">
        {product.imageData ? (
          <img
            src={product.imageData}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-2xl text-[var(--mg-text-faint)]">📦</span>
        )}
      </span>

      <span className="flex-1 min-w-0">
        <span className="block font-extrabold text-[var(--mg-text-primary)] text-sm leading-snug line-clamp-2">
          {product.name}
        </span>
        {subtitle ? (
          <span className="block text-xs font-semibold text-[var(--mg-text-muted)] mt-0.5 truncate">
            {subtitle}
          </span>
        ) : null}
        <span className="block font-black text-[var(--mg-text-primary)] text-base mt-1 tabular-nums">
          {priceLabel}
        </span>
        {meta}
      </span>

      <span className="shrink-0 flex items-center">
        {actionArea}
      </span>
    </motion.div>
  );
}
