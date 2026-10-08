// ─────────────────────────────────────────────────────────────
// Inicio del cajero: solo su trabajo, nada de la tienda.
// Ve: vender, sus recibos de hoy (con reimpresión) y avisos de stock.
// NO ve: totales del negocio, otros vendedores, costos, reportes ni ajustes.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import { motion } from 'motion/react';
import { formatBs } from '../utils/currency';
import { AppIcon } from './icons';

function ReceiptRow({ sale, items, expanded, onToggle, onSelectSale, onReimprint, printingSaleId }) {
  const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt || Date.now());
  const time = date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  return (
    <li className={`rounded-2xl border transition-colors ${expanded ? 'bg-blue-50/60 border-blue-200' : 'bg-white border-[var(--mg-border)]'}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer"
      >
        <span className="font-mono text-xs font-extrabold text-[var(--mg-text-muted)] shrink-0">{time}</span>
        <span className="flex-1 min-w-0 truncate text-sm font-bold text-[var(--mg-text-primary)]">
          {sale.clientName || 'Cliente Ocasional'}
        </span>
        <span className="text-sm font-black text-[#1670C2] tabular-nums shrink-0">{formatBs(sale.total)}</span>
        <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full border text-xs transition-transform shrink-0 ${expanded ? 'bg-blue-600 text-white border-blue-600 rotate-180' : 'bg-white text-slate-400 border-slate-200'}`}>
          ⌄
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap border-t border-blue-200/60 pt-2.5">
            <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
              {items.length > 0 ? (
                items.map((it, idx) => (
                  <span key={idx} className="bg-white border border-slate-200 px-2 py-1 rounded-md font-semibold text-[11px] text-slate-600 tabular-nums">
                    {it.quantity}x {it.productName} ({formatBs(it.subtotal)})
                  </span>
                ))
              ) : (
                <span className="text-slate-400 font-medium text-xs">Cargando productos…</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {onSelectSale && (
                <button
                  type="button"
                  onClick={() => onSelectSale(sale)}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                >
                  <AppIcon name="detalle" size={13} /> Detalle
                </button>
              )}
              {onReimprint && (
                <button
                  type="button"
                  onClick={() => onReimprint(sale)}
                  disabled={printingSaleId === sale.id}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                >
                  <AppIcon name="recibo" size={13} color="#fff" /> {printingSaleId === sale.id ? 'Imprimiendo…' : 'Recibo'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

export function CashierHome({
  user,
  businessName,
  todayStr,
  sales,
  salesItemsMap = {},
  lowStock = [],
  totalCobrado = 0,
  totalCash = 0,
  totalQr = 0,
  onNavigate,
  onSelectSale,
  onReimprint,
  printingSaleId,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const firstName = (user?.displayName || 'Cajero').split(' ')[0];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto pb-16"
    >
      {/* Saludo */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-[var(--mg-text-primary)]">Hola, {firstName} 👋</h1>
          <p className="text-xs text-[var(--mg-text-muted)] font-medium mt-0.5 capitalize">
            {businessName} · {todayStr}
          </p>
        </div>
        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
          Mi turno
        </span>
      </div>

      {/* Acción principal */}
      <button
        type="button"
        onClick={() => onNavigate('/ventas')}
        className="w-full bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white rounded-3xl p-5 flex items-center gap-4 shadow-md active:scale-[0.99] transition-all text-left"
      >
        <span className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
          <AppIcon name="carrito" size={24} color="#fff" />
        </span>
        <span>
          <span className="block text-lg font-black">Nueva venta</span>
          <span className="block text-xs text-white/80 font-medium">Toca, cobra y listo</span>
        </span>
      </button>

      {/* Mi turno hoy */}
      <section>
        <h2 className="text-xs font-black uppercase tracking-wider text-[var(--mg-text-muted)] mb-3">
          Mi turno hoy
        </h2>
        {sales.length > 0 ? (
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-[var(--mg-bg-surface)] rounded-2xl p-3.5 text-center border border-[var(--mg-border)]">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Ventas</p>
              <p className="text-xl font-black text-[var(--mg-text-primary)] mt-0.5 tabular-nums">{sales.length}</p>
            </div>
            <div className="bg-[var(--mg-bg-surface)] rounded-2xl p-3.5 text-center border border-[var(--mg-border)]">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Cobrado</p>
              <p className="text-xl font-black text-[#1670C2] mt-0.5 tabular-nums">{formatBs(totalCobrado)}</p>
            </div>
            <div className="bg-[var(--mg-bg-surface)] rounded-2xl p-3.5 text-center border border-[var(--mg-border)]">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Efec / QR</p>
              <p className="text-sm font-black text-[var(--mg-text-primary)] mt-1 tabular-nums">
                {formatBs(totalCash)} <span className="text-[var(--mg-text-faint)] font-bold">/</span> {formatBs(totalQr)}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--mg-bg-surface)] rounded-2xl p-6 text-center border border-[var(--mg-border)]">
            <AppIcon name="carrito" size={36} />
            <p className="text-sm font-bold text-[var(--mg-text-primary)] mt-2">Sin ventas todavía</p>
            <p className="text-xs text-[var(--mg-text-muted)] mt-0.5">Tu primera venta del día aparece aquí.</p>
          </div>
        )}
      </section>

      {/* Mis recibos */}
      {sales.length > 0 && (
        <section>
          <h2 className="text-xs font-black uppercase tracking-wider text-[var(--mg-text-muted)] mb-3">
            Mis recibos ({sales.length})
          </h2>
          <ul className="space-y-2">
            {[...sales]
              .sort((a, b) => {
                const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return db - da;
              })
              .map((sale) => (
                <ReceiptRow
                  key={sale.id}
                  sale={sale}
                  items={salesItemsMap[sale.id] || []}
                  expanded={expandedId === sale.id}
                  onToggle={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                  onSelectSale={onSelectSale}
                  onReimprint={onReimprint}
                  printingSaleId={printingSaleId}
                />
              ))}
          </ul>
        </section>
      )}

      {/* Aviso de stock (sin precios ni edición) */}
      {lowStock.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
            <AppIcon name="reloj" size={14} /> Por acabarse ({lowStock.length})
          </p>
          <p className="text-xs text-amber-700 mt-1.5 font-medium">
            {lowStock.slice(0, 5).map((p) => p.name).join(' · ')}
            {lowStock.length > 5 ? ` y ${lowStock.length - 5} más` : ''}.
            Avisa al dueño para reponer.
          </p>
        </section>
      )}

    </motion.div>
  );
}
