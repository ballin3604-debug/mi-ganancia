import { formatBs } from '../utils/currency';
import { CartBillIcon } from './CartBillIcon';

// Auditoría de compras: lista simple de reposiciones para celular.
// Izquierda: N° de compra + producto + proveedor + fecha y hora.
// Derecha: total con icono. En PC se sigue usando la tabla.
export function AuditPurchasesList({ rows }) {
  const total = (rows || []).reduce((sum, r) => sum + Number(r.totalCost || 0), 0);

  if (!rows || rows.length === 0) {
    return (
      <div className="bg-[var(--mg-bg-surface)] rounded-[20px] border border-[var(--mg-border)] p-8 text-center shadow-xs">
        <p className="text-4xl mb-2">🛍️</p>
        <h3 className="text-sm font-black text-[var(--mg-text-primary)]">No hay compras registradas</h3>
        <p className="text-xs text-[var(--mg-text-muted)] mt-1">
          Las compras y reposiciones aparecerán aquí automáticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--mg-bg-surface)] rounded-[20px] border border-[var(--mg-border)] overflow-hidden shadow-sm">
      <div className="px-4 py-2.5 border-b border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] flex items-center justify-between gap-2">
        <p className="font-extrabold text-[var(--mg-text-secondary)] text-[11px] uppercase tracking-wider">
          Compras ({rows.length})
        </p>
        <p className="text-[11px] font-black text-[var(--mg-text-primary)] tabular-nums">
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
              <div className="flex-1 min-w-0">
                <p className="font-black text-[var(--mg-text-primary)] text-sm tabular-nums">
                  COMPRA {r.number}
                </p>
                <p className="text-xs font-bold text-[var(--mg-text-primary)] truncate mt-0.5">
                  {r.productName}
                  {r.supplier ? <span className="font-semibold text-[var(--mg-text-muted)]"> · {r.supplier}</span> : null}
                </p>
                <p className="text-[11px] text-[var(--mg-text-muted)] font-semibold mt-0.5 truncate uppercase font-mono">
                  Fecha y hora: {fecha}{hora ? ` · ${hora}` : ''}
                </p>
              </div>
              <span className="flex items-center gap-1.5 font-black text-[#1670C2] text-sm tabular-nums shrink-0">
                {formatBs(r.totalCost)}
                <CartBillIcon className="w-9 h-8" />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
