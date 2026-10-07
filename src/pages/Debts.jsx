import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { getDebts, payDebt, deleteDebt } from '../services/debts';
import { formatBs } from '../utils/currency';
import { DebtCard } from '../components/debts/DebtCard';
import { AddDebtModal } from '../components/debts/AddDebtModal';
import { PayDebtModal } from '../components/debts/PayDebtModal';
import { DebtsSkeleton } from '../components/debts/DebtsSkeleton';
import { ConfirmModal } from '../components/settings/ConfirmModal';
import { AppIcon } from '../components/icons';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
};

export default function Debts() {
  const { businessId } = useAuth();
  const { business } = useBusiness();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get('tab') === 'paid' ? 'paid' : 'pending';

  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(() => searchParams.get('action') === 'nuevo');
  const [payingDebt, setPayingDebt] = useState(null);
  const [deletingDebt, setDeletingDebt] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDebts = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const data = await getDebts(businessId);
      setDebts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  const handleTabChange = (tabKey) => {
    setSearchParams({ tab: tabKey });
  };

  const handleConfirmPay = async (debt, paymentMethod) => {
    try {
      await payDebt(debt.id, debt.saleId || null, paymentMethod);
      await fetchDebts();
      setPayingDebt(null);
    } catch (err) {
      console.error(err);
      alert('Error al registrar el cobro. Intentá de nuevo.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingDebt) return;
    setDeleting(true);
    try {
      await deleteDebt(deletingDebt.id);
      await fetchDebts();
      setDeletingDebt(null);
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el registro. Intentá de nuevo.');
    } finally {
      setDeleting(false);
    }
  };

  // Calculations
  const pendingDebts = debts.filter((d) => d.status === 'pending');
  const paidDebts = debts.filter((d) => d.status === 'paid');

  const todayObj = new Date(new Date().setHours(0, 0, 0, 0));
  
  const overdueDebts = pendingDebts.filter((d) => {
    if (!d.dueDate) return false;
    const dueObj = new Date(`${d.dueDate}T00:00:00`);
    return dueObj < todayObj;
  });

  const totalPendingAmount = pendingDebts.reduce((sum, d) => sum + (d.amount || 0), 0);
  const totalOverdueAmount = overdueDebts.reduce((sum, d) => sum + (d.amount || 0), 0);
  
  const uniqueClientsPending = new Set(pendingDebts.map((d) => d.clientName?.trim().toLowerCase())).size;

  // Filter current tab list
  const currentList = activeTab === 'pending' ? pendingDebts : paidDebts;

  const filteredDebts = currentList.filter((d) => {
    // Search query filter
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      (d.clientName || '').toLowerCase().includes(q) ||
      (d.clientNit || '').toLowerCase().includes(q) ||
      (d.clientPhone || '').toLowerCase().includes(q);

    // Overdue filter (only applies to pending tab)
    let matchesOverdue = true;
    if (activeTab === 'pending' && onlyOverdue) {
      const dueObj = d.dueDate ? new Date(`${d.dueDate}T00:00:00`) : null;
      matchesOverdue = dueObj && dueObj < todayObj;
    }

    return matchesSearch && matchesOverdue;
  });

  // Sort: Overdue first, then by closest due date
  const sortedDebts = [...filteredDebts].sort((a, b) => {
    if (activeTab === 'pending') {
      const aDue = a.dueDate ? new Date(`${a.dueDate}T00:00:00`) : new Date('9999-12-31');
      const bDue = b.dueDate ? new Date(`${b.dueDate}T00:00:00`) : new Date('9999-12-31');
      
      const aOverdue = aDue < todayObj;
      const bOverdue = bDue < todayObj;

      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      return aDue - bDue;
    }
    // Paid tab: latest paid first
    const aDate = a.paidAt?.toDate ? a.paidAt.toDate() : new Date(a.paidAt || 0);
    const bDate = b.paidAt?.toDate ? b.paidAt.toDate() : new Date(b.paidAt || 0);
    return bDate - aDate;
  });

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 pb-24 mg-fade-in w-full mx-auto space-y-3.5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--mg-text-primary)] tracking-tight">
            Cuentas por Cobrar (Fiados)
          </h2>
          <p className="text-[var(--mg-text-muted)] text-xs font-semibold mt-0.5">
            Control de creditos a clientes y recordatorios de cobro
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setShowAddModal(true)}
          className="bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white px-4 py-2.5 rounded-2xl font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0 min-h-[42px]"
        >
          <span className="text-lg leading-none">+</span>
          <span>Fiado Manual</span>
        </motion.button>
      </div>

      {loading ? (
        <DebtsSkeleton />
      ) : (
        <>
          {/* Top Metric Cards */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {/* Total Por Cobrar Card */}
            <motion.div
              variants={itemVariants}
              whileHover={{ y: -3, transition: { duration: 0.18 } }}
              className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] shadow-xs hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                  Total Pendiente de Cobro
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-black text-sm border border-purple-100 group-hover:scale-110 transition-transform">
                  📖
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-[var(--mg-danger)] tracking-tight">
                {formatBs(totalPendingAmount)}
              </p>
              <p className="text-[11px] font-semibold text-[var(--mg-text-muted)] mt-1">
                {pendingDebts.length} {pendingDebts.length === 1 ? 'fiado activo' : 'fiados activos'} ({uniqueClientsPending} clientes)
              </p>
            </motion.div>

            {/* Total Vencido Card */}
            <motion.div
              variants={itemVariants}
              whileHover={{ y: -3, transition: { duration: 0.18 } }}
              className={`rounded-[22px] p-4 border shadow-xs hover:shadow-md transition-all group relative overflow-hidden ${
                overdueDebts.length > 0
                  ? 'bg-red-50/50 border-red-200'
                  : 'bg-[var(--mg-bg-surface)] border-[var(--mg-border)]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-danger)]">
                  Monto Vencido
                </span>
                <div className="w-8 h-8 rounded-xl bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] flex items-center justify-center font-black text-sm border border-red-200 group-hover:scale-110 transition-transform">
                  ⚠️
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-[var(--mg-danger)] tracking-tight">
                {formatBs(totalOverdueAmount)}
              </p>
              <p className="text-[11px] font-semibold text-[var(--mg-text-muted)] mt-1">
                {overdueDebts.length} {overdueDebts.length === 1 ? 'fiado vencido' : 'fiados vencidos'}
              </p>
            </motion.div>
          </motion.div>

          {/* Visible Tabs Bar */}
          <div className="bg-[var(--mg-bg-surface)] p-1 rounded-[20px] border border-[var(--mg-border)] shadow-xs flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleTabChange('pending')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all active:scale-95 flex items-center justify-center gap-2 min-h-[40px] ${
                activeTab === 'pending'
                  ? 'bg-[var(--mg-accent)] text-white shadow-xs'
                  : 'bg-transparent text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)] hover:bg-[var(--mg-bg-elevated)]'
              }`}
            >
              <span>⏳ Pendientes</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-[var(--mg-bg-section)] text-[var(--mg-text-secondary)]'
              }`}>
                {pendingDebts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('paid')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all active:scale-95 flex items-center justify-center gap-2 min-h-[40px] ${
                activeTab === 'paid'
                  ? 'bg-[var(--mg-accent)] text-white shadow-xs'
                  : 'bg-transparent text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)] hover:bg-[var(--mg-bg-elevated)]'
              }`}
            >
              <span>✓ Cobros Realizados</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'paid' ? 'bg-white/20 text-white' : 'bg-[var(--mg-bg-section)] text-[var(--mg-text-secondary)]'
              }`}>
                {paidDebts.length}
              </span>
            </button>
          </div>

          {/* Buscador y Filtro Vencidos */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[var(--mg-bg-surface)] rounded-[22px] p-3.5 border border-[var(--mg-border)] shadow-xs hover:shadow-md transition-all"
          >
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              {/* Buscador */}
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Buscar por cliente, NIT/CI o teléfono..."
                  className="w-full bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-xl pl-3.5 pr-10 py-2 text-xs text-[var(--mg-text-primary)] font-semibold placeholder:text-[var(--mg-text-muted)] focus:outline-none focus:border-[var(--mg-accent)] transition-all min-h-[38px]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-full text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)] text-[10px] font-bold flex items-center justify-center transition-all"
                    title="Limpiar búsqueda"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Toggle Solo Vencidos (solo en pendientes) */}
              {activeTab === 'pending' && (
                <button
                  type="button"
                  onClick={() => setOnlyOverdue(!onlyOverdue)}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold border transition-all active:scale-95 shrink-0 flex items-center gap-1.5 min-h-[38px] w-full sm:w-auto justify-center ${
                    onlyOverdue
                      ? 'bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] border-red-300 shadow-2xs'
                      : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] border-[var(--mg-border)] hover:border-[var(--mg-border-hover)]'
                  }`}
                >
                  <AppIcon name="reloj" size={13} />
                  <span>Solo vencidos ({overdueDebts.length})</span>
                </button>
              )}
            </div>
          </motion.div>

          {/* Lista de Deudas */}
          {sortedDebts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-10 bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] shadow-xs p-6"
            >
              <p className="text-4xl mb-2">{activeTab === 'pending' ? '🎉' : '📋'}</p>
              <p className="font-extrabold text-[var(--mg-text-primary)] text-sm">
                {activeTab === 'pending'
                  ? (onlyOverdue ? '¡No tienes fiados vencidos!' : '¡Sin cuentas pendientes de cobro!')
                  : 'Sin cobros registrados'}
              </p>
              <p className="text-xs text-[var(--mg-text-muted)] mt-1">
                {searchQuery
                  ? 'Prueba buscando con otros términos o limpia el filtro.'
                  : activeTab === 'pending'
                    ? 'Toca "+ Fiado Manual" para registrar una nueva venta al crédito.'
                    : 'Aquí se mostrarán los registros cuando cobres un fiado.'}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-2.5">
              {sortedDebts.map((debt) => (
                <DebtCard
                  key={debt.id}
                  debt={debt}
                  businessName={business?.name}
                  onPay={(d) => setPayingDebt(d)}
                  onDelete={(d) => setDeletingDebt(d)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal Agregar Fiado */}
      <AddDebtModal
        businessId={businessId}
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={() => {
          setShowAddModal(false);
          fetchDebts();
        }}
      />

      {/* Modal Registrar Pago */}
      <PayDebtModal
        debt={payingDebt}
        isOpen={!!payingDebt}
        onClose={() => setPayingDebt(null)}
        onConfirm={handleConfirmPay}
      />

      {/* Modal Confirmar Borrado */}
      <ConfirmModal
        isOpen={!!deletingDebt}
        onClose={() => setDeletingDebt(null)}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar registro de fiado?"
        message={`¿Estás seguro de eliminar el registro de "${deletingDebt?.clientName}" por ${formatBs(deletingDebt?.amount)}? Esta acción es irreversible.`}
        danger={true}
        loading={deleting}
        confirmText="Eliminar Registro"
      />
    </div>
  );
}

