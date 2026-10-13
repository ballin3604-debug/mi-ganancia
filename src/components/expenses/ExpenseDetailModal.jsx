import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { formatBs } from '../../utils/currency';
import { EXPENSE_PAYMENT_LABELS } from '../../services/expenses';
import { AppIcon } from '../icons';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ExpenseDetailModal({ expense, isOpen, onClose, onEdit, onDelete }) {
  if (!isOpen || !expense) return null;
  const isFixed = (expense.expense_type || expense.expenseType) === 'fixed';
  const payLabel = EXPENSE_PAYMENT_LABELS[expense.payment_method] || 'Efectivo (Caja)';

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs mg-backdrop-in"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-[var(--mg-bg-surface)] rounded-t-[28px] sm:rounded-[28px] w-full max-w-md border border-[var(--mg-border)] shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-4 border-b border-[var(--mg-separator)] flex items-center justify-between bg-[var(--mg-bg-elevated)]">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
              Detalle de Egreso
            </span>
            <button
              onClick={onClose}
              type="button"
              className="w-8 h-8 bg-[var(--mg-bg-surface)] hover:bg-[var(--mg-bg-section)] border border-[var(--mg-border)] rounded-full flex items-center justify-center text-[var(--mg-text-muted)] font-bold transition-all active:scale-95"
            >
              ×
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div className="text-center py-1">
              <span className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block">
                Monto Pagado
              </span>
              <div className="text-3xl font-black tracking-tight text-[var(--mg-text-primary)] mt-0.5">
                {formatBs(expense.amount)}
              </div>
              <div className="mt-2 flex items-center justify-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)] border border-[var(--mg-border)]">
                  {expense.category} · {isFixed ? 'Gasto Fijo' : 'Gasto Diario'}
                </span>
              </div>
            </div>

            <div className="bg-[var(--mg-bg-elevated)] rounded-2xl p-4 border border-[var(--mg-border)] text-xs space-y-2.5">
              <div className="flex justify-between gap-3">
                <span className="text-[var(--mg-text-muted)] font-semibold">Concepto:</span>
                <span className="font-extrabold text-[var(--mg-text-primary)] text-right">{expense.description}</span>
              </div>
              {expense.supplier && (
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--mg-text-muted)] font-semibold">Proveedor:</span>
                  <span className="font-bold text-[var(--mg-text-primary)] text-right">{expense.supplier}</span>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <span className="text-[var(--mg-text-muted)] font-semibold">Método de Pago:</span>
                <span className="font-bold text-[var(--mg-text-primary)] text-right">{payLabel}</span>
              </div>
              {expense.invoice_number && (
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--mg-text-muted)] font-semibold">Comprobante:</span>
                  <span className="font-mono font-extrabold text-[var(--mg-text-primary)] text-right">{expense.invoice_number}</span>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <span className="text-[var(--mg-text-muted)] font-semibold">Fecha:</span>
                <span className="font-bold text-[var(--mg-text-primary)] text-right">{formatDate(expense.createdAt)}</span>
              </div>
            </div>

            {expense.notes && (
              <div className="p-3 bg-[var(--mg-accent-bg)] rounded-xl border border-[var(--mg-accent-border)] text-xs text-[var(--mg-text-secondary)]">
                <strong className="text-[var(--mg-accent)] block mb-0.5">Observaciones:</strong>
                {expense.notes}
              </div>
            )}
          </div>

          <div className="px-5 py-4 bg-[var(--mg-bg-elevated)] border-t border-[var(--mg-separator)] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onDelete(expense)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-extrabold text-[var(--mg-danger)] bg-[var(--mg-danger-bg)] hover:brightness-95 border border-red-200 transition-all active:scale-95"
            >
              <AppIcon name="eliminar" size={14} />
              <span>Eliminar</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEdit(expense)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-extrabold bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] text-[var(--mg-text-secondary)] hover:bg-[var(--mg-bg-section)] transition-all active:scale-95"
              >
                <AppIcon name="editar" size={13} />
                <span>Editar</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[var(--mg-accent)] text-white hover:bg-[var(--mg-accent-hover)] transition-all active:scale-95"
              >
                Cerrar
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
