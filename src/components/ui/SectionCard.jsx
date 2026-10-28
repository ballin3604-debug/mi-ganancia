export default function SectionCard({ title, subtitle, action, children, className = '', bodyClassName = '' }) {
  return (
    <section className={`overflow-hidden rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shadow-[var(--mg-shadow-sm)] ${className}`}>
      {title || action ? (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--mg-separator)] px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-sm font-black tracking-tight text-[var(--mg-brand-text)]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[11px] font-medium text-[var(--mg-text-muted)]">{subtitle}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
