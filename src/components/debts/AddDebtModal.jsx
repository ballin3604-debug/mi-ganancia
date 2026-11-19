import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { addDebt } from '../../services/debts';
import { clampNumberInput, blockInvalidNumberKeys } from '../../utils/numberInput';

const EMPTY_FORM = {
  clientName: '',
  amount: '',
  description: '',
  clientNit: '',
  clientPhone: '',
  dueDate: ''
};

export function AddDebtModal({ businessId, isOpen, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.clientName.trim() || !form.amount || Number(form.amount) <= 0) {
      setError('Ingresa el nombre del cliente y un monto válido.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addDebt(businessId, form);
      setForm(EMPTY_FORM);
      onSaved();
    } catch (err) {
      console.error(err);
      setError('Error al registrar el fiado. Intenta nuevamente.');
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
                📖
              </div>
              <div>
                <h3 className="text-lg font-black text-[var(--mg-text-primary)]">Nuevo Registro de Fiado</h3>
                <p className="text-xs text-[var(--mg-text-muted)] font-medium">Anota una venta al crédito para cobrar después</p>
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
            {/* Nombre del cliente */}
            <div>
              <label className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1.5">
                Nombre del Cliente *
              </label>
              <input
                type="text"
                value={form.clientName}
                onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                placeholder="Ej: Doña Rosa (Vecina del 3), Don Carlos..."
                className="w-full bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent)] text-sm text-[var(--mg-text-primary)] font-bold placeholder:text-[var(--mg-text-faint)] transition-all min-h-[46px]"
                required
                autoFocus
                maxLength={70}
              />
            </div>

            {/* NIT/CI y Teléfono */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1.5">
                  NIT / CI <span className="text-[var(--mg-text-faint)] font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={form.clientNit}
                  onChange={(e) => setForm((f) => ({ ...f, clientNit: e.target.value }))}
                  placeholder="Ej: 4938201"
                  className="w-full bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent)] text-sm text-[var(--mg-text-primary)] font-medium placeholder:text-[var(--mg-text-faint)] transition-all min-h-[46px]"
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1.5">
                  Teléfono / WhatsApp <span className="text-[var(--mg-text-faint)] font-normal">(Opcional)</span>
                </label>
                <input
                  type="tel"
                  value={form.clientPhone}
                  onChange={(e) => setForm((f) => ({ ...f, clientPhone: e.target.value }))}
                  placeholder="Ej: 71234567"
                  className="w-full bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent)] text-sm text-[var(--mg-text-primary)] font-medium placeholder:text-[var(--mg-text-faint)] transition-all min-h-[46px]"
                />
              </div>
            </div>

            {/* Monto y Fecha Límite */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1.5">
                  Monto a Deber (Bs) *
                </label>
                <div className="flex items-center border-2 border-[var(--mg-border)] rounded-xl overflow-hidden focus-within:border-[var(--mg-accent)] transition-all">
                  <span className="px-3.5 py-3 bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)] font-black border-r border-[var(--mg-border)] text-sm shrink-0">
                    Bs
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: clampNumberInput(e.target.value, { max: 999999 }) }))}
                    onKeyDown={blockInvalidNumberKeys}
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                    className="flex-1 px-3.5 py-3 focus:outline-none text-lg font-black text-[var(--mg-text-primary)] bg-transparent min-h-[46px]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1.5">
                  Fecha Límite de Pago
                </label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className="w-full bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent)] text-sm text-[var(--mg-text-primary)] font-semibold transition-all min-h-[46px] cursor-pointer"
                />
              </div>
            </div>

            {/* Descripción de Productos */}
            <div>
              <label className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1.5">
                Detalle de Productos Llevados
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ej: 2kg azúcar, 1L aceite Fino, 1 paquete fideo..."
                className="w-full bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 text-sm text-[var(--mg-text-primary)] font-medium focus:outline-none focus:border-[var(--mg-accent)] h-20 resize-none transition-all placeholder:text-[var(--mg-text-faint)]"
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
                  <span>Agregar Fiado</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
