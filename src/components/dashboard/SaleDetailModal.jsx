import React, { useState, useEffect } from 'react';
import { getSaleItems } from '../../services/sales';
import { formatBs } from '../../utils/currency';
import { printReceipt } from '../Receipt';
import { AppIcon } from '../icons';

function getPaymentMethodLabel(method) {
  if (method === 'qr') return '📲 QR';
  if (method === 'cash') return '💵 Efectivo';
  if (method === 'mixto') return '🔀 Mixto';
  return '💵 Efectivo';
}

function getPaymentMethodShort(method) {
  if (method === 'qr') return 'QR';
  if (method === 'mixto') return 'Mixto';
  return 'Efectivo';
}

function ProductThumb({ imageData }) {
  if (!imageData) {
    return (
      <div className="w-11 h-11 bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-xl flex items-center justify-center text-xl shrink-0">
        📦
      </div>
    );
  }
  return (
    <img
      src={imageData}
      alt=""
      className="w-11 h-11 rounded-xl object-contain shrink-0 border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-0.5"
    />
  );
}

export function SaleDetailModal({ sale, businessId, business, settings, saleNumber, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    if (!sale) return;
    setLoading(true);
    setShowReceipt(false);
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
  const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt || Date.now());
  const totalQty = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
  const total = Number(sale.total || 0);

  // ── Datos del recibo desde Ajustes ──
  const logo = settings?.logoData || settings?.logo_data || '';
  const bizName = business?.name || settings?.businessName || 'Mi Negocio';
  const slogan = settings?.slogan || '';
  const phone = settings?.phone || '';
  const address = [settings?.address, settings?.city].filter(Boolean).join(' · ');
  const legalName = settings?.legal_name || settings?.legalName || '';
  const bizNit = settings?.nit || '';
  const footerMsg = (settings?.footer_message || settings?.footerMessage || '').trim()
    || '¡Gracias por su compra!';
  const ticketLabel = saleNumber
    ? `#${String(saleNumber).padStart(4, '0')}`
    : `#${String(sale.id || '').replace(/-/g, '').slice(-6).toUpperCase() || '—'}`;
  const fullDate = `${date.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' })} ${date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`;

  function handlePrint() {
    printReceipt({
      business: { name: bizName },
      settings: { slogan, phone, address, logoData: logo, qrData: settings?.qrData },
      type: 'sale',
      saleId: sale.id,
      items: items.map((it) => ({
        productName: it.productName || 'Producto',
        productBrand: it.productBrand || '',
        quantity: Number(it.quantity || 0),
        price: Number(it.price || 0),
        subtotal: Number(it.subtotal || 0),
      })),
      total,
      date,
      clientName: sale.clientName || 'Consumidor Final',
      clientNit: sale.clientNit || '0',
      sellerName: sale.sellerName || '',
      paymentMethod: sale.paymentMethod || 'cash',
      montoRecibido: sale.montoRecibido,
      cambio: sale.cambio,
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-xs mg-backdrop-in"
      onClick={onClose}
    >
      <div
        className="bg-[var(--mg-bg-base)] sm:rounded-[28px] rounded-t-[28px] w-full max-w-md shadow-2xl mg-slide-up overflow-hidden"
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 overflow-y-auto" style={{ maxHeight: '92vh' }}>
          {/* Encabezado */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-black text-[var(--mg-text-primary)]">Detalle de Venta</h3>
              <p className="text-[var(--mg-text-muted)] text-xs mt-0.5 font-medium capitalize">
                {date.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })}
                {' · '}
                {date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <button
              onClick={onClose}
              type="button"
              aria-label="Cerrar detalle de venta"
              className="w-9 h-9 bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-full flex items-center justify-center text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)] font-bold text-lg min-h-[44px] min-w-[44px] shrink-0"
            >
              ×
            </button>
          </div>

          {/* Tarjeta azul: total cobrado */}
          <div className="bg-[#1670C2] rounded-[20px] p-4 mb-4 text-white shadow-sm">
            <p className="text-white/80 text-xs font-bold uppercase tracking-wide">Total Cobrado</p>
            <p className="text-3xl font-black mt-0.5 tabular-nums">{formatBs(total)}</p>
            <p className="text-white/85 text-xs font-semibold mt-1">
              {totalQty} {totalQty === 1 ? 'producto vendido' : 'productos vendidos'}
              {' · '}
              {getPaymentMethodLabel(sale.paymentMethod)}
            </p>

            {sale.paymentMethod === 'mixto' && (
              <div className="text-xs text-white/90 mt-2 pt-2 border-t border-white/20 flex justify-between gap-4 font-semibold">
                <span className="flex items-center gap-1"><AppIcon name="cash" size={13} color="#fff" /> Efectivo: {formatBs(sale.montoEfectivo)}</span>
                <span className="flex items-center gap-1"><AppIcon name="qr" size={13} color="#fff" /> QR: {formatBs(sale.montoQR)}</span>
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

          {/* Productos */}
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
                  className="flex items-center gap-3 bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-2xl p-3 shadow-xs"
                >
                  <ProductThumb imageData={item.imageData} />
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-[var(--mg-text-primary)] text-xs leading-snug">
                      {item.productName}
                    </p>
                    {item.productBrand && (
                      <p className="text-[var(--mg-text-muted)] text-[10px]">{item.productBrand}</p>
                    )}
                    <p className="text-[var(--mg-text-muted)] text-[10px] tabular-nums">
                      {item.quantity} × {formatBs(item.price)}
                    </p>
                  </div>
                  <p className="font-black text-[#1670C2] text-xs shrink-0 tabular-nums">
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

          {/* Recibo completo (layout imagen 2) */}
          {!loading && items.length > 0 && (
            <div className="mt-4">
              {!showReceipt ? (
                <button
                  onClick={() => setShowReceipt(true)}
                  type="button"
                  className="w-full bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] text-[var(--mg-text-primary)] font-extrabold py-3 rounded-2xl text-xs active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-xs min-h-[44px]"
                >
                  <span className="text-base">🧾</span> Ver recibo
                </button>
              ) : (
                <div className="bg-white rounded-[20px] border border-[var(--mg-border)] p-4 shadow-xs text-slate-800">
                  <div className="flex justify-end mb-2">
                    <span className="inline-block bg-blue-100 text-[#1670C2] font-black text-sm px-3 py-1.5 rounded-lg tracking-wide">
                      RECIBO {ticketLabel}
                    </span>
                  </div>

                  <div className="flex items-start gap-3 pb-3 border-b border-slate-200">
                    {logo ? (
                      <img src={logo} alt="Logo" className="w-16 h-16 rounded-xl object-contain border border-slate-200 p-1 shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-[#1670C2] text-white flex items-center justify-center font-black text-2xl shrink-0">
                        {(bizName || 'M').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-lg font-black text-[#1670C2] leading-tight">{bizName}</p>
                      {legalName ? <p className="text-[11px] text-slate-500 font-semibold">{legalName}</p> : null}
                      {bizNit ? <p className="text-[11px] text-slate-500 font-semibold">NIT: {bizNit}</p> : null}
                      {address ? <p className="text-xs text-slate-600 mt-1">📍 {address}</p> : null}
                      {(phone || slogan) && (
                        <p className="text-xs text-slate-600 mt-0.5">
                          {phone ? `📞 ${phone}` : ''}{phone && slogan ? ' · ' : ''}{slogan ? `${slogan}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="grid grid-cols-[44px_1fr_auto] gap-2 px-2 py-2 bg-blue-50 rounded-xl text-[#1670C2] text-sm font-bold">
                      <span>Cant.</span>
                      <span>Producto</span>
                      <span className="text-right">Precio</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {items.map((item) => (
                        <div key={item.id} className="grid grid-cols-[44px_1fr_auto] gap-2 px-2 py-2.5 items-center">
                          <span className="text-center font-bold tabular-nums">{item.quantity}</span>
                          <span className="font-semibold text-[13px] leading-snug">{item.productName}</span>
                          <span className="text-right tabular-nums font-medium">{formatBs(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-200 space-y-1 text-right">
                    <p className="text-sm text-slate-600">
                      Subtotal: <span className="font-semibold tabular-nums ml-6">{formatBs(total)}</span>
                    </p>
                    <p className="inline-flex items-center gap-6 bg-blue-50 rounded-xl px-4 py-2 mt-1">
                      <span className="text-base font-black text-[#1670C2]">Total:</span>
                      <span className="text-base font-black text-[#1670C2] tabular-nums">{formatBs(total)}</span>
                    </p>
                    <p className="text-sm text-slate-600 pt-1">
                      {getPaymentMethodShort(sale.paymentMethod)}: <span className="font-semibold tabular-nums ml-6">{formatBs(total)}</span>
                    </p>
                  </div>

                  <div className="mt-4 bg-blue-50/60 rounded-2xl p-4 text-center">
                    <p className="text-2xl">🤝</p>
                    <p className="text-[#1670C2] font-black text-base mt-1">{footerMsg}</p>
                    <p className="text-xs text-slate-500 mt-1.5 capitalize">📅 {fullDate}</p>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setShowReceipt(false)}
                      type="button"
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-3 rounded-2xl text-xs active:scale-95 transition-all min-h-[44px]"
                    >
                      Ocultar recibo
                    </button>
                    <button
                      onClick={handlePrint}
                      type="button"
                      className="flex-1 bg-[#1670C2] hover:bg-[#0f5c9e] text-white font-extrabold py-3 rounded-2xl text-xs active:scale-95 transition-all min-h-[44px] flex items-center justify-center gap-1.5"
                    >
                      <AppIcon name="recibo" size={14} color="#fff" /> Imprimir
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            type="button"
            className="w-full mt-4 bg-[var(--mg-bg-surface)] text-[var(--mg-text-primary)] font-extrabold py-3.5 rounded-2xl border border-[var(--mg-border)] active:scale-95 min-h-[44px] shadow-xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
