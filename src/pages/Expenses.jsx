import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import {
  getRecentExpenses, deleteExpense, exportExpensesCsv, EXPENSE_CATEGORIES, EXPENSE_PAYMENT_LABELS
} from '../services/expenses';
import { formatBs } from '../utils/currency';
import { AddExpenseModal } from '../components/expenses/AddExpenseModal';
import { ExpenseDetailModal } from '../components/expenses/ExpenseDetailModal';
import { ExpenseFilters } from '../components/expenses/ExpenseFilters';
import { ExpensesSkeleton } from '../components/expenses/ExpensesSkeleton';
import { ConfirmModal } from '../components/settings/ConfirmModal';
import { AppIcon } from '../components/icons';
import MetricCard from '../components/ui/MetricCard';
import EmptyState from '../components/ui/EmptyState';
import SectionCard from '../components/ui/SectionCard';

const CATEGORY_ICONS = {
  'Mercadería': 'paquete',
  'Servicios básicos': 'reloj',
  'Alquiler': 'tienda',
  'Transporte': 'traspaso',
  'Empleados': 'equipo',
  'Limpieza': 'check',
  'Otros': 'etiqueta',
};

const PAY_ICONS = {
  efectivo: 'cash',
  qr: 'qr',
  transferencia: 'traspaso',
  tarjeta: 'tarjeta',
};

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Expenses() {
  const { businessId } = useAuth();
  const { business } = useBusiness();
  const [searchParams] = useSearchParams();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(() => searchParams.get('action') === 'nuevo');
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  
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

  // Conteos por categoría (estilo Inicio7)
  const categoryCounts = useMemo(() => {
    const counts = { all: expenses.length };
    for (const e of expenses) {
      counts[e.category] = (counts[e.category] || 0) + 1;
    }
    return counts;
  }, [expenses]);

  function handleExport() {
    exportExpensesCsv(filteredExpenses, business?.name || 'MiNegocio');
  }

  function openEdit(exp) {
    setSelectedExpense(null);
    setEditingExpense(exp);
    setShowAddModal(true);
  }

  // Filtered Expenses List
  const filteredExpenses = expenses.filter((exp) => {
    // Search query match (concepto, proveedor o comprobante — como Inicio7)
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query ||
      exp.description.toLowerCase().includes(query) ||
      (exp.supplier && exp.supplier.toLowerCase().includes(query)) ||
      (exp.invoice_number && exp.invoice_number.toLowerCase().includes(query));

    // Type match
    const expType = exp.expense_type || exp.expenseType || 'daily';
    const matchesType = selectedType === 'all' || expType === selectedType;

    // Category match
    const matchesCategory = selectedCategory === 'all' || exp.category === selectedCategory;

    return matchesSearch && matchesType && matchesCategory;
  });

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 pb-24 mg-fade-in w-full mx-auto space-y-3.5 max-w-7xl">
      <header className="rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-4 shadow-[var(--mg-shadow-sm)] sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--mg-brand)] text-white shadow-[var(--mg-shadow-sm)] sm:h-12 sm:w-12">
              <AppIcon name="gastos" size={21} color="#fff" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--mg-text-muted)]">Finanzas</p>
              <h1 className="text-xl font-black tracking-tight text-[var(--mg-brand-text)] sm:text-2xl">Egresos</h1>
              <p className="mt-0.5 text-xs font-medium leading-snug text-[var(--mg-text-secondary)] sm:text-sm">
                Gastos operativos, compras de caja y costos fijos del negocio.
              </p>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
            <button
              type="button"
              onClick={handleExport}
              disabled={filteredExpenses.length === 0}
              className="mg-btn-tertiary flex min-h-[42px] flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs sm:flex-none"
            >
              <AppIcon name="respaldo" size={15} />
              <span className="hidden sm:inline">Exportar</span>
              <span className="sm:hidden">Exportar</span>
            </button>
            <button
              type="button"
              onClick={() => { setEditingExpense(null); setShowAddModal(true); }}
              className="mg-btn-primary flex min-h-[42px] flex-1 items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs sm:flex-none"
            >
              <AppIcon name="agregar" size={15} color="#fff" />
              Registrar
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <ExpensesSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricCard
              label={`Total egresos (${selectedDays}d)`}
              value={formatBs(totalPeriod)}
              hint={`${expenses.length} ${expenses.length === 1 ? 'registro' : 'registros'} en el período`}
              icon="gastos"
              tone="danger"
            />
            <MetricCard
              label="Gastos diarios"
              value={formatBs(totalDaily)}
              hint={`${dailyExpenses.length} movimientos · ${totalPeriod > 0 ? Math.round((totalDaily / totalPeriod) * 100) : 0}% del total`}
              icon="cash"
              tone="success"
            />
            <MetricCard
              label="Gastos fijos"
              value={formatBs(totalFixed)}
              hint={`${fixedExpenses.length} compromisos · ${totalPeriod > 0 ? Math.round((totalFixed / totalPeriod) * 100) : 0}% del total`}
              icon="reloj"
              tone="action"
            />
          </div>

          {byCategory.length > 0 && (
            <SectionCard
              title="Distribución por categoría"
              subtitle="Participación de cada categoría en el total de egresos."
              action={(
                <span className="rounded-full border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] px-2.5 py-0.5 text-[10px] font-black text-[var(--mg-accent-text)]">
                  {byCategory.length} {byCategory.length === 1 ? 'categoría' : 'categorías'}
                </span>
              )}
              bodyClassName="grid grid-cols-1 gap-x-6 gap-y-3 p-4 md:grid-cols-2"
            >
              {byCategory.map(({ cat, total }) => {
                const pct = Math.max(6, (total / maxCat) * 100);
                return (
                  <div key={cat} className="flex items-center gap-2.5 text-xs">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)]">
                      <AppIcon name={CATEGORY_ICONS[cat] || 'etiqueta'} size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="truncate font-bold text-[var(--mg-text-secondary)]">{cat}</p>
                        <p className="shrink-0 font-black tabular-nums text-[var(--mg-text-primary)]">{formatBs(total)}</p>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--mg-bg-elevated)]">
                        <div className="h-full rounded-full bg-[var(--mg-accent)]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </SectionCard>
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
            categoryCounts={categoryCounts}
          />

          {filteredExpenses.length === 0 ? (
            <EmptyState
              icon="gastos"
              title="Sin egresos registrados"
              description={expenses.length === 0
                ? 'No hay egresos en el período seleccionado. Lleva el control de pagos a proveedores, alquiler, servicios y compras operativas de caja.'
                : 'No se encontraron resultados con los filtros aplicados.'}
              action={expenses.length === 0 ? (
                <button
                  type="button"
                  onClick={() => { setEditingExpense(null); setShowAddModal(true); }}
                  className="mg-btn-primary inline-flex items-center gap-1.5 text-xs"
                >
                  <AppIcon name="agregar" size={15} color="#fff" />
                  Registrar primer egreso
                </button>
              ) : null}
            />
          ) : (
            <SectionCard
              title={`Historial (${filteredExpenses.length})`}
              subtitle="Movimientos de egreso del período seleccionado."
              action={(
                <p className="whitespace-nowrap text-[11px] font-black tabular-nums text-[var(--mg-text-primary)]">
                  {formatBs(filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0))}
                </p>
              )}
              bodyClassName="divide-y divide-[var(--mg-separator)]"
            >
              {filteredExpenses.map((exp) => {
                const isFixed = (exp.expense_type || exp.expenseType) === 'fixed';
                const payMethod = exp.payment_method || 'efectivo';
                return (
                  <div
                    key={exp.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedExpense(exp)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedExpense(exp); }}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--mg-bg-elevated)] sm:px-5"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)]">
                      <AppIcon name={CATEGORY_ICONS[exp.category] || 'etiqueta'} size={17} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-extrabold text-[var(--mg-text-primary)] sm:text-sm">{exp.description}</p>
                        <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                          isFixed
                            ? 'border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent-text)]'
                            : 'border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]'
                        }`}>
                          {isFixed ? 'Fijo' : 'Diario'}
                        </span>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] font-medium text-[var(--mg-text-muted)]">
                        {exp.supplier ? <span className="truncate">{exp.supplier}</span> : null}
                        <span>{exp.category}</span>
                        <span>·</span>
                        <span>{formatDate(exp.createdAt)}</span>
                        {exp.invoice_number ? (
                          <span className="inline-flex items-center gap-1">
                            <span>·</span>
                            <AppIcon name="recibo" size={11} />
                            {exp.invoice_number}
                          </span>
                        ) : null}
                      </p>
                      <span className="mt-1 inline-flex items-center gap-1 rounded-md border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--mg-text-secondary)]">
                        <AppIcon name={PAY_ICONS[payMethod] || 'cash'} size={11} />
                        {EXPENSE_PAYMENT_LABELS[payMethod] || 'Efectivo'}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <p className="mr-1 text-sm font-black tabular-nums text-[var(--mg-danger)] sm:text-base">
                        − {formatBs(exp.amount)}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openEdit(exp); }}
                        aria-label={`Editar ${exp.description}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)] transition-all hover:bg-[var(--mg-bg-section)] active:scale-95"
                        title="Editar egreso"
                      >
                        <AppIcon name="editar" size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDeletingExpense(exp); }}
                        aria-label={`Eliminar ${exp.description}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] transition-all hover:brightness-95 active:scale-95"
                        title="Eliminar egreso"
                      >
                        <AppIcon name="eliminar" size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </SectionCard>
          )}
        </>
      )}

      {/* Modal Agregar / Editar Egreso */}
      <AddExpenseModal
        businessId={businessId}
        isOpen={showAddModal}
        editingExpense={editingExpense}
        onClose={() => { setShowAddModal(false); setEditingExpense(null); }}
        onSaved={() => {
          setShowAddModal(false);
          setEditingExpense(null);
          loadExpenses();
        }}
      />

      {/* Modal Detalle (estilo Inicio7) */}
      <ExpenseDetailModal
        expense={selectedExpense}
        isOpen={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        onEdit={openEdit}
        onDelete={(exp) => { setSelectedExpense(null); setDeletingExpense(exp); }}
      />

      {/* Modal Confirmación de Borrado */}
      <ConfirmModal
        isOpen={!!deletingExpense}
        onClose={() => setDeletingExpense(null)}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar este egreso?"
        message={`Se eliminará "${deletingExpense?.description}" por ${formatBs(deletingExpense?.amount)} y se recalcularán los reportes del período.`}
        danger={true}
        loading={deleting}
        confirmText="Sí, Eliminar"
      />
    </div>
  );
}

