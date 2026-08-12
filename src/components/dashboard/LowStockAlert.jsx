import React from 'react';

export function LowStockAlert({ lowStock, onLowStockClick }) {
  if (!lowStock || lowStock.length === 0) return null;

  return (
    <div className="bg-[var(--mg-warning-bg)] border-2 border-[var(--mg-warning)] rounded-[20px] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="font-extrabold text-[var(--mg-warning)] text-sm flex items-center gap-2">
          <svg className="w-5 h-5 text-[var(--mg-warning)] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Reponer pronto — Toca para editar
        </p>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-200/60 text-amber-900">
          {lowStock.length} {lowStock.length === 1 ? 'producto' : 'productos'}
        </span>
      </div>

      <div className="space-y-2">
        {lowStock.slice(0, 5).map((p) => (
          <button
            key={p.id}
            onClick={() => onLowStockClick(p)}
            type="button"
            aria-label={`Reponer producto ${p.name}, stock actual ${p.stock} unidades`}
            className="w-full flex items-center gap-3 bg-[var(--mg-bg-surface)] rounded-xl px-3 py-2.5 active:scale-98 transition-all border border-[var(--mg-border)] hover:border-[var(--mg-warning)] min-h-[48px]"
          >
            {p.imageData ? (
              <img src={p.imageData} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 border border-[var(--mg-border)]" />
            ) : (
              <div className="w-8 h-8 bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] text-[var(--mg-text-muted)] rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            )}
            <span className="text-[var(--mg-text-primary)] text-sm font-bold flex-1 text-left truncate">
              {p.name}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-extrabold text-[var(--mg-warning)] text-xs bg-[var(--mg-warning-bg)] px-2 py-1 rounded-md">
                {p.stock} und.
              </span>
              <svg className="w-4 h-4 text-[var(--mg-text-muted)]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}

        {lowStock.length > 5 && (
          <p className="text-[var(--mg-warning)] text-xs text-center font-bold mt-2">
            +{lowStock.length - 5} productos más en stock bajo
          </p>
        )}
      </div>
    </div>
  );
}
