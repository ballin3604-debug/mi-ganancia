import { motion } from 'motion/react';
import { formatBs, formatBsShort } from '../../utils/currency';
import { AppIcon } from '../icons';
import { ProfitIcon } from '../ProfitIcon';

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
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-3 sm:gap-4"
    >
      {/* 1. VENTAS DE HOY: métrica principal, en celular abre la auditoría */}
      <motion.div
        variants={itemVariants}
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
        onClick={() => {
          const isMobile = window.matchMedia('(max-width: 1023px)').matches;
          onNavigate && onNavigate(isMobile ? '/ventas?tab=auditoria' : '/ventas?tab=reporte');
        }}
        className="relative overflow-hidden rounded-3xl bg-[var(--mg-brand)] p-5 sm:p-6 text-white shadow-[var(--mg-shadow-md)] hover:shadow-[var(--mg-shadow-lg)] transition-shadow group cursor-pointer sm:col-span-2 xl:col-span-5"
      >
        <span className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/5" />
        <span className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-white/5" />

        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
                Ventas de hoy
              </p>
              <p className="mt-2 text-3xl sm:text-4xl font-black tracking-tight tabular-nums">
                {formatBs(totalHoy)}
              </p>
            </div>
            <span className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <AppIcon name="caja" size={20} color="#fff" />
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3 text-[11px]">
            <span className="font-bold text-white/90">
              {paidSalesCount} {paidSalesCount === 1 ? 'venta' : 'ventas'}
            </span>
            <span className="flex items-center gap-2 font-semibold text-white/70">
              <span className="flex items-center gap-1"><AppIcon name="cash" size={12} color="#fff" /> {formatBsShort(totalCash)}</span>
              <span className="text-white/25">·</span>
              <span className="flex items-center gap-1"><AppIcon name="qr" size={12} color="#fff" /> {formatBsShort(totalQr)}</span>
            </span>
          </div>
        </div>
      </motion.div>

      {/* 2. GANANCIA DE HOY (ventas − costo − gastos): sin navegación */}
      <motion.div
        variants={itemVariants}
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
        className="bg-[var(--mg-bg-surface)] rounded-3xl p-5 border border-[var(--mg-border)] shadow-[var(--mg-shadow-sm)] hover:shadow-[var(--mg-shadow-md)] transition-shadow group relative overflow-hidden sm:col-span-1 xl:col-span-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--mg-text-secondary)]">
              Ganancia de hoy
            </p>
            <p className={`mt-2 text-3xl font-black tracking-tight tabular-nums ${gananciaNeta >= 0 ? 'text-[var(--mg-success-text)]' : 'text-[var(--mg-danger)]'}`}>
              {formatBs(gananciaNeta)}
            </p>
          </div>
          <span className="w-10 h-10 rounded-2xl bg-[var(--mg-success-bg)] border border-[var(--mg-success-border)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <ProfitIcon className="w-7 h-6" />
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--mg-separator)] pt-3 text-[11px]">
          <span className={`font-bold px-2 py-0.5 rounded-full border tabular-nums ${
            gananciaNeta >= 0
              ? 'text-[var(--mg-success-text)] bg-[var(--mg-success-bg)] border-[var(--mg-success-border)]'
              : 'text-[var(--mg-danger)] bg-[var(--mg-danger-bg)] border-[var(--mg-danger-border)]'
          }`}>
            Margen {margen.toFixed(1)}%
          </span>
          <span className="text-[var(--mg-text-muted)] font-medium">
            Ventas − costo − gastos
          </span>
        </div>
      </motion.div>

      {/* 3. COMPRAS DE HOY: métrica secundaria */}
      <motion.div
        variants={itemVariants}
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
        onClick={() => onNavigate && onNavigate('/compras?tab=historial')}
        className="bg-[var(--mg-bg-surface)] rounded-3xl p-5 border border-[var(--mg-border)] shadow-[var(--mg-shadow-sm)] hover:shadow-[var(--mg-shadow-md)] transition-shadow group relative overflow-hidden cursor-pointer sm:col-span-1 xl:col-span-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--mg-text-secondary)]">
              Compras de hoy
            </p>
            <p className="mt-2 text-xl sm:text-2xl font-black text-[var(--mg-gold-text)] tracking-tight tabular-nums">
              {formatBs(comprasTotal)}
            </p>
          </div>
          <span className="w-10 h-10 rounded-2xl bg-[var(--mg-gold-bg)] border border-[var(--mg-gold-border)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <AppIcon name="nuevoProducto" size={20} />
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--mg-separator)] pt-3 text-[11px]">
          <span className="font-bold text-[var(--mg-text-secondary)]">
            {comprasCount} {comprasCount === 1 ? 'compra' : 'compras'}
          </span>
          <span className="text-[var(--mg-text-muted)] font-medium">
            Reposición del día
          </span>
        </div>
      </motion.div>

    </motion.div>
  );
}
