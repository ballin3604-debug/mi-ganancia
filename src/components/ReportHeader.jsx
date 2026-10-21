import QuickDateRangeButtons from './QuickDateRangeButtons';
import { AppIcon } from './icons';

export default function ReportHeader({
  icon, title, subtitle,
  startDate, endDate, onStartDateChange, onEndDateChange,
  onExport, exportLabel = 'Exportar PDF', exportDisabled = false,
  branchSelector = null,
}) {
  return (
    <div className="bg-[var(--mg-bg-surface)] rounded-2xl border border-[var(--mg-border)] p-3 sm:p-5 shadow-sm mb-4 w-full min-w-0 overflow-hidden">
      {/* Título + selector de sede al centro */}
      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <span className="text-2xl sm:text-3xl shrink-0">{icon}</span>}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-black text-[#1670C2] tracking-tight leading-tight truncate">{title}</h1>
            {subtitle && (
              <p className="text-[var(--mg-text-secondary)] text-[11px] sm:text-sm font-medium mt-0.5 leading-snug line-clamp-2">{subtitle}</p>
            )}
          </div>
        </div>
        {branchSelector}
      </div>

      {/* Controles: minimalista en móvil, expandido en PC */}
      <div className="flex flex-col gap-2 mt-3 lg:flex-row lg:items-stretch">
        <div className="flex-1 min-w-0 bg-[var(--mg-bg-elevated)] p-2 rounded-2xl border border-[var(--mg-border)]">
          {/* Día / Semana / Mes: segmentado a todo el ancho en móvil */}
          <QuickDateRangeButtons
            startDate={startDate}
            endDate={endDate}
            onChange={(s, e) => { onStartDateChange(s); onEndDateChange(e); }}
          />
          {/* Fechas personalizadas compactas */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="flex flex-col gap-1 min-w-0">
              <label className="text-[9px] font-extrabold uppercase tracking-widest text-[#1670C2] pl-1">Desde</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="w-full min-w-0 bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-xl px-2 py-1.5 text-xs font-semibold text-[var(--mg-text-primary)] focus:outline-none focus:border-[#1670C2] focus:ring-2 focus:ring-[#1670C2]/20 transition-all cursor-pointer tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <label className="text-[9px] font-extrabold uppercase tracking-widest text-[#1670C2] pl-1">Hasta</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="w-full min-w-0 bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-xl px-2 py-1.5 text-xs font-semibold text-[var(--mg-text-primary)] focus:outline-none focus:border-[#1670C2] focus:ring-2 focus:ring-[#1670C2]/20 transition-all cursor-pointer tabular-nums"
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
            className="flex items-center justify-center gap-1.5 bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover,#0f5c9e)] text-white font-bold px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm active:scale-95 transition-all shadow-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 w-full lg:w-auto lg:self-center"
          >
            <AppIcon name="pdf" size={14} color="#fff" /> {exportLabel}
          </button>
        )}
      </div>
    </div>
  );
}
