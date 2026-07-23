import { getDayRange, getWeekRange, getMonthRange } from '../utils/dateRanges';

export default function QuickDateRangeButtons({ startDate, endDate, onChange }) {
  const options = [
    { key: 'day', label: 'Día', range: getDayRange() },
    { key: 'week', label: 'Semana', range: getWeekRange() },
    { key: 'month', label: 'Mes', range: getMonthRange() },
  ];

  return (
    <div className="flex items-center gap-1 bg-[var(--mg-bg-surface)] p-1 rounded-xl border border-[var(--mg-border)] shrink-0">
      {options.map(({ key, label, range }) => {
        const active = startDate === range.start && endDate === range.end;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(range.start, range.end)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              active
                ? 'bg-[var(--mg-accent)] text-white shadow-sm'
                : 'text-[var(--mg-text-muted)] hover:bg-[var(--mg-bg-elevated)]'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
