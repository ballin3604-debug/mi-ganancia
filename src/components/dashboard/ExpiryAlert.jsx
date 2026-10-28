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

  return (
    <section className="bg-[var(--mg-bg-surface)] rounded-3xl border border-[var(--mg-border)] p-5 shadow-[var(--mg-shadow-sm)]">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="text-sm font-black text-[var(--mg-brand-text)] flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)] flex items-center justify-center shrink-0">
            <AppIcon name="reloj" size={16} />
          </span>
          Control de vencimientos
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {expiredCount > 0 && (
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--mg-danger)] bg-[var(--mg-danger-bg)] border border-[var(--mg-danger-border)] px-2 py-0.5 rounded-full">
              {expiredCount} vencido{expiredCount === 1 ? '' : 's'}
            </span>
          )}
          {soonCount > 0 && (
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--mg-gold-text)] bg-[var(--mg-gold-bg)] border border-[var(--mg-gold-border)] px-2 py-0.5 rounded-full">
              {soonCount} por vencer
            </span>
          )}
        </div>
      </div>
      <p className="text-[11px] text-[var(--mg-text-muted)] mb-3">Revisa fechas antes de vender o reponer.</p>

      {total === 0 ? (
        <p className="text-xs font-semibold text-[var(--mg-success-text)] bg-[var(--mg-success-bg)] border border-[var(--mg-success-border)] rounded-xl px-3 py-3 text-center">
          Sin vencimientos: ningún producto vence pronto.
        </p>
      ) : (
      <ul className="space-y-2">
        {items.slice(0, 4).map((it) => (
          <li key={it.productId} className="flex items-center gap-2 bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-xl px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-[var(--mg-text-primary)] truncate">{it.name}</p>
              <p className={`text-[11px] font-bold ${it.daysLeft < 0 ? 'text-[var(--mg-danger)]' : 'text-[var(--mg-gold-text)]'}`}>
                {it.daysLeft < 0 ? `Vencido hace ${Math.abs(it.daysLeft)} d` : it.daysLeft === 0 ? 'Vence hoy' : `Vence en ${it.daysLeft} d`} · {fmtDate(it.date)}
              </p>
            </div>
            <span className="text-[11px] font-bold text-[var(--mg-text-muted)] tabular-nums shrink-0">
              {it.stock} und.
            </span>
          </li>
        ))}
      </ul>
      )}

      <button
        type="button"
        onClick={() => onNavigate && onNavigate(expiredCount > 0 ? '/inventario?filtro=vencidos' : '/inventario?filtro=porVencer')}
        className="w-full mt-3 text-xs font-bold text-[var(--mg-text-secondary)] bg-[var(--mg-bg-elevated)] hover:bg-[var(--mg-bg-section)] border border-[var(--mg-border)] rounded-xl py-2.5 min-h-[44px] transition-colors"
      >
        Ver en Inventario →
      </button>
    </section>
  );
}
