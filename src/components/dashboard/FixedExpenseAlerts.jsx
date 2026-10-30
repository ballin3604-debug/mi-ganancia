import { AppIcon } from '../icons';
import { formatBs } from '../../utils/currency';

function formatDueDate(date) {
  return date.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' });
}

function dueLabel(daysLeft) {
  if (daysLeft < 0) return `Vencido hace ${Math.abs(daysLeft)} d`;
  if (daysLeft === 0) return 'Vence hoy';
  if (daysLeft === 1) return 'Vence mañana';
  return `Vence en ${daysLeft} d`;
}

export function FixedExpenseAlerts({ alerts = [], onOpen, onSnooze, onDismiss, busyId = null }) {
  if (alerts.length === 0) return null;

  const overdue = alerts.filter((item) => item.daysLeft < 0).length;
  const total = alerts.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <section className="rounded-3xl border border-[var(--mg-gold-border)] bg-[var(--mg-bg-surface)] p-4 shadow-[var(--mg-shadow-sm)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--mg-gold-text)]">Pagos fijos</p>
          <h2 className="mt-0.5 text-lg font-black tracking-tight text-[var(--mg-brand-text)]">Avisos de pago</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-[var(--mg-text-secondary)]">
            {overdue > 0 ? `${overdue} vencido${overdue === 1 ? '' : 's'} · ` : ''}
            {alerts.length} pago{alerts.length === 1 ? '' : 's'} por revisar · {formatBs(total)}
          </p>
        </div>
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] px-3 py-2 text-[11px] font-black text-[var(--mg-brand-text)] transition-colors hover:bg-[var(--mg-border-hover)] active:scale-95"
          >
            <AppIcon name="gastos" size={14} /> Ver egresos
          </button>
        ) : null}
      </div>

      <ul className="mt-4 space-y-2">
        {alerts.slice(0, 4).map((item) => {
          const isOverdue = item.daysLeft < 0;
          const busy = busyId === item.id;
          return (
            <li
              key={item.id}
              className={`rounded-2xl border px-3 py-2.5 ${
                isOverdue
                  ? 'border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)]'
                  : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                    isOverdue
                      ? 'border-[var(--mg-danger-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-danger)]'
                      : 'border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]'
                  }`}
                >
                  <AppIcon name="reloj" size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-[var(--mg-text-primary)]">{item.description}</p>
                  <p className={`text-[11px] font-bold ${isOverdue ? 'text-[var(--mg-danger)]' : 'text-[var(--mg-gold-text)]'}`}>
                    {dueLabel(item.daysLeft)} · {formatDueDate(item.dueDate)} · {item.category}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-black tabular-nums text-[var(--mg-danger)]">
                  − {formatBs(item.amount)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => onSnooze && onSnooze(item)}
                  disabled={busy}
                  className="min-h-[32px] rounded-lg border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] px-2.5 py-1.5 text-[10px] font-extrabold text-[var(--mg-text-secondary)] transition-colors hover:bg-[var(--mg-bg-section)] disabled:opacity-50"
                >
                  Posponer 7 d
                </button>
                <button
                  type="button"
                  onClick={() => onDismiss && onDismiss(item)}
                  disabled={busy}
                  className="min-h-[32px] rounded-lg border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] px-2.5 py-1.5 text-[10px] font-extrabold text-[var(--mg-success-text)] transition-colors hover:brightness-95 disabled:opacity-50"
                >
                  {busy ? 'Guardando…' : 'Listo'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {alerts.length > 4 ? (
        <p className="mt-2 text-[11px] font-semibold text-[var(--mg-text-muted)]">
          +{alerts.length - 4} aviso{alerts.length - 4 === 1 ? '' : 's'} más en Egresos.
        </p>
      ) : null}
    </section>
  );
}
