import React from 'react';
import { motion } from 'motion/react';
import { formatBs, formatBsShort } from '../../utils/currency';

export function MagicMetricCards({
  totalHoy = 0,
  paidSalesCount = 0,
  totalCash = 0,
  totalQr = 0,
  peakBand = null,
  totalPendingDebts = 0,
  uniqueClientsCount = 0,
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
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
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
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <p className="text-2xl sm:text-3xl font-black text-[var(--mg-text-primary)] tracking-tight">
          {formatBs(totalHoy)}
        </p>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--mg-separator)] text-[11px]">
          <span className="font-extrabold text-[var(--mg-text-secondary)]">
            {paidSalesCount} {paidSalesCount === 1 ? 'venta' : 'ventas'}
          </span>
          <span className="text-[var(--mg-text-muted)] font-medium">
            💵 {formatBsShort(totalCash)} · 📲 {formatBsShort(totalQr)}
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
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
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
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
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

      {/* 4. FIADOS POR COBRAR (CxC) */}
      <motion.div
        variants={itemVariants}
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
        onClick={() => onNavigate && onNavigate('/cxc')}
        className="bg-[var(--mg-bg-surface)] rounded-[22px] p-5 border border-[var(--mg-border)] shadow-xs hover:shadow-md transition-all group cursor-pointer relative overflow-hidden"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
            Fiados por Cobrar
          </span>
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 group-hover:scale-110 transition-transform">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>

        <p className="text-2xl sm:text-3xl font-black text-purple-600 tracking-tight">
          {formatBs(totalPendingDebts)}
        </p>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--mg-separator)] text-[11px]">
          <span className="font-extrabold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
            {uniqueClientsCount} {uniqueClientsCount === 1 ? 'cliente' : 'clientes'}
          </span>
          <span className="text-[var(--mg-text-muted)] font-bold text-[10px]">
            Gestionar ›
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
