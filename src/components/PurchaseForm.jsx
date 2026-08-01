import { useState, useEffect, useRef } from 'react';
import { addReplenishment, updateProduct } from '../services/products';
import { getReplenishmentConcepts, addReplenishmentConcepts } from '../services/replenishmentConcepts';
import { subscribeToSuppliers, addSupplier } from '../services/suppliers';
import { clampNumberInput, blockInvalidNumberKeys } from '../utils/numberInput';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { printReceipt } from './Receipt';
import { savePurchaseDraft, clearPurchaseDraft } from '../services/purchaseDraft';

function formatBs(amount) {
  return `Bs ${Number(amount || 0).toFixed(2)}`;
}

function ProductImage({ imageData, name }) {
  if (!imageData) {
    return (
      <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center shrink-0 text-2xl">
        📦
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
  const { user } = useAuth();
  const { business, settings } = useBusiness();
  const [successDetails, setSuccessDetails] = useState(null);
  const [salePrice, setSalePrice] = useState(String(product.price || ''));
  const [supplierPrice, setSupplierPrice] = useState(String(product.supplierPrice || ''));
  const [quantity, setQuantity] = useState('');
  const [purchaseUnitType, setPurchaseUnitType] = useState('unit');
  const [packageSize, setPackageSize] = useState(product.packageSize ? String(product.packageSize) : '');
  const [packageCount, setPackageCount] = useState('');
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

    setSalePrice(draft ? (draft.salePrice ?? '') : String(product.price || ''));
    setSupplierPrice(draft ? (draft.supplierPrice ?? '') : String(product.supplierPrice || ''));
    setQuantity(draft ? (draft.quantity ?? '') : '');
    setPurchaseUnitType(draft?.purchaseUnitType || learnedMode);
    setPackageSize(draft ? (draft.packageSize ?? '') : (learnedBoxSize ? String(learnedBoxSize) : ''));
    setPackageCount(draft ? (draft.packageCount ?? '') : '');
    setExpiryDate(draft?.expiryDate || '');
    setExtraCosts(draft && Array.isArray(draft.extraCosts)
      ? draft.extraCosts.map((r) => ({ id: ++rowIdRef.current, concept: r.concept, amount: r.amount, isCustom: true }))
      : []);
    setSupplier(draft?.supplier || '');
    setIsCustomSupplier(!!draft?.isCustomSupplier);
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
  const packageSizeVal = Number(packageSize || 0);
  const packageCountVal = Number(packageCount || 0);
  const qtyVal = purchaseUnitType === 'package' ? packageCountVal * packageSizeVal : Number(quantity || 0);
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
    salePrice, supplierPrice, quantity, purchaseUnitType, packageSize, packageCount,
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
  }, [businessId, user?.uid, salePrice, supplierPrice, quantity, purchaseUnitType, packageSize, packageCount, expiryDate, supplier, isCustomSupplier, extraCosts]);

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

      // Stock y costo del producto: responsabilidad del caller (ver fix de Prioridad 1)
      await updateProduct(product.id, {
        name: product.name,
        price: salePriceVal,
        stock: newStock,
        expectedStock: product.stock,
        minStock: product.minStock || 5,
        brand: product.brand || '',
        category: product.category || 'Otros',
        description: product.description || '',
        imageData: product.imageData || '',
        supplierPrice: costoUnitarioReal,
        unit: product.unit || 'Unidad',
        // Persistimos el tamaño de caja para que la próxima compra ya lo
        // traiga prellenado. En modo unidad no se pisa el valor existente.
        packageSize: purchaseUnitType === 'package' ? packageSizeVal : (product.packageSize || null),
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
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[var(--mg-accent-bg)] rounded-full flex items-center justify-center border-2 border-[var(--mg-accent-border)]">
              <svg className="w-9 h-9 text-[var(--mg-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" className="mg-draw-check" />
              </svg>
            </div>
          </div>

          <h3 className="text-lg font-black text-[var(--mg-text-primary)]">¡Compra Registrada!</h3>
          <p className="text-3xl font-black text-[var(--mg-accent)] my-2">{formatBs(successDetails.totalCost)}</p>

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
              className="w-full bg-[var(--mg-accent-bg)] hover:bg-[var(--mg-accent-border)] text-[var(--mg-accent)] font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"
            >
              🖨️ Imprimir detalle
            </button>
            <button
              type="button"
              onClick={handleContinue}
              className="w-full bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white font-bold py-3 rounded-xl text-xs active:scale-95 transition-all shadow-md"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 pb-10 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-[var(--mg-text-primary)]">Registrar compra</h3>
        {onClose && (
          <button
            onClick={() => { clearPurchaseDraft(businessId, user?.uid); onClose(); }}
            title="Cambiar producto"
            className="w-8 h-8 bg-[var(--mg-bg-elevated)] rounded-full flex items-center justify-center text-[var(--mg-text-muted)] font-bold text-lg">×</button>
        )}
      </div>

      {/* Encabezado del producto seleccionado */}
          <div className="bg-[var(--mg-bg-elevated)] p-3.5 rounded-2xl border border-[var(--mg-border)] flex items-center gap-3">
            <ProductImage imageData={product.imageData} name={product.name} />
            <div className="min-w-0">
              <p className="text-xs text-[var(--mg-text-muted)] font-semibold uppercase tracking-wider">Producto seleccionado</p>
              <p className="font-black text-[var(--mg-text-primary)] text-base truncate mt-0.5">{product.name}</p>
              <p className="text-xs text-[var(--mg-text-faint)] font-semibold mt-0.5">
                {product.brand && `${product.brand} · `}Stock actual: <strong className="text-[var(--mg-text-secondary)]">{product.stock} und.</strong>
              </p>
              {lastPurchase && (
                <p className="text-[11px] text-[var(--mg-accent)] font-semibold mt-1">
                  {lastPurchase.purchaseUnitType === 'package' && lastPurchase.packageSize
                    ? `📦 La última vez lo compraste por caja de ${lastPurchase.packageSize}.`
                    : '📦 La última vez lo compraste por unidad.'}
                </p>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  className={`text-left p-3.5 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                    purchaseUnitType === 'unit'
                      ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)]'
                      : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${purchaseUnitType === 'unit' ? 'border-[var(--mg-accent)] bg-[var(--mg-accent)]' : 'border-gray-300'}`}>
                      {purchaseUnitType === 'unit' && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-[var(--mg-text-primary)]">Por unidad</p>
                      <p className="text-xs text-[var(--mg-text-secondary)] mt-0.5">Compré unidades sueltas</p>
                      <p className="text-[11px] text-[var(--mg-text-faint)] mt-1 italic">Ej: 12 botellas sueltas a Bs 8 cada una</p>
                    </div>
                  </div>
                </button>
                {/* Tarjeta B — Por paquete / caja */}
                <button
                  type="button"
                  onClick={() => {
                    if (purchaseUnitType !== 'package') setSupplierPrice('');
                    setPurchaseUnitType('package');
                  }}
                  className={`text-left p-3.5 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                    purchaseUnitType === 'package'
                      ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)]'
                      : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${purchaseUnitType === 'package' ? 'border-[var(--mg-accent)] bg-[var(--mg-accent)]' : 'border-gray-300'}`}>
                      {purchaseUnitType === 'package' && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-[var(--mg-text-primary)]">Por paquete / caja</p>
                      <p className="text-xs text-[var(--mg-text-secondary)] mt-0.5">Compré cajas, pacas o fardos que traen varias unidades adentro</p>
                      <p className="text-[11px] text-[var(--mg-text-faint)] mt-1 italic">Ej: 10 cajas de 12 botellas, cada caja a Bs 84</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Cantidad(es) */}
            {purchaseUnitType === 'package' ? (
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">¿Cuántos paquetes compraste? *</label>
                    <input
                      type="number" step="1" min="1" max="9999"
                      value={packageCount}
                      onChange={(e) => setPackageCount(clampNumberInput(e.target.value, { min: 1, max: 9999 }))}
                      onKeyDown={blockInvalidNumberKeys}
                      placeholder="Ej: 10"
                      className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--mg-accent-border)] font-bold text-[var(--mg-text-primary)]"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">¿Cuántas unidades trae cada paquete? *</label>
                    <input
                      type="number" step="1" min="1" max="9999"
                      value={packageSize}
                      onChange={(e) => setPackageSize(clampNumberInput(e.target.value, { min: 1, max: 9999 }))}
                      onKeyDown={blockInvalidNumberKeys}
                      placeholder="Ej: 12"
                      className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--mg-accent-border)] font-bold text-[var(--mg-text-primary)]"
                      required
                    />
                  </div>
                </div>
                {packageCountVal > 0 && packageSizeVal > 0 && (
                  <p className="text-xs font-bold text-[var(--mg-accent)] mt-1.5">= {qtyVal} unidades totales</p>
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
                  className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--mg-accent-border)] font-bold text-[var(--mg-text-primary)]"
                  required
                />
              </div>
            )}

            {/* Costo */}
            <div>
              <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">
                {purchaseUnitType === 'package' ? (
                  <>¿Cuánto te costó <strong className="text-[var(--mg-text-primary)]">CADA</strong> paquete{packageSizeVal > 0 ? ` de ${packageSizeVal}` : ''} {shortName}? *</>
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
                className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--mg-accent-border)] font-bold text-[var(--mg-text-primary)]"
              />
              {purchaseUnitType === 'package' && (
                <p className="text-[11px] text-[var(--mg-text-faint)] mt-1">El precio de una sola caja, no el total de todas.</p>
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
                className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--mg-accent-border)] font-bold text-[var(--mg-text-primary)]"
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
                className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--mg-accent-border)] font-semibold text-[var(--mg-text-secondary)]"
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
                  className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--mg-accent-border)] font-semibold text-[var(--mg-text-secondary)]"
                />
              ) : (
                <select
                  value={supplier}
                  onChange={(e) => handleSupplierSelect(e.target.value)}
                  className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--mg-accent-border)] font-semibold text-[var(--mg-text-secondary)] bg-[var(--mg-bg-surface)]"
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
                          className="w-full border-2 border-[var(--mg-border)] rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-[var(--mg-accent-border)] font-semibold text-[var(--mg-text-secondary)]"
                        />
                      ) : (
                        <select
                          value={row.concept}
                          onChange={(e) => handleConceptSelect(row.id, e.target.value)}
                          className="w-full border-2 border-[var(--mg-border)] rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-[var(--mg-accent-border)] font-semibold text-[var(--mg-text-secondary)] bg-[var(--mg-bg-surface)]"
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
                        className="w-full border-2 border-[var(--mg-border)] rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-[var(--mg-accent-border)] font-semibold text-[var(--mg-text-secondary)]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="w-8 h-8 mt-0.5 shrink-0 bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] rounded-full flex items-center justify-center font-bold text-sm active:scale-95"
                      aria-label="Quitar gasto"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addExtraCostRow}
                className="w-full mt-2 border-2 border-dashed border-[var(--mg-accent-border)] text-[var(--mg-accent)] rounded-xl py-2 text-xs font-bold active:scale-95"
              >
                + Agregar gasto extra
              </button>
            </div>

            {/* Resumen en lenguaje natural — se arma en vivo mientras se escribe */}
            <div className="bg-[var(--mg-accent-bg)] border border-[var(--mg-accent-border)] rounded-2xl p-3.5 text-sm leading-relaxed text-[var(--mg-text-secondary)]">
              <p>
                {purchaseUnitType === 'package' ? (
                  <>Estás comprando <strong className="text-[var(--mg-text-primary)]">{numOr(packageCountVal)}</strong> paquetes × <strong className="text-[var(--mg-text-primary)]">{numOr(packageSizeVal)}</strong> unidades = <strong className="text-[var(--mg-text-primary)]">{numOr(qtyVal)}</strong> unidades de {shortName}. </>
                ) : (
                  <>Estás comprando <strong className="text-[var(--mg-text-primary)]">{numOr(qtyVal)}</strong> unidades de {shortName}. </>
                )}
                Le pagás <strong className="text-[var(--mg-text-primary)]">{bsOr(merchandiseTotal)}</strong> al proveedor por la mercadería
                {totalExtra > 0 && <> (más {formatBs(totalExtra)} de gastos extra)</>}. Cada unidad te sale a <strong className="text-[var(--mg-text-primary)]">{bsOr(costoUnitarioReal)}</strong> y la vendés a <strong className="text-[var(--mg-text-primary)]">{bsOr(salePriceVal)}</strong>.
                {salePriceVal > 0 && qtyVal > 0 && (
                  <> <strong className={profitMontoVal >= 0 ? 'text-green-700' : 'text-red-600'}>
                    {profitMontoVal >= 0 ? 'Ganás' : 'Perdés'} {formatBs(Math.abs(profitMontoVal))} por unidad ({profitPercentVal.toFixed(1)}% del precio de venta).
                  </strong></>
                )}
              </p>
            </div>

            {/* Alerta de venta a pérdida (advertencia, no bloqueo) */}
            {showLossAlert && (
              <div className="bg-[var(--mg-warning-bg)] border-2 border-[var(--mg-warning)] rounded-2xl p-3.5">
                <p className="text-sm font-bold text-[var(--mg-warning)] mb-1 flex items-center gap-1.5">
                  <span>⚠️</span> Estás vendiendo a pérdida
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

            {/* Bloques CALCULADOS (no editables) */}
            {qtyVal > 0 && (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-[var(--mg-bg-elevated)] p-3 rounded-2xl text-center relative">
                  <span className="absolute top-1.5 right-2 text-[8px] font-bold uppercase tracking-wider text-[var(--mg-text-faint)]">🔒 calculado</span>
                  <p className="text-[10px] text-[var(--mg-text-faint)] uppercase font-semibold mt-2">Costo real por unidad</p>
                  <p className="text-base font-black mt-0.5 text-[var(--mg-accent)]">{formatBs(costoUnitarioReal)}</p>
                </div>
                <div className="bg-[var(--mg-bg-elevated)] p-3 rounded-2xl text-center relative">
                  <span className="absolute top-1.5 right-2 text-[8px] font-bold uppercase tracking-wider text-[var(--mg-text-faint)]">🔒 calculado</span>
                  <p className="text-[10px] text-[var(--mg-text-faint)] uppercase font-semibold mt-2">Ganancia por unidad</p>
                  <p className={`text-base font-black mt-0.5 ${profitMontoVal >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {formatBs(profitMontoVal)} <span className="text-xs">({profitPercentVal.toFixed(1)}%)</span>
                  </p>
                </div>
              </div>
            )}

            {/* Desglose de lo que se desembolsa — el número que el tendero tiene en la mano */}
            {qtyVal > 0 && (
              <div className="bg-[var(--mg-bg-elevated)] rounded-2xl p-3.5 space-y-1.5 text-sm">
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
                  <span className="font-black text-[var(--mg-accent)] text-lg">{formatBs(totalCostVal)}</span>
                </div>
                <p className="text-[10px] text-[var(--mg-text-faint)] font-bold pt-1">
                  Stock final tras compra: <strong className="text-[var(--mg-text-secondary)]">{(product.stock || 0) + qtyVal} unidades</strong>
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !salePrice || qtyVal <= 0}
              className="w-full bg-[var(--mg-accent)] text-white font-bold py-3.5 rounded-2xl text-sm active:scale-95 transition-all disabled:opacity-50 mt-2 shadow-md"
            >
              {saving ? 'Guardando...' : 'Confirmar compra'}
            </button>
          </form>
    </div>
  );
}
