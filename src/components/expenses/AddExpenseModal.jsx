import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EXPENSE_CATEGORIES, addExpense, updateExpense, EXPENSE_PAYMENT_LABELS } from '../../services/expenses';
import { clampNumberInput, blockInvalidNumberKeys } from '../../utils/numberInput';

const CATEGORY_ICONS = {
  'Mercadería': '📦',
  'Servicios básicos': '💡',
  'Alquiler': '🏠',
  'Transporte': '🚚',
  'Empleados': '👤',
  'Limpieza': '🧹',
  'Otros': '📝',
};

const PAYMENT_OPTIONS = [
  { id: 'efectivo', label: 'Efectivo', icon: '💵' },
  { id: 'qr', label: 'QR Simple', icon: '📲' },
  { id: 'transferencia', label: 'Transfer.', icon: '🏦' },
  { id: 'tarjeta', label: 'Tarjeta', icon: '💳' },
];

export function AddExpenseModal({ businessId, isOpen, onClose, onSaved, editingExpense = null }) {
  const [description, setDescription] = useState('');
  const [supplier, setSupplier] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Mercadería');
  const [expenseType, setExpenseType] = useState('daily');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!editingExpense;

  // Precarga cuando se edita (diseño Inicio7: mismo modal sirve para editar)
  useEffect(() => {
    if (isOpen && editingExpense) {
      setDescription(editingExpense.description || '');
      setSupplier(editingExpense.supplier || '');
      setAmount(String(editingExpense.amount ?? ''));
      setCategory(editingExpense.category || 'Mercadería');
      setExpenseType(editingExpense.expense_type || editingExpense.expenseType || 'daily');
      setPaymentMethod(editingExpense.payment_method || 'efectivo');
      setInvoiceNumber(editingExpense.invoice_number || '');
      setNotes(editingExpense.notes || '');
      setError('');
    } else if (isOpen && !editingExpense) {
      setDescription('');
      setSupplier('');
      setAmount('');
      setCategory('Mercadería');
      setExpenseType('daily');
      setPaymentMethod('efectivo');
      setInvoiceNumber('');
      setNotes('');
      setError('');
    }
  }, [isOpen, editingExpense]);

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
      const payload = {
        description, supplier, amount, category,
        expenseType, paymentMethod, invoiceNumber, notes,
      };
      if (isEditing) {
        await updateExpense(editingExpense.id, payload);
      } else {
        await addExpense(businessId, payload);
      }
      onSaved();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al guardar el egreso. Intenta de nuevo.');
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
                <h3 className="text-lg font-black text-[var(--mg-text-primary)]">
                  {isEditing ? 'Editar Egreso' : 'Registrar Egreso'}
                </h3>
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
            {/* Tipo de Gasto (estilo Inicio7: Diario ámbar / Fijo índigo) */}
            <div>
              <label className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-2">
                Tipo de Egreso
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExpenseType('daily')}
                  className={`py-3 px-3 rounded-xl text-xs font-extrabold border-2 transition-all active:scale-95 min-h-[46px] flex items-center justify-center gap-2 ${
                    expenseType === 'daily'
                      ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-xs'
                      : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
                  }`}
                >
                  <span className="text-base">☀️</span>
                  <span className="leading-tight text-left">Diario<br /><span className="font-semibold text-[10px] opacity-70">Operativo / Caja chica</span></span>
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseType('fixed')}
                  className={`py-3 px-3 rounded-xl text-xs font-extrabold border-2 transition-all active:scale-95 min-h-[46px] flex items-center justify-center gap-2 ${
                    expenseType === 'fixed'
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-900 shadow-xs'
                      : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
                  }`}
                >
                  <span className="text-base">📅</span>
                  <span className="leading-tight text-left">Fijo<br /><span className="font-semibold text-[10px] opacity-70">Alquiler / Servicios / Mes</span></span>
                </button>
              </div>
            </div>

            {/* Monto destacado (caja grande como Inicio7) */}
            <div className="bg-[var(--mg-bg-elevated)] p-4 rounded-2xl border border-[var(--mg-border)] text-center">
              <label className="block text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider mb-1">
                Monto a Registrar
              </label>
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl font-black text-[var(--mg-text-muted)]">Bs</span>
                <input
                  type="number"
                  inputMode="decimal"
                  autoFocus={!isEditing}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(clampNumberInput(e.target.value, { max: 999999 }))}
                  onKeyDown={blockInvalidNumberKeys}
                  className="w-44 text-3xl font-black text-[var(--mg-text-primary)] text-center bg-transparent border-b-2 border-[var(--mg-accent)] focus:outline-none min-h-[48px]"
                  min="0.01"
                  max="999999"
                  step="0.01"
                  required
                />
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1.5">
                Concepto / Descripción *
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Pago de bolsas para mostrador, pago de luz..."
                className="w-full bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent)] text-sm text-[var(--mg-text-primary)] font-semibold placeholder:text-[var(--mg-text-faint)] transition-all min-h-[46px]"
                maxLength={100}
                required
              />
            </div>

            {/* Categoría (pills grid Inicio7) */}
            <div>
              <label className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-2">
                Categoría
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {EXPENSE_CATEGORIES.filter((c) => c !== 'Otros').map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`p-2 rounded-xl text-xs font-extrabold border-2 flex items-center gap-1.5 transition-all active:scale-95 min-h-[42px] ${
                      category === cat
                        ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] shadow-xs'
                        : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)]'
                    }`}
                  >
                    <span className="text-base">{CATEGORY_ICONS[cat] || '📝'}</span>
                    <span className="truncate">{cat}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCategory('Otros')}
                  className={`p-2 rounded-xl text-xs font-extrabold border-2 flex items-center gap-1.5 transition-all active:scale-95 min-h-[42px] ${
                    category === 'Otros'
                      ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] shadow-xs'
                      : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)]'
                  }`}
                >
                  <span className="text-base">📝</span>
                  <span className="truncate">Otros</span>
                </button>
              </div>
            </div>

            {/* Proveedor + Comprobante (lado a lado como Inicio7) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1.5">
                  Proveedor
                </label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Ej: Distribuidora Oriente, CRE..."
                  className="w-full bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[var(--mg-accent)] text-xs text-[var(--mg-text-primary)] font-medium placeholder:text-[var(--mg-text-faint)] transition-all min-h-[44px]"
                  maxLength={80}
                />
              </div>
              <div>
                <label className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1.5">
                  N° Comprobante / Factura
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Ej: FAC-0492 o Recibo N° 12"
                  className="w-full bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[var(--mg-accent)] text-xs text-[var(--mg-text-primary)] font-mono placeholder:text-[var(--mg-text-faint)] placeholder:font-sans transition-all min-h-[44px]"
                  maxLength={40}
                />
              </div>
            </div>

            {/* Método de Pago (grid 4 como Inicio7) */}
            <div>
              <label className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-2">
                Método de Pago
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PAYMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentMethod(opt.id)}
                    title={EXPENSE_PAYMENT_LABELS[opt.id]}
                    className={`p-2 rounded-xl border-2 flex items-center justify-center gap-1.5 text-[11px] font-extrabold transition-all active:scale-95 min-h-[42px] ${
                      paymentMethod === opt.id
                        ? opt.id === 'efectivo'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : opt.id === 'qr'
                            ? 'border-blue-500 bg-blue-50 text-blue-800'
                            : opt.id === 'transferencia'
                              ? 'border-purple-500 bg-purple-50 text-purple-800'
                              : 'border-slate-600 bg-slate-100 text-slate-900'
                        : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
                    }`}
                  >
                    <span className="text-sm">{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1.5">
                Observaciones <span className="font-normal normal-case">(opcional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas opcionales sobre el pago..."
                className="w-full bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[var(--mg-accent)] text-xs text-[var(--mg-text-primary)] font-medium placeholder:text-[var(--mg-text-faint)] transition-all min-h-[44px]"
                maxLength={200}
              />
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
                  <span>{isEditing ? 'Guardar Cambios' : 'Registrar Egreso'}</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
