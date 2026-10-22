import { AppIcon } from '../icons';

export default function EmptyState({ icon = 'paquete', title, description, action, className = '' }) {
  return (
    <div className={`rounded-3xl border border-dashed border-[var(--mg-border-hover)] bg-[var(--mg-bg-surface)] px-6 py-10 text-center ${className}`}>
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]">
        <AppIcon name={icon} size={26} color="var(--mg-text-muted)" />
      </span>
      <h3 className="mt-3 text-sm font-black text-[var(--mg-text-primary)]">{title}</h3>
      {description ? <p className="mx-auto mt-1 max-w-sm text-xs font-medium leading-relaxed text-[var(--mg-text-muted)]">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
