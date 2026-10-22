import { AppIcon } from '../icons';

const TONES = {
  brand: 'bg-[var(--mg-brand-bg)] text-[var(--mg-brand)] border-[var(--mg-brand-border)]',
  action: 'bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] border-[var(--mg-accent-border)]',
  success: 'bg-[var(--mg-success-bg)] text-[var(--mg-success-text)] border-[var(--mg-success-border)]',
  warning: 'bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)] border-[var(--mg-gold-border)]',
  danger: 'bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] border-[var(--mg-danger-border)]',
  neutral: 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)] border-[var(--mg-border)]',
};

export default function MetricCard({ label, value, hint, icon, tone = 'neutral', className = '' }) {
  return (
    <div className={`rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-4 shadow-[var(--mg-shadow-sm)] ${className}`}>
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--mg-text-secondary)]">{label}</p>
          <p className="mt-1.5 truncate text-base font-black tracking-tight text-[var(--mg-text-primary)] tabular-nums sm:text-xl lg:text-2xl">{value}</p>
          {hint ? <p className="mt-1 text-[11px] font-semibold text-[var(--mg-text-muted)]">{hint}</p> : null}
        </div>
        {icon ? (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border sm:h-9 sm:w-9 ${TONES[tone] || TONES.neutral}`}>
            <AppIcon name={icon} size={16} />
          </span>
        ) : null}
      </div>
    </div>
  );
}
