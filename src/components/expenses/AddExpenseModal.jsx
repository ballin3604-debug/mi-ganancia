import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EXPENSE_CATEGORIES, addExpense } from '../../services/expenses';
import { clampNumberInput, blockInvalidNumberKeys } from '../../utils/numberInput';

const CATEGORY_ICONS = {
  'Mercadería': '📦',
  'Servicios básicos': '💡',
  'Alquiler': '🏠',
  'Transporte': '🚚',
  'Empleados': '👤',
  'Otros': '📝',
};

export function AddExpenseModal({ businessId, isOpen, onClose, onSaved }) {
  const [description, setDescription] = useState('');
  const [supplier, setSupplier] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Mercadería');
  const [expenseType, setExpenseType] = useState('daily');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim() || !amount || Number(amount) <= 0) {
      setError('Completa la descripción y un monto mayor a 0.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addExpense(businessId, { description, supplier, amount, category, expenseType });
      onSaved();
    } catch (err) {
      console.error(err);
      setError('Error al guardar el egreso. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

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
          className="bg-[var(--mg-bg-surface)] rounded-t-[28px] sm:rounded-[28px] w-full max-w-lg border border-[var(--mg-border)] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 border-b border-[var(--mg-separator)] flex items-center justify-between bg-[var(--mg-bg-elevated)] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] flex items-center justify-center text-xl shrink-0 font-bold">
                💸
              </div>
              <div>
                <h3 className="text-lg font-black text-[var(--mg-text-primary)]">Registrar Egreso</h3>
                <p className="text-xs text-[var(--mg-text-muted)] font-medium">Ingresa los detalles del gasto o salida de dinero</p>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="w-9 h-9 bg-[var(--mg-bg-surface)] hover:bg-[var(--mg-bg-section)] border border-[var(--mg-border)] rounded-full flex items-center justify-center text-[var(--mg-text-muted)] text-lg font-bold transition-all active:scale-95"
            >
              ×
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
            {/* Categoría */}
            <div>
              <label className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-2">
                Categoría del Gasto
              </label>
              <div className="grid grid-cols-3 gap-2">
                {EXPENSE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex flex-col items-center py-2.5 px-2 rounded-xl text-xs font-extrabold border-2 transition-all active:scale-95 min-h-[58px] justify-center ${
                      category === cat
                        ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] shadow-xs'
                        : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)] hover:border-[var(--mg-border-hover)]'
                    }`}
                  >
                    <span className="text-xl mb-1">{CATEGORY_ICONS[cat] || '📝'}</span>
                    <span className="truncate w-full text-center">{cat}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tipo de Gasto */}
            <div>
              <label className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-2">
                Tipo de Gasto
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExpenseType('daily')}
                  className={`py-3 px-3 rounded-xl text-xs font-extrabold border-2 transition-all active:scale-95 min-h-[46px] flex items-center justify-center gap-2 ${
                    expenseType === 'daily'
                      ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] shadow-xs'
                      : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
                  }`}
                >
                  <span className="text-base">☀️</span>
                  <span>Diario (Operativo)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseType('fixed')}
                  className={`py-3 px-3 rounded-xl text-xs font-extrabold border-2 transition-all active:scale-95 min-h-[46px] flex items-center justify-center gap-2 ${
                    expenseType === 'fixed'
                      ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] shadow-xs'
                      : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
                  }`}
                >
                  <span className="text-base">📅</span>
                  <span>Fijo / Mensual</span>
                </button>
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1.5">
                Descripción *
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Compra de mercadería PIL, pago de luz..."
                className="w-full bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent)] text-sm text-[var(--mg-text-primary)] font-semibold placeholder:text-[var(--mg-text-faint)] transition-all min-h-[46px]"
                maxLength={100}
                required
              />
            </div>

            {/* Proveedor / Origen */}
            <div>
              <label className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1.5">
                Proveedor / Origen <span className="text-[var(--mg-text-faint)] font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Ej: Distribuidora PIL, DELAPAZ, Mercado Central..."
                className="w-full bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent)] text-sm text-[var(--mg-text-primary)] font-medium placeholder:text-[var(--mg-text-faint)] transition-all min-h-[46px]"
                maxLength={80}
              />
            </div>

            {/* Monto */}
            <div>
              <label className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1.5">
                Monto (Bs) *
              </label>
              <div className="flex items-center border-2 border-[var(--mg-border)] rounded-xl overflow-hidden focus-within:border-[var(--mg-accent)] transition-all">
                <span className="px-4 py-3 bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)] font-black border-r border-[var(--mg-border)] text-sm shrink-0">
                  Bs
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(clampNumberInput(e.target.value, { max: 999999 }))}
                  onKeyDown={blockInvalidNumberKeys}
                  placeholder="0.00"
                  className="flex-1 px-4 py-3 focus:outline-none text-xl font-black text-[var(--mg-text-primary)] bg-transparent min-h-[46px]"
                  min="0.01"
                  max="999999"
                  step="0.01"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-[var(--mg-danger-bg)] border border-red-200 rounded-xl text-[var(--mg-danger)] text-xs font-bold text-center">
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3.5 px-4 bg-[var(--mg-bg-elevated)] hover:bg-[var(--mg-bg-section)] text-[var(--mg-text-secondary)] font-extrabold rounded-xl text-xs border border-[var(--mg-border)] transition-all active:scale-95 min-h-[48px]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3.5 px-4 bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white font-extrabold rounded-xl text-xs transition-all active:scale-95 disabled:opacity-50 min-h-[48px] shadow-sm flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>Registrar Egreso</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
