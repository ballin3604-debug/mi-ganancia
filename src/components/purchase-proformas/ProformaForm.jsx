import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import { useBranches } from '../../context/BranchContext';
import { getReplenishmentConcepts, addReplenishmentConcepts } from '../../services/replenishmentConcepts';
import { subscribeToSuppliers, addSupplier } from '../../services/suppliers';
import {
  PROFORMA_DOC_TYPES,
  buildProformaExtraShares,
  cleanProformaExtraCosts,
  clearProformaDraft,
  computeProformaItem,
  getProformaDraft,
  roundMoney,
  saveProformaDraft,
  savePurchaseProforma,
  suggestProformaNumber,
  validateProformaDraft,
} from '../../services/purchaseProformas';
import { toLocalISODate } from '../../utils/dateRanges';
import { getExpiryWarningDays } from '../../utils/expiry';
import { clampNumberInput, blockInvalidNumberKeys } from '../../utils/numberInput';
import { AppIcon } from '../icons';
import BarcodeScanner from '../BarcodeScanner';
import EmptyState from '../ui/EmptyState';
import SectionCard from '../ui/SectionCard';
import ProformaItemCard from './ProformaItemCard';
import NewProformaProductModal from './NewProformaProductModal';
import { createProformaItemFromNewProduct, createProformaItemFromProduct } from './proformaUi';

function formatBs(amount) {
  return `Bs ${Number(amount || 0).toFixed(2)}`;
}

function todayISO() {
  return toLocalISODate(new Date());
}

function draftHasContent(draft) {
  return !!(
    String(draft?.header?.number || '').trim()
    || String(draft?.header?.supplier || '').trim()
    || String(draft?.header?.notes || '').trim()
    || (Array.isArray(draft?.items) && draft.items.length > 0)
    || (Array.isArray(draft?.extraCosts) && draft.extraCosts.some((row) => (
      String(row.concept || '').trim() || Number(row.amount || 0) > 0
    )))
  );
}

