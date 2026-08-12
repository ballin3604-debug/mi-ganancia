import { motion, AnimatePresence } from 'motion/react';
import { signOut } from '../services/auth';

export function LogoutModal({ isOpen, onClose, user, business }) {
  if (!isOpen) return null;

  const handleConfirmLogout = async () => {
    try {
      await signOut();
      onClose();
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
      alert('No se pudo cerrar la sesión. Intenta de nuevo.');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="bg-[var(--mg-bg-surface)] rounded-[28px] border border-[var(--mg-border)] p-6 shadow-2xl max-w-sm w-full text-center relative overflow-hidden"
        >
          {/* Halos decorativos */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Avatar del usuario */}
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center text-2xl font-black shadow-lg border-4 border-white mb-4">
            {user?.displayName ? user.displayName.charAt(0).toUpperCase() : '👤'}
          </div>

          <h3 className="text-lg font-black text-[var(--mg-text-primary)] tracking-tight">
            ¿Deseas cerrar sesión?
          </h3>

          <p className="text-xs text-[var(--mg-text-muted)] font-medium mt-1.5 leading-relaxed">
            Se pausará la sesión activa de <strong className="text-[var(--mg-text-primary)]">{user?.displayName || 'Usuario'}</strong> en <strong className="text-[var(--mg-accent)]">{business?.name || 'Mi Ganancia'}</strong>. Todos tus datos locales están guardados.
          </p>

          <div className="my-5 p-3 rounded-2xl bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] flex items-center justify-between text-xs text-[var(--mg-text-secondary)] font-bold">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Estado del sistema
            </span>
            <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Seguro
            </span>
          </div>

          {/* Botones */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              type="button"
              className="w-full bg-[var(--mg-bg-elevated)] hover:bg-slate-200 text-[var(--mg-text-secondary)] font-bold py-3 px-4 rounded-xl text-xs active:scale-95 transition-all border border-[var(--mg-border)] min-h-[44px]"
            >
              Cancelar
            </button>

            <button
              onClick={handleConfirmLogout}
              type="button"
              className="w-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-extrabold py-3 px-4 rounded-xl text-xs active:scale-95 transition-all shadow-md border border-rose-500/30 flex items-center justify-center gap-1.5 min-h-[44px]"
            >
              <svg className="w-4 h-4 fill-none stroke-current" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
