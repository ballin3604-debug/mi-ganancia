import { AppIcon } from './icons';

function Stat({ label, value, icon, tone, onClick }) {
  const tones = {
    danger: 'border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]',
    success: 'border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]',
    warning: 'border-[var(--mg-warning-border)] bg-[var(--mg-warning-bg)] text-[var(--mg-warning-text)]',
    brand: 'border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={`Ver ${label.toLowerCase()} en el reporte de ventas`}
      className={`w-full rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--mg-shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mg-accent)] disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-none ${tones[tone] || tones.brand}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">{label}</p>
        <AppIcon name={icon} size={15} />
      </div>
      <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
    </button>
  );
}

export default function OrderChangesCard({
  changes = [],
  orders = [],
  onOpen,
  onFilter,
  className = '',
}) {
  const cancelledIds = new Set(changes
    .filter((change) => change.eventType === 'sale_cancelled')
    .map((change) => change.saleId || change.sale_id));
  const editedIds = new Set(changes
    .filter((change) => ['item_added', 'item_removed', 'qty_increased', 'qty_decreased'].includes(change.eventType))
    .map((change) => change.saleId || change.sale_id));
  const cancelledOrders = orders.filter((sale) => (
    sale.status === 'cancelled' || sale.status === 'voided' || cancelledIds.has(sale.id)
  ));
  const cancelledOrderIds = new Set(cancelledOrders.map((sale) => sale.id));
  const edited = orders.filter((sale) => (
    !cancelledOrderIds.has(sale.id) && editedIds.has(sale.id)
  )).length;
  const regular = orders.length - cancelledOrders.length - edited;

  return (
    <section className={`rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-4 shadow-[var(--mg-shadow-sm)] sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--mg-text-muted)]">Control de pedidos</p>
          <h2 className="mt-0.5 text-lg font-black tracking-tight text-[var(--mg-brand-text)]">Pedidos de hoy</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-[var(--mg-text-secondary)]">
            Selecciona un cuadro para ver sus ventas y totales.
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
        <Stat label="Pedidos regulares" value={regular} icon="check" tone="success" onClick={() => onFilter?.('regular')} />
        <Stat label="Pedidos editados" value={edited} icon="editar" tone="warning" onClick={() => onFilter?.('edited')} />
        <Stat label="Pedidos cancelados" value={cancelledOrders.length} icon="cancelar" tone="danger" onClick={() => onFilter?.('cancelled')} />
        <Stat label="Pedidos totales" value={orders.length} icon="recibo" tone="brand" onClick={() => onFilter?.('all')} />
      </div>
    </section>
  );
}