export default function ProformaForm({
  products = [],
  categories = [],
  replenishments = [],
  onCancel,
  onSaved,
}) {
  const { businessId, user, hasPermission } = useAuth();
  const { sectorConfig, tipoNegocio } = useBusiness();
  const { branches, activeBranchId } = useBranches();
  const isLicoreria = tipoNegocio === 'licorera';
  const scannerEnabled = sectorConfig?.features?.scanner !== false;
  const expiryWarningDays = getExpiryWarningDays(sectorConfig);

  const [header, setHeader] = useState(() => ({
    number: '',
    date: todayISO(),
    supplier: '',
    docType: 'Proforma',
    notes: '',
  }));
  const [items, setItems] = useState([]);
  const [extraCosts, setExtraCosts] = useState([]);
  const [purchaseBranchId, setPurchaseBranchId] = useState(activeBranchId || '');
  const [suppliers, setSuppliers] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [search, setSearch] = useState('');
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProductSeed, setNewProductSeed] = useState({ name: '', barcode: '' });
  const [showScanner, setShowScanner] = useState(false);
  const [scanMsg, setScanMsg] = useState('');
  const [error, setError] = useState([]);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [restored, setRestored] = useState(false);

  const rowIdRef = useRef(0);
  const restoreStartedRef = useRef(false);
  const draftPayloadRef = useRef(null);

  useEffect(() => {
    if (!purchaseBranchId && activeBranchId) setPurchaseBranchId(activeBranchId);
  }, [activeBranchId, purchaseBranchId]);

  useEffect(() => {
    if (!businessId || !user?.uid || restoreStartedRef.current) return;
    restoreStartedRef.current = true;
    let active = true;

    getProformaDraft(businessId, user.uid)
      .then((draft) => {
        if (!active) return;
        if (draftHasContent(draft)) {
          setHeader((current) => ({ ...current, ...(draft.header || {}) }));
          setItems(Array.isArray(draft.items) ? draft.items : []);
          setExtraCosts((Array.isArray(draft.extraCosts) ? draft.extraCosts : []).map((row) => {
            rowIdRef.current += 1;
            return { id: rowIdRef.current, concept: row.concept || '', amount: row.amount ?? '' };
          }));
          if (draft.branchId) setPurchaseBranchId(draft.branchId);
          setRestored(true);
        } else {
          setHeader((current) => ({
            ...current,
            number: current.number || suggestProformaNumber(replenishments),
          }));
        }
        setReady(true);
      })
      .catch((err) => {
        console.error(err);
        if (!active) return;
        setHeader((current) => ({
          ...current,
          number: current.number || suggestProformaNumber(replenishments),
        }));
        setReady(true);
      });

    return () => { active = false; };
  }, [businessId, user?.uid, replenishments]);

  useEffect(() => {
    if (!businessId) return undefined;
    const unsubscribe = subscribeToSuppliers(businessId, setSuppliers);
    return unsubscribe;
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return undefined;
    let active = true;
    getReplenishmentConcepts(businessId)
      .then((list) => { if (active) setConcepts(list); })
      .catch(console.error);
    return () => { active = false; };
  }, [businessId]);

  draftPayloadRef.current = {
    header,
    items,
    extraCosts: extraCosts.map((row) => ({ concept: row.concept, amount: row.amount })),
    branchId: purchaseBranchId || null,
  };

  useEffect(() => {
    if (!ready || !businessId || !user?.uid) return undefined;
    const timer = setTimeout(() => {
      if (!draftHasContent(draftPayloadRef.current)) {
        clearProformaDraft(businessId, user.uid).catch(console.error);
      } else {
        saveProformaDraft(businessId, user.uid, draftPayloadRef.current).catch(console.error);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [ready, businessId, user?.uid, header, items, extraCosts, purchaseBranchId]);

  useEffect(() => {
    if (!ready || !businessId || !user?.uid) return undefined;
    function flush() {
      if (draftHasContent(draftPayloadRef.current)) {
        saveProformaDraft(businessId, user.uid, draftPayloadRef.current).catch(console.error);
      }
    }
    window.addEventListener('pagehide', flush);
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [ready, businessId, user?.uid]);

  const searchTerm = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    return products
      .filter((product) => !product.isDish)
      .filter((product) => (
        String(product.name || '').toLowerCase().includes(searchTerm)
        || String(product.brand || '').toLowerCase().includes(searchTerm)
        || String(product.barcode || '').toLowerCase().includes(searchTerm)
      ))
      .slice(0, 8);
  }, [products, searchTerm]);

  const baseTotals = items.map((item) => computeProformaItem(item, 0));
  const baseCosts = baseTotals.map((totals) => totals.baseCost);
  const extraShares = buildProformaExtraShares(extraCosts, baseCosts);
  const totalsWithExtras = items.map((item, index) => (
    computeProformaItem(item, extraShares[index]?.total || 0)
  ));
  const units = totalsWithExtras.reduce((sum, totals) => sum + totals.quantity, 0);
  const merchandiseTotal = roundMoney(totalsWithExtras.reduce((sum, totals) => sum + totals.baseCost, 0));
  const totalExtra = roundMoney(extraCosts.reduce((sum, row) => sum + Number(row.amount || 0), 0));
  const grandTotal = roundMoney(totalsWithExtras.reduce((sum, totals) => sum + totals.totalCost, 0));
  const saleTotal = roundMoney(totalsWithExtras.reduce((sum, totals) => sum + totals.salePrice * totals.quantity, 0));
  const marginTotal = roundMoney(saleTotal - grandTotal);
  const marginPct = saleTotal > 0 ? (marginTotal / saleTotal) * 100 : 0;

  function addProductToProforma(product) {
    setItems((current) => [...current, createProformaItemFromProduct(product)]);
    setSearch('');
    setError([]);
  }

  function handleAddNewProduct(newProduct, preferredFactor) {
    setItems((current) => [...current, createProformaItemFromNewProduct(newProduct, preferredFactor)]);
    setShowNewProduct(false);
    setNewProductSeed({ name: '', barcode: '' });
    setError([]);
  }

  function updateItem(key, patch) {
    setItems((current) => current.map((item) => (
      item.key === key ? { ...item, ...patch } : item
    )));
  }

  function removeItem(key) {
    setItems((current) => current.filter((item) => item.key !== key));
  }

  function addExtraRow() {
    rowIdRef.current += 1;
    setExtraCosts((current) => [...current, { id: rowIdRef.current, concept: '', amount: '' }]);
  }

  function updateExtraRow(id, patch) {
    setExtraCosts((current) => current.map((row) => (
      row.id === id ? { ...row, ...patch } : row
    )));
  }

  function removeExtraRow(id) {
    setExtraCosts((current) => current.filter((row) => row.id !== id));
  }

  function openNewProduct(seed = {}) {
    setNewProductSeed({ name: seed.name || search.trim(), barcode: seed.barcode || '' });
    setShowNewProduct(true);
  }

  function handleScan(code) {
    const cleaned = String(code || '').trim();
    if (!cleaned) return;
    const found = products.find((product) => (
      !product.isDish
      && String(product.barcode || '').trim().toLowerCase() === cleaned.toLowerCase()
    ));
    setShowScanner(false);
    setScanMsg('');
    if (found) {
      addProductToProforma(found);
    } else {
      openNewProduct({ barcode: cleaned });
    }
  }

  async function handleSubmit(event) {
    event?.preventDefault();
    setError([]);

    const errors = validateProformaDraft({
      header,
      items,
      requireExpiry: isLicoreria,
    });
    items.forEach((item) => {
      if (item.presentationKey === 'custom' && Number(item.factor || 0) <= 1) {
        errors.push(`${item.productName}: indicá cuántas unidades trae la presentación.`);
      }
    });

    if (errors.length > 0) {
      setError(errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    try {
      const trimmedSupplier = header.supplier.trim();
      if (trimmedSupplier && !suppliers.some((supplier) => supplier.toLowerCase() === trimmedSupplier.toLowerCase())) {
        await addSupplier(businessId, trimmedSupplier);
      }

      const cleanExtras = cleanProformaExtraCosts(extraCosts);
      const newConcepts = cleanExtras
        .map((row) => row.concept)
        .filter((concept) => !concepts.some((existing) => existing.toLowerCase() === concept.toLowerCase()));
      if (newConcepts.length > 0) {
        await addReplenishmentConcepts(businessId, newConcepts);
      }

      const selectedBranchId = purchaseBranchId || activeBranchId || null;
      const result = await savePurchaseProforma(businessId, {
        header: { ...header, supplier: trimmedSupplier },
        items,
        extraCosts: cleanExtras,
        branchId: selectedBranchId,
        branchName: branches.find((branch) => branch.id === selectedBranchId)?.name || '',
        mainBranchId: branches.find((branch) => branch.isMain)?.id || null,
        requireExpiry: isLicoreria,
      });

      await clearProformaDraft(businessId, user?.uid);
      onSaved?.(result);
    } catch (err) {
      console.error(err);
      setError(Array.isArray(err.details) && err.details.length > 0
        ? err.details
        : [err.message || 'Error al guardar la proforma. Intentá de nuevo.']);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 pb-4">
        {error.length > 0 && (
          <div className="rounded-2xl border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-black text-[var(--mg-danger)]">
              <AppIcon name="alerta" size={14} />
              Revisá estos puntos antes de guardar
            </p>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[11px] font-semibold text-[var(--mg-danger)]">
              {error.slice(0, 6).map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
            </ul>
            {error.length > 6 && (
              <p className="mt-1 text-[10px] font-bold text-[var(--mg-danger)]">Y {error.length - 6} más.</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Volver al historial de proformas"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-text-secondary)] active:scale-90"
          >
            <AppIcon name="volver" size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--mg-text-muted)]">Compras</p>
            <h1 className="truncate text-xl font-black tracking-tight text-[var(--mg-brand-text)]">Nueva proforma</h1>
            <p className="truncate text-[11px] font-semibold text-[var(--mg-text-secondary)]">
              Copiá la proforma física; el sistema calcula stock, costos y márgenes.
            </p>
          </div>
        </div>

        {restored && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] px-3 py-2 text-[11px] font-bold text-[var(--mg-brand-text)]">
            <AppIcon name="historial" size={14} />
            Borrador restaurado. Podés seguir donde lo dejaste.
          </div>
        )}

        <SectionCard title="Datos de la proforma" subtitle="Lo que dice el documento físico." bodyClassName="p-3.5 sm:p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                N° de proforma *
              </label>
              <input
                type="text"
                value={header.number}
                onChange={(event) => setHeader((current) => ({ ...current, number: event.target.value }))}
                placeholder="Ej: P-0001 o el número del proveedor"
                className="mg-input text-sm font-black uppercase"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                Fecha de la proforma *
              </label>
              <input
                type="date"
                value={header.date}
                onChange={(event) => setHeader((current) => ({ ...current, date: event.target.value }))}
                className="mg-input text-sm font-bold"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                Proveedor
              </label>
              <input
                type="text"
                list="proforma-suppliers"
                value={header.supplier}
                onChange={(event) => setHeader((current) => ({ ...current, supplier: event.target.value }))}
                placeholder="Nombre del proveedor"
                className="mg-input text-sm font-bold"
              />
              <datalist id="proforma-suppliers">
                {suppliers.map((supplier) => <option key={supplier} value={supplier} />)}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                Tipo de documento
              </label>
              <select
                value={header.docType}
                onChange={(event) => setHeader((current) => ({ ...current, docType: event.target.value }))}
                className="mg-input text-sm font-bold"
              >
                {PROFORMA_DOC_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                Sucursal donde entra la mercadería
              </label>
              {branches.length > 1 ? (
                <select
                  value={purchaseBranchId || activeBranchId || ''}
                  onChange={(event) => setPurchaseBranchId(event.target.value)}
                  className="mg-input text-sm font-bold"
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}{branch.isMain ? ' · Principal' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex min-h-[46px] items-center gap-2 rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] px-3.5 text-sm font-bold text-[var(--mg-text-secondary)]">
                  <AppIcon name="tienda" size={15} />
                  {branches[0]?.name || 'Sin sucursal configurada'}
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                Observaciones
              </label>
              <textarea
                value={header.notes}
                onChange={(event) => setHeader((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Opcional: condiciones, vencimiento general, quién entregó..."
                rows={2}
                className="mg-input resize-none text-xs font-semibold"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Productos de la proforma"
          subtitle="Buscá uno existente o creá el producto en el momento."
          action={(
            <button
              type="button"
              onClick={() => openNewProduct()}
              className="mg-btn-secondary inline-flex min-h-[34px] items-center gap-1 px-3 text-[11px]"
            >
              <AppIcon name="agregar" size={13} />
              Nuevo
            </button>
          )}
          bodyClassName="p-3.5 sm:p-4"
        >
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--mg-text-muted)]">
                <AppIcon name="search" size={17} />
              </span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar producto, marca o código..."
                className="mg-input min-h-[48px] pl-10 text-sm"
              />
            </div>
            {scannerEnabled && hasPermission('scanner') && (
              <button
                type="button"
                onClick={() => { setScanMsg(''); setShowScanner(true); }}
                aria-label="Escanear código de barras"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)] active:scale-90"
              >
                <AppIcon name="scan" size={21} />
              </button>
            )}
          </div>

          {searchTerm && (
            <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)]">
              {searchResults.length > 0 ? (
                <div className="divide-y divide-[var(--mg-separator)]">
                  {searchResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addProductToProforma(product)}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--mg-bg-elevated)] active:bg-[var(--mg-bg-section)]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-[var(--mg-text-primary)]">{product.name}</p>
                        <p className="truncate text-[10px] font-semibold text-[var(--mg-text-muted)]">
                          {[product.brand, product.category, product.barcode].filter(Boolean).join(' · ') || 'Sin marca'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] font-bold text-[var(--mg-text-muted)]">Costo {formatBs(product.supplierPrice)}</p>
                        <p className="text-[10px] font-black text-[var(--mg-accent-text)]">Venta {formatBs(product.price)}</p>
                      </div>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)]">
                        <AppIcon name="agregar" size={13} />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center">
                  <p className="text-[11px] font-bold text-[var(--mg-text-secondary)]">No encontramos “{search.trim()}”.</p>
                  <button
                    type="button"
                    onClick={() => openNewProduct({ name: search.trim() })}
                    className="mg-btn-secondary mt-2 inline-flex min-h-[32px] items-center gap-1 px-3 text-[11px]"
                  >
                    <AppIcon name="nuevoProducto" size={13} />
                    Crear producto
                  </button>
                </div>
              )}
            </div>
          )}

          {items.length > 0 ? (
            <div className="mt-3 space-y-2.5">
              {items.map((item, index) => (
                <ProformaItemCard
                  key={item.key}
                  item={item}
                  index={index}
                  extraShare={extraShares[index]?.total || 0}
                  requireExpiry={isLicoreria}
                  expiryWarningDays={expiryWarningDays}
                  onChange={(patch) => updateItem(item.key, patch)}
                  onRemove={() => removeItem(item.key)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="paquete"
              title="Todavía no agregaste productos"
              description="Buscá un producto por nombre o código, o creá uno nuevo para empezar la proforma."
              className="mt-3 border-0 bg-[var(--mg-bg-elevated)] px-3 py-5 shadow-none"
            />
          )}
        </SectionCard>

        <SectionCard
          title="Gastos de la proforma"
          subtitle="Flete, comisión u otros. Se reparten entre los productos según su costo."
          action={(
            <button
              type="button"
              onClick={addExtraRow}
              className="mg-btn-secondary inline-flex min-h-[34px] items-center gap-1 px-3 text-[11px]"
            >
              <AppIcon name="agregar" size={13} />
              Gasto
            </button>
          )}
          bodyClassName="p-3.5 sm:p-4"
        >
          {extraCosts.length > 0 ? (
            <div className="space-y-2">
              {extraCosts.map((row) => (
                <div key={row.id} className="grid grid-cols-[1fr_110px_36px] items-center gap-2">
                  <input
                    type="text"
                    list="proforma-concepts"
                    value={row.concept}
                    onChange={(event) => updateExtraRow(row.id, { concept: event.target.value })}
                    placeholder="Concepto"
                    className="mg-input !px-3 !py-2 text-xs font-bold"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="999999"
                    step="0.01"
                    value={row.amount}
                    onChange={(event) => updateExtraRow(row.id, { amount: clampNumberInput(event.target.value, { max: 999999 }) })}
                    onKeyDown={blockInvalidNumberKeys}
                    placeholder="0.00"
                    className="mg-input !px-2.5 !py-2 text-right text-xs font-black"
                  />
                  <button
                    type="button"
                    onClick={() => removeExtraRow(row.id)}
                    aria-label="Quitar gasto"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--mg-border)] text-[var(--mg-text-muted)] hover:text-[var(--mg-danger)]"
                  >
                    <AppIcon name="eliminar" size={14} />
                  </button>
                </div>
              ))}
              <datalist id="proforma-concepts">
                {concepts.map((concept) => <option key={concept} value={concept} />)}
              </datalist>
              <p className="text-right text-[11px] font-black text-[var(--mg-text-secondary)]">
                Gastos: {formatBs(totalExtra)}
              </p>
            </div>
          ) : (
            <p className="text-[11px] font-semibold text-[var(--mg-text-muted)]">
              Sin gastos extra. Si el proveedor cobró flete o comisión, agregalos acá.
            </p>
          )}
        </SectionCard>

        <div className="rounded-3xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] p-3.5 sm:p-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--mg-text-muted)]">Productos</p>
              <p className="text-lg font-black text-[var(--mg-text-primary)]">{items.length}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--mg-text-muted)]">Unidades base</p>
              <p className="text-lg font-black text-[var(--mg-text-primary)]">{units}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--mg-text-muted)]">Mercadería</p>
              <p className="text-sm font-black text-[var(--mg-text-primary)]">{formatBs(merchandiseTotal)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--mg-text-muted)]">Gastos extra</p>
              <p className="text-sm font-black text-[var(--mg-text-primary)]">{formatBs(totalExtra)}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-[var(--mg-brand-border)] pt-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--mg-text-muted)]">Total de la proforma</p>
              <p className="text-2xl font-black text-[var(--mg-brand-text)]">{formatBs(grandTotal)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--mg-text-muted)]">Margen estimado</p>
              <p className={`text-sm font-black ${marginTotal < 0 ? 'text-[var(--mg-danger)]' : 'text-[var(--mg-success-text)]'}`}>
                {formatBs(marginTotal)} · {marginPct.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="sticky bottom-2 z-30 flex items-center justify-between gap-3 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)]/95 p-3 shadow-[var(--mg-shadow-md)] backdrop-blur">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--mg-text-muted)]">Total</p>
            <p className="truncate text-lg font-black text-[var(--mg-brand-text)]">{formatBs(grandTotal)}</p>
          </div>
          <button
            type="submit"
            disabled={saving || items.length === 0}
            className="mg-btn-primary inline-flex min-h-[44px] shrink-0 items-center gap-1.5 px-4 text-xs disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Guardando...
              </>
            ) : (
              <>
                <AppIcon name="guardar" size={15} />
                Guardar proforma
              </>
            )}
          </button>
        </div>
      </form>

      {showNewProduct && (
        <NewProformaProductModal
          initialName={newProductSeed.name}
          initialBarcode={newProductSeed.barcode}
          categories={categories}
          products={products}
          isLicoreria={isLicoreria}
          presentationsEnabled={isLicoreria || !!sectorConfig?.features?.configurablePresentations}
          onClose={() => {
            setShowNewProduct(false);
            setNewProductSeed({ name: '', barcode: '' });
          }}
          onAdd={handleAddNewProduct}
        />
      )}

      {showScanner && (
        <div
          className="fixed inset-0 z-[96] flex flex-col bg-black"
          style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center justify-between border-b border-[var(--mg-separator)] p-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]">
                <AppIcon name="scan" size={17} />
              </span>
              <div>
                <h3 className="font-black text-[var(--mg-text-primary)]">Escanear producto</h3>
                <p className="text-[11px] font-semibold text-[var(--mg-text-muted)]">Si no existe, lo creamos con ese código.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowScanner(false)}
              aria-label="Cerrar escáner"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]"
            >
              <AppIcon name="cerrar" size={15} />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
            <BarcodeScanner fullScreen onScan={handleScan} message={scanMsg} />
          </div>
        </div>
      )}
    </>
  );
}
