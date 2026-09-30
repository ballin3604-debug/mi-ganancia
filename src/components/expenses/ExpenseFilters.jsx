import React from 'react';
import { motion } from 'motion/react';
import { EXPENSE_CATEGORIES } from '../../services/expenses';

export function ExpenseFilters({
  searchQuery,
  onSearchChange,
  selectedDays,
  onDaysChange,
  selectedType,
  onTypeChange,
  selectedCategory,
  onCategoryChange,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="bg-[var(--mg-bg-surface)] rounded-[22px] p-3.5 border border-[var(--mg-border)] shadow-xs hover:shadow-md transition-all space-y-2.5"
    >
      {/* Top row: Search input + Type Selector + Days Selector */}
      <div className="flex flex-col lg:flex-row items-center gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="🔍 Buscar egreso o proveedor..."
            className="w-full bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-xl pl-3.5 pr-9 py-2 text-xs text-[var(--mg-text-primary)] font-semibold placeholder:text-[var(--mg-text-muted)] focus:outline-none focus:border-[var(--mg-accent)] transition-all min-h-[38px]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-full text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)] text-[10px] font-bold flex items-center justify-center transition-all"
              title="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto shrink-0 justify-between sm:justify-start">
          {/* Type Selector Pills */}
          <div className="flex items-center gap-1 bg-[var(--mg-bg-elevated)] p-1 rounded-xl border border-[var(--mg-border)]">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'daily', label: '☀️ Diarios' },
              { id: 'fixed', label: '📅 Fijos' },
            ].map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => onTypeChange(type.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all active:scale-95 min-h-[32px] ${
                  selectedType === type.id
                    ? 'bg-[var(--mg-bg-surface)] text-[var(--mg-accent)] border border-[var(--mg-accent-border)] shadow-2xs'
                    : 'text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)]'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* Days Period Selector */}
          <div className="flex items-center bg-[var(--mg-bg-elevated)] p-1 rounded-xl border border-[var(--mg-border)]">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onDaysChange(days)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all active:scale-95 min-h-[32px] ${
                  selectedDays === days
                    ? 'bg-[var(--mg-accent)] text-white shadow-xs'
                    : 'text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)]'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row: Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-0.5 pb-0.5">
        <button
          type="button"
          onClick={() => onCategoryChange('all')}
          className={`px-3 py-1 rounded-full text-[11px] font-extrabold border transition-all active:scale-95 shrink-0 min-h-[30px] ${
            selectedCategory === 'all'
              ? 'bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] border-[var(--mg-accent-border)] shadow-2xs'
              : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] border-[var(--mg-border)] hover:border-[var(--mg-border-hover)]'
          }`}
        >
          Todas
        </button>
        {EXPENSE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onCategoryChange(cat)}
            className={`px-3 py-1 rounded-full text-[11px] font-extrabold border transition-all active:scale-95 shrink-0 min-h-[30px] ${
              selectedCategory === cat
                ? 'bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] border-[var(--mg-accent-border)] shadow-2xs'
                : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] border-[var(--mg-border)] hover:border-[var(--mg-border-hover)]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

