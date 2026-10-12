import { useState } from 'react';
import { AppIcon } from '../icons';
import { getReceiptFormat } from '../../utils/receiptFormat';

// Vista previa en vivo del ticket con los datos reales del negocio.
export function TicketPreview({ businessName, slogan, phone, address, logoData, qrData }) {
  const [mode, setMode] = useState(() => {
    try { return getReceiptFormat() === 'sheet' ? 'a4' : 'ticket'; } catch { return 'ticket'; }
  });

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
            <div className="text-[10px] text-slate-500">{address || 'Dirección de la tienda'}</div>
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
            <div className="flex justify-between"><span className="truncate pr-2">2x Coca 2L</span><span className="font-bold">Bs 24.00</span></div>
            <div className="flex justify-between"><span className="truncate pr-2">1x Pan integral</span><span className="font-bold">Bs 8.50</span></div>
          </div>
          <div className="flex justify-between text-sm font-black text-slate-900">
            <span>TOTAL:</span><span>Bs 32.50</span>
          </div>
          {qrData ? (
            <div className="text-center pt-1">
              <img src={qrData} alt="QR de cobro" className="w-24 h-24 object-contain mx-auto rounded-xl border border-slate-300 p-1" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mt-1">Escanea para pagar</span>
            </div>
          ) : null}
          <div className="text-center text-[10px] text-slate-500 italic">¡Gracias por su compra!</div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 border border-[var(--mg-border)] shadow-md text-xs space-y-4 max-w-sm mx-auto">
          <div className="flex justify-between items-start pb-4 border-b border-slate-200">
            <div>
              <h4 className="font-bold text-base text-slate-900">{businessName || 'MI NEGOCIO'}</h4>
              <p className="text-[11px] text-slate-500">{slogan}</p>
              <p className="text-[11px] text-slate-600 mt-1">{address}</p>
              <p className="text-[11px] text-slate-600">Tel: {phone}</p>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold text-slate-800 text-sm">RECIBO</div>
              <div className="text-xs font-mono text-slate-500">N° R-002194</div>
            </div>
          </div>
          <div className="flex justify-between text-xs text-slate-600">
            <span>Cliente: Consumidor Final</span><span>Fecha: 12 Octubre 2026</span>
          </div>
          <div className="pt-2 text-right">
            <span className="text-xs text-slate-500 block">Total Recibo:</span>
            <span className="text-xl font-bold font-mono text-slate-900">Bs 32.50</span>
          </div>
        </div>
      )}
    </div>
  );
}
