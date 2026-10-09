import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { subscribeToTodaySales, getSaleItems, exportDetailedCSV } from '../services/sales';
import { getProducts, subscribeToProducts, subscribeToReplenishments } from '../services/products';
import { subscribeToExpenses } from '../services/expenses';
import { printReceipt } from '../components/Receipt';

// Subcomponentes del Dashboard
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { MagicMetricCards } from '../components/dashboard/MagicMetricCards';
import { EmptyDayState } from '../components/dashboard/EmptyDayState';
import { DashboardCharts } from '../components/dashboard/DashboardCharts';
import { SaleDetailModal } from '../components/dashboard/SaleDetailModal';
import { QrModal } from '../components/dashboard/QrModal';
import { AppIcon } from '../components/icons';
import { CashierHome } from '../components/CashierHome';
import { OwnerPulse } from '../components/OwnerPulse';

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
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [salesItemsMap, setSalesItemsMap] = useState({});
  const [printingSaleId, setPrintingSaleId] = useState(null);
  const [replenishments, setReplenishments] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // Carga de datos iniciales y suscripciones en tiempo real
  useEffect(() => {
    if (!businessId) return;

    const unsubSales = subscribeToTodaySales(businessId, (sales) => {
      setTodaySales(sales);
    });

    Promise.allSettled([
      getProducts(businessId),
    ])
      .then(([prods]) => {
        if (prods.status === 'fulfilled') setProducts(prods.value);
      })
      .finally(() => setLoading(false));

    return () => {
      unsubSales();
    };
  }, [businessId]);

  // Productos en vivo: el resumen y las alertas de stock reaccionan
  // a ventas y ediciones sin recargar la pantalla.
  useEffect(() => {
    if (!businessId) return;
    const unsubProducts = subscribeToProducts(businessId, (prods) => {
      setProducts(prods);
    });
    const unsubReps = subscribeToReplenishments(businessId, (reps) => {
      setReplenishments(reps);
    });
    const unsubExpenses = subscribeToExpenses(businessId, (list) => {
      setExpenses(list);
    });
    return () => {
      unsubProducts();
      unsubReps();
      unsubExpenses();
    };
  }, [businessId]);

  // Ventas visibles según rol (dueño ve todas, cajero solo las suyas)
  const visibleSales = useMemo(() => (
    isOwner ? todaySales : todaySales.filter((s) => s.createdBy === user?.uid)
  ), [isOwner, todaySales, user?.uid]);

  const hasSalesToday = visibleSales.length > 0;

  // Cargar los ítems de cada venta visible (gráficos)
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

  // Datos del gráfico de productos más vendidos (cantidades en UNIDADES BASE:
  // los paquetes suman × su factor)
  const topProductsChartData = useMemo(() => {
    const productsCount = {};
    Object.values(salesItemsMap).flat().forEach((item) => {
      const name = item.productName || 'Desconocido';
      const factor = Number(item.presentation_factor ?? item.presentationFactor ?? 1);
      if (!productsCount[name]) productsCount[name] = { value: 0, revenue: 0, image: '' };
      productsCount[name].value += Number(item.quantity || 0) * factor;
      productsCount[name].revenue += Number(item.subtotal || 0);
      if (!productsCount[name].image && item.image_url) productsCount[name].image = item.image_url;
    });

    const sorted = Object.entries(productsCount)
      .map(([label, data]) => ({ label, value: data.value, revenue: data.revenue, image: data.image || '' }))
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

  // Productos que necesitan reposición
  const lowStock = useMemo(() => (
    products.filter((p) => p.stock <= (p.minStock || 5))
  ), [products]);

  // Totales por método de pago (con soporte para mixtos)
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

  const isToday = (d) => {
    if (!d) return false;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };

  // Compras de hoy (reposiciones del día)
  const comprasHoy = useMemo(() => {
    const list = replenishments.filter((r) => {
      const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
      return isToday(d);
    });
    return {
      count: list.length,
      total: list.reduce((s, r) => s + Number(r.totalCost ?? r.total_cost ?? 0), 0),
    };
  }, [replenishments]);

  // Costo de lo vendido hoy (para la ganancia del día)
  const cogsHoy = useMemo(() => (
    Object.values(salesItemsMap).flat().reduce((sum, it) => {
      const cost = it.supplier_price ?? it.supplierPrice ?? null;
      if (cost === null || cost === undefined) return sum;
      const factor = Number(it.presentation_factor ?? it.presentationFactor ?? 1);
      return sum + Number(cost) * Number(it.quantity || 0) * factor;
    }, 0)
  ), [salesItemsMap]);

  // Gastos de hoy
  const gastosHoy = useMemo(() => (
    expenses
      .filter((e) => {
        const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
        return isToday(d);
      })
      .reduce((s, e) => s + Number(e.amount || 0), 0)
  ), [expenses]);

  // Ganancia del día = ventas − costo − gastos
  const gananciaHoy = totalHoy - cogsHoy - gastosHoy;
  const margenHoy = totalHoy > 0 ? (gananciaHoy / totalHoy) * 100 : 0;

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

  async function handleReimprint(sale) {
    setPrintingSaleId(sale.id);
    try {
      const items = await getSaleItems(businessId, sale.id);
      const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date();
      printReceipt({
        business,
        settings,
        saleId: sale.id,
        items: items.map((it) => ({
          ...it,
          productName: it.presentation ? `${it.productName} · ${it.presentation}` : it.productName,
        })),
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

  // Cajero: inicio propio de trabajo (sin totales del negocio ni ajustes).
  if (!isOwner) {
    return (
      <>
        <CashierHome
          user={user}
          businessName={business?.name || settings?.businessName || 'Mi negocio'}
          todayStr={todayStr}
          sales={visibleSales}
          salesItemsMap={salesItemsMap}
          lowStock={lowStock}
          totalCobrado={totalHoy}
          totalCash={totalCash}
          totalQr={totalQr}
          onNavigate={(path, opts) => navigate(path, opts)}
          onSelectSale={(sale) => setSelectedSale(sale)}
          onReimprint={handleReimprint}
          printingSaleId={printingSaleId}
        />
        {selectedSale && (
          <SaleDetailModal
            sale={selectedSale}
            businessId={businessId}
            onClose={() => setSelectedSale(null)}
          />
        )}
      </>
    );
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
        onNavigate={(path, opts) => navigate(path, opts)}
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
            comprasTotal={comprasHoy.total}
            comprasCount={comprasHoy.count}
            gananciaNeta={gananciaHoy}
            margen={margenHoy}
            onNavigate={(path) => navigate(path)}
          />
        ) : (
          <EmptyDayState
            isOwner={isOwner}
            onNavigate={(path, opts) => navigate(path, opts)}
          />
        )}
      </section>

      {/* PULSO DEL NEGOCIO (solo dueño): mensual, stock, sucursales y en vivo */}
      <OwnerPulse
        businessId={businessId}
        liveSales={todaySales}
        salesItemsMap={salesItemsMap}
        lowStock={lowStock}
        onNavigate={(path, opts) => navigate(path, opts)}
        onReimprint={handleReimprint}
        printingSaleId={printingSaleId}
      />

      {/* SECCIÓN 2 — ANÁLISIS DETALLADO (solo si hubo ventas hoy) */}
      {hasSalesToday && (
        <section className="bg-[var(--mg-bg-surface)] rounded-[24px] p-5 border border-[var(--mg-border)] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--mg-separator)] pb-3 gap-3 flex-wrap">
            <div>
              <h3 className="font-black text-base text-[var(--mg-text-primary)]">Análisis del día</h3>
              <p className="text-xs text-[var(--mg-text-muted)]">Productos, categorías y tendencia por hora</p>
            </div>
            {isOwner && (
              <button
                onClick={handleExport}
                disabled={exporting}
                type="button"
                className="text-xs font-bold text-[var(--mg-accent)] hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                {exporting ? 'Exportando...' : <><AppIcon name="csv" size={14} /> Exportar CSV</>}
              </button>
            )}
          </div>

          <DashboardCharts
            visibleSalesCount={visibleSales.length}
            topProductsChartData={topProductsChartData}
            categorySalesChartData={categorySalesChartData}
            hourlyTrendData={hourlyTrendData}
          />
        </section>
      )}

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
    </motion.div>
  );
}
