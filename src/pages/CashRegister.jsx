import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranches } from '../context/BranchContext';
import { getAllExpenses, subscribeToExpenses } from '../services/expenses';
import { getSales, subscribeToSales } from '../services/sales';
import {
  calculateCashMovements,
  getCashArqueos,
  getCashSessions,
  subscribeCashArqueos,
  subscribeCashSessions,
} from '../services/cashRegister';
import { AppIcon } from '../components/icons';
import { BranchSelect } from '../components/BranchSelect';
import CashArqueoModal from '../components/CashArqueoModal';
import { formatBs } from '../utils/currency';
import { formatShiftRange } from '../utils/shifts';

function toDate(value) {
  if (!value) return null;
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value, options = {}) {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleString('es-BO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    ...options,
  });
}

function todayStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function StatCard({ label, value, hint, icon, tone = 'brand' }) {
  const tones = {
    brand: 'border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]',
    success: 'border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]',
    gold: 'border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]',
    danger: 'border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]',
    neutral: 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)]',
  };
  return (
    <div className="rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-4 shadow-[var(--mg-shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--mg-text-muted)]">{label}</p>
          <p className="mt-2 truncate text-xl font-black tabular-nums text-[var(--mg-text-primary)] sm:text-2xl">{value}</p>
          <p className="mt-1 truncate text-[11px] font-semibold text-[var(--mg-text-muted)]">{hint}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tones[tone] || tones.brand}`}>
          <AppIcon name={icon} size={18} />
        </span>
      </div>
    </div>
  );
}

function Difference({ amount }) {
  const value = Number(amount || 0);
  if (Math.abs(value) < 0.01) {
    return <span className="inline-flex items-center gap-1 rounded-md border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] px-2.5 py-1 text-[10px] font-black text-[var(--mg-success-text)]"><AppIcon name="check" size={11} /> Cuadró</span>;
  }
  const surplus = value > 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[10px] font-black ${surplus
      ? 'border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]'
      : 'border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]'
    }`}>
      <AppIcon name={surplus ? 'agregar' : 'alerta'} size={11} />
      {surplus ? 'Sobrante' : 'Faltante'} {formatBs(Math.abs(value))}
    </span>
  );
}

