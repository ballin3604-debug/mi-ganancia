import { useState, useEffect, useRef } from 'react';
import { addReplenishment } from '../services/products';
import { applyPurchaseStock } from '../services/branchStock';
import { getReplenishmentConcepts, addReplenishmentConcepts } from '../services/replenishmentConcepts';
import { subscribeToSuppliers, addSupplier } from '../services/suppliers';
import { clampNumberInput, blockInvalidNumberKeys } from '../utils/numberInput';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { useBranches } from '../context/BranchContext';
import { printReceipt } from './Receipt';
import { savePurchaseDraft, clearPurchaseDraft } from '../services/purchaseDraft';
import { AppIcon } from './icons';
import { calculatePurchaseBaseQuantity } from '../utils/presentations';

function formatBs(amount) {
  return `Bs ${Number(amount || 0).toFixed(2)}`;
}

function ProductImage({ imageData, name }) {
  if (!imageData) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]">
        <AppIcon name="paquete" size={24} />
      </div>
    );
  }
  return (
    <img src={imageData} alt={name}
      className="w-14 h-14 rounded-xl object-cover shrink-0 border border-[var(--mg-border)]" />
  );
}

const CUSTOM_CONCEPT_VALUE = '__custom__';
const CUSTOM_SUPPLIER_VALUE = '__custom__';

