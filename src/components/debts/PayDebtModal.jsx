import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { formatBs } from '../../utils/currency';
import { AppIcon } from '../icons';

export function PayDebtModal({ debt, isOpen, onClose, onConfirm }) {
  const [processing, setProcessing] = useState(false);

  if (!isOpen || !debt) return null;

  const handleSelectMethod = async (method) => {
    setProcessing(true);
    try {
      await onConfirm(debt, method);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs mg-backdrop-in"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="bg-[var(--mg-bg-surface)] rounded-[28px] p-6 w-full max-w-sm text-center shadow-2xl border border-[var(--mg-border)] relative mg-modal-in"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)] font-bold text-base flex items-center justify-center transition-all active:scale-95"
          >
            ✕
          </button>

          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[var(--mg-success-text)] flex items-center justify-center text-2xl mx-auto mb-3 font-bold border border-emerald-200">
            ✓
          </div>

          <h3 className="text-lg font-black text-[var(--mg-text-primary)] tracking-tight">
            Registrar Cobro de Fiado
          </h3>
          <p className="text-xs text-[var(--mg-text-muted)] font-medium mt-0.5 mb-4">
            Cliente: <strong className="text-[var(--mg-text-primary)]">{debt.clientName}</strong>
          </p>

          <div className="bg-[var(--mg-bg-elevated)] p-4 rounded-2xl border border-[var(--mg-border)] mb-5 text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)] block">
              Monto a Cobrar
            </span>
            <span className="text-3xl font-black text-[var(--mg-accent)] block mt-1">
              {formatBs(debt.amount)}
            </span>
          </div>

          <p className="text-xs font-extrabold text-[var(--mg-text-secondary)] mb-3 text-left">
            Selecciona el método de pago recibido:
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              type="button"
              disabled={processing}
              onClick={() => handleSelectMethod('cash')}
              className="py-3.5 px-3 bg-[var(--mg-bg-surface)] hover:bg-[var(--mg-bg-elevated)] border-2 border-[var(--mg-border)] hover:border-[var(--mg-accent)] text-[var(--mg-text-primary)] rounded-2xl text-xs font-extrabold flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all shadow-2xs min-h-[72px]"
            >
              <AppIcon name="cash" size={26} />
              <span>Efectivo</span>
            </button>

            <button
              type="button"
              disabled={processing}
              onClick={() => handleSelectMethod('qr')}
              className="py-3.5 px-3 bg-[var(--mg-bg-surface)] hover:bg-[var(--mg-accent-bg)] border-2 border-[var(--mg-border)] hover:border-[var(--mg-accent)] text-[var(--mg-text-primary)] rounded-2xl text-xs font-extrabold flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all shadow-2xs min-h-[72px]"
            >
              <AppIcon name="qr" size={26} />
              <span>Pago QR</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="w-full py-3 bg-[var(--mg-bg-elevated)] hover:bg-[var(--mg-bg-section)] text-[var(--mg-text-muted)] border border-[var(--mg-border)] rounded-xl text-xs font-extrabold active:scale-95 transition-all min-h-[42px]"
          >
            Cancelar
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
