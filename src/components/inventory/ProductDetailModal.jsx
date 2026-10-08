import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { formatBs } from '../../utils/currency';
import { TransferModal } from './TransferModal';
import { AppIcon } from '../icons';

function formatDate(dateVal) {
  if (!dateVal) return '—';
  const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ProductDetailModal({
  product,
  nearestExpiry,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onQuickUpdateStock,
  categoryColor,
  branches = [],
  stockRows = [],
  businessId,
}) {
  const [updatingStock, setUpdatingStock] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  // Mapa sede → stock para este producto
  const branchStocks = useMemo(() => {
    const map = {};
    (stockRows || []).forEach((r) => {
      if (r.product_id === product?.id) map[r.branch_id] = Number(r.stock || 0);
    });
    return map;
  }, [stockRows, product?.id]);

  if (!isOpen || !product) return null;

  const currentStock = Number(product.stock || 0);
  const minStock = Number(product.minStock || 5);
  const isOut = currentStock === 0;
  const isLow = !isOut && currentStock <= minStock;

  // Health Stock Ratio Bar (Percentage relative to healthy stock of 2x minStock)
  const targetHealthyStock = Math.max(minStock * 2, 10);
  const stockPercentage = Math.min(100, Math.round((currentStock / targetHealthyStock) * 100));

  // Financial calculations
  const price = Number(product.price || 0);
  const supplierPrice = Number(product.supplierPrice || 0);
  const profit = supplierPrice > 0 ? price - supplierPrice : 0;
  const marginPct = supplierPrice > 0 ? Math.round((profit / supplierPrice) * 100) : null;
  const totalSaleValue = price * currentStock;

  // Expiry calculation
  let expiryInfo = null;
  if (nearestExpiry?.date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((nearestExpiry.date - today) / (1000 * 60 * 60 * 24));
    expiryInfo = {
      dateFormatted: formatDate(nearestExpiry.date),
      daysLeft,
      isOverdue: daysLeft < 0,
      isWarning: daysLeft >= 0 && daysLeft <= 30,
    };
  }

  async function handleStockAdjust(delta) {
    if (!onQuickUpdateStock || updatingStock) return;
    const newStock = Math.max(0, currentStock + delta);
    if (newStock === currentStock) return;

    setUpdatingStock(true);
    try {
      await onQuickUpdateStock(product, newStock);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingStock(false);
    }
  }

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs mg-backdrop-in"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[var(--mg-bg-surface)] w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] border border-[var(--mg-border)] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header Bar */}
          <div className="p-4 border-b border-[var(--mg-separator)] flex items-center justify-between bg-[var(--mg-bg-elevated)]">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">
              Ficha de Producto
            </span>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] flex items-center justify-center font-bold text-base text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)] transition-all active:scale-95"
            >
              ✕
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="p-5 overflow-y-auto space-y-5">
            {/* Top Section: Photo + Title */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-2xl bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] overflow-hidden flex items-center justify-center p-2 shrink-0 shadow-xs">
                {product.imageData ? (
                  <img src={product.imageData} alt={product.name} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-6xl">📦</span>
                )}
              </div>

              <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
                <span className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider ${categoryColor || 'bg-blue-50 text-blue-700'}`}>
                  {product.category || 'Sin categoría'}
                </span>

                <h3 className="font-black text-[var(--mg-text-primary)] text-lg sm:text-xl leading-tight">
                  {product.name}
                </h3>

                {product.brand && (
                  <p className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider">
                    Marca: {product.brand}
                  </p>
                )}

                {product.barcode && (
                  <p className="text-[11px] font-mono font-bold text-[var(--mg-text-muted)] bg-[var(--mg-bg-elevated)] inline-block px-2.5 py-1 rounded-lg border border-[var(--mg-border)]">
                    🏷️ {product.barcode}
                  </p>
                )}

                {Number(product.packageSize || 0) > 1 && product.packPrice && (
                  <p className="text-[11px] font-bold text-[var(--mg-accent)] bg-[var(--mg-accent-bg)] inline-block px-2.5 py-1 rounded-lg border border-[var(--mg-accent-border)] ml-1.5">
                    📦 {(product.packLabel || 'Paquete').trim() || 'Paquete'} x{product.packageSize}: Bs {Number(product.packPrice).toFixed(2)}
                    {product.packPriceHot ? ` · caliente Bs ${Number(product.packPriceHot).toFixed(2)}` : ''}
                  </p>
                )}

                {product.description && (
                  <p className="text-xs text-[var(--mg-text-secondary)] bg-[var(--mg-bg-elevated)] p-2.5 rounded-xl border border-[var(--mg-border)] font-medium">
                    {product.description}
                  </p>
                )}
              </div>
            </div>

            {/* Stock por sede + traspasos (Fase 2, solo si hay varias sedes) */}
            {branches.length > 1 && (
              <div className="bg-[var(--mg-bg-elevated)] p-4 rounded-[22px] border border-[var(--mg-border)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider">
                    🏬 Stock por sede
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTransfer(true)}
                    className="text-[11px] font-black px-3 py-1.5 rounded-xl bg-[var(--mg-accent)] text-white active:scale-95"
                  >
                    🔀 Traspasar
                  </button>
                </div>
                <div className="space-y-1.5">
                  {branches.map((b) => (
                    <div key={b.id} className="flex items-center justify-between bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-xl px-3 py-2">
                      <span className="text-xs font-bold text-[var(--mg-text-secondary)] truncate">
                        {b.type === 'almacen' ? '📦' : '🏪'} {b.name}
                        {b.isMain ? ' ⭐' : ''}
                      </span>
                      <span className="text-sm font-black text-[var(--mg-text-primary)] shrink-0">
                        {branchStocks[b.id] ?? 0} <span className="text-[10px] font-bold text-[var(--mg-text-muted)]">und</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Metrics Cards */}            <div className="bg-[var(--mg-bg-elevated)] p-4 rounded-[22px] border border-[var(--mg-border)] space-y-3">
              <span className="text-[10px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block">
                💰 Análisis Económico
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-[var(--mg-bg-surface)] p-3 rounded-xl border border-[var(--mg-border)]">
                  <span className="text-[10px] font-bold text-[var(--mg-text-muted)] block">Precio Venta</span>
                  <p className="text-base font-black text-[var(--mg-accent)] mt-0.5">{formatBs(price)}</p>
                </div>

                <div className="bg-[var(--mg-bg-surface)] p-3 rounded-xl border border-[var(--mg-border)]">
                  <span className="text-[10px] font-bold text-[var(--mg-text-muted)] block">Precio Compra</span>
                  <p className="text-base font-black text-[var(--mg-text-primary)] mt-0.5">
                    {supplierPrice > 0 ? formatBs(supplierPrice) : '—'}
                  </p>
                </div>

                <div className="col-span-2 sm:col-span-1 bg-[var(--mg-bg-surface)] p-3 rounded-xl border border-[var(--mg-border)]">
                  <span className="text-[10px] font-bold text-[var(--mg-text-muted)] block">Ganancia Est.</span>
                  <p className="text-base font-black text-emerald-600 mt-0.5">
                    {marginPct !== null ? `+${marginPct}%` : '—'}
                  </p>
                  {profit > 0 && (
                    <span className="text-[10px] font-bold text-emerald-700 block">({formatBs(profit)} / und)</span>
                  )}
                </div>
              </div>

              {/* Total Stock Valuation */}
              <div className="bg-[var(--mg-accent-bg)] p-3 rounded-xl border border-[var(--mg-accent-border)] flex items-center justify-between text-xs">
                <div>
                  <span className="font-extrabold text-[var(--mg-accent)] block">Valor Total en Ventas:</span>
                  <span className="text-[10px] text-[var(--mg-text-muted)] font-semibold">({currentStock} unidades × {formatBs(price)})</span>
                </div>
                <p className="text-base font-black text-[var(--mg-accent)]">{formatBs(totalSaleValue)}</p>
              </div>
            </div>

            {/* Dates & Expiry Section */}
            <div className="bg-[var(--mg-bg-elevated)] p-4 rounded-[22px] border border-[var(--mg-border)] space-y-2 text-xs">
              <span className="text-[10px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block">
                📅 Fechas & Registro
              </span>

              {expiryInfo && (
                <div className={`p-3 rounded-xl border flex items-center justify-between font-bold ${
                  expiryInfo.isOverdue
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : expiryInfo.isWarning
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-[var(--mg-bg-surface)] text-[var(--mg-text-primary)] border-[var(--mg-border)]'
                }`}>
                  <span>Próximo Vencimiento:</span>
                  <span className="font-black">
                    {expiryInfo.dateFormatted} {expiryInfo.isOverdue ? '(VENCIDO)' : `(${expiryInfo.daysLeft}d restantes)`}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-[11px] text-[var(--mg-text-muted)] pt-1">
                <span>Registrado: {formatDate(product.createdAt)}</span>
                {product.updatedAt && <span>Modificado: {formatDate(product.updatedAt)}</span>}
              </div>
            </div>
          </div>

          {/* Action Buttons Footer */}
          <div className="p-4 border-t border-[var(--mg-separator)] bg-[var(--mg-bg-surface)] flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onDelete(product);
              }}
              className="flex-1 py-3 px-4 bg-[var(--mg-danger-bg)] hover:bg-red-100 text-[var(--mg-danger)] font-extrabold rounded-2xl text-xs border border-red-200 transition-all active:scale-95 flex items-center justify-center gap-1.5 min-h-[44px]"
            >
              <AppIcon name="eliminar" size={14} />
              <span>Eliminar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(product);
              }}
              className="flex-1 py-3 px-4 bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white font-extrabold rounded-2xl text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 min-h-[44px]"
            >
              <AppIcon name="editar" size={14} color="#fff" />
              <span>Editar Producto</span>
            </button>
          </div>
        </motion.div>
      </div>

      {showTransfer && (
        <TransferModal
          businessId={businessId}
          product={product}
          branches={branches}
          fromBranchId={null}
          branchStocks={branchStocks}
          isOpen={showTransfer}
          onClose={() => setShowTransfer(false)}
          onDone={() => setShowTransfer(false)}
        />
      )}
    </AnimatePresence>
  );
}
