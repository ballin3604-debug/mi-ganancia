// ─────────────────────────────────────────────────────────────
// Top productos del día (compacto, para compartir fila en el Inicio).
// ─────────────────────────────────────────────────────────────
import { AppIcon } from '../icons';

export function TopProductsCard({ data = [] }) {
  const top = data.filter((p) => p.label !== 'Otros').slice(0, 5);
  const max = Math.max(...top.map((x) => x.value), 1);

  return (
    <section className="bg-[var(--mg-bg-surface)] rounded-3xl border border-[var(--mg-border)] p-5 shadow-[var(--mg-shadow-sm)]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-[var(--mg-brand-text)] flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)] flex items-center justify-center shrink-0">
              <AppIcon name="reportes" size={16} />
            </span>
            Productos más vendidos
          </h3>
          <p className="text-[11px] text-[var(--mg-text-muted)] mt-1">Unidades y dinero de hoy.</p>
        </div>
        <span className="text-[10px] font-bold text-[var(--mg-text-secondary)] bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-full px-2 py-0.5 shrink-0">
          Top 5
        </span>
      </div>

      {top.length === 0 ? (
        <p className="text-xs font-semibold text-[var(--mg-text-muted)] bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-xl px-3 py-3 text-center">
          Sin ventas hoy: aquí verás tu producto estrella.
        </p>
      ) : (
      <ul className="divide-y divide-[var(--mg-separator)]">
        {top.map((p, i) => (
          <li key={p.label} className="relative py-2.5 overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute left-0 top-1 bottom-1 rounded-lg"
              style={{ width: `${Math.max((p.value / max) * 100, 6)}%`, backgroundColor: p.color, opacity: 0.1 }}
            />
            <div className="relative flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[var(--mg-bg-section)] text-[var(--mg-text-secondary)] flex items-center justify-center text-[10px] font-black shrink-0 tabular-nums">
                {i + 1}
              </span>
              {p.image ? (
                <img
                  src={p.image}
                  alt={p.label}
                  className="w-8 h-8 rounded-lg object-cover border border-[var(--mg-border)] shrink-0 bg-[var(--mg-bg-surface)]"
                  loading="lazy"
                />
              ) : (
                <span className="w-8 h-8 rounded-lg bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] text-[var(--mg-text-muted)] flex items-center justify-center shrink-0">
                  <AppIcon name="paquete" size={15} />
                </span>
              )}
              <span className="flex-1 min-w-0 truncate text-xs font-bold text-[var(--mg-text-primary)]">
                {p.label}
              </span>
              <span className="text-right shrink-0">
                <span className="block text-xs font-black text-[var(--mg-text-primary)] tabular-nums">
                  {p.value} ud.
                </span>
                <span className="block text-[10px] font-bold text-[var(--mg-brand-text)] tabular-nums">
                  Bs {Number(p.revenue || 0).toFixed(2)}
                </span>
              </span>
            </div>
          </li>
        ))}
      </ul>
      )}
    </section>
  );
}
