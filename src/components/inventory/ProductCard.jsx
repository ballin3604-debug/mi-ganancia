import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { formatBs } from '../../utils/currency';

export function ProductCard({ product, nearestExpiry, onSelect, categoryColor }) {
  const [isHovered, setIsHovered] = useState(false);

  // Stock Status checks
  const isOut = product.stock === 0;
  const isLow = !isOut && product.stock <= (product.minStock || 5);

  // Expiry check
  let expiryStatus = null;
  if (nearestExpiry?.date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((nearestExpiry.date - today) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) {
      expiryStatus = { type: 'expired', label: 'Vencido' };
    } else if (daysLeft <= 30) {
      expiryStatus = { type: 'expiring', label: `${daysLeft}d vencer` };
    }
  }

  // Margin calculation
  const price = Number(product.price || 0);
  const supplierPrice = Number(product.supplierPrice || 0);
  const profit = supplierPrice > 0 ? price - supplierPrice : null;
  const marginPct = supplierPrice > 0 ? Math.round((profit / supplierPrice) * 100) : null;

  return (
    <div
      className="relative group select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* RESTING PRODUCT CARD: High Visual Emphasis */}
      <motion.div
        whileHover={{ y: -6, scale: 1.02 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => onSelect(product)}
        className="bg-[var(--mg-bg-surface)] rounded-[24px] border border-[var(--mg-border)] overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col h-full group"
      >
        {/* Photo Container */}
        <div className="relative aspect-square w-full bg-[var(--mg-bg-elevated)] overflow-hidden flex items-center justify-center p-3 border-b border-[var(--mg-separator)]">
          {product.imageData ? (
            <img
              src={product.imageData}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-108"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-4xl text-[var(--mg-text-faint)] bg-gradient-to-br from-[var(--mg-bg-elevated)] to-slate-100/90">
              📦
            </div>
          )}

          {/* Price Tag Badge (Bottom Left Overlay) */}
          <div className="absolute bottom-2 left-2 pointer-events-none">
            <span className="bg-black/75 backdrop-blur-md text-white font-black text-[11px] px-2.5 py-1 rounded-xl shadow-md border border-white/10 tracking-tight">
              {formatBs(price)}
            </span>
          </div>

          {/* Status & Expiry Badges (Top Overlay) */}
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 pointer-events-none">
            {isOut ? (
              <span className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-md">
                ❌ Agotado
              </span>
            ) : isLow ? (
              <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-md">
                ⚠️ {product.stock} und
              </span>
            ) : (
              <span className="bg-emerald-600/90 backdrop-blur-xs text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs">
                {product.stock} {product.unit || 'und'}
              </span>
            )}

            {expiryStatus && (
              <span
                className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-md ${
                  expiryStatus.type === 'expired' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                }`}
              >
                ⏰ {expiryStatus.label}
              </span>
            )}
          </div>
        </div>

        {/* Product Details (Name & Category) */}
        <div className="p-3.5 flex-1 flex flex-col justify-between bg-[var(--mg-bg-surface)]">
          <div className="space-y-1">
            <span
              className={`inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                categoryColor || 'bg-blue-50 text-blue-700'
              }`}
            >
              {product.category || 'Otros'}
            </span>

            <h4 className="font-extrabold text-[var(--mg-text-primary)] text-xs sm:text-sm line-clamp-2 leading-snug tracking-tight group-hover:text-[var(--mg-accent)] transition-colors">
              {product.name}
            </h4>
          </div>

          {product.brand && (
            <p className="text-[10px] font-bold text-[var(--mg-text-muted)] truncate uppercase tracking-wider mt-1.5 pt-1.5 border-t border-[var(--mg-separator)]">
              {product.brand}
            </p>
          )}
        </div>
      </motion.div>

      {/* DESKTOP HOVER EXPANDED CARD (High-impact visual tooltip) */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="hidden lg:block absolute left-1/2 -translate-x-1/2 bottom-full mb-3 z-40 w-72 bg-[var(--mg-bg-surface)] rounded-[26px] p-4 border border-[var(--mg-border)] shadow-2xl pointer-events-none"
          >
            {/* Natural Image Container */}
            <div className="relative w-full h-44 rounded-2xl bg-[var(--mg-bg-elevated)] overflow-hidden flex items-center justify-center p-2 mb-3 border border-[var(--mg-separator)]">
              {product.imageData ? (
                <img src={product.imageData} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-contain" />
              ) : (
                <span className="text-5xl">📦</span>
              )}
            </div>

            {/* Info Metrics */}
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-extrabold text-[var(--mg-text-primary)] text-sm truncate">{product.name}</h4>
                  {product.brand && (
                    <p className="text-[10px] font-bold text-[var(--mg-text-muted)] uppercase tracking-wider">
                      {product.brand}
                    </p>
                  )}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${categoryColor}`}>
                  {product.category || 'Otros'}
                </span>
              </div>

              <div className="pt-2 border-t border-[var(--mg-separator)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[var(--mg-text-muted)] uppercase tracking-wider block">
                    Precio Venta
                  </span>
                  <p className="text-base font-black text-[var(--mg-accent)]">{formatBs(price)}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-[var(--mg-text-muted)] uppercase tracking-wider block">
                    Stock Disponible
                  </span>
                  <p
                    className={`text-sm font-black ${
                      isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600'
                    }`}
                  >
                    {product.stock} {product.unit || 'und'}
                  </p>
                </div>
              </div>

              {marginPct !== null && (
                <div className="bg-[var(--mg-accent-bg)] p-2 rounded-xl text-[11px] font-bold text-[var(--mg-accent)] flex items-center justify-between border border-[var(--mg-accent-border)]">
                  <span>Margen est. ganancia:</span>
                  <span className="font-black">
                    +{marginPct}% ({formatBs(profit)})
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
