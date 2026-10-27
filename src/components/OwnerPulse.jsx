// ─────────────────────────────────────────────────────────────
// Pulso del negocio (solo dueño): rendimiento mensual real,
// alertas de stock, sucursales y ventas en vivo.
// Todo calculado con datos locales existentes. Tema claro de la app.
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { getSales, getSaleItemsAll } from '../services/sales';
import { getAllExpenses } from '../services/expenses';
import { useBranches } from '../context/BranchContext';
import { formatBs } from '../utils/currency';
import { AppIcon } from './icons';
import { buildMonthlyPerformance } from './ownerPulseMetrics';

function timeAgo(date) {
  const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export function OwnerPulse({ businessId, liveSales = [], salesItemsMap = {}, lowStock = [], branchId = 'all', mainBranchId = null, branchName = '', onNavigate, onReimprint, printingSaleId }) {
  const { branches } = useBranches();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [items, setItems] = useState([]);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    if (!businessId) { setLoading(false); return; }
    let alive = true;
    (async () => {
      try {
        const [s, it, ex] = await Promise.all([
          getSales(businessId).catch(() => []),
          getSaleItemsAll(businessId).catch(() => []),
          getAllExpenses(businessId).catch(() => []),
        ]);
        if (!alive) return;
        setSales(Array.isArray(s) ? s : []);
        setItems(Array.isArray(it) ? it : []);
        setExpenses(Array.isArray(ex) ? ex : []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [businessId]);

  const monthly = useMemo(
    () => buildMonthlyPerformance(sales, items, expenses, branchId, mainBranchId),
    [sales, items, expenses, branchId, mainBranchId],
  );

  const maxBar = Math.max(...monthly.map((m) => Math.max(m.income, m.cogs, m.net, 0)), 1);
  const avgMargin = (() => {
    const inc = monthly.reduce((s, m) => s + m.income, 0);
    const net = monthly.reduce((s, m) => s + m.net, 0);
    return inc > 0 ? (net / inc) * 100 : 0;
  })();

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
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Rendimiento mensual */}
        <div className="lg:col-span-3 bg-[var(--mg-bg-surface)] rounded-3xl border border-[var(--mg-border)] p-5 shadow-[var(--mg-shadow-sm)]">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
            <h3 className="text-sm font-black text-[var(--mg-brand)] flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-[var(--mg-brand-bg)] text-[var(--mg-brand)] flex items-center justify-center shrink-0">
                <AppIcon name="reportes" size={16} />
              </span>
              Rendimiento del Negocio ({monthly.length} {monthly.length === 1 ? 'mes' : 'meses'})
            </h3>
            <div className="flex items-center gap-3 text-[10px] font-bold text-[var(--mg-text-muted)]">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[var(--mg-success)]" /> Ingresos</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[var(--mg-text-muted)]" /> Costos</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[var(--mg-brand)]" /> Utilidad</span>
            </div>
          </div>
          <p className="text-[11px] text-[var(--mg-text-muted)] mb-4">
            Ingresos vs costo de mercadería y utilidad neta por mes.
            {branchId !== 'all' && branchName ? ` · ${branchName}` : ''}
          </p>
          <div className="overflow-x-auto pb-1">
            {monthly.length > 0 ? (
              <div
                className="flex items-end justify-between gap-2 h-44"
                style={{ minWidth: monthly.length > 6 ? `${monthly.length * 56}px` : undefined }}
              >
                {monthly.map((m) => (
                  <div key={m.key} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                    <div className="flex items-end gap-1 h-32 w-full justify-center">
                      <div className="w-3 sm:w-4 rounded-t-md bg-[var(--mg-success)]" style={{ height: `${m.income > 0 ? Math.max((m.income / maxBar) * 100, 2) : 0}%` }} title={`Ingresos ${formatBs(m.income)}`} />
                      <div className="w-3 sm:w-4 rounded-t-md bg-[var(--mg-text-muted)]" style={{ height: `${m.cogs > 0 ? Math.max((m.cogs / maxBar) * 100, 2) : 0}%` }} title={`Costos ${formatBs(m.cogs)}`} />
                      <div className="w-3 sm:w-4 rounded-t-md bg-[var(--mg-brand)]" style={{ height: `${m.net > 0 ? Math.max((m.net / maxBar) * 100, 2) : 0}%` }} title={`Utilidad ${formatBs(m.net)}`} />
                    </div>
                    <span className="text-[10px] font-bold text-[var(--mg-text-muted)] capitalize">{m.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-44 flex items-center justify-center text-xs font-medium text-[var(--mg-text-muted)]">
                Aún no hay ventas registradas.
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-[var(--mg-separator)] text-xs flex-wrap">
            <span className="text-[var(--mg-text-muted)] font-medium">
              Margen Neto Promedio: <strong className="text-[var(--mg-text-primary)]">{avgMargin.toFixed(1)}%</strong>
            </span>
            <button type="button" onClick={() => onNavigate && onNavigate('/reportes?type=profit')} className="font-bold text-[var(--mg-accent)] hover:text-[var(--mg-accent-hover)] hover:underline">
              Ver análisis mensual detallado →
            </button>
          </div>
        </div>

        {/* Alertas de stock */}
        <div className="lg:col-span-2 bg-[var(--mg-bg-surface)] rounded-3xl border border-[var(--mg-border)] p-5 shadow-[var(--mg-shadow-sm)]">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-black text-[var(--mg-brand)] flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] flex items-center justify-center shrink-0">
                <AppIcon name="reloj" size={16} />
              </span>
              Alertas de Bajo Stock
            </h3>
            {lowStock.length > 0 && (
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--mg-danger)] bg-[var(--mg-danger-bg)] border border-[var(--mg-danger-border)] px-2 py-0.5 rounded-full shrink-0">
                Urgente
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--mg-text-muted)] mb-3">Existencias en mínimo o menos. Evita quiebres de venta.</p>
          {lowStock.length > 0 ? (
            <ul className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
              {lowStock.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center gap-2 bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-xl px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-[var(--mg-text-primary)] truncate">{p.name}</p>
                    <p className="text-[10px] font-bold text-[var(--mg-danger)]">{p.stock} en stock · Mín: {p.minStock || 5}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate && onNavigate('/compras', { state: { reorderProductId: p.id } })}
                    className="text-[11px] font-black text-white bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] px-2.5 py-1.5 rounded-lg shrink-0 transition-colors"
                  >
                    + Reordenar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs font-bold text-[var(--mg-success-text)] bg-[var(--mg-success-bg)] border border-[var(--mg-success-border)] rounded-xl px-3 py-2.5">
              Todo el stock está sano. Sin alertas.
            </p>
          )}
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('/inventario')}
            className="w-full mt-3 text-xs font-bold text-[var(--mg-text-secondary)] bg-[var(--mg-bg-elevated)] hover:bg-[var(--mg-bg-section)] border border-[var(--mg-border)] rounded-xl py-2.5 min-h-[44px] transition-colors"
          >
            Gestionar Inventario Completo{lowStock.length > 0 ? ` (${lowStock.length} alertas)` : ''}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 lg:items-start gap-4">
        {/* Sucursales */}
        <div className="lg:col-span-2 bg-[var(--mg-bg-surface)] rounded-3xl border border-[var(--mg-border)] p-5 shadow-[var(--mg-shadow-sm)]">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-black text-[var(--mg-brand)] flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-[var(--mg-brand-bg)] text-[var(--mg-brand)] flex items-center justify-center shrink-0">
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

        {/* Ventas en vivo */}
        <div className="lg:col-span-3 bg-[var(--mg-bg-surface)] rounded-3xl border border-[var(--mg-border)] p-5 shadow-[var(--mg-shadow-sm)]">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-black text-[var(--mg-brand)] flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-[var(--mg-success-bg)] text-[var(--mg-success-text)] flex items-center justify-center shrink-0">
                <span className="w-2 h-2 rounded-full bg-[var(--mg-success)] animate-pulse" />
              </span>
              Ventas Recientes en Vivo
            </h3>
            <button type="button" onClick={() => onNavigate && onNavigate('/ventas?tab=auditoria')} className="text-[11px] font-bold text-[var(--mg-accent)] hover:text-[var(--mg-accent-hover)] hover:underline">
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
                        {s.sellerName || s.clientName || 'Venta'} <span className="font-semibold text-[var(--mg-text-muted)]">· {timeAgo(d)}</span>
                      </p>
                      <p className="text-[11px] text-[var(--mg-text-muted)] truncate">{items || '—'}</p>
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
