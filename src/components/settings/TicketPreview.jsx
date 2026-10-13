import { useState } from 'react';
import { AppIcon } from '../icons';
import { getReceiptFormat } from '../../utils/receiptFormat';
import { amountToWords } from '../../utils/numberToWords';
import { printReceipt } from '../Receipt';

// Vista previa en vivo del ticket con los datos reales del negocio.
// Estilos existentes intactos; solo se agregan los campos antes inexistentes:
// razón social, NIT, ciudad, mensaje de pie y QR condicional + botón de prueba.
export function TicketPreview({
  businessName, slogan, phone, address, city,
  legalName, nit, footerMessage, showQrOnTicket = true,
  logoData, qrData,
}) {
  const [mode, setMode] = useState(() => {
    try { return getReceiptFormat() === 'sheet' ? 'a4' : 'ticket'; } catch { return 'ticket'; }
  });

  const demoTotal = 445;
  const footer = (footerMessage || '').trim() || '¡Gracias por su compra! Conserve su recibo.';
  const fullAddress = [address, city].filter(Boolean).join(' · ') || 'Dirección de la tienda';
  const showQr = showQrOnTicket && !!qrData;

  function handleTestPrint() {
    printReceipt({
      business: { name: businessName || 'MI NEGOCIO' },
      settings: {
        slogan, phone, address: fullAddress,
        legal_name: legalName, legalName,
        nit, city,
        footer_message: footer, footerMessage: footer,
        logoData, qrData,
        show_qr: showQrOnTicket, showQrOnTicket,
      },
      type: 'sale',
      format: mode === 'a4' ? 'sheet' : 'thermal',
      saleId: 'TEST-004819',
      items: [
        { productName: 'Alimento Nutri-Pet 15kg', quantity: 1, price: 280, subtotal: 280 },
        { productName: 'Pipeta Antiparasitaria', quantity: 2, price: 60, subtotal: 120 },
        { productName: 'Collar Reflectivo Canino', quantity: 1, price: 45, subtotal: 45 },
      ],
      total: demoTotal,
      date: new Date(),
      clientName: 'Consumidor Final',
      clientNit: '0',
      sellerName: 'Alan',
      paymentMethod: 'cash',
    });
  }

  return (
    <div className="lg:sticky lg:top-4 space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-black text-[var(--mg-text-primary)] uppercase tracking-wider flex items-center gap-1.5">
          <AppIcon name="recibo" size={14} /> Vista previa en vivo
        </span>
        <div className="flex items-center gap-1">
          {['ticket', 'a4'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                mode === m ? 'bg-slate-900 text-white' : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] border border-[var(--mg-border)]'
              }`}
            >
              {m === 'ticket' ? 'Ticket 80mm' : 'Hoja A4'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'ticket' ? (
        <div className="bg-white rounded-3xl p-6 border border-[var(--mg-border)] shadow-md font-mono text-[11px] text-slate-800 leading-tight space-y-3 max-w-sm mx-auto">
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
            {logoData ? (
              <img src={logoData} alt="Logo" className="w-12 h-12 rounded-xl object-contain mx-auto mb-1" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg mx-auto mb-1">
                {(businessName || 'M').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="font-bold text-sm text-slate-900">{businessName || 'MI NEGOCIO'}</div>
            {slogan && <div className="text-[10px] text-slate-500 italic">"{slogan}"</div>}
            {legalName && <div className="text-[10px] text-slate-500">{legalName}</div>}
            {nit && <div className="text-[10px] text-slate-500">NIT: {nit}</div>}
            <div className="text-[10px] text-slate-500">{fullAddress}</div>
            <div className="text-[10px] text-slate-500">Tel: {phone || '00000000'}</div>
          </div>
          <div className="text-[10px] space-y-0.5 text-slate-600 pb-2 border-b border-dashed border-slate-300">
            <div className="flex justify-between"><span>TICKET N°: 004819</span><span>CAJA: 01</span></div>
            <div className="flex justify-between"><span>ATENDIDO POR: Alan</span><span>12/10/2026</span></div>
          </div>
          <div className="space-y-1.5 pb-3 border-b border-dashed border-slate-300">
            <div className="flex justify-between font-bold text-[10px] text-slate-500 uppercase">
              <span>Cant / Detalle</span><span>Subtotal</span>
            </div>
            <div className="flex justify-between"><span className="truncate pr-2">1x Alimento Nutri-Pet 15kg</span><span className="font-bold">Bs 280.00</span></div>
            <div className="flex justify-between"><span className="truncate pr-2">2x Pipeta Antiparasitaria</span><span className="font-bold">Bs 120.00</span></div>
            <div className="flex justify-between"><span className="truncate pr-2">1x Collar Reflectivo Canino</span><span className="font-bold">Bs 45.00</span></div>
          </div>
          <div className="space-y-0.5 text-[11px]">
            <div className="flex justify-between text-slate-600"><span>SUBTOTAL:</span><span>Bs {demoTotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-slate-600"><span>DESCUENTO (0%):</span><span>Bs 0.00</span></div>
            <div className="flex justify-between text-sm font-black text-slate-900 pt-1">
              <span>TOTAL A PAGAR:</span><span>Bs {demoTotal.toFixed(2)}</span>
            </div>
            <div className="text-[9px] text-slate-500">SON: {amountToWords(demoTotal)}</div>
          </div>
          {showQr ? (
            <div className="text-center pt-1">
              <img src={qrData} alt="QR de cobro" className="w-24 h-24 object-contain mx-auto rounded-xl border border-slate-300 p-1" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mt-1">Escanea para pagar con QR Simple</span>
            </div>
          ) : null}
          <div className="text-center text-[10px] text-slate-500 italic">{footer}</div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 border border-[var(--mg-border)] shadow-md text-xs space-y-4 max-w-sm mx-auto">
          <div className="flex justify-between items-start pb-4 border-b border-slate-200">
            <div>
              <h4 className="font-bold text-base text-slate-900">{businessName || 'MI NEGOCIO'}</h4>
              {slogan && <p className="text-[11px] text-slate-500 italic">"{slogan}"</p>}
              {legalName && <p className="text-[11px] text-slate-500">{legalName}</p>}
              {nit && <p className="text-[11px] text-slate-500">NIT: {nit}</p>}
              <p className="text-[11px] text-slate-600 mt-1">{fullAddress}</p>
              <p className="text-[11px] text-slate-600">Tel: {phone || '—'}</p>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold text-slate-800 text-sm">RECIBO</div>
              <div className="text-xs font-mono text-slate-500">N° R-002194</div>
            </div>
          </div>
          <div className="flex justify-between text-xs text-slate-600">
            <span>Cliente: Consumidor Final</span><span>Fecha: 12 Octubre 2026</span>
          </div>
          <p className="text-[11px] text-slate-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            SON: {amountToWords(demoTotal)}
          </p>
          <div className="pt-2 text-right">
            <span className="text-xs text-slate-500 block">Total Recibo:</span>
            <span className="text-xl font-bold font-mono text-slate-900">Bs {demoTotal.toFixed(2)}</span>
          </div>
          <p className="text-[11px] text-slate-500 italic text-center">{footer}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleTestPrint}
        className="w-full flex items-center justify-center gap-2 bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-2xl py-2.5 text-xs font-bold text-[var(--mg-text-secondary)] hover:bg-[var(--mg-bg-elevated)] active:scale-[0.99] transition-all"
      >
        <AppIcon name="recibo" size={14} /> Imprimir Ticket de Prueba
      </button>
    </div>
  );
}
