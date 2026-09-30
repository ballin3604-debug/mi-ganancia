import { getSellOptions, formatMoney } from '../utils/presentations';

// Hoja para elegir cómo se vende: unidad suelta o paquete (frío/caliente).
// Se queda abierta para sumar varias veces seguidas sin salir.
export default function PresentationPicker({ product, cartCounts = {}, onPick, onClose, onGoCart, cartTotalItems = 0 }) {
  if (!product) return null;
  const options = getSellOptions(product);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--mg-bg-surface)] rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden mg-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[var(--mg-separator)] flex items-center gap-3">
          {product.imageData ? (
            <img src={product.imageData} alt={product.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-[var(--mg-bg-elevated)] flex items-center justify-center text-2xl shrink-0">📦</div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-[var(--mg-text-primary)] truncate">{product.name}</h3>
            <p className="text-[11px] text-[var(--mg-text-muted)]">Stock: {product.stock} und. · ¿Cómo lo vendés?</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 bg-[var(--mg-bg-elevated)] rounded-full flex items-center justify-center text-[var(--mg-text-muted)] font-bold text-lg shrink-0"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-2.5">
          {options.map((opt) => {
            const count = cartCounts[opt.key] || 0;
            const maxed = Math.floor((product.stock || 0) / opt.factor) <= count;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onPick(opt)}
                disabled={maxed}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all active:scale-[0.98] disabled:opacity-50 ${
                  count > 0
                    ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)]'
                    : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)]'
                }`}
              >
                <span className="text-2xl shrink-0">{opt.icon}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-black text-[var(--mg-text-primary)] text-sm">
                    {opt.presId === 'pack'
                      ? `1 ${(product.packLabel || 'Paquete').trim() || 'Paquete'}${opt.variant === 'caliente' ? ' caliente' : opt.variant === 'frio' ? ' frío' : ''} (x${opt.factor})`
                      : `1 ${(product.unitLabel || 'Unidad').trim() || 'Unidad'}`}
                  </span>
                  <span className="block text-[11px] text-[var(--mg-text-muted)] font-semibold">
                    {formatMoney(opt.price)} c/u
                  </span>
                </span>
                {count > 0 ? (
                  <span className="bg-[var(--mg-accent)] text-white text-xs font-black px-3 py-1.5 rounded-full shrink-0">
                    x {count}
                  </span>
                ) : (
                  <span className="w-8 h-8 rounded-full bg-[var(--mg-accent)] text-white font-black flex items-center justify-center shrink-0">
                    +
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-[var(--mg-separator)] flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)] font-bold py-3 rounded-2xl text-sm active:scale-95"
          >
            Seguir
          </button>
          <button
            type="button"
            onClick={onGoCart}
            disabled={cartTotalItems === 0}
            className="flex-1 bg-[var(--mg-accent)] text-white font-bold py-3 rounded-2xl text-sm active:scale-95 disabled:opacity-50"
          >
            Ver carrito ({cartTotalItems})
          </button>
        </div>
      </div>
    </div>
  );
}
