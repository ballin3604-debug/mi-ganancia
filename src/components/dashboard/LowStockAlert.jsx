import { AppIcon } from '../icons';

export function LowStockAlert({ items = [], onNavigate, reorderPath = '/compras' }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-3xl border border-[var(--mg-danger-border)] bg-[var(--mg-bg-surface)] p-5 shadow-[var(--mg-shadow-sm)]">
      <div className="mb-1 flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-black text-[var(--mg-brand-text)]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]">
            <AppIcon name="reloj" size={16} />
          </span>
          Alertas de bajo stock
        </h3>
        <span className="shrink-0 rounded-full border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[var(--mg-danger)]">
          {items.length} urgente{items.length === 1 ? '' : 's'}
        </span>
      </div>
      <p className="mb-3 text-[11px] text-[var(--mg-text-muted)]">Existencias en mínimo o menos. Evita quiebres de venta.</p>

      <ul className="space-y-2">
        {items.slice(0, 4).map((product) => (
          <li key={product.id} className="flex items-center gap-2 rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-[var(--mg-text-primary)]">{product.name}</p>
              <p className="text-[10px] font-bold text-[var(--mg-danger)]">
                {product.stock} en stock · Mín: {product.minStock || 5}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate(reorderPath, { state: { reorderProductId: product.id } })}
              className="shrink-0 rounded-lg bg-[var(--mg-accent)] px-2.5 py-1.5 text-[11px] font-black text-white transition-colors hover:bg-[var(--mg-accent-hover)]"
            >
              + Reordenar
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onNavigate && onNavigate('/inventario')}
        className="mt-3 min-h-[44px] w-full rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] py-2.5 text-xs font-bold text-[var(--mg-text-secondary)] transition-colors hover:bg-[var(--mg-bg-section)]"
      >
        Ver en Inventario →
      </button>
    </section>
  );
}
