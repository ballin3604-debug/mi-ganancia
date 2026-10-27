import { useMemo } from 'react';
import { formatBs } from '../utils/currency';
import { CashBillIcon } from './CashBillIcon';
import { SyncStatusBadge } from './SyncStatusBadge';
import EmptyState from './ui/EmptyState';

// Auditoría de ventas: lista completa de tickets agrupada por cajero,
// sin filtros. A la izquierda N° de ticket + fecha y hora,
// a la derecha el monto con icono de billete.
export function AuditSalesList({ sales, businessName = '', onSelectSale }) {
  const groups = useMemo(() => {
    const map = new Map();
    (sales || []).forEach((s) => {
      const key = s.seller || 'Sin nombre';
      if (!map.has(key)) map.set(key, { name: key, sales: [], total: 0 });
      const g = map.get(key);
      g.sales.push(s);
      g.total += s.total;
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [sales]);

  const grandTotal = useMemo(
    () => (sales || []).reduce((sum, s) => sum + s.total, 0),
    [sales]
  );

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Encabezado minimalista */}
      <div className="px-1 mb-3">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-sm font-black tracking-tight text-[var(--mg-text-primary)] uppercase">
            Auditoría de ventas
          </h1>
          <p className="text-sm font-black text-[var(--mg-success-text)] tabular-nums shrink-0">
            {formatBs(grandTotal)}
          </p>
        </div>
        <p className="text-[11px] font-semibold text-[var(--mg-text-muted)] mt-0.5">
          {(sales || []).length} {(sales || []).length === 1 ? 'ticket' : 'tickets'}
          {businessName ? ` · ${businessName}` : ''}
        </p>
      </div>

      {(sales || []).length === 0 ? (
        <EmptyState
          icon="recibo"
          title="No hay ventas registradas"
          description="Los tickets emitidos aparecerán aquí automáticamente."
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.name} className="space-y-2.5">
              <div className="px-1 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--mg-brand)]" />
                  <h2 className="truncate text-sm font-extrabold tracking-tight text-[var(--mg-text-primary)] sm:text-base">
                    {group.name}
                  </h2>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-[var(--mg-text-muted)] tabular-nums flex items-center gap-1.5 shrink-0">
                  <span>Total:</span>
                  <span className="text-[var(--mg-success-text)] font-black">{formatBs(group.total)}</span>
                  <span className="text-[var(--mg-text-faint)] font-bold">({group.sales.length})</span>
                </p>
              </div>

              <div className="space-y-2.5">
                {group.sales.map((sale) => (
                  <div
                    key={sale.id}
                    onClick={() => onSelectSale?.(sale)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onSelectSale?.(sale);
                    }}
                    className="group flex min-h-[68px] cursor-pointer items-center justify-between rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] px-4 py-3.5 shadow-[var(--mg-shadow-sm)] transition-all hover:border-[var(--mg-border-hover)] hover:shadow-md active:scale-[0.99] sm:px-5 sm:py-4"
                  >
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <p className="text-sm sm:text-[15px] font-black text-[var(--mg-text-primary)] tracking-tight truncate">
                          TICKET {sale.number}
                        </p>
                        <SyncStatusBadge status={sale.sync_status} />
                      </div>
                      <p className="mt-1 truncate font-mono text-[11px] font-semibold uppercase tracking-wide text-[var(--mg-text-muted)] sm:text-xs">
                        {sale.dateLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 pl-3">
                      <span className="text-sm sm:text-base font-black text-[var(--mg-success)] tracking-tight tabular-nums">
                        {formatBs(sale.total)}
                      </span>
                      <CashBillIcon />
                      <span className="text-lg font-black text-[var(--mg-text-faint)]">›</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
