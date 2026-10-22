import QuickDateRangeButtons from './QuickDateRangeButtons';
import { AppIcon } from './icons';

export default function ReportHeader({
  icon, title, subtitle,
  startDate, endDate, onStartDateChange, onEndDateChange,
  onExport, exportLabel = 'Exportar PDF', exportDisabled = false,
  branchSelector = null,
}) {
  return (
    <div className="mb-4 w-full min-w-0 overflow-hidden rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-4 shadow-[var(--mg-shadow-sm)] sm:p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {icon ? (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] text-2xl text-[var(--mg-brand)] sm:h-12 sm:w-12">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--mg-text-muted)]">Reportes</p>
            <h1 className="truncate text-lg font-black tracking-tight text-[var(--mg-brand)] sm:text-2xl">{title}</h1>
            {subtitle ? (
              <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-[var(--mg-text-secondary)] sm:text-sm">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {branchSelector ? (
          <div className="min-w-0 sm:ml-auto sm:shrink-0">
            {branchSelector}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-stretch">
        <div className="min-w-0 flex-1 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-2">
          <QuickDateRangeButtons
            startDate={startDate}
            endDate={endDate}
            onChange={(s, e) => { onStartDateChange(s); onEndDateChange(e); }}
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <label className="pl-1 text-[9px] font-extrabold uppercase tracking-widest text-[var(--mg-text-muted)]">Desde</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="w-full min-w-0 cursor-pointer rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] px-2 py-1.5 text-xs font-semibold tabular-nums text-[var(--mg-text-primary)] transition-all focus:border-[var(--mg-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--mg-accent-bg)]"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label className="pl-1 text-[9px] font-extrabold uppercase tracking-widest text-[var(--mg-text-muted)]">Hasta</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="w-full min-w-0 cursor-pointer rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] px-2 py-1.5 text-xs font-semibold tabular-nums text-[var(--mg-text-primary)] transition-all focus:border-[var(--mg-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--mg-accent-bg)]"
              />
            </div>
          </div>
        </div>

        {onExport && (
          <button
            type="button"
            onClick={onExport}
            disabled={exportDisabled}
            title={exportDisabled ? 'No hay datos en el periodo seleccionado' : undefined}
            className="flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--mg-accent)] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[var(--mg-accent-hover)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 sm:text-sm lg:w-auto lg:self-center"
          >
            <AppIcon name="pdf" size={14} color="#fff" /> {exportLabel}
          </button>
        )}
      </div>
    </div>
  );
}
