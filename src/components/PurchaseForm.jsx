import { useState, useEffect, useRef } from 'react';
import { addReplenishment, updateProduct } from '../services/products';
import { getReplenishmentConcepts, addReplenishmentConcepts } from '../services/replenishmentConcepts';
import { subscribeToSuppliers, addSupplier } from '../services/suppliers';
import { clampNumberInput, blockInvalidNumberKeys } from '../utils/numberInput';

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

export default function PurchaseForm({ businessId, product, onClose, onSaved }) {
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

  useEffect(() => {
    setSalePrice(String(product.price || ''));
    setSupplierPrice(String(product.supplierPrice || ''));
    setQuantity('');
    setPurchaseUnitType('unit');
    setPackageSize(product.packageSize ? String(product.packageSize) : '');
    setPackageCount('');
    setExpiryDate('');
    setExtraCosts([]);
    setSupplier('');
    setIsCustomSupplier(false);
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
  const totalCostVal = (supplierPriceVal * qtyVal) + totalExtra;
  const costoUnitarioReal = qtyVal > 0 ? totalCostVal / qtyVal : supplierPriceVal;
  const profitMontoVal = salePriceVal - costoUnitarioReal;
  const profitPercentVal = salePriceVal > 0 ? (profitMontoVal / salePriceVal) * 100 : 0;

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
      });

      await addReplenishment(businessId, {
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

      await onSaved?.();
    } catch (err) {
      console.error(err);
      alert('Error al reponer stock. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5 pb-10 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-[var(--mg-text-primary)]">Registrar compra</h3>
        {onClose && (
          <button onClick={onClose} title="Cambiar producto"
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
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Modo de compra */}
            <div>
              <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">Comprar por</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (purchaseUnitType === 'package') setSupplierPrice('');
                    setPurchaseUnitType('unit');
                  }}
                  className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all active:scale-95 ${
                    purchaseUnitType === 'unit'
                      ? 'bg-[var(--mg-accent)] text-white border-[var(--mg-accent)]'
                      : 'bg-[var(--mg-bg-surface)] text-[var(--mg-text-secondary)] border-[var(--mg-border)]'
                  }`}
                >
                  Unidad
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (purchaseUnitType === 'unit') setSupplierPrice('');
                    setPurchaseUnitType('package');
                  }}
                  className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all active:scale-95 ${
                    purchaseUnitType === 'package'
                      ? 'bg-[var(--mg-accent)] text-white border-[var(--mg-accent)]'
                      : 'bg-[var(--mg-bg-surface)] text-[var(--mg-text-secondary)] border-[var(--mg-border)]'
                  }`}
                >
                  Paquete
                </button>
              </div>
            </div>

            {/* Precios Base */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-[var(--mg-text-muted)] block mb-1 truncate">Precio Venta (Público) *</label>
                <input
                  type="number" step="0.01" min="0" max="999999"
                  value={salePrice}
                  onChange={(e) => setSalePrice(clampNumberInput(e.target.value, { max: 999999 }))}
                  onKeyDown={blockInvalidNumberKeys}
                  placeholder="0.00"
                  className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[var(--mg-accent-border)] font-bold text-[var(--mg-text-primary)]"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--mg-text-muted)] block mb-1 truncate">
                  {purchaseUnitType === 'package' ? 'Costo del Paquete (total)' : 'Costo Proveedor (Base)'}
                </label>
                <input
                  type="number" step="0.01" min="0" max="999999"
                  value={supplierPrice}
                  onChange={(e) => setSupplierPrice(clampNumberInput(e.target.value, { max: 999999 }))}
                  onKeyDown={blockInvalidNumberKeys}
                  placeholder="0.00"
                  className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[var(--mg-accent-border)] font-semibold text-[var(--mg-text-secondary)]"
                />
              </div>
            </div>

            {/* Cantidad */}
            {purchaseUnitType === 'package' ? (
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">Cantidad de paquetes *</label>
                    <input
                      type="number" step="1" min="1" max="9999"
                      value={packageCount}
                      onChange={(e) => setPackageCount(clampNumberInput(e.target.value, { min: 1, max: 9999 }))}
                      onKeyDown={blockInvalidNumberKeys}
                      placeholder="Ej: 5"
                      className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--mg-accent-border)] font-bold text-[var(--mg-text-primary)]"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">Unidades por paquete *</label>
                    <input
                      type="number" step="1" min="1" max="9999"
                      value={packageSize}
                      onChange={(e) => setPackageSize(clampNumberInput(e.target.value, { min: 1, max: 9999 }))}
                      onKeyDown={blockInvalidNumberKeys}
                      placeholder="Ej: 6"
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
                <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">Cantidad comprada (unidades) *</label>
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
              <p className="text-xs font-bold text-[var(--mg-text-muted)] block mb-2">Gastos extra de adquisición (montos totales)</p>

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

            {/* Resumen de costos unitarios reales */}
            {qtyVal > 0 && (
              <div className="bg-[var(--mg-bg-elevated)] p-3 rounded-2xl border border-[var(--mg-border)] space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-[var(--mg-text-muted)]">Costo Adicional Total:</span>
                  <span className="font-bold text-[var(--mg-text-secondary)]">{formatBs(totalExtra)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-[var(--mg-border)] pt-1.5">
                  <span className="font-bold text-[var(--mg-text-primary)]">Costo Unitario Real:</span>
                  <span className="font-black text-[var(--mg-accent)] text-sm">{formatBs(costoUnitarioReal)}</span>
                </div>
              </div>
            )}

            {/* Tarjetas de Ganancia Estimada */}
            <div>
              <p className="text-xs font-bold text-[var(--mg-text-muted)] block mb-2">Tu ganancia estimada (por unidad)</p>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-[var(--mg-bg-elevated)] p-3 rounded-2xl border border-[var(--mg-border)] text-center">
                  <p className="text-[10px] text-[var(--mg-text-faint)] uppercase font-semibold">Monto</p>
                  <p className={`text-base font-black mt-0.5 ${profitMontoVal >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {formatBs(profitMontoVal)}
                  </p>
                </div>
                <div className="bg-[var(--mg-bg-elevated)] p-3 rounded-2xl border border-[var(--mg-border)] text-center">
                  <p className="text-[10px] text-[var(--mg-text-faint)] uppercase font-semibold">Porcentaje</p>
                  <p className={`text-base font-black mt-0.5 ${profitMontoVal >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {profitPercentVal.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            {qtyVal > 0 && (
              <p className="text-[10px] text-[var(--mg-text-faint)] font-bold pl-0.5">
                Stock final tras compra: <strong className="text-[var(--mg-text-secondary)]">{(product.stock || 0) + qtyVal} unidades</strong>
              </p>
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
