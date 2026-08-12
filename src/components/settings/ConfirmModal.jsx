import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirmar', danger = false, loading = false }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs mg-backdrop-in">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-[var(--mg-bg-surface)] w-full max-w-sm rounded-[24px] p-6 border border-[var(--mg-border)] shadow-lg space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
              danger ? 'bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]' : 'bg-[var(--mg-accent-bg)] text-[var(--mg-accent)]'
            }`}>
              {danger ? '⚠️' : '❓'}
            </div>
            <div>
              <h3 className="font-extrabold text-[var(--mg-text-primary)] text-base">{title}</h3>
              <p className="text-xs text-[var(--mg-text-muted)] mt-0.5">{message}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-[var(--mg-separator)]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 px-4 bg-[var(--mg-bg-elevated)] hover:bg-[var(--mg-bg-section)] text-[var(--mg-text-primary)] font-bold rounded-xl text-xs border border-[var(--mg-border)] transition-all active:scale-95 disabled:opacity-50 min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 py-3 px-4 font-bold rounded-xl text-xs text-white transition-all active:scale-95 disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-2 ${
                danger ? 'bg-[var(--mg-danger)] hover:opacity-90' : 'bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)]'
              }`}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                confirmText
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
