// ─────────────────────────────────────────────────────────────
// Control de vencimientos en el Inicio (solo dueño).
// Mismo lenguaje visual que Alertas de Bajo Stock.
// ─────────────────────────────────────────────────────────────
import { AppIcon } from '../icons';

function fmtDate(d) {
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' });
}

export function ExpiryAlert({ expiredCount = 0, soonCount = 0, items = [], onNavigate }) {
  const total = expiredCount + soonCount;
  if (total === 0) return null;

  return (
    <section className="bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] p-5 shadow-xs">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-black text-[var(--mg-text-primary)] flex items-center gap-1.5">
          <AppIcon name="reloj" size={16} /> Control de vencimientos
        </h3>
        <div className="flex items-center gap-1.5">
          {expiredCount > 0 && (
            <span className="text-[10px] font-black uppercase tracking-wider text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              {expiredCount} vencido{expiredCount === 1 ? '' : 's'}
            </span>
          )}
          {soonCount > 0 && (
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              {soonCount} por vencer
            </span>
          )}
        </div>
      </div>
      <p className="text-[11px] text-[var(--mg-text-muted)] mb-3">Revisa fechas antes de vender o reponer.</p>

      <ul className="space-y-2">
        {items.slice(0, 4).map((it) => (
          <li key={it.productId} className="flex items-center gap-2 bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-xl px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-[var(--mg-text-primary)] truncate">{it.name}</p>
              <p className={`text-[11px] font-bold ${it.daysLeft < 0 ? 'text-red-600' : 'text-amber-700'}`}>
                {it.daysLeft < 0 ? `Vencido hace ${Math.abs(it.daysLeft)} d` : it.daysLeft === 0 ? 'Vence hoy' : `Vence en ${it.daysLeft} d`} · {fmtDate(it.date)}
              </p>
            </div>
            <span className="text-[11px] font-bold text-[var(--mg-text-muted)] tabular-nums shrink-0">
              {it.stock} und.
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onNavigate && onNavigate(expiredCount > 0 ? '/inventario?filtro=vencidos' : '/inventario?filtro=porVencer')}
        className="w-full mt-3 text-xs font-bold text-[var(--mg-text-secondary)] bg-[var(--mg-bg-elevated)] hover:bg-slate-100 border border-[var(--mg-border)] rounded-xl py-2.5"
      >
        Ver en Inventario →
      </button>
    </section>
  );
}
