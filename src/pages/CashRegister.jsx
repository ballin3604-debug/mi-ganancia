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
    <div className="relative overflow-hidden rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3.5 shadow-[var(--mg-shadow-sm)]">
      <span className={`absolute inset-x-0 top-0 h-1 ${tone === 'success' ? 'bg-[var(--mg-success)]' : tone === 'gold' ? 'bg-[var(--mg-gold)]' : tone === 'danger' ? 'bg-[var(--mg-danger)]' : 'bg-[var(--mg-brand)]'}`} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--mg-text-muted)]">{label}</p>
          <p className="mt-1.5 truncate text-lg font-black tabular-nums text-[var(--mg-text-primary)] sm:text-xl">{value}</p>
          <p className="mt-0.5 truncate text-[10px] font-semibold text-[var(--mg-text-muted)]">{hint}</p>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${tones[tone] || tones.brand}`}>
          <AppIcon name={icon} size={16} />
        </span>
      </div>
    </div>
  );
}

function Difference({ amount }) {
  const value = Number(amount || 0);
  if (Math.abs(value) < 0.01) {
    return <span className="inline-flex items-center gap-1 rounded-full border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] px-2.5 py-1 text-[10px] font-black text-[var(--mg-success-text)]"><AppIcon name="check" size={11} /> Cuadró</span>;
  }
  const surplus = value > 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black ${surplus
      ? 'border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]'
      : 'border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]'
    }`}>
      <AppIcon name={surplus ? 'agregar' : 'alerta'} size={11} />
      {surplus ? 'Sobrante' : 'Faltante'} {formatBs(Math.abs(value))}
    </span>
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
    <div className="mx-auto max-w-6xl space-y-4 px-4 pb-28 pt-4 lg:pb-8">
      <section className="relative overflow-hidden rounded-[28px] bg-[var(--mg-brand)] p-5 text-[var(--mg-brand-contrast)] shadow-[var(--mg-shadow-lg)] sm:p-6">
        <span className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full border-[20px] border-white/10" />
        <span className="pointer-events-none absolute -bottom-20 right-36 h-44 w-44 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <AppIcon name="caja" size={24} color="currentColor" />
            </span>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] ring-1 ring-white/20">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                Control de efectivo
              </span>
              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Arqueo de caja</h1>
              <p className="mt-1 text-[11px] font-semibold text-white/70 sm:text-xs">
                {activeBranch?.name || 'Selecciona una sucursal'} · {now.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <p className="mt-1 text-[10px] font-semibold text-white/70">
                {activeCashSession
                  ? `Caja abierta para ${activeCashSession.cashier_name} · desde ${formatDate(activeCashSession.opened_at)}`
                  : 'Caja cerrada · abre el turno desde Equipo'}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
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
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--mg-brand-contrast)] px-4 text-xs font-black text-[var(--mg-brand)] shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <AppIcon name="cerrar" size={15} color="currentColor" />
              {activeCashSession ? 'Realizar arqueo' : 'Caja cerrada'}
            </button>
          </div>
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
          <p className="text-xs font-bold text-[var(--mg-gold-text)]">No hay una caja abierta en esta sucursal. Ábrela y asígnala a un cajero desde Equipo.</p>
          <button type="button" onClick={() => navigate('/equipo')} className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-[var(--mg-gold)] px-3 text-[10px] font-black text-white transition-all hover:brightness-110">
            <AppIcon name="equipo" size={13} /> Ir a Equipo
          </button>
        </div>
      ) : null}

      {isWarehouse ? (
        <div className="rounded-2xl border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] p-4 text-sm font-bold text-[var(--mg-gold-text)]">
          El arqueo se realiza en una sucursal de venta. Cambia la sucursal seleccionada para continuar.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Efectivo esperado" value={formatBs(movements.expectedCash)} hint="Fondo + efectivo − egresos" icon="cash" tone="brand" />
        <StatCard label="Ventas en efectivo" value={formatBs(movements.cashSales)} hint={`${branchSalesCount} ventas en el período`} icon="recibo" tone="success" />
        <StatCard label="Egresos en efectivo" value={formatBs(movements.cashExpenses)} hint="Pagados desde la caja" icon="gastos" tone="danger" />
        <StatCard label="Pagos QR" value={formatBs(movements.qrSales)} hint="No forman parte del efectivo" icon="qr" tone="gold" />
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shadow-[var(--mg-shadow-sm)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--mg-separator)] px-4 py-3.5 sm:px-5">
            <div>
              <h2 className="text-sm font-black tracking-tight text-[var(--mg-brand-text)]">Arqueos recientes</h2>
              <p className="mt-0.5 text-[11px] font-medium text-[var(--mg-text-muted)]">Cierres guardados para {activeBranch?.name || 'esta sucursal'}.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] px-2.5 py-1 text-[10px] font-black text-[var(--mg-brand-text)]">{branchArqueos.length} registrados</span>
              <button
                type="button"
                onClick={() => navigate('/equipo/arqueo/historial')}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] px-3 text-[10px] font-black text-[var(--mg-accent-text)] transition-colors hover:bg-[var(--mg-accent)] hover:text-white"
              >
                <AppIcon name="historial" size={12} /> Historial completo
              </button>
            </div>
          </div>

          {branchArqueos.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]"><AppIcon name="caja" size={25} /></span>
              <h3 className="mt-3 text-sm font-black text-[var(--mg-text-primary)]">Aún no hay arqueos</h3>
              <p className="mx-auto mt-1 max-w-sm text-xs font-medium text-[var(--mg-text-muted)]">Primero abre una caja desde Equipo y asígnala al cajero que atenderá este turno.</p>
              <button type="button" onClick={() => navigate('/equipo')} disabled={!activeBranchId || isWarehouse} className="mg-btn-primary mt-4 inline-flex min-h-[38px] items-center gap-1.5 px-4 text-xs disabled:opacity-50">
                <AppIcon name="equipo" size={14} /> Abrir caja desde Equipo
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--mg-separator)]">
              {branchArqueos.slice(0, 12).map((arqueo) => (
                <li key={arqueo.id} className="px-4 py-3.5 transition-colors hover:bg-[var(--mg-bg-elevated)]/60 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-black text-[var(--mg-text-primary)]">{formatDate(arqueo.closed_at)}</p>
                        <Difference amount={arqueo.difference} />
                      </div>
                      <p className="mt-1 text-[10px] font-semibold text-[var(--mg-text-muted)]">
                        {formatDate(arqueo.period_start)} → {formatDate(arqueo.closed_at)}
                        {arqueo.cashier_name ? ` · Caja de ${arqueo.cashier_name}` : ''} · Cerró {arqueo.closed_by_name || 'Equipo'}
                      </p>
                      {arqueo.notes ? <p className="mt-1 line-clamp-2 text-[11px] font-medium text-[var(--mg-text-secondary)]">{arqueo.notes}</p> : null}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right text-[10px]">
                      <span className="text-[var(--mg-text-muted)]">Esperado</span>
                      <span className="font-bold tabular-nums text-[var(--mg-text-secondary)]">{formatBs(arqueo.expected_cash)}</span>
                      <span className="text-[var(--mg-text-muted)]">Contado</span>
                      <span className="font-black tabular-nums text-[var(--mg-brand-text)]">{formatBs(arqueo.counted_cash)}</span>
                    </div>
                  </div>
                  {arqueo.denominations && Object.keys(arqueo.denominations).length > 0 ? (
                    <details className="mt-2">
                      <summary className="w-fit cursor-pointer text-[10px] font-bold text-[var(--mg-brand-text)]">Ver detalle del conteo</summary>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(arqueo.denominations)
                          .filter(([, count]) => Number(count) > 0)
                          .sort(([a], [b]) => Number(b) - Number(a))
                          .map(([denomination, count]) => (
                            <span key={denomination} className="rounded-lg border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] px-2 py-1 text-[10px] font-bold text-[var(--mg-text-secondary)]">
                              {count} × {denomination} Bs
                            </span>
                          ))}
                      </div>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="space-y-3">
          <section className="rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-4 shadow-[var(--mg-shadow-sm)]">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]"><AppIcon name="permisos" size={17} /></span>
              <div>
                <h2 className="text-xs font-black text-[var(--mg-text-primary)]">Período actual</h2>
                <p className="text-[10px] font-semibold text-[var(--mg-text-muted)]">{activeCashSession ? `Asignada a ${activeCashSession.cashier_name}` : lastArqueo ? 'Desde el último arqueo' : 'Caja cerrada'}</p>
              </div>
            </div>
            <div className="mt-3 space-y-2 border-t border-[var(--mg-separator)] pt-3 text-[11px]">
              <div className="flex justify-between gap-3"><span className="text-[var(--mg-text-muted)]">Inicio</span><span className="font-bold text-[var(--mg-text-secondary)]">{formatDate(periodStart)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mg-text-muted)]">Fondo inicial</span><span className="font-black tabular-nums text-[var(--mg-brand-text)]">{formatBs(openingCash)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mg-text-muted)]">Ventas vigentes</span><span className="font-bold tabular-nums text-[var(--mg-text-secondary)]">{branchSalesCount}</span></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mg-text-muted)]">Último arqueo</span><span className="font-bold text-[var(--mg-text-secondary)]">{lastArqueo ? formatDate(lastArqueo.closed_at) : 'Todavía ninguno'}</span></div>
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] p-4">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--mg-brand-text)]"><AppIcon name="detalle" size={14} /> Lectura rápida</p>
            <p className="mt-2 text-[11px] font-semibold leading-relaxed text-[var(--mg-text-secondary)]">
              El dinero esperado contempla efectivo cobrado y egresos en efectivo de toda la sucursal. Los pagos QR quedan separados. Un faltante o sobrante pide una observación y queda asociado a quien guardó el arqueo.
            </p>
            <p className="mt-2 border-t border-[var(--mg-brand-border)] pt-2 text-[10px] font-bold text-[var(--mg-text-muted)]">
              Guardar un arqueo no detiene las ventas. El próximo período empieza al guardar este conteo.
            </p>
          </section>
        </aside>
      </section>

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
