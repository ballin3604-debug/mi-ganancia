import { motion } from 'motion/react';
import { EXPENSE_CATEGORIES } from '../../services/expenses';
import { AppIcon } from '../icons';

const TYPES = [
  { id: 'all', label: 'Todos' },
  { id: 'daily', label: 'Diarios' },
  { id: 'fixed', label: 'Fijos' },
];

export function ExpenseFilters({
  searchQuery,
  onSearchChange,
  selectedDays,
  onDaysChange,
  selectedType,
  onTypeChange,
  selectedCategory,
  onCategoryChange,
  categoryCounts = {},
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3.5 shadow-[var(--mg-shadow-sm)] sm:p-4"
    >
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
        <div className="relative w-full flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mg-text-muted)]">
            <AppIcon name="search" size={15} />
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar egreso o proveedor..."
            aria-label="Buscar egreso o proveedor"
            className="min-h-[42px] w-full rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] py-2 pl-9 pr-9 text-xs font-semibold text-[var(--mg-text-primary)] transition-all placeholder:text-[var(--mg-text-muted)] focus:border-[var(--mg-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--mg-accent-bg)]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-text-muted)] transition-colors hover:text-[var(--mg-text-primary)]"
            >
              <AppIcon name="cerrar" size={11} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-1">
            {TYPES.map((type) => {
              const active = selectedType === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => onTypeChange(type.id)}
                  aria-pressed={active}
                  className={`min-h-[34px] rounded-lg px-2.5 text-[11px] font-extrabold transition-all active:scale-95 ${
                    active
                      ? 'border border-[var(--mg-accent-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-accent)] shadow-[var(--mg-shadow-sm)]'
                      : 'text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)]'
                  }`}
                >
                  {type.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-1">
            {[7, 30, 90].map((days) => {
              const active = selectedDays === days;
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => onDaysChange(days)}
                  aria-pressed={active}
                  className={`min-h-[34px] rounded-lg px-2.5 text-[11px] font-extrabold transition-all active:scale-95 ${
                    active
                      ? 'bg-[var(--mg-accent)] text-white shadow-[var(--mg-shadow-sm)]'
                      : 'text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)]'
                  }`}
                >
                  {days}d
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => onCategoryChange('all')}
          aria-pressed={selectedCategory === 'all'}
          className={`flex min-h-[30px] shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-extrabold transition-all active:scale-95 ${
            selectedCategory === 'all'
              ? 'border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent)]'
              : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] hover:border-[var(--mg-border-hover)]'
          }`}
        >
          <span>Todas</span>
          {(categoryCounts.all ?? 0) > 0 && (
            <span className={`rounded-full px-1.5 text-[10px] font-black tabular-nums ${
              selectedCategory === 'all'
                ? 'bg-[var(--mg-accent)] text-white'
                : 'border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-text-muted)]'
            }`}>
              {categoryCounts.all}
            </span>
          )}
        </button>
        {EXPENSE_CATEGORIES.map((cat) => {
          const count = categoryCounts[cat] ?? 0;
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              aria-pressed={active}
              className={`flex min-h-[30px] shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-extrabold transition-all active:scale-95 ${
                active
                  ? 'border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent)]'
                  : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] hover:border-[var(--mg-border-hover)]'
              }`}
            >
              <span>{cat}</span>
              {count > 0 && (
                <span className={`rounded-full px-1.5 text-[10px] font-black tabular-nums ${
                  active
                    ? 'bg-[var(--mg-accent)] text-white'
                    : 'border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-text-muted)]'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
