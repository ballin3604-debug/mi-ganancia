import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getRecentExpenses, addExpense, deleteExpense, EXPENSE_CATEGORIES,
} from '../services/expenses';
import { clampNumberInput, blockInvalidNumberKeys } from '../utils/numberInput';

function formatBs(amount) {
  return `Bs ${Number(amount || 0).toFixed(2)}`;
}

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

const CATEGORY_ICONS = {
  'Mercadería': '📦',
  'Servicios básicos': '💡',
  'Alquiler': '🏠',
  'Transporte': '🚚',
  'Empleados': '👤',
  'Otros': '📝',
};

// ── Add expense modal ─────────────────────────────────────────────────────────
function AddExpenseModal({ businessId, onSaved, onClose }) {
  const [description, setDescription] = useState('');
  const [supplier, setSupplier] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Mercadería');
  const [expenseType, setExpenseType] = useState('daily');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim() || !amount || Number(amount) <= 0) {
      setError('Completa descripción y monto.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addExpense(businessId, { description, supplier, amount, category, expenseType });
      onSaved();
    } catch (err) {
      console.error(err);
      setError('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-[var(--mg-bg-surface)] rounded-t-3xl w-full max-w-md shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 overflow-y-auto" style={{ maxHeight: '90vh' }}>
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[var(--mg-text-primary)] mb-4">Registrar egreso</h3>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Category */}
            <div>
              <label className="text-xs font-semibold text-[var(--mg-text-muted)] uppercase tracking-wide block mb-1">
                Categoría
              </label>
              <div className="grid grid-cols-3 gap-2">
                {EXPENSE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex flex-col items-center py-2 px-1 rounded-xl text-xs font-semibold border-2 transition-all active:scale-95 ${
                      category === cat
                        ? 'border-[#1670C2] bg-blue-50 text-[#1670C2]'
                        : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
                    }`}
                  >
                    <span className="text-xl mb-0.5">{CATEGORY_ICONS[cat] || '📝'}</span>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Tipo de Gasto */}
            <div>
              <label className="text-xs font-semibold text-[var(--mg-text-muted)] uppercase tracking-wide block mb-1">
                Tipo de Gasto
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExpenseType('daily')}
                  className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all active:scale-95 ${
                    expenseType === 'daily'
                      ? 'border-[#1670C2] bg-blue-50 text-[#1670C2]'
                      : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
                  }`}
                >
                  ☀️ Diario (Operativo)
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseType('fixed')}
                  className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all active:scale-95 ${
                    expenseType === 'fixed'
                      ? 'border-[#1670C2] bg-blue-50 text-[#1670C2]'
                      : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
                  }`}
                >
                  📅 Fijo / Mensual
                </button>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-[var(--mg-text-muted)] uppercase tracking-wide block mb-1">
                Descripción *
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Compra de mercadería, pago de luz..."
                className="w-full border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[#1670C2] text-base"
                maxLength={100}
                required
              />
            </div>

            {/* Supplier */}
            <div>
              <label className="text-xs font-semibold text-[var(--mg-text-muted)] uppercase tracking-wide block mb-1">
                Proveedor / Origen (opcional)
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Ej: Distribuidora Norte, Mercado..."
                className="w-full border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[#1670C2] text-base"
                maxLength={80}
              />
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs font-semibold text-[var(--mg-text-muted)] uppercase tracking-wide block mb-1">
                Monto (Bs) *
              </label>
              <div className="flex items-center border-2 border-[var(--mg-border)] rounded-xl overflow-hidden focus-within:border-[#1670C2]">
                <span className="px-4 py-3 bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] font-semibold border-r border-[var(--mg-border)]">Bs</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(clampNumberInput(e.target.value, { max: 999999 }))}
                  onKeyDown={blockInvalidNumberKeys}
                  placeholder="0.00"
                  className="flex-1 px-4 py-3 focus:outline-none text-xl font-bold text-[var(--mg-text-primary)]"
                  min="0.01"
                  max="999999"
                  step="0.01"
                  required
                />
              </div>
            </div>

            {error && <p className="text-[var(--mg-danger)] text-sm text-center">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)] font-bold py-3.5 rounded-2xl active:scale-95"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-[#1670C2] hover:bg-[#0f5c9e] text-white font-bold py-3.5 rounded-2xl active:scale-95 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main Expenses page ────────────────────────────────────────────────────────
export default function Expenses() {
  const { businessId } = useAuth();
  const [searchParams] = useSearchParams();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(() => searchParams.get('action') === 'nuevo');
  const [deletingId, setDeletingId] = useState(null);

  async function load() {
    if (!businessId) return;
    setLoading(true);
    try {
      const data = await getRecentExpenses(businessId, 30);
      setExpenses(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [businessId]);

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este egreso?')) return;
    setDeletingId(id);
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error(err);
      alert('Error al eliminar.');
    } finally {
      setDeletingId(null);
    }
  }

  // Totals
  const totalMonth = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Group by category
  const byCategory = EXPENSE_CATEGORIES.map((cat) => ({
    cat,
    total: expenses.filter((e) => e.category === cat).reduce((s, e) => s + (e.amount || 0), 0),
  })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

  const maxCat = byCategory.length > 0 ? byCategory[0].total : 1;

  return (
    <div className="p-4 lg:p-6 pb-24 mg-fade-in w-full mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-[#1670C2]">Egresos</h2>
          <p className="text-[var(--mg-text-faint)] text-xs">Últimos 30 días</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="w-11 h-11 bg-[#1670C2] hover:bg-[#0f5c9e] rounded-[16px] flex items-center justify-center text-white text-2xl shadow-md active:scale-95 transition-all"
        >
          +
        </button>
      </div>

      {/* Total card */}
      <div className="bg-[#1670C2] rounded-[20px] p-5 text-white shadow-sm">
        <p className="text-blue-100 text-xs uppercase tracking-wide font-bold">Total egresos (30 días)</p>
        <p className="text-4xl font-black mt-1">{formatBs(totalMonth)}</p>
        <p className="text-blue-200 text-sm mt-0.5 font-medium">{expenses.length} registros</p>
      </div>

      {/* By category */}
      {byCategory.length > 0 && (
        <div className="bg-[var(--mg-bg-surface)] rounded-[20px] border border-[var(--mg-border)] p-4 shadow-sm">
          <p className="text-xs font-bold text-[var(--mg-text-faint)] uppercase tracking-wide mb-3">Por categoría</p>
          <div className="space-y-3">
            {byCategory.map(({ cat, total }) => {
              const pct = Math.max(8, (total / maxCat) * 100);
              return (
                <div key={cat} className="flex items-center gap-2">
                  <span className="text-base w-6 text-center shrink-0">{CATEGORY_ICONS[cat] || '📝'}</span>
                  <p className="text-xs text-[var(--mg-text-muted)] w-20 truncate shrink-0">{cat}</p>
                  <div className="flex-1 bg-[var(--mg-bg-elevated)] rounded-full h-3 overflow-hidden">
                    <div
                      className="h-3 rounded-full bg-[#1670C2] transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs font-black text-[var(--mg-text-secondary)] w-16 text-right shrink-0">{formatBs(total)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expense list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#1670C2] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16 bg-[var(--mg-bg-surface)] rounded-[20px] border border-[var(--mg-border)] shadow-sm">
          <p className="text-5xl mb-3">💸</p>
          <p className="font-bold text-[var(--mg-text-muted)]">Sin egresos registrados</p>
          <p className="text-sm text-[var(--mg-text-faint)] mt-1">Toca + para agregar un egreso</p>
        </div>
      ) : (
        <div className="bg-[var(--mg-bg-surface)] rounded-[20px] border border-[var(--mg-border)] overflow-hidden shadow-sm">
          <div className="px-4 py-3.5 border-b border-[var(--mg-border)]">
            <p className="font-bold text-[var(--mg-text-secondary)] text-sm">Historial</p>
          </div>
          <div className="divide-y divide-[var(--mg-separator)]">
            {expenses.map((exp) => (
              <div key={exp.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/50 transition-colors">
                <div className="w-10 h-10 bg-blue-50 text-[#1670C2] rounded-xl flex items-center justify-center text-xl shrink-0">
                  {CATEGORY_ICONS[exp.category] || '📝'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-[var(--mg-text-primary)] text-sm truncate">{exp.description}</p>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase shrink-0 ${
                      exp.expense_type === 'fixed' || exp.expenseType === 'fixed'
                        ? 'bg-purple-100 text-purple-700 border border-purple-200'
                        : 'bg-green-100 text-green-700 border border-green-200'
                    }`}>
                      {exp.expense_type === 'fixed' || exp.expenseType === 'fixed' ? 'Fijo' : 'Diario'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--mg-text-faint)] truncate mt-0.5">
                    {exp.supplier ? `${exp.supplier} · ` : ''}{exp.category} · {formatDate(exp.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="font-black text-gray-900 text-sm">- {formatBs(exp.amount)}</p>
                  <button
                    onClick={() => handleDelete(exp.id)}
                    disabled={deletingId === exp.id}
                    className="w-7 h-7 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg flex items-center justify-center text-xs active:scale-95 disabled:opacity-40 transition-colors font-bold"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <AddExpenseModal
          businessId={businessId}
          onSaved={() => { setShowModal(false); load(); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
