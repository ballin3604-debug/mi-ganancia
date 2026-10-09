// ─────────────────────────────────────────────────────────────
// Control de vencimientos en el Inicio (solo dueño).
// Muestra lo vencido y por vencer con acceso directo a Inventario.
// ─────────────────────────────────────────────────────────────
import { AppIcon } from '../icons';

function fmtDate(d) {
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' });
}

export function ExpiryAlert({ expiredCount = 0, soonCount = 0, items = [], onNavigate }) {
  const total = expiredCount + soonCount;
  if (total === 0) return null;

  return (
    <section className={`rounded-[22px] p-5 border shadow-xs ${expiredCount > 0 ? 'bg-red-50/60 border-red-200' : 'bg-amber-50/60 border-amber-200'}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <h3 className="text-sm font-black text-[var(--mg-text-primary)] flex items-center gap-1.5">
          <AppIcon name="reloj" size={16} /> Control de vencimientos
        </h3>
        <div className="flex items-center gap-1.5">
          {expiredCount > 0 && (
            <span className="text-[10px] font-black uppercase tracking-wide text-red-700 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">
              {expiredCount} vencido{expiredCount === 1 ? '' : 's'}
            </span>
          )}
          {soonCount > 0 && (
            <span className="text-[10px] font-black uppercase tracking-wide text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
              {soonCount} por vencer
            </span>
          )}
        </div>
      </div>

      <ul className="space-y-1.5">
        {items.slice(0, 4).map((it) => (
          <li key={it.productId} className="flex items-center gap-2 bg-white border border-[var(--mg-border)] rounded-xl px-3 py-2">
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
        className="w-full mt-3 text-xs font-bold text-[var(--mg-text-secondary)] bg-white hover:bg-slate-50 border border-[var(--mg-border)] rounded-xl py-2.5"
      >
        Ver en Inventario →
      </button>
    </section>
  );
}