export default function PurchaseForm({ businessId, product, initialDraft, lastPurchase, onClose, onSaved }) {
  const { user, role, hasPermission } = useAuth();
  const isOwner = role !== 'cashier';
  const canSeeCosts = isOwner || hasPermission('ver_costos');
  const { business, settings } = useBusiness();
  const { branches, activeBranchId } = useBranches();
  // Sede donde ENTRA la mercadería (Fase 2). Por defecto la operativa.
  const [purchaseBranchId, setPurchaseBranchId] = useState(activeBranchId);
  const [successDetails, setSuccessDetails] = useState(null);
  const [salePrice, setSalePrice] = useState(String(product.price || ''));
  const [supplierPrice, setSupplierPrice] = useState(String(product.supplierPrice || ''));
  const [quantity, setQuantity] = useState('');
  const [purchaseUnitType, setPurchaseUnitType] = useState('unit');
  const [helpTopic, setHelpTopic] = useState(null); // 'unit' | 'pack' | null
  const [packageSize, setPackageSize] = useState(product.packageSize ? String(product.packageSize) : '');
  const [packageCount, setPackageCount] = useState('');
  const [purchasePresentationId, setPurchasePresentationId] = useState(() => (
    (product.presentations || []).find((presentation) => Number(presentation.factor) > 1)?.id
    || (product.presentations || []).find((presentation) => presentation.isBase)?.id
    || ''
  ));
  const [expiryDate, setExpiryDate] = useState('');
  const [extraCosts, setExtraCosts] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplier, setSupplier] = useState('');
  const [isCustomSupplier, setIsCustomSupplier] = useState(false);
  const [saving, setSaving] = useState(false);
  const rowIdRef = useRef(0);

  // Si hay un borrador guardado para ESTE producto (compra en curso que se
  // interrumpió, p.ej. saliendo a la calculadora del celular), se restaura
  // en vez de arrancar en blanco. Si el producto cambia a otro sin borrador
  // coincidente, se arranca en blanco como siempre.
  useEffect(() => {
    const draft = initialDraft && initialDraft.productId === product.id ? initialDraft : null;

    // Sin borrador: el modal "recuerda" cómo se compró la última vez este
    // producto (modo y tamaño de caja), deducido del historial. Así reponer
    // algo recurrente es solo poner cuántas cajas y a cuánto.
    const learnedMode = lastPurchase?.purchaseUnitType === 'package' ? 'package' : 'unit';
    const learnedBoxSize = lastPurchase?.packageSize || product.packageSize || '';
    const configuredPurchaseOptions = (product.presentations || []).filter((presentation) => Number(presentation.factor) > 1);

    setSalePrice(draft ? (draft.salePrice ?? '') : String(product.price || ''));
    setSupplierPrice(draft ? (draft.supplierPrice ?? '') : String(product.supplierPrice || ''));
    setQuantity(draft ? (draft.quantity ?? '') : '');
    setPurchaseUnitType(configuredPurchaseOptions.length === 0
      ? 'unit'
      : (draft?.purchaseUnitType || learnedMode));
    setPackageSize(draft ? (draft.packageSize ?? '') : (learnedBoxSize ? String(learnedBoxSize) : ''));
    setPackageCount(draft ? (draft.packageCount ?? '') : '');
    const preferredPresentation = configuredPurchaseOptions.find((presentation) => (
      presentation.id === draft?.purchasePresentationId
    ));
    setPurchasePresentationId(
      preferredPresentation?.id
      || configuredPurchaseOptions[0]?.id
      || (product.presentations || []).find((presentation) => presentation.isBase)?.id
      || ''
    );
    setExpiryDate(draft?.expiryDate || '');
    setExtraCosts(draft && Array.isArray(draft.extraCosts)
      ? draft.extraCosts.map((r) => ({ id: ++rowIdRef.current, concept: r.concept, amount: r.amount, isCustom: true }))
      : []);
    setSupplier(draft?.supplier || '');
    setIsCustomSupplier(!!draft?.isCustomSupplier);
    if (!draft) setPurchaseBranchId(activeBranchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  useEffect(() => {
    let active = true;
    if (businessId) {
      getReplenishmentConcepts(businessId).then((list) => {
        if (active) setConcepts(list);
      });
    }
    return () => { active = false; };
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    const unsub = subscribeToSuppliers(businessId, setSuppliers);
    return unsub;
  }, [businessId]);

  function handleSupplierSelect(value) {
    if (value === CUSTOM_SUPPLIER_VALUE) {
      setSupplier('');
      setIsCustomSupplier(true);
    } else {
      setSupplier(value);
    }
  }

  function addExtraCostRow() {
    rowIdRef.current += 1;
    setExtraCosts((rows) => [...rows, { id: rowIdRef.current, concept: '', amount: '', isCustom: concepts.length === 0 }]);
  }

  function updateRow(id, patch) {
    setExtraCosts((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id) {
    setExtraCosts((rows) => rows.filter((r) => r.id !== id));
  }

  function handleConceptSelect(id, value) {
    if (value === CUSTOM_CONCEPT_VALUE) {
      updateRow(id, { concept: '', isCustom: true });
    } else {
      updateRow(id, { concept: value });
    }
  }

  const salePriceVal = Number(salePrice || 0);
  const costInputVal = Number(supplierPrice || 0);
  const configuredPurchaseOptions = (product.presentations || []).filter((presentation) => Number(presentation.factor) > 1);
  const configuredPurchasePresentation = configuredPurchaseOptions.find((presentation) => presentation.id === purchasePresentationId);
  const configuredPurchaseMode = Array.isArray(product.presentations) && product.presentations.length > 0;
  const packageSizeVal = configuredPurchaseMode
    ? Number(configuredPurchasePresentation?.factor || 0)
    : Number(packageSize || 0);
  const packageCountVal = Number(packageCount || 0);
  const qtyVal = purchaseUnitType === 'package'
    ? (packageCountVal > 0 && packageSizeVal > 0 ? calculatePurchaseBaseQuantity(packageCountVal, packageSizeVal) : 0)
    : Number(quantity || 0);
  const supplierPriceVal = purchaseUnitType === 'package'
    ? (packageSizeVal > 0 ? costInputVal / packageSizeVal : 0)
    : costInputVal;
  const totalExtra = extraCosts.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  // Mercadería = lo que se le paga AL PROVEEDOR (sin flete/taxi). En modo
  // paquete equivale a paquetes × costo por paquete; en modo unidad a
  // unidades × costo por unidad.
  const merchandiseTotal = supplierPriceVal * qtyVal;
  const totalCostVal = merchandiseTotal + totalExtra; // total desembolsado (con gastos extra)
  const costoUnitarioReal = qtyVal > 0 ? totalCostVal / qtyVal : supplierPriceVal;
  const profitMontoVal = salePriceVal - costoUnitarioReal;
  const profitPercentVal = salePriceVal > 0 ? (profitMontoVal / salePriceVal) * 100 : 0;

  // Nombre del producto acortado para no romper los labels largos.
  const shortName = product.name.length > 25 ? `${product.name.slice(0, 25).trim()}…` : product.name;

  // Alerta de venta a pérdida: solo cuando hay datos reales cargados y la
  // ganancia es negativa (si no, salta sola mientras el usuario tipea).
  const showLossAlert = salePriceVal > 0 && qtyVal > 0 && profitMontoVal < 0;
  // Sugerencia "quizás pusiste el total de todos los paquetes": solo aplica
  // en modo paquete con más de un paquete. Es el costo ingresado dividido
  // entre la cantidad de paquetes.
  const suggestedPackageCost = purchaseUnitType === 'package' && packageCountVal > 1
    ? costInputVal / packageCountVal
    : null;

  // Muestra el monto si es > 0, o marcador "__" para la frase parcial del resumen.
  const bsOr = (v) => (v > 0 ? formatBs(v) : 'Bs __');
  const numOr = (v) => (v > 0 ? v : '__');

  // Solo se persiste una vez que hay una cantidad real cargada — así no se
  // guarda (ni reabre el panel la próxima vez) por simplemente mirar un
  // producto sin llegar a cargar una compra de verdad.
  const draftPayloadRef = useRef(null);
  draftPayloadRef.current = qtyVal > 0 ? {
    productId: product.id,
    salePrice, supplierPrice, quantity, purchaseUnitType, packageSize, packageCount, purchasePresentationId,
    expiryDate, supplier, isCustomSupplier,
    extraCosts: extraCosts.map((r) => ({ concept: r.concept, amount: r.amount })),
  } : null;

  useEffect(() => {
    if (!businessId || !user?.uid) return;
    const timer = setTimeout(() => {
      if (draftPayloadRef.current) {
        savePurchaseDraft(businessId, user.uid, draftPayloadRef.current);
      } else {
        clearPurchaseDraft(businessId, user.uid);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [businessId, user?.uid, salePrice, supplierPrice, quantity, purchaseUnitType, packageSize, packageCount, purchasePresentationId, expiryDate, supplier, isCustomSupplier, extraCosts]);

  useEffect(() => {
    if (!businessId || !user?.uid) return;
    function flush() {
      if (draftPayloadRef.current) {
        savePurchaseDraft(businessId, user.uid, draftPayloadRef.current);
      }
    }
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') flush();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flush);
    };
  }, [businessId, user?.uid]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!salePrice || qtyVal <= 0) return;
    setSaving(true);
    try {
      const cleanExtraCosts = extraCosts
        .map((r) => ({ concept: (r.concept || '').trim(), amount: Number(r.amount || 0) }))
        .filter((r) => r.concept && r.amount > 0);

      // Conceptos nuevos tipeados al vuelo: se guardan en un solo write batcheado
      const newConceptNames = cleanExtraCosts
        .map((r) => r.concept)
        .filter((c) => !concepts.some((existing) => existing.toLowerCase() === c.toLowerCase()));
      if (newConceptNames.length > 0) {
        await addReplenishmentConcepts(businessId, newConceptNames);
      }

      const trimmedSupplier = supplier.trim();
      if (trimmedSupplier && !suppliers.some((s) => s.toLowerCase() === trimmedSupplier.toLowerCase())) {
        await addSupplier(businessId, trimmedSupplier);
      }

      const newStock = (product.stock || 0) + qtyVal;

      // Stock por sede (Fase 2): suma a la sede elegida y al total.
      await applyPurchaseStock({
        businessId,
        product,
        branchId: purchaseBranchId || activeBranchId,
        mainBranchId: branches.find((branch) => branch.isMain)?.id || null,
        qty: qtyVal,
        fields: {
          name: product.name,
          price: salePriceVal,
          minStock: product.minStock || 5,
          brand: product.brand || '',
          category: product.category || 'Otros',
          description: product.description || '',
          imageData: product.imageData || '',
          supplierPrice: costoUnitarioReal,
          unit: product.unit || 'Unidad',
          presentations: Array.isArray(product.presentations) && product.presentations.length > 0
            ? product.presentations.map((presentation) => (
              presentation.isBase ? { ...presentation, price: salePriceVal } : presentation
            ))
            : undefined,
          // Persistimos el tamaño de caja para que la próxima compra ya lo
          // traiga prellenado. En modo unidad no se pisa el valor existente.
          packageSize: !configuredPurchaseMode && purchaseUnitType === 'package'
            ? packageSizeVal
            : (product.packageSize || null),
        },
      });

      const replenishment = await addReplenishment(businessId, {
        productId: product.id,
        productName: product.name,
        supplier: trimmedSupplier,
        quantity: qtyVal,
        salePrice: salePriceVal,
        supplierPrice: supplierPriceVal,
        extraCosts: cleanExtraCosts,
        expiryDate: expiryDate || null,
        purchaseUnitType,
        packageSize: purchaseUnitType === 'package' ? packageSizeVal : null,
        packageCount: purchaseUnitType === 'package' ? packageCountVal : null,
      });

      await clearPurchaseDraft(businessId, user?.uid);

      setSuccessDetails({
        replenishmentId: replenishment?.id,
        productName: product.name,
        productBrand: product.brand || '',
        supplier: trimmedSupplier,
        quantity: qtyVal,
        supplierPriceUnit: supplierPriceVal,
        extraCostRows: cleanExtraCosts,
        totalCost: totalCostVal,
        newStock,
        time: new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (err) {
      console.error(err);
      alert('Error al reponer stock. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  function handleContinue() {
    setSuccessDetails(null);
    onSaved?.();
  }

  function handlePrintPurchase() {
    if (!successDetails) return;
    printReceipt({
      business,
      settings,
      type: 'purchase',
      saleId: successDetails.replenishmentId,
      items: [{
        quantity: successDetails.quantity,
        productName: successDetails.productName,
        productBrand: successDetails.productBrand,
        price: successDetails.supplierPriceUnit,
        subtotal: successDetails.supplierPriceUnit * successDetails.quantity,
      }],
      total: successDetails.totalCost,
      date: new Date(),
      supplier: successDetails.supplier,
      sellerName: user?.displayName || user?.email || '',
      extraCostRows: successDetails.extraCostRows,
    });
  }

  if (successDetails) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 cursor-pointer mg-backdrop-in" onClick={handleContinue}>
        <div
          className="bg-[var(--mg-bg-surface)] rounded-3xl p-6 w-full max-w-xs text-center shadow-2xl relative cursor-default mg-modal-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)]">
              <svg className="h-9 w-9 text-[var(--mg-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" className="mg-draw-check" />
              </svg>
            </div>
          </div>

          <h3 className="text-lg font-black text-[var(--mg-text-primary)]">Compra registrada</h3>
          <p className="my-2 text-3xl font-black text-[var(--mg-success-text)]">{formatBs(successDetails.totalCost)}</p>

          <div className="bg-[var(--mg-bg-elevated)] rounded-2xl p-3 text-left text-xs space-y-1.5 border border-[var(--mg-border)] my-4 text-[var(--mg-text-secondary)]">
            <div className="flex justify-between">
              <span className="text-[var(--mg-text-muted)] font-medium">Producto:</span>
              <span className="font-bold text-[var(--mg-text-primary)] truncate max-w-[140px]">{successDetails.productName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--mg-text-muted)] font-medium">Proveedor:</span>
              <span className="font-semibold">{successDetails.supplier || 'Sin proveedor'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--mg-text-muted)] font-medium">Cantidad:</span>
              <span className="font-semibold">{successDetails.quantity} unidades</span>
            </div>
            {successDetails.extraCostRows.length > 0 && (
              <div className="flex justify-between">
                <span className="text-[var(--mg-text-muted)] font-medium">Gastos extra:</span>
                <span className="font-semibold">{formatBs(successDetails.extraCostRows.reduce((s, r) => s + Number(r.amount || 0), 0))}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[var(--mg-text-muted)] font-medium">Stock nuevo:</span>
              <span className="font-bold text-[var(--mg-text-primary)]">{successDetails.newStock} unidades</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--mg-text-muted)] font-medium">Hora:</span>
              <span className="font-semibold">{successDetails.time}</span>
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={handlePrintPurchase}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] py-2.5 text-xs font-bold text-[var(--mg-brand-text)] shadow-sm transition-all hover:bg-[var(--mg-border-hover)] active:scale-95"
            >
              <AppIcon name="recibo" size={14} /> Imprimir detalle
            </button>
            <button
              type="button"
              onClick={handleContinue}
              className="w-full rounded-xl bg-[var(--mg-brand)] py-3 text-xs font-bold text-[var(--mg-brand-contrast)] shadow-sm transition-all hover:bg-[var(--mg-brand-hover)] active:scale-95"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-5 pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--mg-text-muted)]">Entrada de inventario</p>
          <h3 className="text-xl font-black tracking-tight text-[var(--mg-brand-text)]">Registrar compra</h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={() => { clearPurchaseDraft(businessId, user?.uid); onClose(); }}
            title="Cambiar producto"
            aria-label="Cerrar y cambiar producto"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]"
          >
            <AppIcon name="cerrar" size={15} />
          </button>
        )}
      </div>

      {/* Encabezado del producto seleccionado */}
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] p-3.5">
            <ProductImage imageData={product.imageData} name={product.name} />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--mg-text-muted)]">Producto seleccionado</p>
              <p className="mt-0.5 truncate text-base font-black text-[var(--mg-text-primary)]">{product.name}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-[var(--mg-text-muted)]">
                {product.brand && `${product.brand} · `}Stock{branches.length > 1 ? ` en ${(branches.find((b) => b.id === (purchaseBranchId || activeBranchId))?.name) || 'sede'}` : ''}: <strong className="text-[var(--mg-text-secondary)]">{product.stock} und.</strong>
              </p>
              {lastPurchase && (
                <p className="mt-1 flex items-start gap-1 text-[11px] font-semibold text-[var(--mg-brand-text)]">
                  <AppIcon name="paquete" size={12} />
                  {lastPurchase.purchaseUnitType === 'package' && lastPurchase.packageSize
                    ? `La última vez lo compraste por caja de ${lastPurchase.packageSize}.`
                    : 'La última vez lo compraste por unidad.'}
                </p>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Sede donde entra la mercadería (solo si hay varias) */}
            {branches.length > 1 && (
              <div>
                <label className="text-sm font-bold text-[var(--mg-text-primary)] block mb-2">¿A qué sede entra?</label>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {branches.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setPurchaseBranchId(b.id)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                        (purchaseBranchId || activeBranchId) === b.id
                          ? 'border-[var(--mg-brand)] bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]'
                          : 'border-[var(--mg-border)] text-[var(--mg-text-muted)]'
                      }`}
                    >
                      <AppIcon name={b.type === 'almacen' ? 'almacen' : 'tienda'} size={14} />
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* ¿Cómo te vendió el proveedor? — tarjetas seleccionables */}
            <div>
              <label className="text-sm font-bold text-[var(--mg-text-primary)] block mb-2">¿Cómo te vendió el proveedor?</label>
              <div className="grid grid-cols-1 gap-2.5">
                {/* Tarjeta A — Por unidad */}
                <button
                  type="button"
                  onClick={() => {
                    if (purchaseUnitType !== 'unit') setSupplierPrice('');
                    setPurchaseUnitType('unit');
                  }}
                  className={`text-left p-3.5 rounded-2xl border transition-all active:scale-[0.98] ${
                    purchaseUnitType === 'unit'
                      ? 'border-[var(--mg-brand)] bg-[var(--mg-brand-bg)]'
                      : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${purchaseUnitType === 'unit' ? 'border-[var(--mg-brand)] bg-[var(--mg-brand)]' : 'border-[var(--mg-border-hover)]'}`}>
                      {purchaseUnitType === 'unit' && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-[var(--mg-text-primary)] flex items-center justify-between gap-2">
                        Por unidad
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Ayuda: comprar por unidad"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHelpTopic(helpTopic === 'unit' ? null : 'unit'); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setHelpTopic(helpTopic === 'unit' ? null : 'unit'); } }}
                          className="shrink-0 w-6 h-6 rounded-full bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] flex items-center justify-center"
                        >
                          <AppIcon name="ayuda" size={14} />
                        </span>
                      </p>
                      <p className="text-xs text-[var(--mg-text-secondary)] mt-0.5">Compré unidades sueltas</p>
                      <p className="text-[11px] text-[var(--mg-text-faint)] mt-1 italic">Ej: 12 botellas sueltas a Bs 8 cada una</p>
                      {helpTopic === 'unit' && (
                        <p className="mt-1.5 rounded-lg border border-[var(--mg-brand-border)] bg-[var(--mg-bg-surface)] px-2 py-1.5 text-[11px] font-semibold text-[var(--mg-brand-text)]">
                          Elegí esto si el proveedor te cobra por cada unidad suelta. El costo que pongas abajo es el de UNA unidad.
                        </p>
                      )}
                    </div>
                  </div>
                </button>
                {(!configuredPurchaseMode || configuredPurchaseOptions.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    if (purchaseUnitType !== 'package') setSupplierPrice('');
                    setPurchaseUnitType('package');
                  }}
                  className={`text-left p-3.5 rounded-2xl border transition-all active:scale-[0.98] ${
                    purchaseUnitType === 'package'
                      ? 'border-[var(--mg-brand)] bg-[var(--mg-brand-bg)]'
                      : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${purchaseUnitType === 'package' ? 'border-[var(--mg-brand)] bg-[var(--mg-brand)]' : 'border-[var(--mg-border-hover)]'}`}>
                      {purchaseUnitType === 'package' && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-[var(--mg-text-primary)] flex items-center justify-between gap-2">
                        {configuredPurchaseMode ? 'Por presentación' : 'Por paquete / caja'}
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Ayuda: comprar por paquete"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHelpTopic(helpTopic === 'pack' ? null : 'pack'); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setHelpTopic(helpTopic === 'pack' ? null : 'pack'); } }}
                          className="shrink-0 w-6 h-6 rounded-full bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] flex items-center justify-center"
                        >
                          <AppIcon name="ayuda" size={14} />
                        </span>
                      </p>
                      <p className="text-xs text-[var(--mg-text-secondary)] mt-0.5">
                        {configuredPurchaseMode
                          ? 'Compré un empaque configurado para este producto.'
                          : 'Compré cajas, pacas o fardos que traen varias unidades adentro'}
                      </p>
                      <p className="text-[11px] text-[var(--mg-text-faint)] mt-1 italic">
                        {configuredPurchaseMode
                          ? 'La conversión usa el factor configurado en Inventario.'
                          : 'Ej: 10 cajas de 12 botellas, cada caja a Bs 84'}
                      </p>
                      {helpTopic === 'pack' && (
                        <p className="mt-1.5 rounded-lg border border-[var(--mg-brand-border)] bg-[var(--mg-bg-surface)] px-2 py-1.5 text-[11px] font-semibold text-[var(--mg-brand-text)]">
                          {configuredPurchaseMode
                            ? 'Elegí esta opción y seleccioná el empaque recibido. El costo ingresado es por cada empaque.'
                            : 'Elegí esto si pagás por caja cerrada. Abajo poné cuántas cajas compraste, cuántas unidades trae cada una y el costo POR CAJA: la app saca sola el costo por unidad.'}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
                )}
              </div>
            </div>

            {/* Cantidad(es) */}
            {purchaseUnitType === 'package' ? (
              <div>
      <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">
                      {configuredPurchaseMode ? '¿Cuántas presentaciones compraste? *' : '¿Cuántos paquetes compraste? *'}
                    </label>
                    <input
                      type="number" step="1" min="1" max="9999"
                      value={packageCount}
                      onChange={(e) => setPackageCount(clampNumberInput(e.target.value, { min: 1, max: 9999 }))}
                      onKeyDown={blockInvalidNumberKeys}
                      placeholder="Ej: 10"
                      className="mg-input py-2 text-sm font-bold"
                      required
                    />
                  </div>
                  <div>
                    {configuredPurchaseMode ? (
                      <>
                        <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">Presentación recibida *</label>
                        <select
                          value={purchasePresentationId}
                          onChange={(e) => {
                            setPurchasePresentationId(e.target.value);
                            setSupplierPrice('');
                          }}
                          className="mg-input py-2 text-sm font-bold"
                          required
                        >
                          {configuredPurchaseOptions.map((presentation) => (
                            <option key={presentation.id} value={presentation.id}>
                              {presentation.name} (x{presentation.factor})
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <>
                        <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">¿Cuántas unidades trae cada paquete? *</label>
                        <input
                          type="number" step="1" min="1" max="9999"
                          value={packageSize}
                          onChange={(e) => setPackageSize(clampNumberInput(e.target.value, { min: 1, max: 9999 }))}
                          onKeyDown={blockInvalidNumberKeys}
                          placeholder="Ej: 12"
                          className="mg-input py-2 text-sm font-bold"
                          required
                        />
                      </>
                    )}
                  </div>
                </div>
                {packageCountVal > 0 && packageSizeVal > 0 && (
                  <p className="mt-1.5 text-xs font-bold text-[var(--mg-brand-text)]">= {qtyVal} unidades totales</p>
                )}
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">¿Cuántas unidades compraste? *</label>
                <input
                  type="number" step="1" min="1" max="999999"
                  value={quantity}
                  onChange={(e) => setQuantity(clampNumberInput(e.target.value, { min: 1, max: 999999 }))}
                  onKeyDown={blockInvalidNumberKeys}
                  placeholder="Ej: 10"
                  className="mg-input py-2 text-sm font-bold"
                  required
                />
              </div>
            )}

            {/* Costo */}
            <div>
              <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">
                {purchaseUnitType === 'package' ? (
                  configuredPurchaseMode
                    ? <>¿Cuánto te costó <strong className="text-[var(--mg-text-primary)]">CADA</strong> {configuredPurchasePresentation?.name || 'presentación'}? *</>
                    : <>¿Cuánto te costó <strong className="text-[var(--mg-text-primary)]">CADA</strong> paquete{packageSizeVal > 0 ? ` de ${packageSizeVal}` : ''} {shortName}? *</>
                ) : (
                  <>¿Cuánto te costó <strong className="text-[var(--mg-text-primary)]">CADA</strong> {shortName}? *</>
                )}
              </label>
              <input
                type="number" step="0.01" min="0" max="999999"
                value={supplierPrice}
                onChange={(e) => setSupplierPrice(clampNumberInput(e.target.value, { max: 999999 }))}
                onKeyDown={blockInvalidNumberKeys}
                placeholder="0.00"
                className="mg-input py-2 text-sm font-bold"
              />
              {purchaseUnitType === 'package' && (
                <p className="text-[11px] text-[var(--mg-text-faint)] mt-1">
                  {configuredPurchaseMode ? 'El costo de una presentación, no el total de todas.' : 'El precio de una sola caja, no el total de todas.'}
                </p>
              )}
            </div>

            {/* Precio de venta */}
            <div>
              <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">
                ¿A cuánto vas a vender <strong className="text-[var(--mg-text-primary)]">CADA</strong> {shortName} al público? *
              </label>
              <input
                type="number" step="0.01" min="0" max="999999"
                value={salePrice}
                onChange={(e) => setSalePrice(clampNumberInput(e.target.value, { max: 999999 }))}
                onKeyDown={blockInvalidNumberKeys}
                placeholder="0.00"
                className="mg-input py-2 text-sm font-bold"
                required
              />
              {purchaseUnitType === 'package' && (
                <p className="text-[11px] text-[var(--mg-text-faint)] mt-1">Siempre el precio de 1 unidad suelta, aunque hayas comprado por caja.</p>
              )}
            </div>

            {/* Fecha de vencimiento */}
            <div>
              <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">Fecha de vencimiento (opcional)</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="mg-input py-2 text-sm font-semibold"
              />
            </div>

            {/* Proveedor */}
            <div>
              <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">Proveedor</label>
              {isCustomSupplier ? (
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Nombre del proveedor"
                  autoFocus
                  className="mg-input py-2 text-sm font-semibold"
                />
              ) : (
                <select
                  value={supplier}
                  onChange={(e) => handleSupplierSelect(e.target.value)}
                  className="mg-input py-2 text-sm font-semibold"
                >
                  <option value="">Sin proveedor</option>
                  {suppliers.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  <option value={CUSTOM_SUPPLIER_VALUE}>+ Escribir otro...</option>
                </select>
              )}
            </div>

            {/* Gastos Extra Dinámicos */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-xs font-bold text-[var(--mg-text-muted)]">Gastos extra de adquisición</p>
                <span
                  title="Flete, taxi, carguío o cualquier gasto del viaje completo. Se reparte entre todas las unidades que compraste."
                  className="w-4 h-4 rounded-full bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] text-[var(--mg-text-muted)] text-[10px] font-black flex items-center justify-center cursor-help shrink-0"
                >
                  ?
                </span>
              </div>
              <p className="text-[11px] text-[var(--mg-text-faint)] -mt-1 mb-2">Flete, taxi, carguío… se reparte entre todas las unidades.</p>

              <div className="space-y-2">
                {extraCosts.map((row) => (
                  <div key={row.id} className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      {row.isCustom ? (
                        <input
                          type="text"
                          value={row.concept}
                          onChange={(e) => updateRow(row.id, { concept: e.target.value })}
                          placeholder="Nombre del gasto"
                          autoFocus
                          className="mg-input px-2.5 py-2 text-xs font-semibold"
                        />
                      ) : (
                        <select
                          value={row.concept}
                          onChange={(e) => handleConceptSelect(row.id, e.target.value)}
                          className="mg-input px-2.5 py-2 text-xs font-semibold"
                        >
                          <option value="" disabled>Concepto...</option>
                          {concepts.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                          <option value={CUSTOM_CONCEPT_VALUE}>+ Escribir otro...</option>
                        </select>
                      )}
                    </div>
                    <div className="w-24 shrink-0">
                      <input
                        type="number" step="0.01" min="0" max="999999"
                        value={row.amount}
                        onChange={(e) => updateRow(row.id, { amount: clampNumberInput(e.target.value, { max: 999999 }) })}
                        onKeyDown={blockInvalidNumberKeys}
                        placeholder="0.00"
                        className="mg-input px-2 py-2 text-xs font-semibold"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] active:scale-95"
                      aria-label="Quitar gasto"
                    >
                      <AppIcon name="cerrar" size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addExtraCostRow}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--mg-brand-border)] py-2 text-xs font-bold text-[var(--mg-brand-text)] transition-colors hover:bg-[var(--mg-brand-bg)] active:scale-95"
              >
                <AppIcon name="agregar" size={14} /> Agregar gasto extra
              </button>
            </div>

            {/* Resumen en lenguaje natural — solo dueño (muestra costos y ganancia) */}
            {canSeeCosts && (
            <div className="rounded-2xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] p-3.5 text-sm leading-relaxed text-[var(--mg-text-secondary)]">
              <p>
                {purchaseUnitType === 'package' ? (
                  configuredPurchaseMode
                    ? <>Estás comprando <strong className="text-[var(--mg-text-primary)]">{numOr(packageCountVal)}</strong> {configuredPurchasePresentation?.name || 'presentaciones'} × <strong className="text-[var(--mg-text-primary)]">{numOr(packageSizeVal)}</strong> unidades = <strong className="text-[var(--mg-text-primary)]">{numOr(qtyVal)}</strong> unidades base de {shortName}. </>
                    : <>Estás comprando <strong className="text-[var(--mg-text-primary)]">{numOr(packageCountVal)}</strong> paquetes × <strong className="text-[var(--mg-text-primary)]">{numOr(packageSizeVal)}</strong> unidades = <strong className="text-[var(--mg-text-primary)]">{numOr(qtyVal)}</strong> unidades de {shortName}. </>
                ) : (
                  <>Estás comprando <strong className="text-[var(--mg-text-primary)]">{numOr(qtyVal)}</strong> unidades de {shortName}. </>
                )}
                Le pagás <strong className="text-[var(--mg-text-primary)]">{bsOr(merchandiseTotal)}</strong> al proveedor por la mercadería
                {totalExtra > 0 && <> (más {formatBs(totalExtra)} de gastos extra)</>}. Cada unidad te sale a <strong className="text-[var(--mg-text-primary)]">{bsOr(costoUnitarioReal)}</strong> y la vendés a <strong className="text-[var(--mg-text-primary)]">{bsOr(salePriceVal)}</strong>.
                {salePriceVal > 0 && qtyVal > 0 && (
                  <> <strong className={profitMontoVal >= 0 ? 'text-[var(--mg-success-text)]' : 'text-[var(--mg-danger)]'}>
                    {profitMontoVal >= 0 ? 'Ganás' : 'Perdés'} {formatBs(Math.abs(profitMontoVal))} por unidad ({profitPercentVal.toFixed(1)}% del precio de venta).
                  </strong></>
                )}
              </p>
              {/* Lo que realmente importa: ganancia total si vende TODO */}
              {salePriceVal > 0 && qtyVal > 0 && (
                <div className={`mt-2.5 rounded-xl px-3 py-2.5 text-center text-sm font-black ${profitMontoVal >= 0 ? 'bg-[var(--mg-success)] text-white' : 'bg-[var(--mg-danger)] text-white'}`}>
                  Si vendés {purchaseUnitType === 'package' ? 'todo' : `las ${qtyVal} unidades`} — {profitMontoVal >= 0 ? 'ganás' : 'perdés'} {formatBs(Math.abs(profitMontoVal) * qtyVal)} en total
                </div>
              )}
            </div>
            )}

            {/* Alerta de venta a pérdida (advertencia, no bloqueo) */}
            {canSeeCosts && showLossAlert && (
              <div className="rounded-2xl border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] p-3.5">
                <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-[var(--mg-gold-text)]">
                  <AppIcon name="ayuda" size={15} /> Estás vendiendo a pérdida
                </p>
                <p className="text-xs text-[var(--mg-text-secondary)] leading-relaxed">
                  Cada unidad te cuesta <strong>{formatBs(costoUnitarioReal)}</strong> y la vendés a <strong>{formatBs(salePriceVal)}</strong>.{' '}
                  {suggestedPackageCost !== null ? (
                    <>¿Será que {formatBs(costInputVal)} es el costo de los {packageCountVal} paquetes y no de uno solo? Si es así, poné <strong>{formatBs(suggestedPackageCost)}</strong> como costo por paquete.</>
                  ) : (
                    <>¿{formatBs(costInputVal)} es lo que te costó una sola unidad o todo el lote?</>
                  )}
                </p>
              </div>
            )}

            {/* Bloques CALCULADOS (no editables) — solo dueño */}
            {canSeeCosts && qtyVal > 0 && (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="relative rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3 text-center">
                  <span className="absolute right-2 top-1.5 text-[8px] font-bold uppercase tracking-wider text-[var(--mg-text-faint)]">Calculado</span>
                  <p className="mt-2 text-[10px] font-semibold uppercase text-[var(--mg-text-muted)]">Costo real por unidad</p>
                  <p className="mt-0.5 text-base font-black text-[var(--mg-brand-text)]">{formatBs(costoUnitarioReal)}</p>
                </div>
                <div className="relative rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3 text-center">
                  <span className="absolute right-2 top-1.5 text-[8px] font-bold uppercase tracking-wider text-[var(--mg-text-faint)]">Calculado</span>
                  <p className="mt-2 text-[10px] font-semibold uppercase text-[var(--mg-text-muted)]">Ganancia por unidad</p>
                  <p className={`mt-0.5 text-base font-black ${profitMontoVal >= 0 ? 'text-[var(--mg-success-text)]' : 'text-[var(--mg-danger)]'}`}>
                    {formatBs(profitMontoVal)} <span className="text-xs">({profitPercentVal.toFixed(1)}%)</span>
                  </p>
                </div>
              </div>
            )}

            {/* Desglose de lo que se desembolsa — el número que el tendero tiene en la mano */}
            {qtyVal > 0 && (
              <div className="space-y-1.5 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3.5 text-sm">
                <div className="flex justify-between items-center text-[var(--mg-text-secondary)]">
                  <span>Mercadería {purchaseUnitType === 'package' ? `(${packageCountVal} × ${formatBs(costInputVal)})` : `(${qtyVal} × ${formatBs(costInputVal)})`}</span>
                  <span className="font-semibold">{formatBs(merchandiseTotal)}</span>
                </div>
                <div className="flex justify-between items-center text-[var(--mg-text-secondary)]">
                  <span>Gastos extra (flete, taxi…)</span>
                  <span className="font-semibold">{formatBs(totalExtra)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-[var(--mg-border)] pt-2 mt-1">
                  <span className="font-black text-[var(--mg-text-primary)]">Total desembolsado</span>
                  <span className="text-lg font-black text-[var(--mg-brand-text)]">{formatBs(totalCostVal)}</span>
                </div>
                <p className="text-[10px] text-[var(--mg-text-faint)] font-bold pt-1">
                  Stock final tras compra: <strong className="text-[var(--mg-text-secondary)]">{(product.stock || 0) + qtyVal} unidades</strong>
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !salePrice || qtyVal <= 0}
              className="mt-2 w-full rounded-2xl bg-[var(--mg-brand)] py-3.5 text-sm font-bold text-[var(--mg-brand-contrast)] shadow-sm transition-all hover:bg-[var(--mg-brand-hover)] active:scale-95 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Confirmar compra'}
            </button>
          </form>
    </div>
  );
}
