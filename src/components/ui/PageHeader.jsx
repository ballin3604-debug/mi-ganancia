import { AppIcon } from '../icons';

export default function PageHeader({ icon = 'tienda', eyebrow, title, subtitle, actions, children }) {
  return (
    <header className="rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-4 sm:p-5 shadow-[var(--mg-shadow-sm)]">
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)] shadow-[var(--mg-shadow-sm)] sm:h-12 sm:w-12">
          <AppIcon name={icon} size={21} />
        </span>
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--mg-text-muted)]">{eyebrow}</p>
          ) : null}
          <h1 className="text-xl font-black tracking-tight text-[var(--mg-brand-text)] sm:text-2xl">{title}</h1>
          {subtitle ? (
            <p className="mt-0.5 text-xs font-medium leading-snug text-[var(--mg-text-secondary)] sm:text-sm">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </header>
  );
}
