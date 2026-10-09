import React from 'react';
import { motion } from 'motion/react';
import { formatBs, formatBsShort } from '../../utils/currency';
import { AppIcon } from '../icons';

export function MagicMetricCards({
  totalHoy = 0,
  paidSalesCount = 0,
  totalCash = 0,
  totalQr = 0,
  comprasTotal = 0,
  comprasCount = 0,
  gananciaNeta = 0,
  margen = 0,
  onNavigate
}) {

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="mg-grid-auto-sm"
    >
      {/* 1. VENTAS DE HOY */}
      <motion.div
        variants={itemVariants}
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
        className="bg-[var(--mg-bg-surface)] rounded-[22px] p-5 border border-[var(--mg-border)] shadow-xs hover:shadow-md transition-all group relative overflow-hidden"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
            Ventas de Hoy
          </span>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[var(--mg-accent)] flex items-center justify-center border border-blue-100 group-hover:scale-110 transition-transform">
            <AppIcon name="caja" size={20} />
          </div>
        </div>

        <p className="text-2xl sm:text-3xl font-black text-[var(--mg-text-primary)] tracking-tight">
          {formatBs(totalHoy)}
        </p>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--mg-separator)] text-[11px]">
          <span className="font-extrabold text-[var(--mg-text-secondary)]">
            {paidSalesCount} {paidSalesCount === 1 ? 'venta' : 'ventas'}
          </span>
          <span className="text-[var(--mg-text-muted)] font-bold flex items-center gap-1.5">
            <span className="flex items-center gap-0.5"><AppIcon name="cash" size={12} /> {formatBsShort(totalCash)}</span>
            <span className="text-[var(--mg-text-faint)]">·</span>
            <span className="flex items-center gap-0.5"><AppIcon name="qr" size={12} /> {formatBsShort(totalQr)}</span>
          </span>
        </div>
      </motion.div>

      {/* 2. COMPRAS DE HOY */}
      <motion.div
        variants={itemVariants}
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
        onClick={() => onNavigate && onNavigate('/compras?tab=historial')}
        className="bg-[var(--mg-bg-surface)] rounded-[22px] p-5 border border-[var(--mg-border)] shadow-xs hover:shadow-md transition-all group relative overflow-hidden cursor-pointer"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
            Compras de Hoy
          </span>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 group-hover:scale-110 transition-transform">
            <AppIcon name="nuevoProducto" size={20} />
          </div>
        </div>

        <p className="text-2xl sm:text-3xl font-black text-amber-600 tracking-tight tabular-nums">
          {formatBs(comprasTotal)}
        </p>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--mg-separator)] text-[11px]">
          <span className="font-extrabold text-[var(--mg-text-secondary)]">
            {comprasCount} {comprasCount === 1 ? 'compra' : 'compras'}
          </span>
          <span className="text-[var(--mg-text-muted)] font-medium">
            Reposición del día
          </span>
        </div>
      </motion.div>

      {/* 3. GANANCIA DE HOY (ventas − costo − gastos) */}
      <motion.div
        variants={itemVariants}
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
        onClick={() => onNavigate && onNavigate('/reportes?type=profit')}
        className="bg-[var(--mg-bg-surface)] rounded-[22px] p-5 border border-[var(--mg-border)] shadow-xs hover:shadow-md transition-all group relative overflow-hidden cursor-pointer"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
            Ganancia de Hoy
          </span>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-110 transition-transform">
            <AppIcon name="reportes" size={20} />
          </div>
        </div>

        <p className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${gananciaNeta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {formatBs(gananciaNeta)}
        </p>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--mg-separator)] text-[11px]">
          <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 tabular-nums">
            Margen {margen.toFixed(1)}%
          </span>
          <span className="text-[var(--mg-text-muted)] font-medium">
            Ventas − costo − gastos
          </span>
        </div>
      </motion.div>

    </motion.div>
  );
}
