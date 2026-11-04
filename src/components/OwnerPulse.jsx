// ─────────────────────────────────────────────────────────────
// Pulso del negocio (solo dueño): rendimiento mensual real,
// sucursales y ventas en vivo.
// Todo calculado con datos locales existentes. Tema claro de la app.
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { getSales } from '../services/sales';
import { useBranches } from '../context/BranchContext';
import { formatBs } from '../utils/currency';
import { AppIcon } from './icons';

function timeAgo(date) {
  const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export function OwnerPulse({ businessId, liveSales = [], salesItemsMap = {}, showBranches = true, onNavigate, onReimprint, printingSaleId }) {
  const { branches } = useBranches();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);

  useEffect(() => {
    if (!businessId) { setLoading(false); return; }
    let alive = true;
    (async () => {
      try {
        const s = await getSales(businessId).catch(() => []);
        if (!alive) return;
        setSales((Array.isArray(s) ? s : []).filter((sale) => sale.status !== 'cancelled'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [businessId]);

  const byBranch = useMemo(() => {
    const now = new Date();
    const map = {};
    sales.forEach((s) => {
      if (!s.createdAt) return;
      const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return;
      if (s.paymentMethod === 'fiado') return;
      const bid = s.branchId || s.branch_id || null;
      const key = bid || 'general';
      if (!map[key]) map[key] = { total: 0, count: 0 };
      map[key].total += Number(s.total || 0);
      map[key].count += 1;
    });
    const names = Object.fromEntries((branches || []).map((b) => [b.id, b.name]));
    return Object.entries(map)
      .map(([id, v]) => ({ id, name: names[id] || (id === 'general' ? 'General' : 'Sucursal'), ...v }))
      .sort((a, b) => b.total - a.total);
  }, [sales, branches]);
  const maxBranch = Math.max(...byBranch.map((b) => b.total), 1);

  const live = useMemo(() => (
    [...liveSales]
      .sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return db - da;
      })
      .slice(0, 6)
  ), [liveSales]);

  if (loading) {
    return (
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 animate-pulse">
          <div className="lg:col-span-3 h-64 rounded-3xl bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)]" />
          <div className="lg:col-span-2 h-64 rounded-3xl bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)]" />
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-5 lg:items-start gap-4">
        {/* Sucursales (fuera en restaurante: sede única) */}
        {showBranches && (
        <div className="lg:col-span-2 bg-[var(--mg-bg-surface)] rounded-3xl border border-[var(--mg-border)] p-5 shadow-[var(--mg-shadow-sm)]">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-black text-[var(--mg-brand-text)] flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)] flex items-center justify-center shrink-0">
                <AppIcon name="sucursales" size={16} />
              </span>
              Desempeño por Sucursal
            </h3>
          </div>
          <p className="text-[11px] text-[var(--mg-text-muted)] mb-3">Ventas del mes actual por sede.</p>
          {byBranch.length > 0 ? (
            <ul className="space-y-3">
              {byBranch.slice(0, 4).map((b) => (
                <li key={b.id}>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="text-[var(--mg-text-primary)] truncate">{b.name}</span>
                    <span className="tabular-nums text-[var(--mg-brand-text)] shrink-0 ml-2">{formatBs(b.total)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[var(--mg-bg-section)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--mg-brand)]" style={{ width: `${Math.max((b.total / maxBranch) * 100, 4)}%` }} />
                  </div>
                  <p className="text-[10px] text-[var(--mg-text-muted)] font-semibold mt-0.5">{b.count} {b.count === 1 ? 'venta' : 'ventas'} este mes</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--mg-text-muted)] font-medium">Sin ventas este mes todavía.</p>
          )}
        </div>
        )}

        {/* Ventas en vivo */}
        <div className={`bg-[var(--mg-bg-surface)] rounded-3xl border border-[var(--mg-border)] p-5 shadow-[var(--mg-shadow-sm)] ${showBranches ? 'lg:col-span-3' : 'lg:col-span-5'}`}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-black text-[var(--mg-brand-text)] flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-[var(--mg-success-bg)] text-[var(--mg-success-text)] flex items-center justify-center shrink-0">
                <span className="w-2 h-2 rounded-full bg-[var(--mg-success)] animate-pulse" />
              </span>
              Ventas Recientes en Vivo
            </h3>
            <button type="button" onClick={() => onNavigate && onNavigate('/ventas?tab=auditoria')} className="text-[11px] font-bold text-[var(--mg-accent-text)] hover:text-[var(--mg-accent-hover)] hover:underline">
              Auditoría →
            </button>
          </div>
          <p className="text-[11px] text-[var(--mg-text-muted)] mb-3">Tickets emitidos en tiempo real en los puntos de venta.</p>
          {liveSales.length > 0 ? (
            <ul className="space-y-2">
              {liveSales.map((s) => {
                const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
                const items = (salesItemsMap[s.id] || []).slice(0, 2).map((it) => `${it.quantity}x ${it.productName}`).join(', ');
                return (
                  <li key={s.id} className="flex items-center gap-2 bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-[var(--mg-text-primary)] truncate">
                        Venta <span className="font-semibold text-[var(--mg-text-muted)]">· {timeAgo(d)}</span>
                      </p>
                      <p className="text-[11px] text-[var(--mg-text-muted)] truncate">{items || '—'}</p>
                      <p className="text-[10px] font-bold text-[var(--mg-text-secondary)] flex items-center gap-1 truncate">
                        <AppIcon name="equipo" size={11} />
                        <span className="truncate">
                          {s.sellerName ? `Vendido por ${s.sellerName}` : 'Cajero no registrado'}
                        </span>
                      </p>
                    </div>
                    <span className="text-sm font-black text-[var(--mg-success-text)] tabular-nums shrink-0">+{formatBs(s.total)}</span>
                    {onReimprint && (
                      <button
                        type="button"
                        onClick={() => onReimprint(s)}
                        disabled={printingSaleId === s.id}
                        title="Reimprimir recibo"
                        className="w-8 h-8 rounded-lg bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white flex items-center justify-center shrink-0 disabled:opacity-50 transition-colors"
                      >
                        <AppIcon name="recibo" size={14} color="#fff" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-[var(--mg-text-muted)] font-medium">Hoy aún no hay ventas.</p>
          )}
        </div>
      </div>
    </section>
  );
}
