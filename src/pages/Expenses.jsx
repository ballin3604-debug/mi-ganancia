import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import {
  getRecentExpenses, deleteExpense, EXPENSE_CATEGORIES
} from '../services/expenses';
import { formatBs } from '../utils/currency';
import { AddExpenseModal } from '../components/expenses/AddExpenseModal';
import { ExpenseFilters } from '../components/expenses/ExpenseFilters';
import { ExpensesSkeleton } from '../components/expenses/ExpensesSkeleton';
import { ConfirmModal } from '../components/settings/ConfirmModal';

const CATEGORY_ICONS = {
  'Mercadería': '📦',
  'Servicios básicos': '💡',
  'Alquiler': '🏠',
  'Transporte': '🚚',
  'Empleados': '👤',
  'Otros': '📝',
};

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
};

export default function Expenses() {
  const { businessId } = useAuth();
  const [searchParams] = useSearchParams();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(() => searchParams.get('action') === 'nuevo');
  
  // Filter States
  const [selectedDays, setSelectedDays] = useState(30);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all'); // 'all' | 'daily' | 'fixed'
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Confirm Modal state for deletion
  const [deletingExpense, setDeletingExpense] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadExpenses = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const data = await getRecentExpenses(businessId, selectedDays);
      setExpenses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [businessId, selectedDays]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const handleConfirmDelete = async () => {
    if (!deletingExpense) return;
    setDeleting(true);
    try {
      await deleteExpense(deletingExpense.id);
      setExpenses((prev) => prev.filter((e) => e.id !== deletingExpense.id));
      setDeletingExpense(null);
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el egreso. Intentá de nuevo.');
    } finally {
      setDeleting(false);
    }
  };

  // Metric Totals
  const totalPeriod = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  
  const dailyExpenses = expenses.filter((e) => (e.expense_type || e.expenseType || 'daily') === 'daily');
  const totalDaily = dailyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const fixedExpenses = expenses.filter((e) => (e.expense_type || e.expenseType) === 'fixed');
  const totalFixed = fixedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Grouping by Category for Chart
  const byCategory = EXPENSE_CATEGORIES.map((cat) => ({
    cat,
    total: expenses.filter((e) => e.category === cat).reduce((s, e) => s + (e.amount || 0), 0),
  })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

  const maxCat = byCategory.length > 0 ? byCategory[0].total : 1;

  // Filtered Expenses List
  const filteredExpenses = expenses.filter((exp) => {
    // Search query match
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query ||
      exp.description.toLowerCase().includes(query) ||
      (exp.supplier && exp.supplier.toLowerCase().includes(query));

    // Type match
    const expType = exp.expense_type || exp.expenseType || 'daily';
    const matchesType = selectedType === 'all' || expType === selectedType;

    // Category match
    const matchesCategory = selectedCategory === 'all' || exp.category === selectedCategory;

    return matchesSearch && matchesType && matchesCategory;
  });

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 pb-24 mg-fade-in w-full mx-auto space-y-3.5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--mg-text-primary)] tracking-tight">
            Gestión de Egresos
          </h2>
          <p className="text-[var(--mg-text-muted)] text-xs font-semibold mt-0.5">
            Registro de gastos operativos y costos fijos de tu negocio
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setShowAddModal(true)}
          className="bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white px-4 py-2.5 rounded-2xl font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0 min-h-[42px]"
        >
          <span className="text-lg leading-none">+</span>
          <span className="hidden sm:inline">Registrar</span> Egreso
        </motion.button>
      </div>

      {loading ? (
        <ExpensesSkeleton />
      ) : (
        <>
          {/* Top Metric Cards */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            {/* 1. Total General */}
            <motion.div
              variants={itemVariants}
              whileHover={{ y: -3, transition: { duration: 0.18 } }}
              className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] shadow-xs hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                  Total Egresos ({selectedDays}d)
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[var(--mg-accent)] flex items-center justify-center font-black text-sm group-hover:scale-110 transition-transform border border-blue-100">
                  💸
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-[var(--mg-text-primary)] tracking-tight">
                {formatBs(totalPeriod)}
              </p>
              <p className="text-[11px] font-semibold text-[var(--mg-text-muted)] mt-1">
                {expenses.length} {expenses.length === 1 ? 'registro' : 'registros'} en el período
              </p>
            </motion.div>

            {/* 2. Total Gastos Diarios */}
            <motion.div
              variants={itemVariants}
              whileHover={{ y: -3, transition: { duration: 0.18 } }}
              className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] shadow-xs hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                  Gastos Diarios (Operativos)
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-sm group-hover:scale-110 transition-transform border border-emerald-100">
                  ☀️
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
                {formatBs(totalDaily)}
              </p>
              <p className="text-[11px] font-semibold text-[var(--mg-text-muted)] mt-1">
                {dailyExpenses.length} compras del día
              </p>
            </motion.div>

            {/* 3. Total Gastos Fijos */}
            <motion.div
              variants={itemVariants}
              whileHover={{ y: -3, transition: { duration: 0.18 } }}
              className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] shadow-xs hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                  Gastos Fijos (Mensuales)
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-black text-sm group-hover:scale-110 transition-transform border border-purple-100">
                  📅
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-purple-600 tracking-tight">
                {formatBs(totalFixed)}
              </p>
              <p className="text-[11px] font-semibold text-[var(--mg-text-muted)] mt-1">
                {fixedExpenses.length} servicios / alquileres
              </p>
            </motion.div>
          </motion.div>

          {/* Desglose Por Categoría (Grid compacto) */}
          {byCategory.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] p-4 shadow-xs space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider">
                  Distribución por Categoría
                </span>
                <span className="text-[11px] font-extrabold text-[var(--mg-accent)] bg-[var(--mg-accent-bg)] px-2.5 py-0.5 rounded-full border border-[var(--mg-accent-border)]">
                  {byCategory.length} {byCategory.length === 1 ? 'categoría' : 'categorías'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                {byCategory.map(({ cat, total }) => {
                  const pct = Math.max(8, (total / maxCat) * 100);
                  return (
                    <div key={cat} className="flex items-center gap-2 text-xs">
                      <span className="text-sm w-5 text-center shrink-0">{CATEGORY_ICONS[cat] || '📝'}</span>
                      <p className="font-bold text-[var(--mg-text-secondary)] w-28 truncate shrink-0">{cat}</p>
                      <div className="flex-1 bg-[var(--mg-bg-elevated)] rounded-full h-2.5 overflow-hidden border border-[var(--mg-separator)]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className="h-full rounded-full bg-[var(--mg-accent)]"
                        />
                      </div>
                      <p className="font-black text-[var(--mg-text-primary)] w-20 text-right shrink-0">{formatBs(total)}</p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Filtros */}
          <ExpenseFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedDays={selectedDays}
            onDaysChange={setSelectedDays}
            selectedType={selectedType}
            onTypeChange={setSelectedType}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />

          {/* Lista de Egresos */}
          {filteredExpenses.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-10 bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] shadow-xs p-6"
            >
              <p className="text-4xl mb-2">💸</p>
              <p className="font-extrabold text-[var(--mg-text-primary)] text-sm">Sin egresos registrados</p>
              <p className="text-xs text-[var(--mg-text-muted)] mt-1">
                {expenses.length === 0
                  ? 'No hay egresos en los últimos ' + selectedDays + ' días. Toca "+ Registrar Egreso" para comenzar.'
                  : 'No se encontraron resultados con los filtros aplicados.'}
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] overflow-hidden shadow-xs hover:shadow-md transition-all"
            >
              <div className="px-4 py-2.5 border-b border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] flex items-center justify-between">
                <p className="font-extrabold text-[var(--mg-text-secondary)] text-[11px] uppercase tracking-wider">
                  Historial ({filteredExpenses.length})
                </p>
                <p className="text-[11px] font-black text-[var(--mg-text-primary)]">
                  Total: {formatBs(filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0))}
                </p>
              </div>

              <div className="divide-y divide-[var(--mg-separator)]">
                {filteredExpenses.map((exp) => {
                  const isFixed = (exp.expense_type || exp.expenseType) === 'fixed';
                  return (
                    <div
                      key={exp.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--mg-bg-elevated)] transition-colors group"
                    >
                      <div className="w-9 h-9 bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] rounded-xl flex items-center justify-center text-lg shrink-0 font-bold border border-[var(--mg-accent-border)] group-hover:scale-105 transition-transform">
                        {CATEGORY_ICONS[exp.category] || '📝'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-[var(--mg-text-primary)] text-xs sm:text-sm truncate">{exp.description}</p>
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0 ${
                              isFixed
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {isFixed ? 'Fijo' : 'Diario'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--mg-text-muted)] truncate mt-0.5 font-medium">
                          {exp.supplier ? `${exp.supplier} · ` : ''}{exp.category} · {formatDate(exp.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <p className="font-black text-[var(--mg-text-primary)] text-sm sm:text-base">
                          - {formatBs(exp.amount)}
                        </p>
                        <button
                          type="button"
                          onClick={() => setDeletingExpense(exp)}
                          className="w-7 h-7 bg-[var(--mg-danger-bg)] hover:bg-red-100 text-[var(--mg-danger)] rounded-lg flex items-center justify-center text-xs font-black transition-all active:scale-95 border border-red-200 min-h-[28px]"
                          title="Eliminar egreso"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Modal Agregar Egreso */}
      <AddExpenseModal
        businessId={businessId}
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={() => {
          setShowAddModal(false);
          loadExpenses();
        }}
      />

      {/* Modal Confirmación de Borrado */}
      <ConfirmModal
        isOpen={!!deletingExpense}
        onClose={() => setDeletingExpense(null)}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar egreso?"
        message={`¿Estás seguro de eliminar "${deletingExpense?.description}" por ${formatBs(deletingExpense?.amount)}?`}
        danger={true}
        loading={deleting}
        confirmText="Eliminar Egreso"
      />
    </div>
  );
}

