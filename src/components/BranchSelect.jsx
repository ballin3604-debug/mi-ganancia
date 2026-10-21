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
      <label className="inline-flex items-center gap-2 bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-full pl-3.5 pr-2 py-1.5 shadow-xs max-w-full">
        <span className="text-[10px] font-black uppercase tracking-wider text-[var(--mg-text-muted)] shrink-0">
          {label}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Elegir sede"
          className="bg-transparent text-xs font-black text-[var(--mg-text-primary)] focus:outline-none cursor-pointer max-w-[220px] truncate"
        >
          <option value="all">🏬 {allLabel}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.type === 'almacen' ? '📦' : '🏪'} {b.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export default BranchSelect;
