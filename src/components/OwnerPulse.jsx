import { useEffect, useMemo, useState } from 'react';
import { getSales } from '../services/sales';
import { useBranches } from '../context/BranchContext';
import { formatBs } from '../utils/currency';
import { AppIcon } from './icons';

export function OwnerPulse({ businessId }) {
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

  if (loading) {
    return (
      <section>
        <div className="h-56 animate-pulse rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)]" />
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-5 shadow-[var(--mg-shadow-sm)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-[var(--mg-brand-text)] flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]">
            <AppIcon name="sucursales" size={16} />
          </span>
          Desempeño por Sucursal
        </h3>
      </div>
      <p className="mb-4 mt-1 text-[11px] text-[var(--mg-text-muted)]">Ventas del mes actual por sede.</p>
      {byBranch.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {byBranch.slice(0, 4).map((branch) => (
            <li key={branch.id} className="rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs font-bold">
                <span className="truncate text-[var(--mg-text-primary)]">{branch.name}</span>
                <span className="ml-2 shrink-0 tabular-nums text-[var(--mg-brand-text)]">{formatBs(branch.total)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[var(--mg-bg-section)]">
                <div className="h-full rounded-full bg-[var(--mg-brand)]" style={{ width: `${Math.max((branch.total / maxBranch) * 100, 4)}%` }} />
              </div>
              <p className="mt-1 text-[10px] font-semibold text-[var(--mg-text-muted)]">{branch.count} {branch.count === 1 ? 'venta' : 'ventas'} este mes</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs font-medium text-[var(--mg-text-muted)]">Sin ventas este mes todavía.</p>
      )}
    </section>
  );
}
