import { useState, useEffect, useMemo } from 'react';

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100, 200];

function loadVisibleColumns(storageKey, columns) {
  const defaults = columns.filter((c) => c.defaultVisible !== false).map((c) => c.key);
  if (!storageKey) return defaults;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const saved = JSON.parse(raw);
      const validKeys = new Set(columns.map((c) => c.key));
      const filtered = saved.filter((k) => validKeys.has(k));
      if (filtered.length > 0) return filtered;
    }
  } catch { /* localStorage no disponible, usar default */ }
  return defaults;
}

export default function DataTable({ columns, rows, storageKey, emptyMessage = 'Sin datos para mostrar.', getRowKey, footer }) {
  const [visibleKeys, setVisibleKeys] = useState(() => loadVisibleColumns(storageKey, columns));
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(null); // { key, dir: 'asc' | 'desc' }

  useEffect(() => {
    setPage(1);
  }, [rows.length, pageSize, sort]);

  function toggleSort(col) {
    if (!col.sortable) return;
    setSort((prev) => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: 'asc' };
      if (prev.dir === 'asc') return { key: col.key, dir: 'desc' };
      return null; // tercer clic: vuelve al orden original
    });
  }

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(visibleKeys));
    } catch { /* ignore */ }
  }, [storageKey, visibleKeys]);

  function toggleColumn(key) {
    setVisibleKeys((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // siempre queda al menos una columna visible
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  }

  const visibleColumns = columns.filter((c) => visibleKeys.includes(c.key));

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const getValue = col.sortValue || ((row) => row[col.key]);
    const withValue = rows.map((row, i) => ({ row, i, value: getValue(row) }));
    withValue.sort((a, b) => {
      if (a.value == null && b.value == null) return a.i - b.i;
      if (a.value == null) return 1;
      if (b.value == null) return -1;
      if (typeof a.value === 'number' && typeof b.value === 'number') return a.value - b.value || a.i - b.i;
      return String(a.value).localeCompare(String(b.value), 'es') || a.i - b.i;
    });
    const ordered = withValue.map((w) => w.row);
    return sort.dir === 'desc' ? ordered.reverse() : ordered;
  }, [rows, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pageRows = sortedRows.slice(startIdx, startIdx + pageSize);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColumnPicker((v) => !v)}
            className="flex items-center gap-1.5 bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--mg-text-secondary)] hover:bg-[var(--mg-bg-section)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Columnas
            <span className="text-[10px] text-[var(--mg-text-faint)]">({visibleColumns.length}/{columns.length})</span>
          </button>
          {showColumnPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowColumnPicker(false)} />
              <div className="absolute left-0 top-full mt-2 z-20 bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-2xl shadow-xl p-2 w-60 max-h-80 overflow-y-auto">
                <div className="flex items-center gap-2 px-2.5 pb-2 mb-1 border-b border-[var(--mg-border)]">
                  <button
                    type="button"
                    onClick={() => setVisibleKeys(columns.map((c) => c.key))}
                    className="text-[11px] font-bold text-[var(--mg-accent)] hover:underline"
                  >
                    Seleccionar todo
                  </button>
                  <span className="text-gray-300 text-[11px]">|</span>
                  <button
                    type="button"
                    onClick={() => setVisibleKeys([columns[0].key])}
                    className="text-[11px] font-bold text-[var(--mg-text-muted)] hover:underline"
                  >
                    Deseleccionar todo
                  </button>
                </div>
                {columns.map((c) => (
                  <label
                    key={c.key}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[var(--mg-bg-elevated)] cursor-pointer text-sm text-[var(--mg-text-primary)]"
                  >
                    <input
                      type="checkbox"
                      checked={visibleKeys.includes(c.key)}
                      onChange={() => toggleColumn(c.key)}
                      className="w-4 h-4 rounded accent-[var(--mg-accent)]"
                    />
                    <span className="font-medium">{c.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--mg-text-muted)]">Mostrar</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-xl px-2.5 py-2 text-xs font-bold text-[var(--mg-text-secondary)] focus:outline-none cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-[20px] shadow-sm border border-[var(--mg-border)] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-50">
        <table className="w-full text-sm border-collapse bg-[var(--mg-bg-surface)]">
          <thead>
            <tr>
              {visibleColumns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c)}
                  className={`bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] whitespace-nowrap select-none ${
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                  } ${c.width || ''} ${c.sortable ? 'cursor-pointer hover:bg-blue-100 transition-colors' : ''}`}
                >
                  <span className={`inline-flex items-center gap-1 ${c.align === 'right' ? 'flex-row-reverse' : ''}`}>
                    {c.label}
                    {c.sortable && (
                      <span className="text-[10px] opacity-50">
                        {sort?.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={getRowKey ? getRowKey(row) : i} className="hover:bg-blue-50/20 transition-colors">
                {visibleColumns.map((c) => (
                  <td
                    key={c.key}
                    className={`p-3 border border-[var(--mg-border)] text-[var(--mg-text-primary)] ${
                      c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length || 1} className="p-10 text-center text-[var(--mg-text-muted)] font-medium text-base bg-gray-50/30">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
          {footer && footer.length > 0 && rows.length > 0 && (() => {
            const footerMap = new Map(footer.map((f) => [f.key, f.value]));
            const matchedIdxs = visibleColumns
              .map((c, idx) => (footerMap.has(c.key) ? idx : -1))
              .filter((idx) => idx !== -1);
            if (matchedIdxs.length === 0) return null;
            const firstIdx = matchedIdxs[0];
            const label = footer.find((f) => f.label)?.label || 'Total del período';
            return (
              <tfoot>
                <tr className="bg-blue-50/50">
                  {firstIdx > 0 && (
                    <td
                      colSpan={firstIdx}
                      className="p-3 border border-[var(--mg-border)] text-right text-[10px] font-extrabold uppercase tracking-widest text-[var(--mg-text-muted)]"
                    >
                      {label}
                    </td>
                  )}
                  {visibleColumns.slice(firstIdx).map((c) => (
                    <td
                      key={c.key}
                      className={`p-3 border border-[var(--mg-border)] font-black text-[#1670C2] ${
                        c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {footerMap.has(c.key) ? footerMap.get(c.key) : ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>

      {/* Paginación */}
      {rows.length > 0 && (
        <div className="relative flex items-center text-xs">
          <span className="text-[var(--mg-text-muted)] font-medium">
            Mostrando {startIdx + 1}–{Math.min(startIdx + pageSize, rows.length)} de {rows.length}
          </span>
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="w-8 h-8 rounded-lg border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)] font-bold disabled:opacity-40 flex items-center justify-center active:scale-95"
            >
              ‹
            </button>
            <span className="px-2 font-bold text-[var(--mg-text-primary)]">{safePage} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="w-8 h-8 rounded-lg border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)] font-bold disabled:opacity-40 flex items-center justify-center active:scale-95"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
