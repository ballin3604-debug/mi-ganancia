import { getSellOptions, formatMoney } from '../utils/presentations';
import { AppIcon } from './icons';

// Hoja para elegir cómo se vende: unidad suelta o paquete (frío/caliente).
// Se queda abierta para sumar varias veces seguidas sin salir.
export default function PresentationPicker({ product, cartCounts = {}, cartBaseUsed = 0, onPick, onClose, onGoCart, cartTotalItems = 0 }) {
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
        <div className="flex items-center gap-3 border-b border-[var(--mg-separator)] p-4">
          {product.imageData ? (
            <img src={product.imageData} alt={product.name} className="h-12 w-12 shrink-0 rounded-xl border border-[var(--mg-border)] object-cover" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]">
              <AppIcon name="paquete" size={22} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-black text-[var(--mg-text-primary)]">{product.name}</h3>
            <p className="text-[11px] font-semibold text-[var(--mg-text-muted)]">Stock: {product.stock} und. · ¿Cómo lo vendes?</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]"
            aria-label="Cerrar"
          >
            <AppIcon name="cerrar" size={15} />
          </button>
        </div>

        <div className="p-4 space-y-2.5">
          {options.map((opt) => {
            const count = cartCounts[opt.key] || 0;
            const maxed = Number(product.stock || 0) - cartBaseUsed < opt.factor;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onPick(opt)}
                disabled={maxed}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all active:scale-[0.98] disabled:opacity-50 ${
                  count > 0
                    ? 'border-[var(--mg-brand)] bg-[var(--mg-brand-bg)]'
                    : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)] hover:border-[var(--mg-border-hover)]'
                }`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${count > 0 ? 'border-[var(--mg-brand-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-brand-text)]' : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'}`}>
                  <AppIcon name={opt.factor > 1 ? 'paquete' : 'etiqueta'} size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-[var(--mg-text-primary)]">
                    {opt.presentationId
                      ? `1 ${opt.label}${opt.factor > 1 ? ` (x${opt.factor})` : ''}`
                      : opt.presId === 'pack'
                      ? `1 ${(product.packLabel || 'Paquete').trim() || 'Paquete'}${opt.variant === 'caliente' ? ' caliente' : opt.variant === 'frio' ? ' frío' : ''} (x${opt.factor})`
                      : `1 ${(product.unitLabel || 'Unidad').trim() || 'Unidad'}`}
                  </span>
                  <span className="block text-[11px] font-semibold text-[var(--mg-text-muted)]">
                    {formatMoney(opt.price)}{opt.factor === 1 ? ' c/u' : ' por presentación'}
                  </span>
                </span>
                {count > 0 ? (
                  <span className="shrink-0 rounded-full bg-[var(--mg-brand)] px-3 py-1.5 text-xs font-black text-white">
                    x {count}
                  </span>
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--mg-brand)] font-black text-white">
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
            className="flex-1 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] py-3 text-sm font-bold text-[var(--mg-text-secondary)] transition-colors hover:bg-[var(--mg-bg-section)] active:scale-95"
          >
            Seguir
          </button>
          <button
            type="button"
            onClick={onGoCart}
            disabled={cartTotalItems === 0}
            className="flex-1 rounded-2xl bg-[var(--mg-brand)] py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[var(--mg-brand-hover)] active:scale-95 disabled:opacity-50"
          >
            Ver carrito ({cartTotalItems})
          </button>
        </div>
      </div>
    </div>
  );
}
