import { useMemo, useState } from 'react';
import { useBusiness } from '../context/BusinessContext';
import { useBranches } from '../context/BranchContext';
import { groupReplenishmentsByProforma, roundMoney } from '../services/purchaseProformas';
import { toLocalISODate } from '../utils/dateRanges';
import { getExpiryWarningDays } from '../utils/expiry';
import { AppIcon } from '../components/icons';
import EmptyState from '../components/ui/EmptyState';
import MetricCard from '../components/ui/MetricCard';
import PageHeader from '../components/ui/PageHeader';
import ProformaForm from '../components/purchase-proformas/ProformaForm';

function formatBs(amount) {
  return `Bs ${Number(amount || 0).toFixed(2)}`;
}

function formatQty(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0';
  if (Number.isInteger(number)) return String(number);
  return number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function formatDate(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function expiryInfo(dateValue, warningDays) {
  if (!dateValue) return { label: '—', tone: 'text-[var(--mg-text-faint)]' };
  const expiry = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return { label: '—', tone: 'text-[var(--mg-text-faint)]' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  return {
    label: expiry.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }),
    tone: daysLeft < 0
      ? 'text-[var(--mg-danger)]'
      : daysLeft <= warningDays ? 'text-[var(--mg-gold-text)]' : 'text-[var(--mg-text-secondary)]',
  };
}

function presentationLabel(item) {
  const raw = String(item.presentationName || '').trim()
    || (item.purchaseUnitType === 'package' && Number(item.packageSize) > 1 ? 'Paquete' : 'Unidad');
  if (Number(item.packageSize) > 1 && !/x\s*\d+/i.test(raw)) return `${raw} x${item.packageSize}`;
  return raw;
}

function quantityLabel(item) {
  const quantity = Number(item.quantity || 0);
  const packs = Number(item.packageCount || 0);
  const size = Number(item.packageSize || 0);
  if (item.purchaseUnitType === 'package' && packs > 0 && size > 0) {
    const loose = quantity - packs * size;
    return `${formatQty(packs)} × ${size}${loose > 0 ? ` + ${formatQty(loose)}` : ''} = ${formatQty(quantity)} und.`;
  }
  return `${formatQty(quantity)} und.`;
}

function itemMargin(item) {
  const quantity = Number(item.quantity || 0);
  const totalCost = Number(item.totalCost || 0);
  const realCost = quantity > 0 ? totalCost / quantity : 0;
  const salePrice = Number(item.salePrice || 0);
  const pct = salePrice > 0 ? ((salePrice - realCost) / salePrice) * 100 : 0;
  return { realCost, pct, danger: pct < 0 };
}

export default function PurchaseProformas({
  products = [],
  replenishments = [],
  categories = [],
  initialProductId = null,
}) {
  const { settings, sectorConfig } = useBusiness();
  const { branches } = useBranches();
  const expiryWarningDays = getExpiryWarningDays(sectorConfig);

  const [view, setView] = useState(() => (initialProductId ? 'form' : 'list'));
  const [pendingProductId, setPendingProductId] = useState(initialProductId);
  const [success, setSuccess] = useState(null);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return toLocalISODate(date);
  });
  const [endDate, setEndDate] = useState(() => toLocalISODate(new Date()));

  const groups = useMemo(() => groupReplenishmentsByProforma(replenishments), [replenishments]);

  const filteredGroups = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59.999`);
    const query = search.trim().toLowerCase();

    return groups.filter((group) => {
      const date = group.date ? new Date(`${group.date}T00:00:00`) : group.createdAt;
      if (!date || date < start || date > end) return false;
      if (branchFilter !== 'all' && group.branchId !== branchFilter) return false;
      if (!query) return true;
      const haystack = [
        group.number,
        group.supplier,
        group.branchName,
        group.docType,
        group.notes,
        ...group.items.flatMap((item) => [item.productName, item.lotCode]),
      ];
      return haystack.some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [groups, startDate, endDate, search, branchFilter]);

  const periodSummary = useMemo(() => ({
    count: filteredGroups.length,
    total: roundMoney(filteredGroups.reduce((sum, group) => sum + group.total, 0)),
    units: filteredGroups.reduce((sum, group) => sum + group.units, 0),
    extras: roundMoney(filteredGroups.reduce((sum, group) => sum + group.extraTotal, 0)),
  }), [filteredGroups]);

  function openForm() {
    setPendingProductId(null);
    setView('form');
  }

  function handleSaved(result) {
    setSuccess(result);
    setView('success');
    if (result?.date) {
      const date = new Date(`${result.date}T00:00:00`);
      const start = new Date(date);
      start.setDate(start.getDate() - 30);
      setStartDate(toLocalISODate(start));
      setEndDate(result.date);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openHistory(proformaId = null) {
    setView('list');
    setSuccess(null);
    if (proformaId) setExpandedId(proformaId);
    setSearch('');
  }

  if (view === 'form') {
    return (
      <div className="p-4">
        <ProformaForm
          products={products}
          categories={categories}
          replenishments={replenishments}
          initialProductId={pendingProductId}
          onInitialProductAdded={() => setPendingProductId(null)}
          onCancel={() => setView('list')}
          onSaved={handleSaved}
        />
      </div>
    );
  }

  if (view === 'success' && success) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-6 text-center shadow-[var(--mg-shadow-lg)] mg-modal-in">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)]">
            <AppIcon name="ok" size={32} color="var(--mg-success-text)" />
          </div>
          <h2 className="mt-4 text-xl font-black tracking-tight text-[var(--mg-brand-text)]">Proforma guardada</h2>
          <p className="mt-1 text-xs font-semibold text-[var(--mg-text-muted)]">
            Se actualizaron el stock, las presentaciones y los vencimientos.
          </p>
          <div className="mt-4 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3.5 text-left text-xs">
            <div className="flex justify-between gap-2">
              <span className="font-semibold text-[var(--mg-text-muted)]">N° proforma</span>
              <span className="font-black text-[var(--mg-text-primary)]">{success.number}</span>
            </div>
            <div className="mt-1.5 flex justify-between gap-2">
              <span className="font-semibold text-[var(--mg-text-muted)]">Productos</span>
              <span className="font-bold text-[var(--mg-text-primary)]">{success.itemCount} · {formatQty(success.units)} und.</span>
            </div>
            {success.receivedBy && (
              <div className="mt-1.5 flex justify-between gap-2">
                <span className="font-semibold text-[var(--mg-text-muted)]">Recibe</span>
                <span className="font-bold text-[var(--mg-text-primary)]">{success.receivedBy}</span>
              </div>
            )}
            {Number(success.discount || 0) > 0 && (
              <div className="mt-1.5 flex justify-between gap-2">
                <span className="font-semibold text-[var(--mg-text-muted)]">Descuento</span>
                <span className="font-bold text-[var(--mg-danger)]">− {formatBs(success.discount)}</span>
              </div>
            )}
            <div className="mt-1.5 flex justify-between gap-2">
              <span className="font-semibold text-[var(--mg-text-muted)]">Total</span>
              <span className="font-black text-[var(--mg-brand-text)]">{formatBs(success.total)}</span>
            </div>
          </div>
          <div className="mt-5 grid gap-2">
            <button type="button" onClick={() => openHistory(success.proformaId)} className="mg-btn-primary w-full text-sm">
              Ver historial de proformas
            </button>
            <button type="button" onClick={() => { setSuccess(null); openForm(); }} className="mg-btn-tertiary w-full text-sm">
              Registrar otra proforma
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        icon="recibo"
        eyebrow="Compras"
        title="Proformas de compra"
        subtitle="Copiá la proforma física una sola vez y consultá el detalle de cada producto, lote y vencimiento."
        actions={(
          <button
            type="button"
            onClick={openForm}
            className="mg-btn-primary inline-flex min-h-[40px] items-center gap-1.5 px-3.5 text-xs"
          >
            <AppIcon name="agregar" size={15} />
            Nueva proforma
          </button>
        )}
      />

      <div className="grid grid-cols-1 gap-2 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative min-w-0">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--mg-text-muted)]">
            <AppIcon name="search" size={17} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar número, proveedor, producto o lote..."
            className="mg-input min-h-[44px] pl-10 text-sm"
          />
        </div>
        <input
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          aria-label="Desde"
          className="mg-input min-h-[44px] !px-3 text-xs font-bold"
        />
        <input
          type="date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
          aria-label="Hasta"
          className="mg-input min-h-[44px] !px-3 text-xs font-bold"
        />
        {branches.length > 1 ? (
          <select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            aria-label="Sucursal"
            className="mg-input min-h-[44px] !px-3 text-xs font-bold"
          >
            <option value="all">Todas las sedes</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        ) : (
          <div className="hidden sm:block" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <MetricCard label="Proformas" value={periodSummary.count} hint="En el período" icon="recibo" tone="brand" />
        <MetricCard label="Total comprado" value={formatBs(periodSummary.total)} hint="Con gastos incluidos" icon="caja" tone="action" />
        <MetricCard label="Unidades" value={periodSummary.units} hint="Ingresadas al inventario" icon="paquete" tone="success" />
        <MetricCard label="Gastos extra" value={formatBs(periodSummary.extras)} hint="Flete y otros" icon="gastos" tone="warning" />
      </div>

      {filteredGroups.length > 0 ? (
        <div className="space-y-2.5">
          {filteredGroups.map((group) => {
            const expanded = expandedId === group.id;
            return (
              <article key={group.id} className="overflow-hidden rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shadow-[var(--mg-shadow-sm)]">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : group.id)}
                  className="flex w-full items-start gap-3 p-3.5 text-left sm:p-4"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]">
                    <AppIcon name="recibo" size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-black text-[var(--mg-text-primary)]">{group.number}</p>
                      <span className="rounded-full bg-[var(--mg-bg-elevated)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[var(--mg-text-muted)]">
                        {group.docType}
                      </span>
                      {group.branchName && (
                        <span className="truncate rounded-full bg-[var(--mg-brand-bg)] px-2 py-0.5 text-[9px] font-bold text-[var(--mg-brand-text)]">
                          {group.branchName}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--mg-text-muted)]">
                      {formatDate(group.date)} · {group.supplier || 'Sin proveedor'} · {group.itemCount} {group.itemCount === 1 ? 'producto' : 'productos'}
                      {group.receivedBy ? ` · Recibe: ${group.receivedBy}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-[var(--mg-brand-text)]">{formatBs(group.total)}</p>
                    <p className="text-[10px] font-bold text-[var(--mg-text-muted)]">{group.units} und.</p>
                  </div>
                  <span className="mt-1 shrink-0 text-[var(--mg-text-muted)]">
                    <AppIcon name={expanded ? 'ocultar' : 'ver'} size={16} />
                  </span>
                </button>

                {expanded && (
                  <div className="space-y-3 border-t border-[var(--mg-separator)] p-3.5 sm:p-4">
                    <div className="hidden overflow-x-auto sm:block">
                      <table className="w-full min-w-[760px] text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-[var(--mg-separator)] text-[9px] uppercase tracking-wider text-[var(--mg-text-muted)]">
                            <th className="py-2 pr-2 font-black">Producto</th>
                            <th className="px-2 py-2 font-black">Presentación</th>
                            <th className="px-2 py-2 text-right font-black">Cantidad</th>
                            <th className="px-2 py-2 font-black">Lote</th>
                            <th className="px-2 py-2 font-black">Vence</th>
                            <th className="px-2 py-2 text-right font-black">Costo und.</th>
                            <th className="px-2 py-2 text-right font-black">Venta</th>
                            <th className="px-2 py-2 text-right font-black">Margen</th>
                            <th className="py-2 pl-2 text-right font-black">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--mg-separator)]">
                          {group.items.map((item) => {
                            const margin = itemMargin(item);
                            const expiry = expiryInfo(item.expiryDate, expiryWarningDays);
                            return (
                              <tr key={item.id}>
                                <td className="py-2.5 pr-2">
                                  <p className="font-black text-[var(--mg-text-primary)]">{item.productName}</p>
                                  {item.brand && <p className="text-[10px] font-semibold text-[var(--mg-text-muted)]">{item.brand}</p>}
                                </td>
                                <td className="px-2 py-2.5 text-[var(--mg-text-secondary)]">{presentationLabel(item)}</td>
                                <td className="px-2 py-2.5 text-right font-bold text-[var(--mg-text-secondary)]">{quantityLabel(item)}</td>
                                <td className="px-2 py-2.5 font-mono text-[10px] font-bold uppercase text-[var(--mg-text-secondary)]">{item.lotCode || '—'}</td>
                                <td className={`px-2 py-2.5 font-mono text-[10px] font-bold ${expiry.tone}`}>{expiry.label}</td>
                                <td className="px-2 py-2.5 text-right font-bold text-[var(--mg-text-secondary)]">{formatBs(item.supplierPrice)}</td>
                                <td className="px-2 py-2.5 text-right font-bold text-[var(--mg-text-secondary)]">{formatBs(item.salePrice)}</td>
                                <td className={`px-2 py-2.5 text-right font-black ${margin.danger ? 'text-[var(--mg-danger)]' : 'text-[var(--mg-success-text)]'}`}>
                                  {margin.pct.toFixed(1)}%
                                </td>
                                <td className="py-2.5 pl-2 text-right font-black text-[var(--mg-brand-text)]">{formatBs(item.totalCost)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-2 sm:hidden">
                      {group.items.map((item) => {
                        const margin = itemMargin(item);
                        const expiry = expiryInfo(item.expiryDate, expiryWarningDays);
                        return (
                          <div key={item.id} className="rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-black text-[var(--mg-text-primary)]">{item.productName}</p>
                                <p className="text-[10px] font-semibold text-[var(--mg-text-muted)]">{presentationLabel(item)} · {quantityLabel(item)}</p>
                              </div>
                              <p className="shrink-0 text-xs font-black text-[var(--mg-brand-text)]">{formatBs(item.totalCost)}</p>
                            </div>
                            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-semibold text-[var(--mg-text-secondary)]">
                              <span>Lote: <strong className="font-mono uppercase">{item.lotCode || '—'}</strong></span>
                              <span>Vence: <strong className={expiry.tone}>{expiry.label}</strong></span>
                              <span>Costo: <strong>{formatBs(item.supplierPrice)}</strong></span>
                              <span>Venta: <strong>{formatBs(item.salePrice)}</strong></span>
                              <span className={margin.danger ? 'text-[var(--mg-danger)]' : 'text-[var(--mg-success-text)]'}>
                                Margen: <strong>{margin.pct.toFixed(1)}%</strong>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {(group.extraCosts.length > 0 || group.notes || group.discount > 0 || group.receivedBy) && (
                      <div className="space-y-2 rounded-xl bg-[var(--mg-bg-elevated)] p-3">
                        {group.discount > 0 && (
                          <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                            <span className="text-[var(--mg-text-muted)]">Descuento aplicado</span>
                            <span className="text-[var(--mg-danger)]">− {formatBs(group.discount)}</span>
                          </div>
                        )}
                        {group.receivedBy && (
                          <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                            <span className="text-[var(--mg-text-muted)]">Recibió</span>
                            <span className="text-[var(--mg-text-secondary)]">{group.receivedBy}</span>
                          </div>
                        )}
                        {group.extraCosts.length > 0 && (
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">Gastos de la proforma</p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {group.extraCosts.map((extra, index) => (
                                <span key={`${extra.concept}-${index}`} className="rounded-full border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] px-2 py-0.5 text-[10px] font-bold text-[var(--mg-text-secondary)]">
                                  {extra.concept}: {formatBs(extra.amount)}
                                </span>
                              ))}
                              <span className="rounded-full bg-[var(--mg-brand-bg)] px-2 py-0.5 text-[10px] font-black text-[var(--mg-brand-text)]">
                                Total: {formatBs(group.extraTotal)}
                              </span>
                            </div>
                          </div>
                        )}
                        {group.notes && (
                          <p className="text-[11px] font-semibold leading-relaxed text-[var(--mg-text-secondary)]">
                            <span className="font-black text-[var(--mg-text-muted)]">Observaciones: </span>
                            {group.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="recibo"
          title={search ? 'No encontramos esa proforma' : 'Todavía no hay proformas registradas'}
          description={search
            ? 'Probá con otro número, proveedor, producto o lote.'
            : 'Registrá la primera proforma física para controlar lotes, vencimientos y el costo real de cada producto.'}
          action={!search ? (
            <button type="button" onClick={openForm} className="mg-btn-primary inline-flex items-center gap-1.5 px-4 text-xs">
              <AppIcon name="agregar" size={14} />
              Nueva proforma
            </button>
          ) : null}
        />
      )}

      {settings?.businessName && (
        <p className="pb-2 text-center text-[10px] font-semibold text-[var(--mg-text-faint)]">
          {settings.businessName} · Historial de compras por proforma
        </p>
      )}
    </div>
  );
}
