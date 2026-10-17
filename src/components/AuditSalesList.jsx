import { useMemo } from 'react';
import { formatBs } from '../utils/currency';
import { CashBillIcon } from './CashBillIcon';

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
          <p className="text-sm font-black text-emerald-700 tabular-nums shrink-0">
            {formatBs(grandTotal)}
          </p>
        </div>
        <p className="text-[11px] font-semibold text-[var(--mg-text-muted)] mt-0.5">
          {(sales || []).length} {(sales || []).length === 1 ? 'ticket' : 'tickets'}
          {businessName ? ` · ${businessName}` : ''}
        </p>
      </div>

      {(sales || []).length === 0 ? (
        <div className="bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] p-8 text-center shadow-xs">
          <p className="text-4xl mb-2">🧾</p>
          <h3 className="text-sm font-black text-[var(--mg-text-primary)]">No hay ventas registradas</h3>
          <p className="text-xs text-[var(--mg-text-muted)] mt-1">
            Los tickets emitidos aparecerán aquí automáticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.name} className="space-y-2.5">
              <div className="px-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600" />
                  </span>
                  <h2 className="text-sm sm:text-base font-extrabold text-[var(--mg-text-primary)] tracking-tight truncate">
                    Cajero: <span className="font-black">{group.name}</span>
                  </h2>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-[var(--mg-text-muted)] tabular-nums flex items-center gap-1.5 shrink-0">
                  <span>Total:</span>
                  <span className="text-emerald-700 font-black">{formatBs(group.total)}</span>
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
                    className="group bg-[var(--mg-bg-surface)] active:scale-[0.99] transition-all rounded-2xl border border-[var(--mg-border)] shadow-xs px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between cursor-pointer min-h-[66px]"
                  >
                    <div className="min-w-0 text-left">
                      <p className="text-sm sm:text-[15px] font-black text-[var(--mg-text-primary)] tracking-tight truncate">
                        TICKET {sale.number}
                      </p>
                      <p className="text-[11px] sm:text-xs text-[var(--mg-text-muted)] font-semibold mt-1 tracking-wider uppercase font-mono truncate">
                        Fecha y hora: {sale.dateLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 pl-3">
                      <span className="text-sm sm:text-base font-black text-emerald-600 tracking-tight tabular-nums">
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
