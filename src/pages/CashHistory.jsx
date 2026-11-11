import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranches } from '../context/BranchContext';
import { getCashArqueos, subscribeCashArqueos } from '../services/cashRegister';
import { AppIcon } from '../components/icons';
import { BranchSelect } from '../components/BranchSelect';
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
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    ...options,
  });
}

function getDifferenceStatus(amount) {
  const difference = Number(amount || 0);
  if (Math.abs(difference) < 0.01) return 'balanced';
  return difference > 0 ? 'surplus' : 'shortage';
}

function DifferenceBadge({ amount }) {
  const difference = Number(amount || 0);
  const status = getDifferenceStatus(difference);
  const styles = {
    balanced: 'border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]',
    surplus: 'border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]',
    shortage: 'border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]',
  };
  const label = status === 'balanced' ? 'Cuadró' : status === 'surplus' ? 'Sobrante' : 'Faltante';
  const icon = status === 'balanced' ? 'check' : status === 'surplus' ? 'agregar' : 'alerta';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black ${styles[status]}`}>
      <AppIcon name={icon} size={11} />
      {label}{status === 'balanced' ? '' : ` ${formatBs(Math.abs(difference))}`}
    </span>
  );
}

function SummaryCard({ label, value, hint, icon, tone }) {
  const tones = {
    brand: 'border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]',
    success: 'border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]',
    gold: 'border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]',
    danger: 'border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]',
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3.5 shadow-[var(--mg-shadow-sm)] sm:p-4">
      <span className={`absolute inset-x-0 top-0 h-1 ${tone === 'success' ? 'bg-[var(--mg-success)]' : tone === 'gold' ? 'bg-[var(--mg-gold)]' : tone === 'danger' ? 'bg-[var(--mg-danger)]' : 'bg-[var(--mg-brand)]'}`} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--mg-text-muted)]">{label}</p>
          <p className="mt-1.5 truncate text-xl font-black tabular-nums text-[var(--mg-text-primary)]">{value}</p>
          <p className="mt-0.5 truncate text-[10px] font-semibold text-[var(--mg-text-muted)]">{hint}</p>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${tones[tone]}`}>
          <AppIcon name={icon} size={16} />
        </span>
      </div>
    </div>
  );
}

function DetailValue({ label, value, tone = 'neutral' }) {
  const valueTone = {
    neutral: 'text-[var(--mg-text-primary)]',
    brand: 'text-[var(--mg-brand-text)]',
    success: 'text-[var(--mg-success-text)]',
    gold: 'text-[var(--mg-gold-text)]',
    danger: 'text-[var(--mg-danger)]',
  };
  return (
    <div className="rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--mg-text-muted)]">{label}</p>
      <p className={`mt-1 text-sm font-black tabular-nums ${valueTone[tone]}`}>{value}</p>
    </div>
  );
}

