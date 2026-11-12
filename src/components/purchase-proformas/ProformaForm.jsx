import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import { useBranches } from '../../context/BranchContext';
import { subscribeToSuppliers, addSupplier } from '../../services/suppliers';
import {
  clearProformaDraft,
  computeProformaItem,
  getProformaDiscountAmount,
  getProformaDraft,
  getProformaItemFactor,
  getProformaItemPackagePrice,
  getProformaItemPackageQty,
  getProformaItemUnitCost,
  roundMoney,
  saveProformaDraft,
  savePurchaseProforma,
  suggestProformaNumber,
  validateProformaDraft,
} from '../../services/purchaseProformas';
import { toLocalISODate } from '../../utils/dateRanges';
import { clampIntegerInput, clampNumberInput, blockInvalidNumberKeys } from '../../utils/numberInput';
import { AppIcon } from '../icons';
import BarcodeScanner from '../BarcodeScanner';
import EmptyState from '../ui/EmptyState';
import NewProformaProductModal from './NewProformaProductModal';
import PhysicalImportModal from './PhysicalImportModal';
import { createProformaItemFromNewProduct, createProformaItemFromProduct } from './proformaUi';

function formatBs(amount) {
  return `Bs ${Number(amount || 0).toFixed(2)}`;
}

function formatQty(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0';
  if (Number.isInteger(number)) return String(number);
  return number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function todayISO() {
  return toLocalISODate(new Date());
}

function normalizeSearch(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function draftHasContent(draft) {
  return !!(
    String(draft?.header?.supplier || '').trim()
    || String(draft?.header?.notes || '').trim()
    || Number(draft?.discount || 0) > 0
    || (Array.isArray(draft?.items) && draft.items.length > 0)
  );
}

function normalizeDraftItem(item) {
  if (!item || typeof item !== 'object') return item;
  if (item.packageQty !== undefined && item.packageQty !== null && item.packageQty !== '') {
    return { ...item, noExpiry: !!item.noExpiry };
  }
  const factor = getProformaItemFactor(item);
  const unitCost = getProformaItemUnitCost(item);
  return {
    ...item,
    factor,
    packageQty: String(getProformaItemPackageQty(item)),
    packagePrice: unitCost > 0 ? String(roundMoney(unitCost * factor)) : '',
    presentationName: item.presentationName || (factor > 1 ? 'Caja' : 'Unidad'),
    noExpiry: !!item.noExpiry,
  };
}

export default function ProformaForm({
  products = [],
  categories = [],
  replenishments = [],
  onCancel,
  onSaved,
}) {
  const { businessId, user, sellerName, hasPermission } = useAuth();
  const { sectorConfig, tipoNegocio } = useBusiness();
  const { branches, activeBranchId } = useBranches();
  const isLicoreria = tipoNegocio === 'licorera';
  const scannerEnabled = sectorConfig?.features?.scanner !== false;

  const [header, setHeader] = useState(() => ({
    number: '',
    date: todayISO(),
    supplier: '',
    receivedBy: '',
    docType: 'Proforma',
    notes: '',
  }));
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState('0.00');
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProductSeed, setNewProductSeed] = useState({ name: '', barcode: '' });
  const [showScanner, setShowScanner] = useState(false);
  const [showPhysicalImport, setShowPhysicalImport] = useState(false);
  const [scanMsg, setScanMsg] = useState('');
  const [error, setError] = useState([]);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [restored, setRestored] = useState(false);

  const formRef = useRef(null);
  const searchRef = useRef(null);
  const restoreStartedRef = useRef(false);
  const draftPayloadRef = useRef(null);

  const selectedBranchId = activeBranchId
    || branches.find((branch) => branch.isMain)?.id
    || branches[0]?.id
    || null;
  const selectedBranchName = branches.find((branch) => branch.id === selectedBranchId)?.name || '';
  const mainBranchId = branches.find((branch) => branch.isMain)?.id || null;

  useEffect(() => {
    if (!header.receivedBy && sellerName) {
      setHeader((current) => ({ ...current, receivedBy: sellerName }));
    }
  }, [sellerName, header.receivedBy]);

  useEffect(() => {
    if (!businessId || !user?.uid || restoreStartedRef.current) return;
    restoreStartedRef.current = true;
    let active = true;

    getProformaDraft(businessId, user.uid)
      .then((draft) => {
        if (!active) return;
        if (draftHasContent(draft)) {
          setHeader((current) => ({
            ...current,
            ...(draft.header || {}),
            receivedBy: draft.header?.receivedBy || current.receivedBy || sellerName || '',
          }));
          setItems(Array.isArray(draft.items) ? draft.items.map(normalizeDraftItem) : []);
          setDiscount(draft.discount !== undefined && draft.discount !== null ? String(draft.discount) : '0.00');
          setRestored(true);
        } else {
          setHeader((current) => ({
            ...current,
            number: current.number || suggestProformaNumber(replenishments),
            receivedBy: current.receivedBy || sellerName || '',
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
          receivedBy: current.receivedBy || sellerName || '',
        }));
        setReady(true);
      });

    return () => { active = false; };
  }, [businessId, user?.uid, replenishments, sellerName]);

  useEffect(() => {
    if (!businessId) return undefined;
    return subscribeToSuppliers(businessId, setSuppliers);
  }, [businessId]);

  draftPayloadRef.current = {
    header,
    items,
    discount: Number(discount) || 0,
    branchId: selectedBranchId || null,
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
  }, [ready, businessId, user?.uid, header, items, discount, selectedBranchId]);

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

  const searchTerm = normalizeSearch(search);
  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    return products
      .filter((product) => !product.isDish)
      .filter((product) => (
        normalizeSearch(product.name).includes(searchTerm)
        || normalizeSearch(product.brand).includes(searchTerm)
        || normalizeSearch(product.barcode).includes(searchTerm)
      ))
      .slice(0, 8);
  }, [products, searchTerm]);

  const computedItems = useMemo(
    () => items.map((item) => computeProformaItem(item)),
    [items],
  );
  const merchandiseTotal = roundMoney(computedItems.reduce((sum, computed) => sum + computed.baseCost, 0));
  const totalPackages = roundMoney(items.reduce((sum, item) => sum + getProformaItemPackageQty(item), 0));
  const discountAmount = getProformaDiscountAmount(items, discount);
  const totalGeneral = roundMoney(merchandiseTotal - discountAmount);

  function focusSearch() {
    if (showNewProduct || showScanner || showPhysicalImport) return;
    searchRef.current?.focus();
    searchRef.current?.select?.();
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'F2') {
        event.preventDefault();
        focusSearch();
        return;
      }
      if (event.key === 'F10') {
        event.preventDefault();
        if (!saving) formRef.current?.requestSubmit();
        return;
      }
      if (event.key === 'Escape') {
        if (showScanner) {
          setShowScanner(false);
          return;
        }
        if (showNewProduct) {
          setShowNewProduct(false);
          setNewProductSeed({ name: '', barcode: '' });
          return;
        }
        if (showPhysicalImport) {
          setShowPhysicalImport(false);
          return;
        }
        onCancel?.();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saving, showScanner, showNewProduct, showPhysicalImport, onCancel]);

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

  function handlePhysicalImport(importedItems) {
    if (!Array.isArray(importedItems) || importedItems.length === 0) return;
    setItems((current) => [...current, ...importedItems]);
    setShowPhysicalImport(false);
    setError([]);
  }

  function updateItem(key, patch) {
    setItems((current) => current.map((item) => (
      item.key === key ? { ...item, ...patch } : item
    )));
  }

  function updateItemFactor(key, value) {
    const factor = Number(clampIntegerInput(value, { min: 1, max: 9999 }) || 1);
    setItems((current) => current.map((item) => (
      item.key === key
        ? {
          ...item,
          factor,
          packageFactor: factor,
          presentationName: factor > 1
            ? (String(item.presentationName || '').trim() || 'Caja')
            : 'Unidad',
        }
        : item
    )));
  }

  function removeItem(key) {
    setItems((current) => current.filter((item) => item.key !== key));
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
      && normalizeSearch(product.barcode) === normalizeSearch(cleaned)
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

    if (Number(discount) > merchandiseTotal) {
      errors.push('El descuento no puede superar el subtotal de la proforma.');
    }

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

      const result = await savePurchaseProforma(businessId, {
        header: {
          ...header,
          supplier: trimmedSupplier,
          receivedBy: header.receivedBy.trim() || sellerName || '',
        },
        items,
        discount: Number(discount) || 0,
        extraCosts: [],
        branchId: selectedBranchId,
        branchName: selectedBranchName,
        mainBranchId,
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

  function renderExpiryControl(item, compact = false) {
    return (
      <div className={compact ? 'flex items-end gap-1.5' : 'space-y-1'}>
        <input
          type="date"
          value={item.expiryDate || ''}
          disabled={!!item.noExpiry}
          onChange={(event) => updateItem(item.key, { expiryDate: event.target.value })}
          className={`mg-input !px-2 !py-2 text-[11px] font-bold disabled:opacity-40 ${compact ? 'min-w-0 flex-1' : ''}`}
        />
        <button
          type="button"
          onClick={() => updateItem(item.key, {
            noExpiry: !item.noExpiry,
            expiryDate: item.noExpiry ? item.expiryDate : '',
          })}
          className={`inline-flex min-h-[34px] shrink-0 items-center justify-center rounded-lg border px-2 text-[10px] font-black ${
            item.noExpiry
              ? 'border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]'
              : 'border-[var(--mg-border)] text-[var(--mg-text-muted)]'
          }`}
          title="Sin vencimiento"
        >
          S/V
        </button>
      </div>
    );
  }

  return (
    <>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-3 pb-4">
        {error.length > 0 && (
          <div className="rounded-2xl border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-black text-[var(--mg-danger)]">
              <AppIcon name="alerta" size={14} />
              Revisá estos puntos antes de guardar
            </p>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[11px] font-semibold text-[var(--mg-danger)]">
              {error.slice(0, 8).map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
            </ul>
            {error.length > 8 && (
              <p className="mt-1 text-[10px] font-bold text-[var(--mg-danger)]">Y {error.length - 8} más.</p>
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
            <h1 className="truncate text-xl font-black tracking-tight text-[var(--mg-brand-text)]">Proforma de compra</h1>
            <p className="truncate text-[11px] font-semibold text-[var(--mg-text-secondary)]">
              Recepción de mercadería por paquete o caja.
            </p>
          </div>
        </div>

        {restored && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] px-3 py-2 text-[11px] font-bold text-[var(--mg-brand-text)]">
            <AppIcon name="historial" size={14} />
            Borrador restaurado. Podés seguir donde lo dejaste.
          </div>
        )}

        <section className="rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3.5 shadow-[var(--mg-shadow-sm)] sm:p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                N° Proforma
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={header.number}
                  readOnly
                  tabIndex={-1}
                  aria-label="Número de proforma generado automáticamente"
                  className="mg-input pr-9 text-sm font-black uppercase text-[var(--mg-text-secondary)]"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--mg-text-muted)]">
                  <AppIcon name="seguro" size={14} />
                </span>
              </div>
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
                Recibe
              </label>
              <input
                type="text"
                value={header.receivedBy}
                onChange={(event) => setHeader((current) => ({ ...current, receivedBy: event.target.value }))}
                placeholder={sellerName || 'Nombre de quien recibe'}
                className="mg-input text-sm font-bold"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                Fecha
              </label>
              <input
                type="date"
                value={header.date}
                onChange={(event) => setHeader((current) => ({ ...current, date: event.target.value }))}
                className="mg-input text-sm font-bold"
              />
            </div>
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-[var(--mg-text-muted)]">
            <AppIcon name="tienda" size={12} />
            Sucursal de ingreso: {selectedBranchName || 'Sin sucursal configurada'}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shadow-[var(--mg-shadow-sm)]">
          <div className="flex flex-col gap-2 border-b border-[var(--mg-separator)] p-3 sm:flex-row sm:items-center sm:p-3.5">
            <button
              type="button"
              onClick={focusSearch}
              className="mg-btn-primary inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 px-3 text-[11px]"
            >
              <AppIcon name="agregar" size={14} />
              AGREGAR PRODUCTO (F2)
            </button>

            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mg-text-muted)]">
                <AppIcon name="search" size={16} />
              </span>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && searchResults.length > 0) {
                    event.preventDefault();
                    addProductToProforma(searchResults[0]);
                  }
                }}
                placeholder="Buscar producto, marca o código..."
                className="mg-input min-h-[40px] pl-9 text-sm"
              />
            </div>

            {scannerEnabled && hasPermission('scanner') && (
              <button
                type="button"
                onClick={() => { setScanMsg(''); setShowScanner(true); }}
                aria-label="Escanear código de barras"
                className="flex min-h-[40px] w-[40px] shrink-0 items-center justify-center rounded-xl bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)] active:scale-90"
              >
                <AppIcon name="scan" size={18} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowPhysicalImport(true)}
              className="mg-btn-secondary inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 px-3 text-[11px]"
            >
              <AppIcon name="carpeta" size={14} />
              IMPORTAR FÍSICA
            </button>
          </div>

          {searchTerm && (
            <div className="border-b border-[var(--mg-separator)] p-2">
              {searchResults.length > 0 ? (
                <div className="divide-y divide-[var(--mg-separator)] overflow-hidden rounded-xl border border-[var(--mg-border)]">
                  {searchResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addProductToProforma(product)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--mg-bg-elevated)] active:bg-[var(--mg-bg-section)]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-[var(--mg-text-primary)]">{product.name}</p>
                        <p className="truncate text-[10px] font-semibold text-[var(--mg-text-muted)]">
                          {[product.barcode, product.brand, product.category].filter(Boolean).join(' · ') || 'Sin código'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[9px] font-bold uppercase text-[var(--mg-text-muted)]">Venta</p>
                        <p className="text-[11px] font-black text-[var(--mg-accent-text)]">{formatBs(product.price)}</p>
                      </div>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)]">
                        <AppIcon name="agregar" size={13} />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--mg-border)] p-3 text-center">
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
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px] text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)] text-[9px] uppercase tracking-wider text-[var(--mg-text-muted)]">
                      <th className="w-10 px-2 py-2.5 text-center font-black">Ítem</th>
                      <th className="w-24 px-2 py-2.5 font-black">Código</th>
                      <th className="px-2 py-2.5 font-black">Producto / Descripción</th>
                      <th className="w-32 px-2 py-2.5 text-center font-black">Cant. paquetes / cajas</th>
                      <th className="w-32 px-2 py-2.5 text-right font-black">Precio compra caja (Bs)</th>
                      <th className="w-36 px-2 py-2.5 font-black">F. Vencimiento</th>
                      <th className="w-24 px-2 py-2.5 text-right font-black">Total (Bs)</th>
                      <th className="w-9 px-1 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--mg-separator)]">
                    {items.map((item, index) => {
                      const computed = computedItems[index];
                      return (
                        <tr key={item.key} className="align-top">
                          <td className="px-2 py-3 text-center text-xs font-black text-[var(--mg-text-muted)]">{index + 1}</td>
                          <td className="px-2 py-3 font-mono text-[10px] font-bold text-[var(--mg-text-secondary)]">
                            {item.barcode || '—'}
                          </td>
                          <td className="px-2 py-3">
                            <p className="text-xs font-black text-[var(--mg-text-primary)]">{item.productName}</p>
                            <p className="mt-0.5 line-clamp-1 text-[10px] font-semibold text-[var(--mg-text-muted)]">
                              {item.description || [item.productBrand, item.category].filter(Boolean).join(' · ') || 'Sin descripción'}
                            </p>
                            <div className="mt-1.5 flex items-center gap-1 text-[9px] font-bold text-[var(--mg-text-muted)]">
                              <span className="rounded bg-[var(--mg-bg-elevated)] px-1.5 py-0.5">
                                {getProformaItemFactor(item) > 1 ? (item.presentationName || 'Caja') : 'Unidad'}
                              </span>
                              <span>x</span>
                              <input
                                type="number"
                                inputMode="numeric"
                                min="1"
                                max="9999"
                                step="1"
                                value={item.factor}
                                onChange={(event) => updateItemFactor(item.key, event.target.value)}
                                onKeyDown={(event) => blockInvalidNumberKeys(event, { allowDecimal: false })}
                                aria-label={`Unidades por caja de ${item.productName}`}
                                className="w-12 rounded border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] px-1 py-0.5 text-center text-[10px] font-black text-[var(--mg-text-primary)]"
                              />
                              <span>und.</span>
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              max="999999"
                              step="0.01"
                              value={item.packageQty}
                              onChange={(event) => updateItem(item.key, {
                                packageQty: clampNumberInput(event.target.value, { max: 999999 }),
                              })}
                              onKeyDown={blockInvalidNumberKeys}
                              placeholder="1"
                              aria-label={`Cantidad de paquetes o cajas de ${item.productName}`}
                              className="mg-input !px-2 !py-2 text-center text-sm font-black"
                            />
                          </td>
                          <td className="px-2 py-3">
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              max="9999999"
                              step="0.01"
                              value={item.packagePrice}
                              onChange={(event) => updateItem(item.key, {
                                packagePrice: clampNumberInput(event.target.value, { max: 9999999 }),
                              })}
                              onKeyDown={blockInvalidNumberKeys}
                              placeholder="0.00"
                              aria-label={`Precio de compra por caja de ${item.productName}`}
                              className="mg-input !px-2 !py-2 text-right text-sm font-black text-[var(--mg-accent-text)]"
                            />
                            {computed.unitCost > 0 && (
                              <p className="mt-0.5 text-right text-[9px] font-semibold text-[var(--mg-text-muted)]">
                                {formatBs(computed.unitCost)} / und.
                              </p>
                            )}
                          </td>
                          <td className="px-2 py-3">
                            {renderExpiryControl(item, true)}
                          </td>
                          <td className="px-2 py-3 text-right text-xs font-black text-[var(--mg-brand-text)]">
                            {formatBs(computed.baseCost)}
                          </td>
                          <td className="px-1 py-3">
                            <button
                              type="button"
                              onClick={() => removeItem(item.key)}
                              aria-label={`Quitar ${item.productName}`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--mg-border)] text-[var(--mg-text-muted)] transition-colors hover:border-[var(--mg-danger)] hover:text-[var(--mg-danger)]"
                            >
                              <AppIcon name="eliminar" size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2 p-3 md:hidden">
                {items.map((item, index) => {
                  const computed = computedItems[index];
                  return (
                    <article key={item.key} className="rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3">
                      <div className="flex items-start gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--mg-brand-bg)] text-[10px] font-black text-[var(--mg-brand-text)]">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black text-[var(--mg-text-primary)]">{item.productName}</p>
                          <p className="truncate text-[10px] font-semibold text-[var(--mg-text-muted)]">
                            {item.barcode || 'Sin código'} · {item.description || item.category || 'Sin descripción'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.key)}
                          aria-label={`Quitar ${item.productName}`}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--mg-border)] text-[var(--mg-text-muted)]"
                        >
                          <AppIcon name="eliminar" size={13} />
                        </button>
                      </div>

                      <div className="mt-2 flex items-center gap-1 text-[9px] font-bold text-[var(--mg-text-muted)]">
                        <span>{getProformaItemFactor(item) > 1 ? (item.presentationName || 'Caja') : 'Unidad'} x</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="9999"
                          step="1"
                          value={item.factor}
                          onChange={(event) => updateItemFactor(item.key, event.target.value)}
                          onKeyDown={(event) => blockInvalidNumberKeys(event, { allowDecimal: false })}
                          aria-label={`Unidades por caja de ${item.productName}`}
                          className="w-12 rounded border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] px-1 py-0.5 text-center text-[10px] font-black"
                        />
                        <span>und. por caja</span>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-0.5 block text-[9px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                            Cant. paquetes / cajas
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="999999"
                            step="0.01"
                            value={item.packageQty}
                            onChange={(event) => updateItem(item.key, {
                              packageQty: clampNumberInput(event.target.value, { max: 999999 }),
                            })}
                            onKeyDown={blockInvalidNumberKeys}
                            className="mg-input !px-2 !py-2 text-center text-sm font-black"
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[9px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                            Precio compra caja (Bs)
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="9999999"
                            step="0.01"
                            value={item.packagePrice}
                            onChange={(event) => updateItem(item.key, {
                              packagePrice: clampNumberInput(event.target.value, { max: 9999999 }),
                            })}
                            onKeyDown={blockInvalidNumberKeys}
                            className="mg-input !px-2 !py-2 text-right text-sm font-black text-[var(--mg-accent-text)]"
                          />
                        </div>
                      </div>

                      <div className="mt-2">
                        <label className="mb-0.5 block text-[9px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                          F. Vencimiento
                        </label>
                        {renderExpiryControl(item)}
                      </div>

                      <div className="mt-2 flex items-center justify-between border-t border-[var(--mg-separator)] pt-2 text-xs">
                        <span className="font-semibold text-[var(--mg-text-muted)]">
                          {formatQty(getProformaItemPackageQty(item))} × {formatBs(getProformaItemPackagePrice(item))}
                        </span>
                        <span className="font-black text-[var(--mg-brand-text)]">{formatBs(computed.baseCost)}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <EmptyState
              icon="paquete"
              title="Todavía no agregaste productos"
              description="Usá AGREGAR PRODUCTO (F2), el buscador rápido o IMPORTAR FÍSICA para cargar la proforma."
              className="m-3 border-0 bg-[var(--mg-bg-elevated)] px-3 py-5 shadow-none"
            />
          )}
        </section>

        <div className="rounded-2xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] p-3.5 sm:p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--mg-text-muted)]">Total paquetes / cajas</p>
              <p className="text-2xl font-black text-[var(--mg-text-primary)]">{formatQty(totalPackages)}</p>
              <p className="text-[10px] font-semibold text-[var(--mg-text-muted)]">
                {formatQty(computedItems.reduce((sum, computed) => sum + computed.quantity, 0))} unidades base
              </p>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--mg-text-muted)]">
                Descuento (Bs)
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="9999999"
                step="0.01"
                value={discount}
                onChange={(event) => setDiscount(clampNumberInput(event.target.value, { max: 9999999 }))}
                onKeyDown={blockInvalidNumberKeys}
                placeholder="0.00"
                className="mg-input text-right text-lg font-black text-[var(--mg-text-primary)]"
              />
              {Number(discount) > merchandiseTotal && (
                <p className="mt-1 text-[10px] font-bold text-[var(--mg-danger)]">Supera el subtotal de {formatBs(merchandiseTotal)}.</p>
              )}
            </div>

            <div className="sm:text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--mg-text-muted)]">Total general</p>
              <p className="text-3xl font-black tracking-tight text-[var(--mg-brand-text)]">{formatBs(totalGeneral)}</p>
            </div>
          </div>
        </div>

        <div className="sticky bottom-2 z-30 flex items-center justify-between gap-2 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)]/95 p-2.5 shadow-[var(--mg-shadow-md)] backdrop-blur">
          <button
            type="button"
            onClick={onCancel}
            className="mg-btn-tertiary inline-flex min-h-[44px] items-center gap-1.5 px-3 text-xs"
          >
            CANCELAR (Esc)
          </button>
          <button
            type="submit"
            disabled={saving || items.length === 0}
            className="mg-btn-primary inline-flex min-h-[44px] shrink-0 items-center gap-1.5 px-4 text-xs disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Procesando...
              </>
            ) : (
              <>
                <AppIcon name="guardar" size={15} />
                GUARDAR Y PROCESAR (F10)
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

      {showPhysicalImport && (
        <PhysicalImportModal
          products={products}
          onClose={() => setShowPhysicalImport(false)}
          onImport={handlePhysicalImport}
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
