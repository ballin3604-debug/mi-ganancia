import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranches } from '../context/BranchContext';
import { getCashSessions, openCashSession, subscribeCashSessions } from '../services/cashRegister';
import { AppIcon } from './icons';
import { formatBs } from '../utils/currency';
import {
  describeShiftStatus,
  formatShiftDays,
  formatShiftRange,
  getShiftStatus,
  isShiftConfigured,
} from '../utils/shifts';

function formatOpenedAt(value) {
  if (!value) return '—';
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function CashSessionPanel({ members = [] }) {
  const { businessId, user, sellerName } = useAuth();
  const { branches, activeBranch, activeBranchId, selectBranch } = useBranches();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCashierId, setSelectedCashierId] = useState('');
  const [openingCash, setOpeningCash] = useState('0');
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    const unsubscribe = subscribeCashSessions(businessId, (rows) => {
      if (alive) setSessions(Array.isArray(rows) ? rows : []);
    });
    getCashSessions(businessId)
      .then((rows) => { if (alive) setSessions(Array.isArray(rows) ? rows : []); })
      .catch(console.error)
      .finally(() => { if (alive) setLoading(false); });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [businessId]);

  const cashiers = useMemo(() => members.filter((member) => (
    member.role === 'cashier'
    && (!member.status || member.status === 'active')
    && (!activeBranchId
      || !Array.isArray(member.branchIds)
      || member.branchIds.length === 0
      || member.branchIds.includes(activeBranchId))
  )), [members, activeBranchId]);

  useEffect(() => {
    if (!cashiers.some((cashier) => cashier.id === selectedCashierId)) {
      setSelectedCashierId(cashiers[0]?.id || '');
    }
  }, [cashiers, selectedCashierId]);

  const activeSession = sessions.find((session) => (
    session.branch_id === activeBranchId && session.status === 'open'
  )) || null;
  const selectedCashier = cashiers.find((cashier) => cashier.id === selectedCashierId) || null;
  const selectedShift = isShiftConfigured(selectedCashier?.shift) ? selectedCashier.shift : null;
  const shiftStatus = selectedShift ? getShiftStatus(selectedShift, now) : null;
  const shiftBlocked = !selectedShift || !shiftStatus?.active;
  const isWarehouse = activeBranch?.type === 'almacen';

  async function handleOpenCash() {
    if (saving || activeSession || !activeBranchId || !selectedCashier || shiftBlocked) return;
    setError('');
    const amount = Number(String(openingCash).replace(',', '.'));
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Ingresa un fondo inicial válido.');
      return;
    }
    setSaving(true);
    try {
      const session = await openCashSession(businessId, user?.uid, sellerName || user?.displayName || user?.email, {
        branchId: activeBranchId,
        cashierId: selectedCashier.id,
        cashierName: selectedCashier.displayName || selectedCashier.email || 'Cajero',
        openingCash: amount,
        shift: selectedShift,
        now: new Date(),
      });
      setSessions((previous) => [session, ...previous.filter((item) => item.id !== session.id)]);
    } catch (openError) {
      setError(openError.message || 'No se pudo abrir la caja.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shadow-[var(--mg-shadow-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--mg-separator)] px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]">
            <AppIcon name="caja" size={19} />
          </span>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[var(--mg-accent-text)]">Control de caja</p>
            <h2 className="text-sm font-black text-[var(--mg-text-primary)]">Abrir caja para un cajero</h2>
            <p className="mt-0.5 max-w-xl text-[11px] font-semibold leading-relaxed text-[var(--mg-text-muted)]">
              El dueño asigna el cajero responsable y registra el fondo inicial. Solo puede haber una caja abierta por sucursal.
            </p>
          </div>
        </div>
        {branches.length > 1 ? (
          <label className="inline-flex min-h-[36px] items-center gap-2 rounded-full border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] py-1 pl-3 pr-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">Sucursal</span>
            <select value={activeBranchId || ''} onChange={(event) => selectBranch(event.target.value)} aria-label="Sucursal para abrir caja" className="max-w-[180px] bg-transparent text-xs font-black text-[var(--mg-text-primary)] outline-none">
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="mg-skeleton h-24" />
        ) : activeSession ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-success)] text-white">
                <AppIcon name="check" size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black text-[var(--mg-success-text)]">Caja abierta · {activeSession.cashier_name}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-[var(--mg-text-secondary)]">
                  Fondo {formatBs(activeSession.opening_cash)} · desde {formatOpenedAt(activeSession.opened_at)} · abrió {activeSession.opened_by_name || 'Dueño'}
                </p>
                {activeSession.shift_label && activeSession.shift_start && activeSession.shift_end ? (
                  <p className="mt-0.5 text-[10px] font-semibold text-[var(--mg-text-muted)]">
                    Turno {activeSession.shift_label} · {formatShiftRange({ start: activeSession.shift_start, end: activeSession.shift_end })}
                  </p>
                ) : null}
              </div>
            </div>
            <button type="button" onClick={() => navigate('/equipo/arqueo')} className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--mg-success)] px-3.5 text-[10px] font-black text-white transition-all hover:brightness-110 active:scale-95">
              <AppIcon name="caja" size={13} /> Ir al arqueo / cierre
            </button>
          </div>
        ) : isWarehouse ? (
          <div className="rounded-2xl border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] p-3.5 text-xs font-bold text-[var(--mg-gold-text)]">
            Selecciona una sucursal de venta para abrir una caja; los almacenes no operan caja.
          </div>
        ) : cashiers.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-[var(--mg-border-hover)] bg-[var(--mg-bg-elevated)] p-4">
            <div>
              <p className="text-xs font-black text-[var(--mg-text-primary)]">No hay cajeros activos en esta sucursal</p>
              <p className="mt-0.5 text-[10px] font-semibold text-[var(--mg-text-muted)]">Agrega un cajero o asígnalo a esta sucursal desde Equipo.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3.5 py-3 ${
              !selectedShift
                ? 'border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)]'
                : shiftStatus.active
                  ? 'border-[var(--mg-success-border)] bg-[var(--mg-success-bg)]'
                  : 'border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)]'
            }`}>
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${
                  !selectedShift ? 'bg-[var(--mg-gold)]' : shiftStatus.active ? 'bg-[var(--mg-success)]' : 'bg-[var(--mg-danger)]'
                }`}>
                  <AppIcon name={selectedShift ? 'reloj' : 'alerta'} size={15} />
                </span>
                <div className="min-w-0">
                  <p className={`text-[10px] font-black uppercase tracking-wider ${
                    !selectedShift ? 'text-[var(--mg-gold-text)]' : shiftStatus.active ? 'text-[var(--mg-success-text)]' : 'text-[var(--mg-danger)]'
                  }`}>
                    Turno del cajero
                  </p>
                  <p className="mt-0.5 text-xs font-black text-[var(--mg-text-primary)]">
                    {selectedShift
                      ? `${selectedShift.label} · ${formatShiftRange(selectedShift)}`
                      : 'Sin turno asignado'}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold text-[var(--mg-text-secondary)]">
                    {selectedShift
                      ? `${formatShiftDays(selectedShift.days)} · ${describeShiftStatus(shiftStatus, now)}`
                      : 'Asígnale un horario desde el equipo para habilitar la apertura de caja.'}
                  </p>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${
                !selectedShift
                  ? 'bg-[var(--mg-gold)] text-white'
                  : shiftStatus.active
                    ? 'bg-[var(--mg-success)] text-white'
                    : 'bg-[var(--mg-danger)] text-white'
              }`}>
                {!selectedShift ? 'Bloqueado' : shiftStatus.active ? 'Puede abrir' : 'Fuera de turno'}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
              <label className="block min-w-0">
                <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">Cajero responsable</span>
                <select value={selectedCashierId} onChange={(event) => { setSelectedCashierId(event.target.value); setError(''); }} className="mg-input min-h-[42px] !rounded-xl py-2 text-sm">
                  {cashiers.map((cashier) => <option key={cashier.id} value={cashier.id}>{cashier.displayName || cashier.email || 'Cajero'}</option>)}
                </select>
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">Fondo inicial (Bs)</span>
                <input type="number" min="0" step="0.01" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} className="mg-input min-h-[42px] !rounded-xl py-2 text-sm font-black tabular-nums" />
              </label>
              <button type="button" onClick={handleOpenCash} disabled={saving || !activeBranchId || !selectedCashier || shiftBlocked} className="mg-orders-tile inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-4 text-xs font-black text-[var(--mg-brand-contrast)] transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
                <AppIcon name={shiftBlocked ? 'seguro' : 'agregar'} size={15} /> {saving ? 'Abriendo…' : !selectedShift ? 'Sin turno' : shiftStatus.active ? 'Abrir caja' : 'Fuera de turno'}
              </button>
              {error ? <p role="alert" className="text-[11px] font-bold text-[var(--mg-danger)] md:col-span-3">{error}</p> : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
