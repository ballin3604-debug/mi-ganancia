import { motion } from 'motion/react';

/**
 * Estado de inicio cuando todavía no hay ventas registradas en el día.
 * Reemplaza a las tarjetas de métricas y a los gráficos, que en cero solo
 * mostrarían "Bs 0.00" y "Sin registro".
 */
export function EmptyDayState({ isOwner, pendingSalesYesterday, onNavigate }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="relative bg-[var(--mg-bg-surface)] rounded-[24px] border border-[var(--mg-border)] shadow-xs overflow-hidden"
    >
      {/* Lavado de color suave, sin romper el tema claro */}
      <div
        className="absolute inset-x-0 top-0 h-40 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, var(--mg-accent-bg-soft) 0%, transparent 100%)' }}
      />

      <div className="relative px-6 py-10 sm:py-12 flex flex-col items-center text-center">
        {/* Ilustración */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-5"
        >
          <div className="absolute inset-0 bg-[var(--mg-accent)]/10 rounded-full blur-2xl" />
          <div className="relative w-20 h-20 rounded-[26px] bg-[var(--mg-accent-bg)] border border-[var(--mg-accent-border)] flex items-center justify-center text-[var(--mg-accent)]">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </motion.div>

        <h2 className="text-lg sm:text-xl font-black text-[var(--mg-text-primary)] tracking-tight">
          Todavía no hay ventas hoy
        </h2>
        <p className="text-xs sm:text-sm text-[var(--mg-text-muted)] font-medium mt-2 max-w-sm leading-relaxed">
          En cuanto registres la primera venta del día vas a ver acá tu total cobrado,
          la hora pico, el producto estrella y los gráficos por franja horaria.
        </p>

        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onNavigate('/ventas')}
          type="button"
          className="mt-6 bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white font-extrabold px-6 py-3.5 rounded-2xl text-sm shadow-md flex items-center gap-2 min-h-[48px] border border-[var(--mg-accent-border)]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span>Registrar primera venta</span>
        </motion.button>

        {/* Atajo secundario, útil sólo si hay algo pendiente por cobrar */}
        {isOwner && pendingSalesYesterday > 0 && (
          <button
            onClick={() => onNavigate('/cxc')}
            type="button"
            className="mt-3 text-xs font-bold text-[var(--mg-gold-text)] hover:underline"
          >
            Tenés {pendingSalesYesterday} {pendingSalesYesterday === 1 ? 'fiado pendiente' : 'fiados pendientes'} por cobrar ›
          </button>
        )}
      </div>
    </motion.div>
  );
}
