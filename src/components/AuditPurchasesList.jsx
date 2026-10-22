import { formatBs } from '../utils/currency';
import { CartBillIcon } from './CartBillIcon';
import EmptyState from './ui/EmptyState';

// Auditoría de compras: lista simple de reposiciones para celular.
// Izquierda: N° de compra + producto + proveedor + fecha y hora.
// Derecha: total con icono. En PC se sigue usando la tabla.
export function AuditPurchasesList({ rows }) {
  const total = (rows || []).reduce((sum, r) => sum + Number(r.totalCost || 0), 0);

  if (!rows || rows.length === 0) {
    return (
      <EmptyState
        icon="paquete"
        title="No hay compras registradas"
        description="Las compras y reposiciones aparecerán aquí automáticamente."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shadow-[var(--mg-shadow-sm)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)] px-4 py-2.5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--mg-text-secondary)]">
          Compras ({rows.length})
        </p>
        <p className="text-[11px] font-black tabular-nums text-[var(--mg-brand)]">
          Total: {formatBs(total)}
        </p>
      </div>
      <div className="divide-y divide-[var(--mg-separator)]">
        {rows.map((r) => {
          const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
          const valid = d instanceof Date && !Number.isNaN(d.getTime());
          const fecha = valid ? d.toLocaleDateString('es-BO') : '—';
          const hora = valid ? d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) : '';
          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--mg-text-muted)] tabular-nums">
                  Compra {r.number}
                </p>
                <p className="mt-0.5 truncate text-sm font-bold text-[var(--mg-text-primary)]">
                  {r.productName}
                  {r.supplier ? <span className="font-semibold text-[var(--mg-text-muted)]"> · {r.supplier}</span> : null}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px] font-semibold uppercase text-[var(--mg-text-muted)]">
                  {fecha}{hora ? ` · ${hora}` : ''}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 text-sm font-black tabular-nums text-[var(--mg-brand)]">
                {formatBs(r.totalCost)}
                <CartBillIcon className="h-8 w-9" />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
