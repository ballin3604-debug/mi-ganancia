import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBranches } from '../context/BranchContext';
import { getAllExpenses, subscribeToExpenses } from '../services/expenses';
import { getSales, subscribeToSales } from '../services/sales';
import { calculateCashMovements, getCashSessions, subscribeCashSessions } from '../services/cashRegister';
import CashArqueoModal from './CashArqueoModal';
import { AppIcon } from './icons';
import { formatBs } from '../utils/currency';

function toDate(value) {
  if (!value) return null;
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function CashierCashSessionPanel() {
  const { businessId, user, sellerName } = useAuth();
  const { activeBranch, activeBranchId } = useBranches();
  const [sessions, setSessions] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!businessId) return undefined;
    let alive = true;
    const unSessions = subscribeCashSessions(businessId, (rows) => { if (alive) setSessions(rows); });
    const unSales = subscribeToSales(businessId, (rows) => { if (alive) setSales(rows); });
    const unExpenses = subscribeToExpenses(businessId, (rows) => { if (alive) setExpenses(rows); });
    Promise.all([getCashSessions(businessId), getSales(businessId), getAllExpenses(businessId)])
      .then(([sessionRows, saleRows, expenseRows]) => {
        if (!alive) return;
        setSessions(sessionRows);
        setSales(saleRows);
        setExpenses(expenseRows);
      })
      .catch(console.error)
      .finally(() => { if (alive) setLoaded(true); });
    return () => {
      alive = false;
      unSessions();
      unSales();
      unExpenses();
    };
  }, [businessId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const branchSession = sessions.find((session) => (
    session.branch_id === activeBranchId && session.status === 'open'
  )) || null;
  const assignedSession = branchSession?.cashier_id === user?.uid ? branchSession : null;
  const periodStart = toDate(assignedSession?.opened_at) || now;
  const isMainBranch = !!(activeBranch?.isMain || activeBranch?.is_main);
  const movements = useMemo(() => calculateCashMovements({
    sales,
    expenses,
    branchId: activeBranchId,
    isMainBranch,
    periodStart,
    periodEnd: now,
    openingCash: Number(assignedSession?.opening_cash || 0),
  }), [sales, expenses, activeBranchId, isMainBranch, periodStart, now, assignedSession?.opening_cash]);

  if (!loaded) {
    return <div className="mg-skeleton h-24 rounded-2xl" />;
  }

  return (
    <>
      {savedMessage ? (
        <div role="status" className="rounded-xl border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] px-3 py-2 text-[11px] font-bold text-[var(--mg-success-text)]">
          {savedMessage}
        </div>
      ) : null}

      {assignedSession ? (
        <section className="rounded-2xl border border-[var(--mg-success-border)] bg-[var(--mg-bg-surface)] p-3.5 shadow-[var(--mg-shadow-sm)] sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]">
                <AppIcon name="caja" size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--mg-success-text)]">Mi caja abierta</p>
                <p className="truncate text-xs font-black text-[var(--mg-text-primary)]">{activeBranch?.name || 'Sucursal'} · desde {assignedSession.opened_at ? new Date(assignedSession.opened_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-[var(--mg-text-muted)]">Fondo {formatBs(assignedSession.opening_cash)} · caja compartida · QR separado</p>
              </div>
            </div>
            <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
              <div className="text-left sm:text-right">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--mg-text-muted)]">Efectivo esperado de la sucursal</p>
                <p className="text-lg font-black tabular-nums text-[var(--mg-brand-text)]">{formatBs(movements.expectedCash)}</p>
              </div>
              <button type="button" onClick={() => setModalOpen(true)} className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-[var(--mg-brand)] px-3.5 text-[11px] font-black text-[var(--mg-brand-contrast)] transition-all hover:bg-[var(--mg-brand-hover)] active:scale-95">
                <AppIcon name="cash" size={14} /> Arqueo de caja
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="flex items-center gap-2.5 rounded-xl border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-3.5 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--mg-gold)] text-white"><AppIcon name="caja" size={15} /></span>
          <p className="text-[11px] font-bold leading-relaxed text-[var(--mg-gold-text)]">
            {branchSession ? 'La caja de esta sucursal está asignada a otro cajero.' : 'No tienes una caja abierta asignada. Solicita al dueño que la abra desde Equipo.'}
          </p>
        </section>
      )}

      {assignedSession ? (
        <CashArqueoModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          businessId={businessId}
          userId={user?.uid}
          userName={sellerName || user?.displayName || user?.email}
          branch={activeBranch}
          isMainBranch={isMainBranch}
          cashSessionId={assignedSession.id}
          cashierName={assignedSession.cashier_name}
          sales={sales}
          expenses={expenses}
          periodStart={periodStart}
          suggestedOpening={Number(assignedSession.opening_cash || 0)}
          onSaved={() => {
            setSavedMessage('Arqueo guardado. El dueño deberá abrir la siguiente caja desde Equipo.');
            setModalOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