export default function CashHistory() {
  const { businessId } = useAuth();
  const { branches } = useBranches();
  const navigate = useNavigate();
  const [arqueos, setArqueos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    const unsubscribe = subscribeCashArqueos(businessId, (rows) => {
      if (alive) setArqueos(Array.isArray(rows) ? rows : []);
    });
    getCashArqueos(businessId)
      .then((rows) => { if (alive) setArqueos(Array.isArray(rows) ? rows : []); })
      .catch(console.error)
      .finally(() => { if (alive) setLoading(false); });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [businessId]);

  const branchNames = useMemo(
    () => Object.fromEntries(branches.map((branch) => [branch.id, branch.name])),
    [branches],
  );

  const baseRows = useMemo(() => {
    const allowedBranchIds = new Set(branches.map((branch) => branch.id));
    const start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const end = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
    const term = search.trim().toLocaleLowerCase('es-BO');

    return arqueos.filter((arqueo) => {
      const branchId = arqueo.branch_id || '';
      const branchName = branchNames[branchId] || 'Sucursal';
      if (branchId && allowedBranchIds.size > 0 && !allowedBranchIds.has(branchId)) return false;
      if (branchFilter !== 'all' && branchId !== branchFilter) return false;

      const closedAt = toDate(arqueo.closed_at);
      if (start && (!closedAt || closedAt < start)) return false;
      if (end && (!closedAt || closedAt > end)) return false;

      if (term) {
        const status = getDifferenceStatus(arqueo.difference);
        const statusLabel = status === 'balanced' ? 'cuadró' : status === 'surplus' ? 'sobrante' : 'faltante';
        const searchable = [
          arqueo.closed_by_name,
          arqueo.notes,
          branchName,
          statusLabel,
          formatDate(arqueo.closed_at),
          formatBs(arqueo.counted_cash),
          formatBs(arqueo.expected_cash),
        ].join(' ').toLocaleLowerCase('es-BO');
        if (!searchable.includes(term)) return false;
      }
      return true;
    }).sort((a, b) => (toDate(b.closed_at)?.getTime() || 0) - (toDate(a.closed_at)?.getTime() || 0));
  }, [arqueos, branchNames, branches, branchFilter, dateFrom, dateTo, search]);

  const statusCounts = useMemo(() => {
    const counts = { all: baseRows.length, balanced: 0, differences: 0, surplus: 0, shortage: 0 };
    baseRows.forEach((arqueo) => {
      const status = getDifferenceStatus(arqueo.difference);
      counts[status] += 1;
      if (status !== 'balanced') counts.differences += 1;
    });
    return counts;
  }, [baseRows]);

  const filteredRows = useMemo(() => baseRows.filter((arqueo) => {
    if (statusFilter === 'balanced') return getDifferenceStatus(arqueo.difference) === 'balanced';
    if (statusFilter === 'differences') return getDifferenceStatus(arqueo.difference) !== 'balanced';
    return true;
  }), [baseRows, statusFilter]);

  const selectedArqueo = filteredRows.find((arqueo) => arqueo.id === selectedId) || filteredRows[0] || null;
  const selectedDenominations = selectedArqueo?.denominations
    ? Object.entries(selectedArqueo.denominations)
      .filter(([, count]) => Number(count) > 0)
      .sort(([a], [b]) => Number(b) - Number(a))
    : [];

  const filters = [
    { id: 'all', label: 'Todos', count: statusCounts.all },
    { id: 'balanced', label: 'Cuadraron', count: statusCounts.balanced },
    { id: 'differences', label: 'Con diferencia', count: statusCounts.differences },
  ];

  return (
    <div className="mx-auto flex min-h-full max-w-[1600px] flex-col gap-4 px-4 pb-28 pt-4 lg:pb-8">
      <header className="mg-cash-history-hero relative shrink-0 overflow-hidden rounded-[28px] p-5 text-[var(--mg-brand-contrast)] shadow-[var(--mg-shadow-lg)] sm:p-6">
        <span className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full border-[24px] border-white/10" />
        <span className="pointer-events-none absolute -bottom-20 right-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <AppIcon name="historial" size={23} />
            </span>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] ring-1 ring-white/20">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--mg-gold)]" />
                Control y trazabilidad
              </span>
              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Historial de cierres</h1>
              <p className="mt-1 max-w-2xl text-[11px] font-semibold text-white/75 sm:text-xs">
                Consulta cada arqueo, revisa diferencias y quién cerró la caja.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <BranchSelect
              branches={branches}
              value={branchFilter}
              onChange={setBranchFilter}
              label="Sucursal"
              allLabel="Todas las sucursales"
              className="!justify-start sm:!justify-end"
            />
            <button
              type="button"
              onClick={() => navigate('/equipo/arqueo')}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-[var(--mg-brand)] shadow-sm transition-all hover:bg-white/90 active:scale-95"
            >
              <AppIcon name="volver" size={15} /> Ir al arqueo actual
            </button>
          </div>
        </div>
      </header>

      <section className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard label="Cierres encontrados" value={statusCounts.all} hint="Con los filtros actuales" icon="historial" tone="brand" />
        <SummaryCard label="Cuadraron" value={statusCounts.balanced} hint="Conteo igual al esperado" icon="check" tone="success" />
        <SummaryCard label="Sobrantes" value={statusCounts.surplus} hint="Efectivo por encima" icon="agregar" tone="gold" />
        <SummaryCard label="Faltantes" value={statusCounts.shortage} hint="Efectivo por debajo" icon="alerta" tone="danger" />
      </section>

      <section className="shrink-0 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3.5 shadow-[var(--mg-shadow-sm)] sm:p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(240px,1fr)_190px_190px]">
          <label className="relative block min-w-0">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mg-text-muted)]">
              <AppIcon name="search" size={16} />
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por cajero, nota, fecha o monto..."
              aria-label="Buscar cierres de caja"
              className="mg-input min-h-[42px] !rounded-xl pl-9 pr-9 text-sm"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]"
              >
                <AppIcon name="cerrar" size={13} />
              </button>
            ) : null}
          </label>
          <label className="flex min-h-[42px] items-center gap-2 rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] px-3">
            <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">Desde</span>
            <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} aria-label="Fecha inicial" className="min-w-0 flex-1 bg-transparent text-xs font-bold text-[var(--mg-text-primary)] outline-none" />
          </label>
          <label className="flex min-h-[42px] items-center gap-2 rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] px-3">
            <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">Hasta</span>
            <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} aria-label="Fecha final" className="min-w-0 flex-1 bg-transparent text-xs font-bold text-[var(--mg-text-primary)] outline-none" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-[var(--mg-bg-elevated)] p-1 scrollbar-none">
            {filters.map((filter) => {
              const active = statusFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setStatusFilter(filter.id)}
                  className={`inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-black transition-all ${active ? 'mg-orders-filter-active text-[var(--mg-brand-contrast)]' : 'text-[var(--mg-text-secondary)] hover:bg-[var(--mg-bg-surface)]'}`}
                >
                  {filter.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${active ? 'bg-white/20' : 'bg-[var(--mg-bg-surface)] text-[var(--mg-text-muted)]'}`}>{filter.count}</span>
                </button>
              );
            })}
          </div>
          {(dateFrom || dateTo || search || branchFilter !== 'all' || statusFilter !== 'all') ? (
            <button
              type="button"
              onClick={() => { setDateFrom(''); setDateTo(''); setSearch(''); setBranchFilter('all'); setStatusFilter('all'); }}
              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-black text-[var(--mg-accent-text)] hover:bg-[var(--mg-accent-bg)]"
            >
              <AppIcon name="cerrar" size={12} /> Limpiar filtros
            </button>
          ) : null}
        </div>
      </section>

      <div className="mg-cash-history-workspace mg-orders-panel-edge grid min-h-[520px] flex-1 overflow-hidden rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shadow-[var(--mg-shadow-sm)] xl:grid-cols-[360px_minmax(0,1fr)] xl:grid-rows-1">
        <section className="flex min-h-0 flex-col border-b border-[var(--mg-separator)] xl:border-b-0 xl:border-r">
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]">
                <AppIcon name="caja" size={16} />
              </span>
              <div>
                <h2 className="text-xs font-black text-[var(--mg-text-primary)]">Cierres de caja</h2>
                <p className="text-[10px] font-semibold text-[var(--mg-text-muted)]">{filteredRows.length} en esta vista</p>
              </div>
            </div>
            <span className="rounded-full border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-2.5 py-1 text-[10px] font-black text-[var(--mg-gold-text)] tabular-nums">
              {filteredRows.length}
            </span>
          </div>

          <div className="min-h-[260px] flex-1 space-y-1 overflow-y-auto border-t border-[var(--mg-separator)] p-2.5 xl:min-h-0">
            {loading ? (
              <div className="space-y-2 p-1">
                {[0, 1, 2, 3].map((item) => <div key={item} className="mg-skeleton h-[92px]" />)}
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="flex h-full min-h-[260px] flex-col items-center justify-center px-5 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]">
                  <AppIcon name="historial" size={22} />
                </span>
                <p className="mt-3 text-sm font-black text-[var(--mg-text-primary)]">No hay cierres para mostrar</p>
                <p className="mt-1 max-w-xs text-[11px] font-semibold leading-relaxed text-[var(--mg-text-muted)]">
                  Ajusta la búsqueda o los filtros. Los nuevos arqueos aparecerán aquí al guardarse.
                </p>
              </div>
            ) : filteredRows.map((arqueo) => {
              const selected = selectedArqueo?.id === arqueo.id;
              const difference = Number(arqueo.difference || 0);
              const branchName = branchNames[arqueo.branch_id] || 'Sucursal';
              return (
                <button
                  key={arqueo.id}
                  type="button"
                  onClick={() => setSelectedId(arqueo.id)}
                  className={`relative w-full overflow-hidden rounded-xl border p-3 text-left transition-all active:scale-[0.99] ${selected ? 'mg-orders-selected border-transparent text-[var(--mg-brand-contrast)]' : 'border-transparent bg-[var(--mg-bg-elevated)] text-[var(--mg-text-primary)] hover:border-[var(--mg-border-hover)] hover:bg-[var(--mg-bg-surface)]'}`}
                >
                  <span className={`absolute inset-y-0 left-0 w-1.5 ${selected ? 'bg-[var(--mg-gold)]' : getDifferenceStatus(difference) === 'balanced' ? 'bg-[var(--mg-success)]' : getDifferenceStatus(difference) === 'surplus' ? 'bg-[var(--mg-gold)]' : 'bg-[var(--mg-danger)]'}`} />
                  <div className="flex items-start justify-between gap-2 pl-1.5">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-black">{formatDate(arqueo.closed_at)}</p>
                      <p className={`mt-1 truncate text-[10px] font-semibold ${selected ? 'opacity-70' : 'text-[var(--mg-text-muted)]'}`}>
                        {branchName} · {arqueo.cashier_name ? `Caja de ${arqueo.cashier_name} · ` : ''}Cerró {arqueo.closed_by_name || 'Equipo'}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[13px] font-black tabular-nums ${selected ? '' : 'text-[var(--mg-brand-text)]'}`}>
                      {formatBs(arqueo.counted_cash)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-1.5">
                    <span className={`text-[9px] font-semibold ${selected ? 'opacity-70' : 'text-[var(--mg-text-muted)]'}`}>
                      Periodo {formatDate(arqueo.period_start)}
                      {arqueo.shift_label ? ` · Turno ${arqueo.shift_label} (${formatShiftRange({ start: arqueo.shift_start, end: arqueo.shift_end })})` : ''}
                    </span>
                    {selected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-black">
                        {getDifferenceStatus(difference) === 'balanced' ? 'Cuadró' : getDifferenceStatus(difference) === 'surplus' ? `Sobrante ${formatBs(Math.abs(difference))}` : `Faltante ${formatBs(Math.abs(difference))}`}
                      </span>
                    ) : <DifferenceBadge amount={difference} />}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="min-h-[360px] overflow-y-auto p-4 sm:p-5 xl:min-h-0">
          {!selectedArqueo ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
              <span className="mg-orders-tile flex h-14 w-14 items-center justify-center rounded-2xl text-[var(--mg-brand-contrast)]">
                <AppIcon name="historial" size={24} />
              </span>
              <h2 className="mt-3 text-sm font-black text-[var(--mg-text-primary)]">Selecciona un cierre</h2>
              <p className="mt-1 max-w-sm text-xs font-semibold leading-relaxed text-[var(--mg-text-muted)]">Elige un registro para ver el resumen, las observaciones y el conteo de billetes y monedas.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--mg-accent-text)]">
                    Detalle del cierre
                  </p>
                  <h2 className="mt-1 truncate text-xl font-black tracking-tight text-[var(--mg-brand-text)] sm:text-2xl">
                    {formatDate(selectedArqueo.closed_at)}
                  </h2>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-[var(--mg-text-muted)]">
                    <span className="inline-flex items-center gap-1"><AppIcon name="equipo" size={12} /> Caja de {selectedArqueo.cashier_name || 'cajero no asignado'} · cerró {selectedArqueo.closed_by_name || 'Equipo'}</span>
                    <span className="h-1 w-1 rounded-full bg-current opacity-40" />
                    <span>{branchNames[selectedArqueo.branch_id] || 'Sucursal'}</span>
                    {selectedArqueo.shift_label ? (
                      <>
                        <span className="h-1 w-1 rounded-full bg-current opacity-40" />
                        <span className="inline-flex items-center gap-1"><AppIcon name="reloj" size={12} /> Turno {selectedArqueo.shift_label} · {formatShiftRange({ start: selectedArqueo.shift_start, end: selectedArqueo.shift_end })}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <DifferenceBadge amount={selectedArqueo.difference} />
                  <span className="text-[10px] font-semibold text-[var(--mg-text-muted)]">
                    Periodo: {formatDate(selectedArqueo.period_start)} – {formatDate(selectedArqueo.closed_at)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
                <DetailValue label="Efectivo esperado" value={formatBs(selectedArqueo.expected_cash)} tone="brand" />
                <DetailValue label="Efectivo contado" value={formatBs(selectedArqueo.counted_cash)} tone="success" />
                <DetailValue label="Diferencia" value={`${Number(selectedArqueo.difference || 0) > 0 ? '+' : ''}${formatBs(selectedArqueo.difference)}`} tone={getDifferenceStatus(selectedArqueo.difference) === 'balanced' ? 'success' : Number(selectedArqueo.difference) > 0 ? 'gold' : 'danger'} />
                <DetailValue label="Fondo inicial" value={formatBs(selectedArqueo.opening_cash)} />
                <DetailValue label="Ventas en efectivo" value={formatBs(selectedArqueo.cash_sales)} tone="success" />
                <DetailValue label="Egresos en efectivo" value={formatBs(selectedArqueo.cash_expenses)} tone="danger" />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--mg-info-bg)] bg-[var(--mg-bg-elevated)] px-3.5 py-3">
                <span className="inline-flex items-center gap-2 text-[11px] font-bold text-[var(--mg-text-secondary)]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--mg-info-bg)] text-[var(--mg-info)]"><AppIcon name="qr" size={14} /></span>
                  Ventas QR (separadas del efectivo)
                </span>
                <span className="text-sm font-black tabular-nums text-[var(--mg-info)]">{formatBs(selectedArqueo.qr_sales)}</span>
              </div>

              {selectedArqueo.notes ? (
                <div className="rounded-2xl border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] p-3.5">
                  <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--mg-gold-text)]"><AppIcon name="texto" size={12} /> Observaciones</p>
                  <p className="mt-1.5 whitespace-pre-wrap text-xs font-semibold leading-relaxed text-[var(--mg-text-primary)]">{selectedArqueo.notes}</p>
                </div>
              ) : null}

              <details className="group overflow-hidden rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2 text-[11px] font-black text-[var(--mg-text-primary)]">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--mg-accent-bg)] text-[var(--mg-accent-text)]"><AppIcon name="cash" size={14} /></span>
                    Conteo de billetes y monedas
                  </span>
                  <span className="text-[10px] font-bold text-[var(--mg-accent-text)] group-open:hidden">Ver detalle</span>
                  <span className="hidden text-[10px] font-bold text-[var(--mg-accent-text)] group-open:inline">Ocultar</span>
                </summary>
                {selectedDenominations.length > 0 ? (
                  <div className="grid grid-cols-1 gap-1.5 border-t border-[var(--mg-separator)] p-3 sm:grid-cols-2 xl:grid-cols-3">
                    {selectedDenominations.map(([denomination, count]) => (
                      <div key={denomination} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] px-2.5 py-2 text-[10px]">
                        <span className="font-bold text-[var(--mg-text-secondary)]">{count} × Bs {denomination}</span>
                        <span className="font-black tabular-nums text-[var(--mg-text-primary)]">{formatBs(Number(denomination) * Number(count))}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="border-t border-[var(--mg-separator)] px-3.5 py-3 text-[10px] font-semibold text-[var(--mg-text-muted)]">Este cierre no tiene el conteo por denominación guardado.</p>
                )}
              </details>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
