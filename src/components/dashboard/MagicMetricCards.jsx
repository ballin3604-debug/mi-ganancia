import React from 'react';
import { motion } from 'motion/react';
import { formatBs, formatBsShort } from '../../utils/currency';
import { AppIcon } from '../icons';

export function MagicMetricCards({
  totalHoy = 0,
  paidSalesCount = 0,
  totalCash = 0,
  totalQr = 0,
  peakBand = null,
  onNavigate
}) {
  const avgTicket = paidSalesCount > 0 ? totalHoy / paidSalesCount : 0;

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
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
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

      {/* 2. HORA PICO DE VENTAS */}
      <motion.div
        variants={itemVariants}
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
        className="bg-[var(--mg-bg-surface)] rounded-[22px] p-5 border border-[var(--mg-border)] shadow-xs hover:shadow-md transition-all group relative overflow-hidden"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
            Hora Pico de Ventas
          </span>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 group-hover:scale-110 transition-transform">
            <AppIcon name="reloj" size={20} />
          </div>
        </div>

        <p className="text-2xl sm:text-3xl font-black text-amber-600 tracking-tight truncate">
          {peakBand ? peakBand.label : 'Sin registro'}
        </p>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--mg-separator)] text-[11px]">
          <span className="font-extrabold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            {peakBand ? `${formatBs(peakBand.total)}` : 'Esperando datos'}
          </span>
          <span className="text-[var(--mg-text-muted)] font-bold text-[10px]">
            {peakBand ? `${peakBand.count} ventas` : '0 ventas'}
          </span>
        </div>
      </motion.div>

      {/* 3. PROMEDIO POR VENTA (TICKET PROMEDIO) */}
      <motion.div
        variants={itemVariants}
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
        className="bg-[var(--mg-bg-surface)] rounded-[22px] p-5 border border-[var(--mg-border)] shadow-xs hover:shadow-md transition-all group relative overflow-hidden"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
            Promedio por Venta
          </span>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-110 transition-transform">
            <AppIcon name="reportes" size={20} />
          </div>
        </div>

        <p className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
          {formatBs(avgTicket)}
        </p>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--mg-separator)] text-[11px]">
          <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
            Ticket promedio
          </span>
          <span className="text-[var(--mg-text-muted)] font-medium">
            {paidSalesCount} ops.
          </span>
        </div>
      </motion.div>

    </motion.div>
  );
}
