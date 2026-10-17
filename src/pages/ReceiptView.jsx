import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { getSaleById, getSaleItems } from '../services/sales';
import { formatBs } from '../utils/currency';
import { printReceipt } from '../components/Receipt';
import { AppIcon } from '../components/icons';

function getPaymentMethodShort(method) {
  if (method === 'qr') return 'QR';
  if (method === 'mixto') return 'Mixto';
  return 'Efectivo';
}

// Recibo en pantalla propia (layout completo, sin ventana emergente).
// Logo y datos del negocio salen de Ajustes.
export default function ReceiptView() {
  const { saleId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { businessId } = useAuth();
  const { business, settings } = useBusiness();
  const [sale, setSale] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId || !saleId) { setLoading(false); return; }
    let alive = true;
    (async () => {
      try {
        const [s, it] = await Promise.all([
          getSaleById(businessId, saleId).catch(() => null),
          getSaleItems(businessId, saleId).catch(() => []),
        ]);
        if (!alive) return;
        setSale(s);
        setItems(Array.isArray(it) ? it : []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [businessId, saleId]);

  if (loading) {
    return (
      <div className="p-4 max-w-2xl mx-auto space-y-3">
        <div className="h-10 rounded-2xl bg-[var(--mg-bg-elevated)] animate-pulse" />
        <div className="h-96 rounded-[20px] bg-[var(--mg-bg-elevated)] animate-pulse" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="bg-[var(--mg-bg-surface)] rounded-[20px] border border-[var(--mg-border)] p-8 text-center">
          <p className="text-4xl mb-2">🧾</p>
          <p className="text-sm font-black text-[var(--mg-text-primary)]">Recibo no encontrado</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-4 px-5 py-2.5 rounded-2xl bg-[var(--mg-accent)] text-white text-xs font-extrabold"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date();
  const total = Number(sale.total || 0);
  const logo = settings?.logoData || settings?.logo_data || '';
  const bizName = business?.name || settings?.businessName || 'Mi Negocio';
  const slogan = settings?.slogan || '';
  const phone = settings?.phone || '';
  const address = [settings?.address, settings?.city].filter(Boolean).join(' · ');
  const legalName = settings?.legal_name || settings?.legalName || '';
  const bizNit = settings?.nit || '';
  const footerMsg = (settings?.footer_message || settings?.footerMessage || '').trim()
    || '¡Gracias por su compra!';
  const passedNumber = location.state?.saleNumber;
  const ticketLabel = passedNumber
    ? `#${String(passedNumber).padStart(4, '0')}`
    : `#${String(sale.id || '').replace(/-/g, '').slice(-6).toUpperCase()}`;
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

  const showQr = (settings?.show_qr ?? settings?.showQrOnTicket ?? true) && !!settings?.qrData;
  const totalQty = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);

  return (
    <div className="mx-auto pb-28 space-y-3 sm:p-6 sm:max-w-[380px]">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 sm:px-0 sm:pt-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-extrabold text-[var(--mg-text-secondary)] bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-2xl px-3.5 py-2.5 active:scale-95 min-h-[44px]"
        >
          ← Volver
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-1.5 text-xs font-extrabold text-white bg-[#1670C2] rounded-2xl px-4 py-2.5 active:scale-95 min-h-[44px] shadow-sm"
        >
          <AppIcon name="recibo" size={14} color="#fff" /> Imprimir
        </button>
      </div>

      {/* Ticket térmico 80mm: pantalla completa en celular */}
      <div className="bg-white border-y sm:border sm:rounded-lg border-[var(--mg-border)] px-5 py-5 shadow-xs text-slate-900 font-mono text-[13px] leading-snug">
        <div className="flex items-start justify-between gap-2">
          {logo ? (
            <img src={logo} alt="Logo" className="w-16 h-16 rounded-lg object-contain shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-2xl shrink-0 font-sans">
              {(bizName || 'M').charAt(0).toUpperCase()}
            </div>
          )}
          <p className="font-black text-[15px] tracking-tight text-right pt-1">RECIBO{ticketLabel}</p>
        </div>

        <div className="mt-2">
          <p className="font-black text-[13px]">{bizName}</p>
          {legalName ? <p className="text-slate-500">{legalName}</p> : null}
          {bizNit ? <p className="text-slate-500">NIT: {bizNit}</p> : null}
          {address ? <p className="text-slate-500">{address}</p> : null}
          {(phone || slogan) && (
            <p className="text-slate-500">{[phone ? `Tel: ${phone}` : '', slogan].filter(Boolean).join(' · ')}</p>
          )}
        </div>

        <div className="border-t border-dashed border-slate-400 my-2.5" />

        <p className="font-bold">{items.length} {items.length === 1 ? 'ítem' : 'ítems'} (Ctd.: {totalQty})</p>

        <div className="border-t border-dashed border-slate-400 my-2.5" />

        {items.length === 0 ? (
          <p className="text-center text-slate-400 py-3">Sin detalle registrado</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-baseline justify-between gap-2">
                <p className="min-w-0">
                  <span className="font-bold">{item.quantity}x</span>{' '}
                  <span className="break-words">{item.productName}</span>
                </p>
                <p className="font-bold tabular-nums whitespace-nowrap">{formatBs(item.subtotal)}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 space-y-0.5 text-right">
          <p className="text-slate-600">Subtotal: <span className="tabular-nums">{formatBs(total)}</span></p>
          <p className="font-black text-[15px]">Total: <span className="tabular-nums">{formatBs(total)}</span></p>
          <p className="text-slate-600">{getPaymentMethodShort(sale.paymentMethod)}: <span className="tabular-nums">{formatBs(total)}</span></p>
          {sale.paymentMethod === 'mixto' && (
            <p className="text-[11px] text-slate-500 tabular-nums">
              Efectivo: {formatBs(sale.montoEfectivo)} · QR: {formatBs(sale.montoQR)}
            </p>
          )}
          {sale.paymentMethod === 'cash' && sale.montoRecibido !== undefined && sale.montoRecibido !== null && (
            <p className="text-[11px] text-slate-500 tabular-nums">
              Recibido: {formatBs(sale.montoRecibido)} · Cambio: {formatBs(sale.cambio)}
            </p>
          )}
        </div>

        {showQr && (
          <div className="text-center mt-3">
            <img src={settings.qrData} alt="QR" className="w-28 h-28 object-contain mx-auto border border-slate-300 rounded-lg p-1" />
            <p className="text-[10px] font-bold tracking-widest text-slate-500 mt-1">ESCANEA PARA PAGAR</p>
          </div>
        )}

        <div className="border-t border-dashed border-slate-400 my-2.5" />

        <div className="text-center">
          <p className="font-bold text-[13px]">{footerMsg}</p>
          <p className="text-slate-500 mt-1 capitalize">{fullDate}</p>
          {sale.sellerName ? <p className="text-slate-500">Atendido por: {sale.sellerName}</p> : null}
        </div>
      </div>
    </div>
  );
}
