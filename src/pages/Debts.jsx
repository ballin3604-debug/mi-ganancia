import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDebts, addDebt, payDebt, deleteDebt } from '../services/debts';

function formatBs(amount) {
  return `Bs ${Number(amount || 0).toFixed(2)}`;
}

const EMPTY_FORM = { clientName: '', amount: '', description: '', clientNit: '', clientPhone: '', dueDate: '' };

export default function Debts() {
  const { businessId } = useAuth();
  const [searchParams] = useSearchParams();
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(() => searchParams.get('action') === 'nuevo');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const tab = searchParams.get('tab') === 'paid' ? 'paid' : 'pending';
  const [searchQuery, setSearchQuery] = useState('');
  
  // Para la confirmación del pago
  const [payingDebt, setPayingDebt] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  const fetchDebts = useCallback(async () => {
    if (!businessId) return;
    const ds = await getDebts(businessId);
    setDebts(ds);
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  function closeForm() {
    setShowForm(false);
    setForm(EMPTY_FORM);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.clientName.trim() || !form.amount) return;
    setSaving(true);
    try {
      await addDebt(businessId, form);
      await fetchDebts();
      closeForm();
    } catch (err) {
      console.error(err);
      alert('Error al agregar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmPayment(paymentMethod) {
    if (!payingDebt) return;
    setProcessingPayment(true);
    try {
      await payDebt(payingDebt.id, payingDebt.saleId || null, paymentMethod);
      await fetchDebts();
      setPayingDebt(null);
    } catch (err) {
      console.error(err);
      alert('Error al registrar el cobro. Intenta de nuevo.');
    } finally {
      setProcessingPayment(false);
    }
  }

  async function handleDelete(debt) {
    if (!window.confirm(`¿Eliminar el registro de "${debt.clientName}"?`)) return;
    try {
      await deleteDebt(debt.id);
      await fetchDebts();
    } catch (err) {
      console.error(err);
    }
  }

  const pending = debts.filter((d) => d.status === 'pending');
  const paid = debts.filter((d) => d.status === 'paid');
  
  const currentTabDebts = tab === 'pending' ? pending : paid;
  
  const filtered = currentTabDebts.filter(d => 
    d.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.clientNit || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.clientPhone || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPending = pending.reduce((sum, d) => sum + (d.amount || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--mg-accent-border)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--mg-text-primary)]">
            {tab === 'paid' ? 'Cobros Realizados' : 'Cuentas por Cobrar (CxC)'}
          </h2>
          <p className="text-[var(--mg-text-faint)] text-xs">
            {tab === 'paid' ? `${paid.length} cobros registrados` : `${pending.length} pendientes de cobro`}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-[var(--mg-accent)] text-white rounded-2xl px-4 h-10 flex items-center gap-1.5 font-bold text-sm shadow-md active:scale-95 transition-all"
        >
          <span className="text-xl leading-none">+</span> Fiado Manual
        </button>
      </div>

      {/* Total pendiente */}
      {totalPending > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-[24px] p-4 flex items-center justify-between">
          <div>
            <p className="text-red-600 text-xs font-bold uppercase tracking-wide">
              Total por cobrar
            </p>
            <p className="text-3xl font-black text-red-700 mt-1">{formatBs(totalPending)}</p>
          </div>
          <span className="text-4xl">📖</span>
        </div>
      )}

      {/* Buscador */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Buscar por cliente, NIT/CI o teléfono..."
          className="w-full bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-2xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent-border)] text-sm text-[var(--mg-text-primary)] font-medium"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold hover:text-gray-600 text-sm"
          >
            Clear
          </button>
        )}
      </div>

      {/* Debt List */}
      <div className="space-y-3">
        {filtered.map((debt) => {
          const isOverdue = debt.status === 'pending' && debt.dueDate && new Date(`${debt.dueDate}T00:00:00`) < new Date(new Date().setHours(0,0,0,0));
          return (
            <div key={debt.id} className={`bg-[var(--mg-bg-surface)] rounded-2xl p-4 border-2 transition-all ${isOverdue ? 'border-red-300 bg-red-50/10' : 'border-[var(--mg-border)]'}`}>
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Avatar y Datos del Cliente */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-base font-bold ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'}`}>
                    {(debt.clientName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-[var(--mg-text-primary)] truncate text-base">{debt.clientName}</p>
                    
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-[var(--mg-text-muted)] font-medium">
                      {debt.clientNit && debt.clientNit !== '0' && (
                        <span>CI/NIT: <strong className="text-[var(--mg-text-secondary)]">{debt.clientNit}</strong></span>
                      )}
                      {debt.clientPhone && (
                        <span>📞 {debt.clientPhone}</span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[11px] text-[var(--mg-text-faint)]">
                      <span>Venta: {debt.createdAt?.toDate ? debt.createdAt.toDate().toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
                      {debt.dueDate && (
                        <span className={`font-semibold ${isOverdue ? 'text-red-500 font-bold' : ''}`}>
                          Límite: {new Date(`${debt.dueDate}T00:00:00`).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {isOverdue && ' (Vencido)'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Monto y Botón Cobrar */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-[var(--mg-separator)]">
                  <div className="text-left sm:text-right">
                    <p className={`font-black text-lg ${debt.status === 'paid' ? 'text-green-600' : 'text-red-600'}`}>
                      {formatBs(debt.amount)}
                    </p>
                    {debt.status === 'paid' && debt.paidAt && (
                      <p className="text-[10px] text-green-600 font-semibold mt-0.5">
                        Pagado: {debt.paidAt.toDate ? debt.paidAt.toDate().toLocaleDateString('es-BO', { day: 'numeric', month: 'short' }) : ''}
                        {debt.paymentMethodReceived && ` (${debt.paymentMethodReceived === 'qr' ? '📲 QR' : '💵 Efec'})`}
                      </p>
                    )}
                  </div>
                  {debt.status === 'pending' ? (
                    <button
                      onClick={() => setPayingDebt(debt)}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-xl active:scale-95 transition-all shadow-sm"
                    >
                      Cobrar ✓
                    </button>
                  ) : (
                    <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full font-bold">✓ Pagado</span>
                  )}
                </div>
              </div>

              {/* Detalle de Productos llevados */}
              {debt.description && (
                <div className="mt-3 bg-[var(--mg-bg-elevated)] p-2.5 rounded-xl border border-[var(--mg-border)] text-xs text-[var(--mg-text-secondary)] font-medium">
                  <span className="text-[var(--mg-text-muted)] font-semibold block mb-0.5">Productos llevados:</span>
                  {debt.description}
                </div>
              )}

              {/* Delete button */}
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => handleDelete(debt)}
                  className="text-[10px] text-gray-300 hover:text-red-500 transition-colors"
                >
                  Eliminar registro
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-[var(--mg-text-faint)]">
          <p className="text-5xl mb-3">{tab === 'pending' ? '🎉' : '📋'}</p>
          <p className="font-semibold">
            {tab === 'pending' ? '¡Sin deudas pendientes!' : 'Sin cobros registrados'}
          </p>
          {searchQuery && <p className="text-xs mt-1">Prueba buscando con otros términos</p>}
        </div>
      )}

      {/* MODAL SELECCIONAR METODO DE PAGO AL COBRAR */}
      {payingDebt && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 cursor-pointer" onClick={() => setPayingDebt(null)}>
          <div 
            className="bg-[var(--mg-bg-surface)] rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl relative cursor-default animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setPayingDebt(null)}
              className="absolute top-4 right-4 text-2xl text-[var(--mg-text-muted)] font-bold cursor-pointer hover:text-[var(--mg-text-primary)] transition-colors"
            >
              ×
            </button>

            <h3 className="text-lg font-black text-[var(--mg-text-primary)] mb-1">Registrar Pago de Deuda</h3>
            <p className="text-xs text-[var(--mg-text-muted)] font-medium mb-4">Cliente: {payingDebt.clientName}</p>

            <div className="bg-[var(--mg-bg-elevated)] p-4 rounded-2xl border border-[var(--mg-border)] mb-5">
              <p className="text-xs text-[var(--mg-text-muted)] uppercase font-semibold">Monto a Cobrar</p>
              <p className="text-2xl font-black text-[var(--mg-accent)] mt-0.5">{formatBs(payingDebt.amount)}</p>
            </div>

            <p className="text-xs font-bold text-[var(--mg-text-muted)] mb-3 text-left">Selecciona el método de pago recibido:</p>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                disabled={processingPayment}
                onClick={() => handleConfirmPayment('cash')}
                className="py-3.5 bg-[var(--mg-bg-surface)] hover:bg-gray-50 border-2 border-[var(--mg-border)] text-[var(--mg-text-secondary)] rounded-2xl text-sm font-bold flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
              >
                <span className="text-2xl">💵</span>
                <span>Efectivo</span>
              </button>
              <button
                type="button"
                disabled={processingPayment}
                onClick={() => handleConfirmPayment('qr')}
                className="py-3.5 bg-[var(--mg-bg-surface)] hover:bg-blue-50/50 border-2 border-[var(--mg-border)] text-[var(--mg-text-secondary)] rounded-2xl text-sm font-bold flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
              >
                <span className="text-2xl">📱</span>
                <span>Pago QR</span>
              </button>
            </div>

            <button
              onClick={() => setPayingDebt(null)}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl text-xs font-bold active:scale-95 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal Form Manual */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
          onClick={closeForm}
        >
          <div
            className="bg-[var(--mg-bg-surface)] rounded-t-3xl w-full max-w-md p-6 pb-10 shadow-2xl flex flex-col mg-slide-up"
            style={{ maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-[var(--mg-text-primary)]">Nuevo Registro de Fiado</h3>
              <button
                onClick={closeForm}
                className="w-7 h-7 bg-[var(--mg-bg-elevated)] rounded-full flex items-center justify-center text-[var(--mg-text-muted)] text-base font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4 overflow-y-auto pr-1">
              <div>
                <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">
                  Nombre del cliente *
                </label>
                <input
                  type="text"
                  value={form.clientName}
                  onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                  placeholder="Ej: Don Carlos, Vecina del 3..."
                  className="w-full bg-[var(--mg-bg-elevated)] border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm text-[var(--mg-text-primary)] font-medium focus:outline-none focus:border-[var(--mg-accent-border)]"
                  required
                  autoFocus
                  maxLength={60}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">
                    NIT / CI
                  </label>
                  <input
                    type="text"
                    value={form.clientNit}
                    onChange={(e) => setForm((f) => ({ ...f, clientNit: e.target.value }))}
                    placeholder="Ej: 1234567"
                    className="w-full bg-[var(--mg-bg-elevated)] border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm text-[var(--mg-text-primary)] font-medium focus:outline-none focus:border-[var(--mg-accent-border)]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={form.clientPhone}
                    onChange={(e) => setForm((f) => ({ ...f, clientPhone: e.target.value }))}
                    placeholder="Ej: 71234567"
                    className="w-full bg-[var(--mg-bg-elevated)] border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm text-[var(--mg-text-primary)] font-medium focus:outline-none focus:border-[var(--mg-accent-border)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">
                    Monto (Bs) *
                  </label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                    className="w-full bg-[var(--mg-bg-elevated)] border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm text-[var(--mg-text-primary)] font-bold focus:outline-none focus:border-[var(--mg-accent-border)]"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">
                    Fecha Límite
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                    className="w-full bg-[var(--mg-bg-elevated)] border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm text-[var(--mg-text-primary)] font-medium focus:outline-none focus:border-[var(--mg-accent-border)] cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">
                  Descripción / Qué llevó (opcional)
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Ej: 2kg azúcar, 1 aceite, leche..."
                  className="w-full bg-[var(--mg-bg-elevated)] border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm text-[var(--mg-text-primary)] font-medium focus:outline-none focus:border-[var(--mg-accent-border)] h-16 resize-none"
                  maxLength={200}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-[var(--mg-accent)] text-white font-bold py-3.5 rounded-2xl text-sm active:scale-95 transition-all disabled:opacity-50 mt-2 shadow-md"
              >
                {saving ? 'Guardando...' : 'Agregar Fiado'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
