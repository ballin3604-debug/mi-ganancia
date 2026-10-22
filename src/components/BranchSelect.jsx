import React from 'react';

// Selector de sede compartido: pill centrado, discreto y consistente en toda la app.
// No es un filtro: solo cambia la vista de los datos (stock, resumen, reportes).
export function BranchSelect({
  branches = [],
  value = 'all',
  onChange,
  label = 'Sede',
  allLabel = 'Todo el stock',
  className = '',
}) {
  if (branches.length <= 1 || !onChange) return null;

  return (
    <div className={`flex justify-center ${className}`}>
      <label className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] py-1.5 pl-3.5 pr-2 shadow-[var(--mg-shadow-sm)]">
        <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">
          {label}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Elegir sede"
          className="max-w-[220px] cursor-pointer truncate bg-transparent text-xs font-black text-[var(--mg-text-primary)] focus:outline-none"
        >
          <option value="all">{allLabel}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

export default BranchSelect;
