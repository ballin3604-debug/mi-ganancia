// ─────────────────────────────────────────────────────────────
// Top productos del día (compacto, para compartir fila en el Inicio).
// ─────────────────────────────────────────────────────────────
export function TopProductsCard({ data = [] }) {
  const top = data.filter((p) => p.label !== 'Otros').slice(0, 5);
  const max = Math.max(...top.map((x) => x.value), 1);
  if (top.length === 0) return null;

  return (
    <section className="bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] p-5 shadow-xs">
      <h3 className="text-sm font-black text-[var(--mg-text-primary)] mb-1">
        Productos más vendidos
      </h3>
      <p className="text-[11px] text-[var(--mg-text-muted)] mb-3">Unidades y dinero de hoy.</p>
      <ul className="divide-y divide-[var(--mg-separator)]">
        {top.map((p, i) => (
          <li key={p.label} className="relative py-2 overflow-hidden">
            <div
              className="absolute left-0 top-1 bottom-1 rounded-lg"
              style={{ width: `${Math.max((p.value / max) * 100, 6)}%`, background: `${p.color}1f` }}
            />
            <div className="relative flex items-center gap-2.5">
              <span className="w-4 text-center text-[11px] font-black text-[var(--mg-text-faint)] shrink-0">
                {i + 1}
              </span>
              {p.image ? (
                <img
                  src={p.image}
                  alt={p.label}
                  className="w-8 h-8 rounded-lg object-cover border border-[var(--mg-border)] shrink-0 bg-white"
                  loading="lazy"
                />
              ) : (
                <span className="w-8 h-8 rounded-lg bg-white border border-[var(--mg-border)] flex items-center justify-center text-sm shrink-0">
                  📦
                </span>
              )}
              <span className="flex-1 min-w-0 truncate text-xs font-bold text-[var(--mg-text-primary)]">
                {p.label}
              </span>
              <span className="text-right shrink-0">
                <span className="block text-xs font-black text-[var(--mg-text-primary)] tabular-nums">
                  {p.value} ud.
                </span>
                <span className="block text-[10px] font-bold text-[#1670C2] tabular-nums">
                  Bs {Number(p.revenue || 0).toFixed(2)}
                </span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
