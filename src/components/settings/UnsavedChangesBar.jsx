import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

export function UnsavedChangesBar({ hasChanges, changesCount, onSave, onDiscard, saving, saved }) {
  if (!hasChanges && !saved) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-40"
      >
        <div className="bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-accent-border)] rounded-[20px] p-3.5 shadow-lg flex items-center justify-between gap-3 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0 pl-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--mg-warning)] animate-pulse shrink-0" />
            <div className="truncate">
              <p className="text-xs font-black text-[var(--mg-text-primary)] truncate">
                {saved ? '¡Cambios guardados!' : `${changesCount} ${changesCount === 1 ? 'cambio sin guardar' : 'cambios sin guardar'}`}
              </p>
              <p className="text-[10px] text-[var(--mg-text-muted)] truncate">
                {saved ? 'Guardado en tu negocio' : 'Presiona guardar para aplicar'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!saved && (
              <button
                type="button"
                onClick={onDiscard}
                disabled={saving}
                className="px-3 py-2 text-xs font-bold text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)] rounded-xl hover:bg-[var(--mg-bg-elevated)] transition-all active:scale-95 disabled:opacity-50 min-h-[44px]"
              >
                Descartar
              </button>
            )}

            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs text-white transition-all active:scale-95 shadow-sm min-h-[44px] flex items-center gap-1.5 ${
                saved
                  ? 'bg-emerald-600'
                  : 'bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)]'
              } disabled:opacity-50`}
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Guardando…
                </>
              ) : saved ? (
                <>✓ Guardado</>
              ) : (
                <>💾 Guardar</>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