function BreakdownRow({ label, value, tone = 'neutral', strong = false }) {
  const tones = {
    neutral: 'text-[var(--mg-text-primary)]',
    success: 'text-[var(--mg-success-text)]',
    danger: 'text-[var(--mg-danger)]',
    gold: 'text-[var(--mg-gold-text)]',
    brand: 'text-[var(--mg-brand-text)]',
    muted: 'text-[var(--mg-text-muted)]',
  };
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? 'pt-2' : ''}`}>
      <span className={`${strong ? 'text-xs font-black text-[var(--mg-text-primary)]' : 'text-[11px] font-semibold text-[var(--mg-text-muted)]'}`}>{label}</span>
      <span className={`tabular-nums ${strong ? 'text-base font-black' : 'text-xs font-bold'} ${tones[tone] || tones.neutral}`}>{value}</span>
    </div>
  );
}

export default function CashRegister() {
  const { businessId, user, sellerName } = useAuth();
  const { branches, activeBranch, activeBranchId, selectBranch } = useBranches();
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [arqueos, setArqueos] = useState([]);
  const [cashSessions, setCashSessions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [flash, setFlash] = useState(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!businessId) return undefined;
    let mounted = true;
    setLoaded(false);
    const unSales = subscribeToSales(businessId, setSales);
    const unExpenses = subscribeToExpenses(businessId, setExpenses);
    const unArqueos = subscribeCashArqueos(businessId, setArqueos);
    const unCashSessions = subscribeCashSessions(businessId, setCashSessions);
    Promise.all([getSales(businessId), getAllExpenses(businessId), getCashArqueos(businessId), getCashSessions(businessId)])
      .then(([salesRows, expenseRows, arqueoRows, sessionRows]) => {
        if (!mounted) return;
        setSales(salesRows);
        setExpenses(expenseRows);
        setArqueos(arqueoRows);
        setCashSessions(sessionRows);
      })
      .catch(console.error)
      .finally(() => { if (mounted) setLoaded(true); });
    return () => {
      mounted = false;
      unSales();
      unExpenses();
      unArqueos();
      unCashSessions();
    };
  }, [businessId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = window.setTimeout(() => setFlash(null), 5000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const branchArqueos = useMemo(() => arqueos
    .filter((arqueo) => arqueo.branch_id === activeBranchId)
    .sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at)), [arqueos, activeBranchId]);
  const lastArqueo = branchArqueos[0] || null;
  const activeCashSession = cashSessions.find((session) => (
    session.branch_id === activeBranchId && session.status === 'open'
  )) || null;
  const periodStart = toDate(activeCashSession?.opened_at) || toDate(lastArqueo?.closed_at) || todayStart();
  const isMainBranch = !!(activeBranch?.isMain || activeBranch?.is_main);
  const openingCash = Number(activeCashSession?.opening_cash ?? lastArqueo?.counted_cash ?? 0);
  const movements = useMemo(() => calculateCashMovements({
    sales,
    expenses,
    branchId: activeBranchId,
    isMainBranch,
    periodStart,
    periodEnd: now,
    openingCash,
  }), [sales, expenses, activeBranchId, isMainBranch, periodStart, now, openingCash]);
  const branchSalesCount = useMemo(() => sales.filter((sale) => {
    if (sale.status === 'cancelled' || sale.status === 'voided') return false;
    const createdAt = toDate(sale.created_at || sale.createdAt);
    return !!createdAt && createdAt >= periodStart && createdAt <= now
      && (sale.branch_id === activeBranchId || (isMainBranch && !sale.branch_id));
  }).length, [sales, periodStart, now, activeBranchId, isMainBranch]);

  function handleSaved(arqueo) {
    const difference = Number(arqueo.difference || 0);
    const status = Math.abs(difference) < 0.01
      ? 'La caja cuadró.'
      : difference > 0
        ? `Se registró un sobrante de ${formatBs(difference)}.`
        : `Se registró un faltante de ${formatBs(Math.abs(difference))}.`;
    setFlash({ text: `Arqueo guardado. ${status}`, sync: 'Se sincronizará al recuperar conexión si estás sin internet.' });
  }

  const isWarehouse = activeBranch?.type === 'almacen';

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 pb-28 pt-4 lg:pb-8">
      <section className="overflow-hidden rounded-[28px] border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shadow-[var(--mg-shadow-sm)]">
        <div className="border-b border-[var(--mg-separator)] bg-[linear-gradient(135deg,var(--mg-brand)_0%,var(--mg-brand-hover)_100%)] px-5 py-5 text-[var(--mg-brand-contrast)] sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]">
                  <span className={`h-1.5 w-1.5 rounded-full ${activeCashSession ? 'bg-emerald-300' : 'bg-white/60'}`} />
                  {activeCashSession ? 'Caja abierta' : 'Caja cerrada'}
                </span>
                <span className="text-[11px] font-semibold text-white/75">{now.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Arqueo de caja</h1>
              <p className="mt-1 text-sm font-semibold text-white/80">
                {activeBranch?.name || 'Selecciona una sucursal'}
                {activeCashSession ? ` · ${activeCashSession.cashier_name}` : ''}
              </p>
              <p className="mt-1 text-[11px] font-medium text-white/70">
                {activeCashSession
                  ? `Abierta desde ${formatDate(activeCashSession.opened_at)}`
                  : 'Abre la caja desde Equipo para iniciar un turno.'}
                {activeCashSession?.shift_label ? ` · Turno ${activeCashSession.shift_label} ${formatShiftRange({ start: activeCashSession.shift_start, end: activeCashSession.shift_end })}` : ''}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <BranchSelect
                branches={branches}
                value={activeBranchId || ''}
                onChange={selectBranch}
                label="Sucursal"
                className="!justify-start sm:!justify-end"
              />
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                disabled={!activeBranchId || isWarehouse || !loaded || !activeCashSession}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-[var(--mg-brand)] shadow-sm transition-all hover:bg-white/95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <AppIcon name="caja" size={16} color="currentColor" />
                {activeCashSession ? 'Realizar arqueo' : 'Caja cerrada'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-4 sm:px-6">
          <StatCard label="Efectivo esperado" value={formatBs(movements.expectedCash)} hint="Fondo + efectivo − egresos" icon="cash" tone="brand" />
          <StatCard label="Ventas efectivo" value={formatBs(movements.cashSales)} hint={`${branchSalesCount} ventas en el período`} icon="recibo" tone="success" />
          <StatCard label="Egresos efectivo" value={formatBs(movements.cashExpenses)} hint="Pagados desde caja" icon="gastos" tone="danger" />
          <StatCard label="Ventas QR" value={formatBs(movements.qrSales)} hint="Fuera del cajón" icon="qr" tone="gold" />
        </div>
      </section>

      {flash ? (
        <div role="status" className="flex items-start gap-2.5 rounded-2xl border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] px-4 py-3 text-[var(--mg-success-text)]">
          <AppIcon name="check" size={17} />
          <div>
            <p className="text-xs font-black">{flash.text}</p>
            <p className="mt-0.5 text-[10px] font-semibold opacity-80">{flash.sync}</p>
          </div>
        </div>
      ) : null}

      {!activeCashSession && !isWarehouse ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-4 py-3">
          <p className="text-xs font-bold text-[var(--mg-gold-text)]">No hay una caja abierta en esta sucursal.</p>
          <button type="button" onClick={() => navigate('/equipo')} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[var(--mg-gold)] px-3 text-[10px] font-black text-white">
            <AppIcon name="equipo" size={13} /> Ir a Equipo
          </button>
        </div>
      ) : null}

      {isWarehouse ? (
        <div className="rounded-2xl border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] p-4 text-sm font-bold text-[var(--mg-gold-text)]">
          El arqueo se realiza en una sucursal de venta.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <section className="overflow-hidden rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shadow-[var(--mg-shadow-sm)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--mg-separator)] px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-sm font-black tracking-tight text-[var(--mg-text-primary)]">Arqueos recientes</h2>
              <p className="mt-0.5 text-[11px] font-medium text-[var(--mg-text-muted)]">{activeBranch?.name || 'Sucursal'}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] px-2.5 py-1 text-[10px] font-black text-[var(--mg-text-secondary)]">{branchArqueos.length}</span>
              <button type="button" onClick={() => navigate('/equipo/arqueo/historial')} className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] px-3 text-[10px] font-black text-[var(--mg-text-secondary)] hover:border-[var(--mg-accent-border)] hover:text-[var(--mg-accent-text)]">
                <AppIcon name="historial" size={12} /> Historial
              </button>
            </div>
          </div>

          {branchArqueos.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]"><AppIcon name="caja" size={24} /></span>
              <h3 className="mt-3 text-sm font-black text-[var(--mg-text-primary)]">Sin arqueos registrados</h3>
              <p className="mx-auto mt-1 max-w-sm text-xs font-medium text-[var(--mg-text-muted)]">Cuando cierres la caja, el arqueo aparecerá aquí.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--mg-separator)]">
              {branchArqueos.slice(0, 10).map((arqueo) => (
                <li key={arqueo.id} className="px-4 py-4 transition-colors hover:bg-[var(--mg-bg-elevated)]/50 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-black text-[var(--mg-text-primary)]">{formatDate(arqueo.closed_at)}</p>
                        <Difference amount={arqueo.difference} />
                      </div>
                      <p className="mt-1 text-[11px] font-medium text-[var(--mg-text-muted)]">
                        {arqueo.cashier_name ? `Caja de ${arqueo.cashier_name}` : 'Caja'}
                        {arqueo.closed_by_name ? ` · Cerró ${arqueo.closed_by_name}` : ''}
                      </p>
                      {arqueo.notes ? <p className="mt-1 line-clamp-1 text-[11px] text-[var(--mg-text-secondary)]">{arqueo.notes}</p> : null}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right text-[10px]">
                      <span className="text-[var(--mg-text-muted)]">Esperado</span>
                      <span className="font-bold tabular-nums text-[var(--mg-text-secondary)]">{formatBs(arqueo.expected_cash)}</span>
                      <span className="text-[var(--mg-text-muted)]">Contado</span>
                      <span className="font-black tabular-nums text-[var(--mg-text-primary)]">{formatBs(arqueo.counted_cash)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-4 shadow-[var(--mg-shadow-sm)] sm:p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]"><AppIcon name="detalle" size={17} /></span>
              <div>
                <h2 className="text-sm font-black text-[var(--mg-text-primary)]">Desglose del período</h2>
                <p className="text-[11px] font-medium text-[var(--mg-text-muted)]">Desde {formatDate(periodStart)}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2.5">
              <BreakdownRow label="Fondo inicial" value={formatBs(openingCash)} />
              <BreakdownRow label="Ventas en efectivo" value={`+ ${formatBs(movements.cashSales)}`} tone="success" />
              <BreakdownRow label="Egresos en efectivo" value={`− ${formatBs(movements.cashExpenses)}`} tone="danger" />
              <div className="border-t border-[var(--mg-separator)] pt-2.5">
                <BreakdownRow label="Efectivo esperado en caja" value={formatBs(movements.expectedCash)} tone="brand" strong />
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold text-[var(--mg-gold-text)]">Pagos QR (separados)</span>
                <span className="text-sm font-black tabular-nums text-[var(--mg-gold-text)]">{formatBs(movements.qrSales)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-4 shadow-[var(--mg-shadow-sm)] sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--mg-text-muted)]">Estado del turno</p>
            <div className="mt-3 space-y-2 text-[11px]">
              <div className="flex justify-between gap-3"><span className="text-[var(--mg-text-muted)]">Caja</span><span className={`font-bold ${activeCashSession ? 'text-[var(--mg-success-text)]' : 'text-[var(--mg-text-secondary)]'}`}>{activeCashSession ? 'Abierta' : 'Cerrada'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mg-text-muted)]">Cajero</span><span className="font-bold text-[var(--mg-text-secondary)]">{activeCashSession?.cashier_name || '—'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mg-text-muted)]">Ventas vigentes</span><span className="font-bold tabular-nums text-[var(--mg-text-secondary)]">{branchSalesCount}</span></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mg-text-muted)]">Último arqueo</span><span className="font-bold text-[var(--mg-text-secondary)]">{lastArqueo ? formatDate(lastArqueo.closed_at) : 'Ninguno'}</span></div>
            </div>
            {lastArqueo ? (
              <div className="mt-3 border-t border-[var(--mg-separator)] pt-3">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--mg-text-muted)]">Último resultado</p>
                <Difference amount={lastArqueo.difference} />
              </div>
            ) : null}
          </section>
        </aside>
      </div>

      <CashArqueoModal
        open={modalOpen && !!activeCashSession}
        onClose={() => setModalOpen(false)}
        businessId={businessId}
        userId={user?.uid}
        userName={sellerName || user?.displayName || user?.email}
        branch={activeBranch}
        isMainBranch={isMainBranch}
        cashSessionId={activeCashSession?.id || null}
        cashierName={activeCashSession?.cashier_name || ''}
        sales={sales}
        expenses={expenses}
        periodStart={periodStart}
        suggestedOpening={openingCash}
        onSaved={handleSaved}
      />
    </div>
  );
}
