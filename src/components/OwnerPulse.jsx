// ─────────────────────────────────────────────────────────────
// Pulso del negocio (solo dueño): rendimiento mensual real,
// alertas de stock, sucursales y ventas en vivo.
// Todo calculado con datos locales existentes. Tema claro de la app.
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { getSales, getSaleItemsAll } from '../services/sales';
import { getRecentExpenses } from '../services/expenses';
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

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
          getRecentExpenses(businessId, 200).catch(() => []),
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

  const monthly = useMemo(() => {
    const now = new Date();
    const buckets = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: monthKey(d), label: d.toLocaleDateString('es-BO', { month: 'short' }).replace('.', ''), income: 0, cogs: 0, exp: 0 });
    }
    const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
    const inBranch = (bid) => branchId === 'all' || (bid || mainBranchId) === branchId;
    const saleInfo = {};
    sales.forEach((s) => {
      if (!s.createdAt) return;
      const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      saleInfo[s.id] = { date: d, branch: s.branchId || s.branch_id || null };
      const b = byKey[monthKey(d)];
      if (b && s.paymentMethod !== 'fiado' && inBranch(s.branchId || s.branch_id)) {
        b.income += Number(s.total || 0);
      }
    });
    items.forEach((it) => {
      const info = saleInfo[it.saleId];
      if (!info) return;
      const b = byKey[monthKey(info.date)];
      if (!b || !inBranch(info.branch)) return;
      const cost = it.supplier_price ?? it.supplierPrice ?? null;
      if (cost === null || cost === undefined) return;
      const factor = Number(it.presentation_factor ?? it.presentationFactor ?? 1);
      b.cogs += Number(cost) * Number(it.quantity || 0) * factor;
    });
    expenses.forEach((e) => {
      if (!e.createdAt) return;
      const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
      const b = byKey[monthKey(d)];
      if (b && inBranch(e.branch_id)) b.exp += Number(e.amount || 0);
    });
    return buckets.map((b) => ({ ...b, net: b.income - b.cogs - b.exp }));
  }, [sales, items, expenses, branchId, mainBranchId]);

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
          <div className="lg:col-span-3 h-64 rounded-[22px] bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)]" />
          <div className="lg:col-span-2 h-64 rounded-[22px] bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)]" />
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Rendimiento mensual */}
        <div className="lg:col-span-3 bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] p-5 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
            <h3 className="text-sm font-black text-[var(--mg-text-primary)] flex items-center gap-1.5">
              <AppIcon name="reportes" size={16} /> Rendimiento del Negocio (6 meses)
            </h3>
            <div className="flex items-center gap-3 text-[10px] font-bold text-[var(--mg-text-muted)]">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Ingresos</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Costos</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#1670C2]" /> Utilidad</span>
            </div>
          </div>
          <p className="text-[11px] text-[var(--mg-text-muted)] mb-4">
            Ingresos vs costo de mercadería y utilidad neta por mes.
            {branchId !== 'all' && branchName ? ` · ${branchName}` : ''}
          </p>
          <div className="flex items-end justify-between gap-2 h-44">
            {monthly.map((m) => (
              <div key={m.key} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                <div className="flex items-end gap-1 h-32 w-full justify-center">
                  <div className="w-3 sm:w-4 rounded-t-md bg-emerald-500" style={{ height: `${Math.max((m.income / maxBar) * 100, 2)}%` }} title={`Ingresos ${formatBs(m.income)}`} />
                  <div className="w-3 sm:w-4 rounded-t-md bg-slate-400" style={{ height: `${Math.max((m.cogs / maxBar) * 100, 2)}%` }} title={`Costos ${formatBs(m.cogs)}`} />
                  <div className="w-3 sm:w-4 rounded-t-md bg-[#1670C2]" style={{ height: `${Math.max((Math.max(m.net, 0) / maxBar) * 100, 2)}%` }} title={`Utilidad ${formatBs(m.net)}`} />
                </div>
                <span className="text-[10px] font-bold text-[var(--mg-text-muted)] capitalize">{m.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--mg-separator)] text-xs">
            <span className="text-[var(--mg-text-muted)] font-medium">
              Margen Neto Promedio: <strong className="text-[var(--mg-text-primary)]">{avgMargin.toFixed(1)}%</strong>
            </span>
            <button type="button" onClick={() => onNavigate && onNavigate('/reportes?type=profit')} className="font-bold text-[#1670C2] hover:underline">
              Ver análisis mensual detallado →
            </button>
          </div>
        </div>

        {/* Alertas de stock */}
        <div className="lg:col-span-2 bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-black text-[var(--mg-text-primary)] flex items-center gap-1.5">
              <AppIcon name="reloj" size={16} /> Alertas de Bajo Stock
            </h3>
            {lowStock.length > 0 && (
              <span className="text-[10px] font-black uppercase tracking-wider text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                Urgente
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--mg-text-muted)] mb-3">Existencias en mínimo o menos. Evita quiebres de venta.</p>
          {lowStock.length > 0 ? (
            <ul className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
              {lowStock.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center gap-2 bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-xl px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-[var(--mg-text-primary)] truncate">{p.name}</p>
                    <p className="text-[10px] font-bold text-red-600">{p.stock} en stock · Mín: {p.minStock || 5}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate && onNavigate('/compras', { state: { reorderProductId: p.id } })}
                    className="text-[11px] font-black text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 rounded-lg shrink-0"
                  >
                    + Reordenar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
              Todo el stock está sano. Sin alertas.
            </p>
          )}
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('/inventario')}
            className="w-full mt-3 text-xs font-bold text-[var(--mg-text-secondary)] bg-[var(--mg-bg-elevated)] hover:bg-slate-100 border border-[var(--mg-border)] rounded-xl py-2.5"
          >
            Gestionar Inventario Completo{lowStock.length > 0 ? ` (${lowStock.length} alertas)` : ''}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Sucursales */}
        <div className="lg:col-span-2 bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-black text-[var(--mg-text-primary)] flex items-center gap-1.5">
              <AppIcon name="sucursales" size={16} /> Desempeño por Sucursal
            </h3>
          </div>
          <p className="text-[11px] text-[var(--mg-text-muted)] mb-3">Ventas del mes actual por sede.</p>
          {byBranch.length > 0 ? (
            <ul className="space-y-3">
              {byBranch.slice(0, 4).map((b) => (
                <li key={b.id}>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="text-[var(--mg-text-primary)] truncate">{b.name}</span>
                    <span className="tabular-nums text-[#1670C2] shrink-0 ml-2">{formatBs(b.total)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-[#1670C2]" style={{ width: `${Math.max((b.total / maxBranch) * 100, 4)}%` }} />
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
        <div className="lg:col-span-3 bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-black text-[var(--mg-text-primary)] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Ventas Recientes en Vivo
            </h3>
            <button type="button" onClick={() => onNavigate && onNavigate('/ventas?tab=reporte')} className="text-[11px] font-bold text-[#1670C2] hover:underline">
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
                  <li key={s.id} className="flex items-center gap-2 bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-xl px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-[var(--mg-text-primary)] truncate">
                        {s.sellerName || s.clientName || 'Venta'} <span className="font-semibold text-[var(--mg-text-muted)]">· {timeAgo(d)}</span>
                      </p>
                      <p className="text-[11px] text-[var(--mg-text-muted)] truncate">{items || '—'}</p>
                    </div>
                    <span className="text-sm font-black text-emerald-600 tabular-nums shrink-0">+{formatBs(s.total)}</span>
                    {onReimprint && (
                      <button
                        type="button"
                        onClick={() => onReimprint(s)}
                        disabled={printingSaleId === s.id}
                        title="Reimprimir recibo"
                        className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shrink-0 disabled:opacity-50"
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
