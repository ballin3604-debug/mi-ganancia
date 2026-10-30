import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EXPENSE_CATEGORIES, addExpense, updateExpense, EXPENSE_PAYMENT_LABELS } from '../../services/expenses';
import { clampNumberInput, blockInvalidNumberKeys } from '../../utils/numberInput';
import { AppIcon } from '../icons';

const CATEGORY_ICONS = {
  'Mercadería': 'paquete',
  'Servicios básicos': 'reloj',
  'Alquiler': 'tienda',
  'Transporte': 'traspaso',
  'Empleados': 'equipo',
  'Limpieza': 'check',
  'Otros': 'etiqueta',
};

const PAYMENT_OPTIONS = [
  { id: 'efectivo', label: 'Efectivo', icon: 'cash' },
  { id: 'qr', label: 'QR Simple', icon: 'qr' },
  { id: 'transferencia', label: 'Transfer.', icon: 'traspaso' },
  { id: 'tarjeta', label: 'Tarjeta', icon: 'tarjeta' },
];

function defaultAlertDate() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function AddExpenseModal({ businessId, isOpen, onClose, onSaved, editingExpense = null }) {
  const [description, setDescription] = useState('');
  const [supplier, setSupplier] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Mercadería');
  const [expenseType, setExpenseType] = useState('daily');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertDate, setAlertDate] = useState('');
  const [alertDaysBefore, setAlertDaysBefore] = useState(3);
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
      setAlertEnabled(!!(editingExpense.alert_enabled ?? editingExpense.alertEnabled));
      setAlertDate(editingExpense.alert_date || editingExpense.alertDate || '');
      setAlertDaysBefore(Number(editingExpense.alert_days_before ?? editingExpense.alertDaysBefore ?? 3));
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
      setAlertEnabled(false);
      setAlertDate('');
      setAlertDaysBefore(3);
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
    if (expenseType === 'fixed' && alertEnabled && !alertDate) {
      setError('Elige la fecha del aviso para el pago fijo.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        description, supplier, amount, category,
        expenseType, paymentMethod, invoiceNumber, notes,
        alertEnabled: expenseType === 'fixed' && alertEnabled,
        alertDate: expenseType === 'fixed' && alertEnabled ? alertDate : null,
        alertDaysBefore,
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
          className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shadow-2xl sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="expense-form-title"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)] p-4 sm:p-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)]">
                <AppIcon name="gastos" size={19} />
              </div>
              <div className="min-w-0">
                <h3 id="expense-form-title" className="truncate text-base font-black text-[var(--mg-text-primary)] sm:text-lg">
                  {isEditing ? 'Editar egreso' : 'Registrar egreso'}
                </h3>
                <p className="text-[11px] font-medium text-[var(--mg-text-muted)] sm:text-xs">Detalle del gasto o salida de dinero</p>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              aria-label="Cerrar formulario de egreso"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-text-muted)] transition-colors hover:text-[var(--mg-text-primary)]"
            >
              <AppIcon name="cerrar" size={17} />
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
                  aria-pressed={expenseType === 'daily'}
                  className={`flex min-h-[50px] items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-extrabold transition-all active:scale-95 ${
                    expenseType === 'daily'
                      ? 'border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)] shadow-[var(--mg-shadow-sm)]'
                      : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
                  }`}
                >
                  <AppIcon name="cash" size={17} />
                  <span className="text-left leading-tight">Diario<br /><span className="text-[10px] font-semibold opacity-70">Operativo / Caja chica</span></span>
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseType('fixed')}
                  aria-pressed={expenseType === 'fixed'}
                  className={`flex min-h-[50px] items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-extrabold transition-all active:scale-95 ${
                    expenseType === 'fixed'
                      ? 'border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent-text)] shadow-[var(--mg-shadow-sm)]'
                      : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
                  }`}
                >
                  <AppIcon name="reloj" size={17} />
                  <span className="text-left leading-tight">Fijo<br /><span className="text-[10px] font-semibold opacity-70">Alquiler / Servicios / Mes</span></span>
                </button>
              </div>
            </div>

            {expenseType === 'fixed' && (
              <div className="rounded-2xl border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-[var(--mg-text-primary)]">Avisar en Inicio</p>
                    <p className="text-[11px] font-semibold leading-snug text-[var(--mg-text-muted)]">
                      Aparece cuando se acerca la fecha del pago fijo.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={alertEnabled}
                    aria-label="Avisar pago fijo en Inicio"
                    onClick={() => {
                      const next = !alertEnabled;
                      setAlertEnabled(next);
                      if (next && !alertDate) setAlertDate(defaultAlertDate());
                    }}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors active:scale-95 ${
                      alertEnabled ? 'bg-[var(--mg-accent)]' : 'bg-[var(--mg-border-hover)]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-all ${
                        alertEnabled ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                {alertEnabled && (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                        Fecha del aviso *
                      </label>
                      <input
                        type="date"
                        value={alertDate}
                        onChange={(e) => setAlertDate(e.target.value)}
                        className="mg-input min-h-[44px] text-xs font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                        Avisar antes
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[1, 3, 7].map((days) => {
                          const active = alertDaysBefore === days;
                          return (
                            <button
                              key={days}
                              type="button"
                              onClick={() => setAlertDaysBefore(days)}
                              aria-pressed={active}
                              className={`min-h-[44px] rounded-xl border text-[11px] font-extrabold transition-all active:scale-95 ${
                                active
                                  ? 'border-[var(--mg-accent)] bg-[var(--mg-bg-surface)] text-[var(--mg-accent-text)]'
                                  : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
                              }`}
                            >
                              {days} día{days === 1 ? '' : 's'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                className="mg-input min-h-[46px] text-sm font-semibold"
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
                {[...EXPENSE_CATEGORIES.filter((c) => c !== 'Otros'), 'Otros'].map((cat) => {
                  const active = category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      aria-pressed={active}
                      className={`flex min-h-[42px] items-center gap-1.5 rounded-xl border p-2 text-xs font-extrabold transition-all active:scale-95 ${
                        active
                          ? 'border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent-text)] shadow-[var(--mg-shadow-sm)]'
                          : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)]'
                      }`}
                    >
                      <AppIcon name={CATEGORY_ICONS[cat] || 'etiqueta'} size={15} />
                      <span className="truncate">{cat}</span>
                    </button>
                  );
                })}
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
                  className="mg-input min-h-[44px] text-xs font-medium"
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
                  className="mg-input min-h-[44px] font-mono text-xs placeholder:font-sans"
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
                {PAYMENT_OPTIONS.map((opt) => {
                  const active = paymentMethod === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPaymentMethod(opt.id)}
                      title={EXPENSE_PAYMENT_LABELS[opt.id]}
                      aria-pressed={active}
                      className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border p-2 text-[11px] font-extrabold transition-all active:scale-95 ${
                        active
                          ? 'border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent-text)]'
                          : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
                      }`}
                    >
                      <AppIcon name={opt.icon} size={15} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
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
                className="mg-input min-h-[44px] text-xs font-medium"
                maxLength={200}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] p-3 text-xs font-bold text-[var(--mg-danger)]">
                <AppIcon name="cancelar" size={15} className="mt-0.5" />
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
