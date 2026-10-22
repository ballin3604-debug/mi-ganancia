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
          className="w-full max-w-md overflow-hidden rounded-t-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shadow-2xl sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="expense-detail-title"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)] px-5 py-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)]">
                <AppIcon name="gastos" size={17} />
              </span>
              <div className="min-w-0">
                <h3 id="expense-detail-title" className="text-sm font-black text-[var(--mg-text-primary)]">Detalle de egreso</h3>
                <p className="text-[11px] font-medium text-[var(--mg-text-muted)]">Información del movimiento</p>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              aria-label="Cerrar detalle del egreso"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-text-muted)] transition-colors hover:text-[var(--mg-text-primary)]"
            >
              <AppIcon name="cerrar" size={17} />
            </button>
          </div>

          <div className="space-y-4 p-5">
            <div className="py-1 text-center">
              <span className="block text-[10px] font-black uppercase tracking-widest text-[var(--mg-text-muted)]">
                Monto pagado
              </span>
              <div className="mt-1 text-3xl font-black tracking-tight text-[var(--mg-danger)]">
                {formatBs(expense.amount)}
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                <span className="inline-flex items-center rounded-full border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--mg-text-secondary)]">
                  {expense.category} · {isFixed ? 'Gasto fijo' : 'Gasto diario'}
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
              className="flex items-center gap-1.5 rounded-xl border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] px-3 py-2.5 text-xs font-extrabold text-[var(--mg-danger)] transition-all hover:brightness-95 active:scale-95"
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
