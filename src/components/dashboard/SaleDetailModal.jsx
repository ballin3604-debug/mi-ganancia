import React, { useState, useEffect } from 'react';
import { getSaleItems } from '../../services/sales';
import { formatBs } from '../../utils/currency';

function getPaymentMethodLabel(method) {
  if (method === 'qr') return '📲 QR';
  if (method === 'cash') return '💵 Efectivo';
  if (method === 'mixto') return '🔀 Mixto';
  if (method === 'fiado') return '⏳ Fiado';
  return '💵 Efectivo';
}

function ProductThumb({ imageData }) {
  if (!imageData) {
    return (
      <div className="w-8 h-8 bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-lg flex items-center justify-center text-sm shrink-0">
        📦
      </div>
    );
  }
  return (
    <img
      src={imageData}
      alt=""
      className="w-8 h-8 rounded-lg object-cover shrink-0 border border-[var(--mg-border)]"
    />
  );
}

export function SaleDetailModal({ sale, businessId, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sale) return;
    setLoading(true);
    getSaleItems(businessId, sale.id)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [sale, businessId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!sale) return null;
  const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date();

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center backdrop-blur-xs mg-backdrop-in"
      onClick={onClose}
    >
      <div
        className="bg-[var(--mg-bg-surface)] rounded-t-[28px] w-full max-w-md shadow-2xl mg-slide-up overflow-hidden"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 overflow-y-auto" style={{ maxHeight: '85vh' }}>
          {/* Pull handle */}
          <div className="w-10 h-1 bg-[var(--mg-border)] rounded-full mx-auto mb-4" />

          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-black text-[var(--mg-text-primary)]">Detalle de Venta</h3>
              <p className="text-[var(--mg-text-muted)] text-xs mt-0.5 font-medium">
                {date.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })}
                {' · '}
                {date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <button
              onClick={onClose}
              type="button"
              aria-label="Cerrar detalle de venta"
              className="w-9 h-9 bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-full flex items-center justify-center text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)] font-bold text-lg min-h-[44px] min-w-[44px]"
            >
              ×
            </button>
          </div>

          <div className="bg-[var(--mg-accent)] rounded-[20px] p-4 mb-4 text-white shadow-sm">
            <p className="text-white/80 text-xs font-bold uppercase tracking-wide">Total Cobrado</p>
            <p className="text-3xl font-black mt-0.5">{formatBs(sale.total)}</p>
            <p className="text-white/80 text-xs font-medium mt-1">
              {sale.itemCount || items.length} productos vendidos
              {' · '}
              {getPaymentMethodLabel(sale.paymentMethod)}
            </p>

            {sale.paymentMethod === 'mixto' && (
              <div className="text-xs text-white/90 mt-2 pt-2 border-t border-white/20 flex justify-between gap-4 font-semibold">
                <span>💵 Efectivo: {formatBs(sale.montoEfectivo)}</span>
                <span>📲 QR: {formatBs(sale.montoQR)}</span>
              </div>
            )}

            {sale.paymentMethod === 'cash' && sale.montoRecibido !== undefined && sale.montoRecibido !== null && (
              <div className="text-xs text-white/90 mt-2 pt-2 border-t border-white/20 flex justify-between gap-4 font-semibold">
                <span>Recibido: {formatBs(sale.montoRecibido)}</span>
                <span>Cambio: {formatBs(sale.cambio)}</span>
              </div>
            )}

            {sale.sellerName && (
              <p className="text-white/70 text-[11px] mt-1">Vendido por: {sale.sellerName}</p>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-[var(--mg-accent-border)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider mb-2">
                Productos ({items.length})
              </p>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-2xl p-3"
                >
                  <ProductThumb imageData={item.imageData} />
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-[var(--mg-text-primary)] text-xs truncate">
                      {item.productName}
                    </p>
                    {item.productBrand && (
                      <p className="text-[var(--mg-text-muted)] text-[10px]">{item.productBrand}</p>
                    )}
                    <p className="text-[var(--mg-text-muted)] text-[10px]">
                      {item.quantity} × {formatBs(item.price)}
                    </p>
                  </div>
                  <p className="font-black text-[var(--mg-accent)] text-xs shrink-0">
                    {formatBs(item.subtotal)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-[var(--mg-text-muted)] py-6 text-xs font-medium">
              Sin detalle de productos registrado
            </p>
          )}

          <button
            onClick={onClose}
            type="button"
            className="w-full mt-5 bg-[var(--mg-bg-elevated)] text-[var(--mg-text-primary)] font-extrabold py-3.5 rounded-2xl border border-[var(--mg-border)] active:scale-95 min-h-[44px]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
