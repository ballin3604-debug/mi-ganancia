import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { subscribeToTodaySales, getSaleItems, exportDetailedCSV } from '../services/sales';
import { getProducts } from '../services/products';
import { printReceipt } from '../components/Receipt';
import { getDebts } from '../services/debts';

// Subcomponentes del Dashboard
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { MagicMetricCards } from '../components/dashboard/MagicMetricCards';
import { EmptyDayState } from '../components/dashboard/EmptyDayState';
import { LowStockAlert } from '../components/dashboard/LowStockAlert';
import { DashboardCharts } from '../components/dashboard/DashboardCharts';
import { SaleDetailModal } from '../components/dashboard/SaleDetailModal';
import { QrModal } from '../components/dashboard/QrModal';
import { LogoutModal } from '../components/LogoutModal';

function SectionHeader({ title }) {
  return (
    <h2 className="text-xs font-black uppercase tracking-wider text-[var(--mg-text-muted)] mb-3">
      {title}
    </h2>
  );
}

export default function Dashboard() {
  const { businessId, user, role } = useAuth();
  const isOwner = role === 'owner';
  const { business, settings } = useBusiness();
  const navigate = useNavigate();

  // Estados
  const [todaySales, setTodaySales] = useState([]);
  const [products, setProducts] = useState([]);
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [salesItemsMap, setSalesItemsMap] = useState({});
  const [printingSaleId, setPrintingSaleId] = useState(null);
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('Todos');
  const [filterCategory, setFilterCategory] = useState('Todas');

  // Carga de datos iniciales y suscripciones en tiempo real
  useEffect(() => {
    if (!businessId) return;

    const unsubSales = subscribeToTodaySales(businessId, (sales) => {
      setTodaySales(sales);
    });

    Promise.allSettled([
      getProducts(businessId),
      getDebts(businessId),
    ])
      .then(([prods, dbs]) => {
        if (prods.status === 'fulfilled') setProducts(prods.value);
        if (dbs.status === 'fulfilled') setDebts(dbs.value);
      })
      .finally(() => setLoading(false));

    return () => {
      unsubSales();
    };
  }, [businessId]);

  // Cuentas por cobrar (fiados)
  const pendingDebts = debts.filter((d) => d.status === 'pending');
  const totalPendingDebts = pendingDebts.reduce((sum, d) => sum + (d.amount || 0), 0);
  const uniqueClientsCount = new Set(pendingDebts.map((d) => (d.clientName || '').trim().toLowerCase())).size;

  // Ventas visibles según rol (dueño ve todas, cajero solo las suyas)
  const visibleSales = useMemo(() => (
    isOwner ? todaySales : todaySales.filter((s) => s.createdBy === user?.uid)
  ), [isOwner, todaySales, user?.uid]);

  const hasSalesToday = visibleSales.length > 0;

  // Lista de categorías de productos para el filtro
  const categoriesList = useMemo(() => {
    return ['Todas', ...new Set(products.map((p) => p.category || 'Otros').filter(Boolean))];
  }, [products]);

  // Ventas filtradas
  const filteredSales = useMemo(() => {
    return visibleSales.filter((s) => {
      const matchesMethod = filterPaymentMethod === 'Todos' || s.paymentMethod === filterPaymentMethod;
      const itemsOfSale = salesItemsMap[s.id] || [];
      const matchesCategory = filterCategory === 'Todas' || itemsOfSale.some((item) => item.category === filterCategory);
      return matchesMethod && matchesCategory;
    });
  }, [visibleSales, salesItemsMap, filterPaymentMethod, filterCategory]);

  // Cargar los ítems de cada venta visible (gráficos y filtro por categoría)
  useEffect(() => {
    if (!businessId || visibleSales.length === 0) return;
    visibleSales.forEach((sale) => {
      if (salesItemsMap[sale.id]) return;
      getSaleItems(businessId, sale.id)
        .then((items) => {
          setSalesItemsMap((prev) => {
            if (prev[sale.id]) return prev;
            return { ...prev, [sale.id]: items };
          });
        })
        .catch(console.error);
    });
  }, [visibleSales, businessId]);

  // Datos del gráfico de productos más vendidos
  const topProductsChartData = useMemo(() => {
    const productsCount = {};
    Object.values(salesItemsMap).flat().forEach((item) => {
      const name = item.productName || 'Desconocido';
      productsCount[name] = (productsCount[name] || 0) + (item.quantity || 0);
    });

    const sorted = Object.entries(productsCount)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const topLimit = 5;
    const top = sorted.slice(0, topLimit);
    const others = sorted.slice(topLimit);
    if (others.length > 0) {
      const othersSum = others.reduce((sum, item) => sum + item.value, 0);
      top.push({ label: 'Otros', value: othersSum });
    }

    const colors = ['#1670C2', '#38bdf8', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#34d399', '#94a3b8'];
    return top.map((item, i) => ({ ...item, color: colors[i % colors.length] }));
  }, [salesItemsMap]);

  // Datos del gráfico de ventas por categoría
  const categorySalesChartData = useMemo(() => {
    const categoryTotals = {};
    Object.values(salesItemsMap).flat().forEach((item) => {
      const cat = item.category || 'Otros';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (item.subtotal || 0);
    });

    const sorted = Object.entries(categoryTotals)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const colors = ['#8b5cf6', '#10b981', '#1670C2', '#f59e0b', '#f43f5e', '#38bdf8', '#34d399', '#94a3b8'];
    return sorted.map((item, i) => ({ ...item, color: colors[i % colors.length] }));
  }, [salesItemsMap]);

  // Tendencia por media hora (48 franjas)
  const hourlyTrendData = useMemo(() => {
    const trend = Array.from({ length: 48 }, (_, i) => ({
      slot: i,
      label: `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
      total: 0,
    }));

    visibleSales.forEach((s) => {
      if (!s.createdAt) return;
      const d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      const slot = d.getHours() * 2 + (d.getMinutes() >= 30 ? 1 : 0);
      if (trend[slot]) {
        trend[slot].total += s.total || 0;
      }
    });

    return trend;
  }, [visibleSales]);

  // Franjas horarias con ventas
  const hourlyBands = useMemo(() => {
    const bands = {};
    visibleSales.forEach((s) => {
      if (!s.createdAt) return;
      const d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      const hr = d.getHours();
      const isSecondHalf = d.getMinutes() >= 30;
      const slot = hr * 2 + (isSecondHalf ? 1 : 0);
      const startLabel = `${String(hr).padStart(2, '0')}:${isSecondHalf ? '30' : '00'}`;
      const endHr = isSecondHalf ? (hr + 1) % 24 : hr;
      const endLabel = `${String(endHr).padStart(2, '0')}:${isSecondHalf ? '00' : '30'}`;
      const label = `${startLabel} - ${endLabel}`;

      if (!bands[slot]) {
        bands[slot] = { label, count: 0, total: 0, slot };
      }
      bands[slot].count += 1;
      bands[slot].total += s.total || 0;
    });

    return Object.values(bands).sort((a, b) => a.slot - b.slot);
  }, [visibleSales]);

  // Franja pico de ventas
  const peakBand = useMemo(() => {
    if (hourlyBands.length === 0) return null;
    return [...hourlyBands].sort((a, b) => b.total - a.total)[0];
  }, [hourlyBands]);

  // Productos que necesitan reposición
  const lowStock = useMemo(() => (
    products.filter((p) => p.stock <= (p.minStock || 5))
  ), [products]);

  // Totales por método de pago (con soporte para mixtos y excluyendo fiados)
  const totalQr = visibleSales.reduce((sum, s) => {
    if (s.paymentMethod === 'qr') return sum + (s.total || 0);
    if (s.paymentMethod === 'mixto') return sum + (s.montoQR || 0);
    return sum;
  }, 0);

  const totalCash = visibleSales.reduce((sum, s) => {
    if (s.paymentMethod === 'cash') return sum + (s.total || 0);
    if (s.paymentMethod === 'mixto') return sum + (s.montoEfectivo || 0);
    if (s.paymentMethod !== 'qr' && s.paymentMethod !== 'mixto' && s.paymentMethod !== 'fiado') {
      return sum + (s.total || 0);
    }
    return sum;
  }, 0);

  const totalHoy = totalCash + totalQr;
  const paidSalesCount = visibleSales.filter((s) => s.paymentMethod !== 'fiado').length;

  // Handlers
  async function handleExport() {
    setExporting(true);
    try {
      await exportDetailedCSV(businessId);
    } catch {
      alert('Error al exportar ventas.');
    } finally {
      setExporting(false);
    }
  }

  // Abrir el producto directamente en modo edición dentro de Inventario
  function handleLowStockClick(product) {
    navigate('/inventario', { state: { editProduct: product } });
  }

  async function handleReimprint(sale) {
    setPrintingSaleId(sale.id);
    try {
      const items = await getSaleItems(businessId, sale.id);
      const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date();
      printReceipt({
        business,
        settings,
        saleId: sale.id,
        items,
        total: sale.total,
        date,
        clientName: sale.clientName || 'S/N',
        clientNit: sale.clientNit || '0',
        sellerName: sale.sellerName || '',
      });
    } catch (err) {
      console.error(err);
      alert('Error al generar el recibo.');
    } finally {
      setPrintingSaleId(null);
    }
  }

  const todayStr = new Date().toLocaleDateString('es-BO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="p-4 sm:p-6 space-y-8 max-w-7xl mx-auto pb-16"
    >
      {/* CABECERA: SALUDO, ESTADO DE SINCRONIZACIÓN Y ACCIONES PRINCIPALES */}
      <DashboardHeader
        today={todayStr}
        user={user}
        settings={settings}
        onShowQr={() => setShowQr(true)}
        onNavigate={(path) => navigate(path)}
      />

      {/* SECCIÓN 1 — RESUMEN DEL DÍA */}
      <section>
        <SectionHeader title="Resumen del día" />
        {hasSalesToday ? (
          <MagicMetricCards
            totalHoy={totalHoy}
            paidSalesCount={paidSalesCount}
            totalCash={totalCash}
            totalQr={totalQr}
            peakBand={peakBand}
            totalPendingDebts={totalPendingDebts}
            uniqueClientsCount={uniqueClientsCount}
            onNavigate={(path) => navigate(path)}
          />
        ) : (
          <EmptyDayState
            isOwner={isOwner}
            pendingSalesYesterday={pendingDebts.length}
            onNavigate={(path) => navigate(path)}
          />
        )}
      </section>

      {/* ALERTA DE STOCK BAJO (solo aparece si hay productos por reponer) */}
      <LowStockAlert lowStock={lowStock} onLowStockClick={handleLowStockClick} />

      {/* SECCIÓN 2 — ANÁLISIS DETALLADO (solo si hubo ventas hoy) */}
      {hasSalesToday && (
        <section className="bg-[var(--mg-bg-surface)] rounded-[24px] p-5 border border-[var(--mg-border)] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--mg-separator)] pb-3 gap-3 flex-wrap">
            <div>
              <h3 className="font-black text-base text-[var(--mg-text-primary)]">Rendimiento por franja horaria</h3>
              <p className="text-xs text-[var(--mg-text-muted)]">Explora tus ventas según horario, pico de consumo y productos</p>
            </div>
            {isOwner && (
              <button
                onClick={handleExport}
                disabled={exporting}
                type="button"
                className="text-xs font-bold text-[var(--mg-accent)] hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                {exporting ? 'Exportando...' : '📥 Exportar CSV'}
              </button>
            )}
          </div>

          <DashboardCharts
            visibleSalesCount={visibleSales.length}
            topProductsChartData={topProductsChartData}
            categorySalesChartData={categorySalesChartData}
            hourlyTrendData={hourlyTrendData}
            hourlyBands={hourlyBands}
            visibleSales={visibleSales}
            filteredSales={filteredSales}
            salesItemsMap={salesItemsMap}
            filterPaymentMethod={filterPaymentMethod}
            setFilterPaymentMethod={setFilterPaymentMethod}
            filterCategory={filterCategory}
            setFilterCategory={setFilterCategory}
            categoriesList={categoriesList}
            onSelectSale={(sale) => setSelectedSale(sale)}
            onReimprint={handleReimprint}
            printingSaleId={printingSaleId}
            isOwner={isOwner}
          />
        </section>
      )}

      {/* CERRAR SESIÓN */}
      <div className="flex justify-center pt-2">
        <button
          onClick={() => setIsLogoutModalOpen(true)}
          type="button"
          className="text-[var(--mg-text-faint)] hover:text-rose-600 text-xs font-bold py-2.5 px-5 rounded-2xl hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4 fill-none stroke-current" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Cerrar sesión de negocio</span>
        </button>
      </div>

      {/* MODALES */}
      {selectedSale && (
        <SaleDetailModal
          sale={selectedSale}
          businessId={businessId}
          onClose={() => setSelectedSale(null)}
        />
      )}

      {showQr && (
        <QrModal
          showQr={showQr}
          settings={settings}
          onClose={() => setShowQr(false)}
          onNavigateSettings={() => navigate('/configuracion')}
        />
      )}

      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        user={user}
        business={business}
      />
    </motion.div>
  );
}
