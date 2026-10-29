import { AppIcon } from './icons';

export const ORDER_CHANGE_META = {
  sale_cancelled: {
    label: 'Pedido cancelado',
    short: 'Cancelado',
    icon: 'cancelar',
    tone: 'danger',
    className: 'border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]',
  },
  item_added: {
    label: 'Producto añadido',
    short: 'Añadido',
    icon: 'agregar',
    tone: 'success',
    className: 'border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]',
  },
  item_removed: {
    label: 'Producto retirado',
    short: 'Retirado',
    icon: 'eliminar',
    tone: 'danger',
    className: 'border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]',
  },
  qty_increased: {
    label: 'Cantidad aumentada',
    short: 'Cantidad +',
    icon: 'agregar',
    tone: 'success',
    className: 'border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]',
  },
  qty_decreased: {
    label: 'Cantidad reducida',
    short: 'Cantidad −',
    icon: 'eliminar',
    tone: 'warning',
    className: 'border-[var(--mg-warning-border)] bg-[var(--mg-warning-bg)] text-[var(--mg-warning-text)]',
  },
  sale_edited: {
    label: 'Pedido editado',
    short: 'Editado',
    icon: 'editar',
    tone: 'neutral',
    className: 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)]',
  },
};

export function getOrderChangeMeta(type) {
  return ORDER_CHANGE_META[type] || ORDER_CHANGE_META.sale_edited;
}

export function OrderChangeBadge({ type, compact = false, className = '' }) {
  const meta = getOrderChangeMeta(type);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${meta.className} ${className}`}>
      <AppIcon name={meta.icon} size={12} />
      {compact ? meta.short : meta.label}
    </span>
  );
}

export function OrderChangeIcon({ type, className = '' }) {
  const meta = getOrderChangeMeta(type);
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${meta.className} ${className}`}>
      <AppIcon name={meta.icon} size={16} />
    </span>
  );
}
