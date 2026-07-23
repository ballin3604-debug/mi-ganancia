import QuickDateRangeButtons from './QuickDateRangeButtons';

export default function ReportHeader({
  icon, title, subtitle,
  startDate, endDate, onStartDateChange, onEndDateChange,
  onExport, exportLabel = 'Exportar PDF', exportDisabled = false,
}) {
  return (
    <div className="bg-[var(--mg-bg-surface)] rounded-[20px] border border-[var(--mg-border)] p-4 lg:p-5 shadow-sm mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {icon && <span className="text-3xl shrink-0">{icon}</span>}
          <div className="min-w-0">
            <h1 className="text-xl lg:text-2xl font-black text-[#1670C2] tracking-tight truncate">{title}</h1>
            {subtitle && (
              <p className="text-[var(--mg-text-secondary)] text-xs lg:text-sm font-medium mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-3 bg-[var(--mg-bg-elevated)] p-3 px-4 rounded-2xl border border-[var(--mg-border)] shrink-0">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#1670C2]">Desde</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm font-mono text-[var(--mg-text-primary)] focus:outline-none focus:border-[#1670C2] focus:ring-2 focus:ring-[#1670C2]/20 transition-all cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#1670C2]">Hasta</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm font-mono text-[var(--mg-text-primary)] focus:outline-none focus:border-[#1670C2] focus:ring-2 focus:ring-[#1670C2]/20 transition-all cursor-pointer"
              />
            </div>
            <QuickDateRangeButtons
              startDate={startDate}
              endDate={endDate}
              onChange={(s, e) => { onStartDateChange(s); onEndDateChange(e); }}
            />
          </div>

          {onExport && (
            <button
              type="button"
              onClick={onExport}
              disabled={exportDisabled}
              title={exportDisabled ? 'No hay datos en el periodo seleccionado' : undefined}
              className="flex items-center gap-1.5 bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover,#0f5c9e)] text-white font-bold px-4 py-2.5 rounded-xl text-xs active:scale-95 transition-all shadow-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              📄 {exportLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
