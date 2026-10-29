import { AppIcon } from './icons';
import { formatBs } from '../utils/currency';
import { OrderChangeBadge, getOrderChangeMeta } from './OrderChangeBadge';

function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function changeTime(change) {
  const date = toDate(change.createdAt || change.created_at);
  if (!date) return '';
  return date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
}

function changeDetail(change) {
  if (change.eventType === 'sale_cancelled') {
    return 'Se anuló el pedido completo';
  }
  const name = change.productName || 'Producto';
  if (change.eventType === 'item_added') {
    return `${name} · se agregó ${change.quantityAfter ?? 1}`;
  }
  if (change.eventType === 'item_removed') {
    return `${name} · se retiró ${change.quantityBefore ?? 1}`;
  }
  if (change.eventType === 'qty_increased') {
    return `${name} · ${change.quantityBefore ?? 0} → ${change.quantityAfter ?? 0}`;
  }
  if (change.eventType === 'qty_decreased') {
    return `${name} · ${change.quantityBefore ?? 0} → ${change.quantityAfter ?? 0}`;
  }
  return name;
}

function Stat({ label, value, icon, tone }) {
  const tones = {
    danger: 'border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]',
    success: 'border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]',
    warning: 'border-[var(--mg-warning-border)] bg-[var(--mg-warning-bg)] text-[var(--mg-warning-text)]',
    brand: 'border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]',
  };
  return (
    <div className={`rounded-2xl border p-3 ${tones[tone] || tones.brand}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">{label}</p>
        <AppIcon name={icon} size={15} />
      </div>
      <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
    </div>
  );
}

export default function OrderChangesCard({
  changes = [],
  salesById = {},
  saleNumberById = {},
  onOpen,
  className = '',
  compact = false,
}) {
  const cancelled = changes.filter((change) => change.eventType === 'sale_cancelled').length;
  const added = changes.filter((change) => change.eventType === 'item_added').length;
  const removed = changes.filter((change) => change.eventType === 'item_removed').length;
  const adjusted = changes.filter((change) => (
    change.eventType === 'qty_increased' || change.eventType === 'qty_decreased'
  )).length;
  const latest = changes.slice(0, compact ? 3 : 5);

  return (
    <section className={`rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-4 shadow-[var(--mg-shadow-sm)] sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--mg-text-muted)]">Control de pedidos</p>
          <h2 className="mt-0.5 text-lg font-black tracking-tight text-[var(--mg-brand-text)]">Pedidos con cambios</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-[var(--mg-text-secondary)]">
            Cancelaciones, productos retirados o añadidos y cantidades ajustadas.
          </p>
        </div>
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] px-3 py-2 text-[11px] font-black text-[var(--mg-brand-text)] transition-colors hover:bg-[var(--mg-border-hover)] active:scale-95"
          >
            <AppIcon name="historial" size={14} /> Ver bitácora
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Cancelados" value={cancelled} icon="cancelar" tone="danger" />
        <Stat label="Añadidos" value={added} icon="agregar" tone="success" />
        <Stat label="Retirados" value={removed} icon="eliminar" tone="warning" />
        <Stat label="Cantidades" value={adjusted} icon="editar" tone="brand" />
      </div>

      {latest.length > 0 ? (
        <ul className="mt-4 divide-y divide-[var(--mg-separator)] overflow-hidden rounded-2xl border border-[var(--mg-border)]">
          {latest.map((change) => {
            const sale = salesById[change.saleId] || salesById[change.sale_id];
            const saleNumber = saleNumberById[change.saleId] || saleNumberById[change.sale_id];
            const meta = getOrderChangeMeta(change.eventType);
            const amount = Number(change.amountDelta || 0);
            return (
              <li key={change.id} className="flex items-center gap-3 bg-[var(--mg-bg-surface)] px-3 py-2.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${meta.className}`}>
                  <AppIcon name={meta.icon} size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <OrderChangeBadge type={change.eventType} compact />
                    <span className="text-[10px] font-bold text-[var(--mg-text-muted)]">
                      {saleNumber ? `Pedido #${String(saleNumber).padStart(4, '0')}` : 'Pedido'}
                      {changeTime(change) ? ` · ${changeTime(change)}` : ''}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs font-semibold text-[var(--mg-text-secondary)]">
                    {changeDetail(change)}
                  </p>
                </div>
                {amount !== 0 ? (
                  <span className={`shrink-0 text-xs font-black tabular-nums ${amount > 0 ? 'text-[var(--mg-success-text)]' : 'text-[var(--mg-danger)]'}`}>
                    {amount > 0 ? '+' : '−'}{formatBs(Math.abs(amount))}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-dashed border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] px-3.5 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]">
            <AppIcon name="check" size={15} />
          </span>
          <div>
            <p className="text-xs font-black text-[var(--mg-text-primary)]">Todo tranquilo por ahora</p>
            <p className="text-[11px] font-medium text-[var(--mg-text-muted)]">Los pedidos editados o cancelados hoy aparecerán aquí.</p>
          </div>
        </div>
      )}
    </section>
  );
}
