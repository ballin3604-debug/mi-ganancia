import { useEffect, useMemo, useState } from 'react';
import { AppIcon } from './icons';
import { CASH_DENOMINATIONS, calculateCashMovements, createCashArqueo } from '../services/cashRegister';
import { formatBs } from '../utils/currency';

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function formatDenomination(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDate(value) {
  return new Date(value).toLocaleString('es-BO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function CashArqueoModal({
  open,
  onClose,
  businessId,
  userId,
  userName,
  branch,
  isMainBranch,
  cashSessionId = null,
  cashierName = '',
  sales,
  expenses,
  periodStart,
  suggestedOpening = 0,
  onSaved,
}) {
  const [detailDenominations, setDetailDenominations] = useState(true);
  const [counts, setCounts] = useState({});
  const [countedInput, setCountedInput] = useState('');
  const [openingInput, setOpeningInput] = useState(String(suggestedOpening || 0));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDetailDenominations(true);
    setCounts({});
    setCountedInput('');
    setOpeningInput(String(suggestedOpening || 0));
    setNotes('');
    setError('');
    setSaving(false);
  }, [open, suggestedOpening]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, saving, onClose]);

  const openingCash = roundMoney(Number(String(openingInput).replace(',', '.')) || 0);
  const denominationTotal = useMemo(() => roundMoney(
    CASH_DENOMINATIONS.reduce((sum, denomination) => (
      sum + Number(counts[String(denomination)] || 0) * denomination
    ), 0)
  ), [counts]);
  const countedCash = detailDenominations
    ? denominationTotal
    : roundMoney(Number(String(countedInput).replace(',', '.')) || 0);
  const movements = useMemo(() => calculateCashMovements({
    sales,
    expenses,
    branchId: branch?.id,
    isMainBranch,
    periodStart,
    periodEnd: new Date(),
    openingCash,
  }), [sales, expenses, branch?.id, isMainBranch, periodStart, openingCash]);
  const difference = roundMoney(countedCash - movements.expectedCash);
  const hasDifference = Math.abs(difference) > 0.009;

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    setError('');
    if (!Number.isFinite(openingCash) || openingCash < 0) {
      setError('El fondo inicial no es válido.');
      return;
    }
    if (!Number.isFinite(countedCash) || countedCash < 0) {
      setError('El efectivo contado no es válido.');
      return;
    }
    if (hasDifference && notes.trim().length < 3) {
      setError('Explica la diferencia de caja en las observaciones antes de guardar.');
      return;
    }

    setSaving(true);
    try {
      const denominations = detailDenominations
        ? Object.fromEntries(CASH_DENOMINATIONS.map((denomination) => [
          String(denomination), Number(counts[String(denomination)] || 0),
        ]))
        : {};
      const arqueo = await createCashArqueo(businessId, userId, userName, {
        branchId: branch.id,
        cashSessionId,
        cashierName,
        periodStart,
        openingCash,
        cashSales: movements.cashSales,
        qrSales: movements.qrSales,
        cashExpenses: movements.cashExpenses,
        expectedCash: movements.expectedCash,
        countedCash,
        difference,
        denominations,
        notes: notes.trim(),
      });
      onSaved(arqueo);
      onClose();
    } catch (saveError) {
      setError(saveError?.message || 'No se pudo guardar el arqueo.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={saving ? undefined : onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[28px] border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shadow-2xl sm:rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="relative shrink-0 overflow-hidden border-b border-[var(--mg-separator)] bg-[var(--mg-bg-surface)] px-4 py-4 sm:px-6">
          <div className="pointer-events-none absolute -right-12 -top-20 h-40 w-40 rounded-full bg-[var(--mg-brand-bg)] blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)] shadow-sm">
                <AppIcon name="caja" size={21} color="currentColor" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--mg-brand-text)]">Arqueo de caja</p>
                <h2 className="truncate text-lg font-black tracking-tight text-[var(--mg-text-primary)] sm:text-xl">Cierre del turno</h2>
                <p className="truncate text-[11px] font-semibold text-[var(--mg-text-muted)]">
                  {branch?.name || 'Sucursal'} · caja de {cashierName || 'cajero'} · desde {formatDate(periodStart)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              aria-label="Cerrar arqueo"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--mg-text-muted)] transition-colors hover:bg-[var(--mg-bg-elevated)] hover:text-[var(--mg-text-primary)] disabled:opacity-40"
            >
              <AppIcon name="cerrar" size={16} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-2.5 sm:p-3.5">
              <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[var(--mg-text-muted)] sm:text-[10px]">Esperado</p>
              <p className="mt-1 truncate text-sm font-black tabular-nums text-[var(--mg-brand-text)] sm:text-xl">{formatBs(movements.expectedCash)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] p-2.5 sm:p-3.5">
              <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[var(--mg-success-text)] sm:text-[10px]">Contado</p>
              <p className="mt-1 truncate text-sm font-black tabular-nums text-[var(--mg-success-text)] sm:text-xl">{formatBs(countedCash)}</p>
            </div>
            <div className={`rounded-2xl border p-2.5 sm:p-3.5 ${hasDifference
              ? difference > 0
                ? 'border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)]'
                : 'border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)]'
              : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)]'
            }`}>
              <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[var(--mg-text-muted)] sm:text-[10px]">Diferencia</p>
              <p className={`mt-1 truncate text-sm font-black tabular-nums sm:text-xl ${hasDifference
                ? difference > 0 ? 'text-[var(--mg-gold-text)]' : 'text-[var(--mg-danger)]'
                : 'text-[var(--mg-text-secondary)]'
              }`}>
                {difference > 0 ? '+' : ''}{formatBs(difference)}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3.5">
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">
                <AppIcon name="cash" size={13} /> Fondo inicial
              </span>
              <span className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={openingInput}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!cashSessionId && /^\d*[.,]?\d{0,2}$/.test(value)) setOpeningInput(value);
                  }}
                  readOnly={!!cashSessionId}
                  aria-label="Fondo inicial de caja"
                  className={`mg-input min-h-[42px] min-w-0 flex-1 text-base font-black tabular-nums ${cashSessionId ? 'cursor-not-allowed opacity-75' : ''}`}
                />
                <span className="text-xs font-black text-[var(--mg-text-muted)]">Bs</span>
              </span>
              <span className="mt-1 block text-[10px] font-semibold text-[var(--mg-text-muted)]">
                {cashSessionId ? 'Fondo registrado al abrir esta caja.' : suggestedOpening > 0 ? 'Sugerido del arqueo anterior; puedes ajustarlo.' : 'Efectivo que había al iniciar este período.'}
              </span>
            </label>
            <div className="rounded-2xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] p-3.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--mg-brand-text)]">Cómo se calcula</p>
              <p className="mt-1.5 text-[11px] font-semibold leading-relaxed text-[var(--mg-text-secondary)]">
                Fondo inicial + ventas en efectivo − egresos pagados en efectivo. Los pagos QR se muestran aparte y no suman al cajón.
              </p>
              <p className="mt-1 text-[10px] font-bold text-[var(--mg-text-muted)]">
                Efectivo vendido {formatBs(movements.cashSales)} · QR {formatBs(movements.qrSales)} · Egresos {formatBs(movements.cashExpenses)}
              </p>
            </div>
          </div>

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--mg-text-secondary)]">Efectivo contado</p>
              <button
                type="button"
                onClick={() => {
                  setDetailDenominations((previous) => {
                    if (previous) setCountedInput(String(denominationTotal));
                    else setCounts({});
                    return !previous;
                  });
                  setError('');
                }}
                className="text-[10px] font-black text-[var(--mg-brand-text)] hover:underline"
              >
                {detailDenominations ? 'Ingresar total directamente' : 'Detallar billetes y monedas'}
              </button>
            </div>

            {detailDenominations ? (
              <div className="rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3 sm:p-4">
                <p className="mb-2.5 text-[10px] font-medium text-[var(--mg-text-muted)]">Indica cuántos billetes o monedas de cada valor hay en la caja.</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 sm:gap-x-4">
                  {CASH_DENOMINATIONS.map((denomination) => (
                    <label key={denomination} className="flex min-w-0 items-center gap-2">
                      <span className="w-[54px] shrink-0 text-right text-[10px] font-black tabular-nums text-[var(--mg-text-secondary)]">
                        {formatDenomination(denomination)} Bs
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={counts[String(denomination)] || ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (!/^\d{0,5}$/.test(value)) return;
                          setCounts((previous) => ({ ...previous, [String(denomination)]: value }));
                        }}
                        placeholder="0"
                        aria-label={`Cantidad de ${formatDenomination(denomination)} Bs`}
                        className="mg-input min-h-[38px] min-w-0 text-center font-mono text-xs font-bold"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[var(--mg-separator)] pt-3">
                  <span className="text-[11px] font-bold text-[var(--mg-text-muted)]">Total contado</span>
                  <span className="text-xl font-black tabular-nums text-[var(--mg-success-text)]">{formatBs(denominationTotal)}</span>
                </div>
              </div>
            ) : (
              <label className="relative block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mg-text-muted)]"><AppIcon name="cash" size={17} /></span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={countedInput}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (/^\d*[.,]?\d{0,2}$/.test(value)) setCountedInput(value);
                  }}
                  placeholder="Escribe el total contado"
                  className="mg-input min-h-[50px] pl-10 text-lg font-black tabular-nums"
                  autoFocus
                />
              </label>
            )}
          </section>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--mg-text-secondary)]">
              Observaciones {hasDifference
                ? <span className="text-[var(--mg-danger)]">· obligatorias por la diferencia</span>
                : <span className="font-semibold normal-case tracking-normal text-[var(--mg-text-muted)]">· opcionales</span>}
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Anota faltantes, sobrantes, retiros o cualquier novedad del turno…"
              className="mg-input mt-1.5 w-full resize-none text-sm"
            />
            <span className="mt-1 block text-right text-[10px] font-semibold text-[var(--mg-text-faint)]">{notes.length}/500</span>
          </label>

          {error ? (
            <p role="alert" className="rounded-xl border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] px-3 py-2.5 text-xs font-bold text-[var(--mg-danger)]">{error}</p>
          ) : null}
        </div>

        <footer className="flex shrink-0 gap-2 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-surface)] p-3.5 sm:justify-end sm:p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-[44px] flex-1 rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] px-4 text-xs font-black text-[var(--mg-text-secondary)] transition-colors hover:border-[var(--mg-border-hover)] active:scale-95 disabled:opacity-50 sm:flex-none"
          >
            Seguir operando
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex min-h-[44px] flex-[1.4] items-center justify-center gap-2 rounded-xl bg-[var(--mg-gold)] px-4 text-xs font-black text-white shadow-[var(--mg-shadow-sm)] transition-all hover:brightness-95 active:scale-95 disabled:opacity-50 sm:flex-none"
          >
            {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <AppIcon name="check" size={15} color="currentColor" />}
            {saving ? 'Guardando…' : 'Guardar arqueo'}
          </button>
        </footer>
      </form>
    </div>
  );
}
