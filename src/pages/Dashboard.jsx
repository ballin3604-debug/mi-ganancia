import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { subscribeToTodaySales, subscribeToSaleChanges, getSaleItems, exportDetailedCSV } from '../services/sales';
import { getProducts, subscribeToProducts, subscribeToReplenishments } from '../services/products';
import { subscribeToExpenses, snoozeExpenseAlert, dismissExpenseAlert } from '../services/expenses';
import { buildFixedExpenseAlerts } from '../services/expenseAlerts';
import { ExpiryAlert } from '../components/dashboard/ExpiryAlert';
import { FixedExpenseAlerts } from '../components/dashboard/FixedExpenseAlerts';
import { LowStockAlert } from '../components/dashboard/LowStockAlert';
import { TopProductsCard } from '../components/dashboard/TopProductsCard';
import { printReceipt } from '../components/Receipt';

// Subcomponentes del Dashboard
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { MagicMetricCards } from '../components/dashboard/MagicMetricCards';

import { DashboardCharts } from '../components/dashboard/DashboardCharts';

import { QrModal } from '../components/dashboard/QrModal';
import OrderChangesCard from '../components/OrderChangesCard';
import { AppIcon } from '../components/icons';
import { CashierHome } from '../components/CashierHome';
import { OwnerPulse } from '../components/OwnerPulse';
import { useBranches } from '../context/BranchContext';
import { usePlan } from '../hooks/usePlan';
import { useBranchStocks } from '../hooks/useBranchStocks';
import { toStockMap } from '../services/branchStock';
import { palette } from '../design/tokens.js';

function SectionHeader({ title }) {
  return (
    <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--mg-text-secondary)] mb-3 flex items-center gap-2">
      <span className="w-1 h-3.5 rounded-full bg-[var(--mg-brand)]" />
      {title}
    </h2>
  );
}

export default function Dashboard() {
  const { businessId, user, role } = useAuth();
  const isOwner = role === 'owner';
  const { business, settings, sectorConfig } = useBusiness();
  // Restaurante: sin compras ni vencimientos en el inicio.
  const isRestaurantMode = !!sectorConfig?.features?.dishes;
  // El dueño puede ocultar existencias y alertas de stock desde Ajustes.
  const showStock = sectorConfig?.features?.stock !== false;
  const navigate = useNavigate();
  // Todo el contenido del inicio siempre visible: sin anuncios de planes.

  // Estados
  const [todaySales, setTodaySales] = useState([]);
  const [orderChanges, setOrderChanges] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [showQr, setShowQr] = useState(false);
  const [salesItemsMap, setSalesItemsMap] = useState({});
  const [printingSaleId, setPrintingSaleId] = useState(null);
  const [replenishments, setReplenishments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [alertBusyId, setAlertBusyId] = useState(null);

  // Carga de datos iniciales y suscripciones en tiempo real
  useEffect(() => {
    if (!businessId) return;

    const unsubSales = subscribeToTodaySales(businessId, (sales) => {
      setTodaySales(sales);
    });
    const unsubOrderChanges = subscribeToSaleChanges(businessId, setOrderChanges);

    Promise.allSettled([
      getProducts(businessId),
    ])
      .then(([prods]) => {
        if (prods.status === 'fulfilled') setProducts(prods.value);
      })
      .finally(() => setLoading(false));

    return () => {
      unsubSales();
      unsubOrderChanges();
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

  // Ventas vigentes: las canceladas no cuentan en totales, gráficos ni reportes.
  const activeTodaySales = useMemo(
    () => todaySales.filter((s) => s.status !== 'cancelled'),
    [todaySales]
  );

  // Ventas visibles según rol (dueño ve todas, cajero solo las suyas)
  const visibleSales = useMemo(() => (
    isOwner ? activeTodaySales : activeTodaySales.filter((s) => s.createdBy === user?.uid)
  ), [isOwner, activeTodaySales, user?.uid]);

  const todayOrderChanges = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return orderChanges.filter((change) => {
      const d = change.createdAt?.toDate ? change.createdAt.toDate() : new Date(change.createdAt);
      return d >= start;
    });
  }, [orderChanges]);

  const todaySalesById = useMemo(
    () => Object.fromEntries(todaySales.map((sale) => [sale.id, sale])),
    [todaySales]
  );

  // Sede del Inicio: filtra todo el día (resumen, análisis, en vivo).
  const { branches } = useBranches();
  const { can } = usePlan();
  const canBranches = can('branches');
  const [homeBranch, setHomeBranch] = useState('all');
  const mainBranchId = branches.find((b) => b.isMain)?.id || branches[0]?.id || null;
  const saleBranchId = (s) => s.branchId || s.branch_id || mainBranchId;
  const daySales = useMemo(() => {
    if (!isOwner || homeBranch === 'all') return visibleSales;
    return visibleSales.filter((s) => saleBranchId(s) === homeBranch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSales, homeBranch, mainBranchId, isOwner]);

  // Bitácora de pedidos del inicio: mismas ventas visibles y misma sede.
  const homeOrderChanges = useMemo(() => {
    if (!isRestaurantMode) return [];
    const scopedSales = (isOwner ? todaySales : todaySales.filter((s) => s.createdBy === user?.uid))
      .filter((s) => !isOwner || homeBranch === 'all' || saleBranchId(s) === homeBranch);
    const ids = new Set(scopedSales.map((s) => s.id));
    return todayOrderChanges.filter((change) => ids.has(change.saleId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestaurantMode, isOwner, todaySales, user?.uid, homeBranch, mainBranchId, todayOrderChanges]);

  // Ítems solo de las ventas del día/sede visible
  const scopedItemsMap = useMemo(() => {
    const ids = new Set(daySales.map((s) => s.id));
    const out = {};
    Object.entries(salesItemsMap).forEach(([sid, items]) => {
      if (ids.has(sid)) out[sid] = items;
    });
    return out;
  }, [salesItemsMap, daySales]);

  // Stock bajo: por sede si hay filtro, si no el global
  const branchStockRows = useBranchStocks(businessId, mainBranchId);
  const branchStockMap = useMemo(() => toStockMap(branchStockRows), [branchStockRows]);



  // Cargar los ítems de cada venta visible (gráficos)
  useEffect(() => {
    if (!businessId || daySales.length === 0) return;
    daySales.forEach((sale) => {
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
  }, [daySales, businessId]);

  // Datos del gráfico de productos más vendidos (cantidades en UNIDADES BASE:
  // los paquetes suman × su factor)
  const topProductsChartData = useMemo(() => {
    const productsCount = {};
    Object.values(scopedItemsMap).flat().forEach((item) => {
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

    const colors = [
      palette.brand[700],
      palette.action[600],
      palette.emerald[600],
      palette.amber[600],
      palette.red[600],
      palette.neutral[400],
      palette.brand[400],
      palette.action[400],
    ];
    return top.map((item, i) => ({ ...item, color: colors[i % colors.length] }));
  }, [scopedItemsMap]);

  // Datos del gráfico de ventas por categoría
  const categorySalesChartData = useMemo(() => {
    const categoryTotals = {};
    Object.values(scopedItemsMap).flat().forEach((item) => {
      const cat = item.category || 'Otros';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (item.subtotal || 0);
    });

    const sorted = Object.entries(categoryTotals)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const colors = [
      palette.action[600],
      palette.brand[700],
      palette.emerald[600],
      palette.amber[600],
      palette.red[600],
      palette.neutral[400],
      palette.action[400],
      palette.brand[400],
    ];
    return sorted.map((item, i) => ({ ...item, color: colors[i % colors.length] }));
  }, [scopedItemsMap]);

  // Tendencia por media hora (48 franjas)
  const hourlyTrendData = useMemo(() => {
    const trend = Array.from({ length: 48 }, (_, i) => ({
      slot: i,
      label: `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
      total: 0,
    }));

    daySales.forEach((s) => {
      if (!s.createdAt) return;
      const d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      const slot = d.getHours() * 2 + (d.getMinutes() >= 30 ? 1 : 0);
      if (trend[slot]) {
        trend[slot].total += s.total || 0;
      }
    });

    return trend;
  }, [daySales]);

  // Productos que necesitan reposición (de la sede elegida si hay filtro)
  const lowStock = useMemo(() => {
    if (isOwner && homeBranch !== 'all' && branchStockRows.length > 0) {
      const byId = Object.fromEntries(products.map((p) => [p.id, p]));
      return branchStockRows
        .filter((r) => r.branch_id === homeBranch)
        .map((r) => {
          const p = byId[r.product_id];
          if (!p) return null;
          return { ...p, stock: Number(r.stock || 0) };
        })
        .filter((p) => p && !p.isDish && p.stock <= (p.minStock || 5));
    }
    return products.filter((p) => !p.isDish && p.stock <= (p.minStock || 5));
  }, [products, homeBranch, branchStockRows, isOwner]);

  // Pagos fijos con aviso activo, según la sede elegida en Inicio.
  const fixedAlerts = useMemo(() => {
    const scoped = !isOwner || homeBranch === 'all'
      ? expenses
      : expenses.filter((e) => (e.branch_id || mainBranchId) === homeBranch);
    return buildFixedExpenseAlerts(scoped);
  }, [expenses, isOwner, homeBranch, mainBranchId]);

  // Totales por método de pago (con soporte para mixtos)
  const totalQr = daySales.reduce((sum, s) => {
    if (s.paymentMethod === 'qr') return sum + (s.total || 0);
    if (s.paymentMethod === 'mixto') return sum + (s.montoQR || 0);
    return sum;
  }, 0);

  const totalCash = daySales.reduce((sum, s) => {
    if (s.paymentMethod === 'cash') return sum + (s.total || 0);
    if (s.paymentMethod === 'mixto') return sum + (s.montoEfectivo || 0);
    if (s.paymentMethod !== 'qr' && s.paymentMethod !== 'mixto' && s.paymentMethod !== 'fiado') {
      return sum + (s.total || 0);
    }
    return sum;
  }, 0);

  const totalHoy = totalCash + totalQr;
  const paidSalesCount = daySales.filter((s) => s.paymentMethod !== 'fiado').length;

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
    Object.values(scopedItemsMap).flat().reduce((sum, it) => {
      const cost = it.supplier_price ?? it.supplierPrice ?? null;
      if (cost === null || cost === undefined) return sum;
      const factor = Number(it.presentation_factor ?? it.presentationFactor ?? 1);
      return sum + Number(cost) * Number(it.quantity || 0) * factor;
    }, 0)
  ), [scopedItemsMap]);

  // Gastos de hoy (de la sede elegida; viejos sin sede van a la principal)
  const gastosHoy = useMemo(() => (
    expenses
      .filter((e) => {
        const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
        if (!isToday(d)) return false;
        if (!isOwner || homeBranch === 'all') return true;
        return (e.branch_id || mainBranchId) === homeBranch;
      })
      .reduce((s, e) => s + Number(e.amount || 0), 0)
  ), [expenses, isOwner, homeBranch, mainBranchId]);

  // Ganancia del día = ventas − costo − gastos
  const gananciaHoy = totalHoy - cogsHoy - gastosHoy;
  const margenHoy = totalHoy > 0 ? (gananciaHoy / totalHoy) * 100 : 0;

  // Control de vencimientos: lo vencido y por vencer (30 días) con stock.
  const expirySummary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nearest = {};
    replenishments.forEach((r) => {
      if (!r.productId || !r.expiryDate) return;
      const d = new Date(`${r.expiryDate}T00:00:00`);
      if (!nearest[r.productId] || d < nearest[r.productId]) nearest[r.productId] = d;
    });
    const byId = Object.fromEntries(products.map((p) => [p.id, p]));
    const rows = Object.entries(nearest)
      .map(([pid, date]) => {
        const p = byId[pid];
        if (!p) return null;
        const daysLeft = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
        // Stock de la sede filtrada; global si se ve consolidado.
        const stock = (isOwner && homeBranch !== 'all' && branchStockRows.length > 0)
          ? Number(branchStockMap.get(`${homeBranch}:${pid}`) ?? 0)
          : Number(p.stock || 0);
        return { productId: pid, name: p.name, stock, date, daysLeft };
      })
      .filter(Boolean)
      .filter((r) => r.daysLeft <= 30)
      // Con sede filtrada: solo lo que realmente hay en esa sede.
      .filter((r) => homeBranch === 'all' || !isOwner || r.stock > 0)
      .sort((a, b) => a.date - b.date);
    return {
      expired: rows.filter((r) => r.daysLeft < 0).length,
      soon: rows.filter((r) => r.daysLeft >= 0).length,
      items: rows,
    };
  }, [replenishments, products, homeBranch, branchStockRows, branchStockMap, isOwner]);

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

  async function handleSnoozeAlert(item) {
    setAlertBusyId(item.id);
    try {
      await snoozeExpenseAlert(item.id, 7);
    } catch {
      window.alert('No se pudo posponer el aviso. Intentá de nuevo.');
    } finally {
      setAlertBusyId(null);
    }
  }

  async function handleDismissAlert(item) {
    setAlertBusyId(item.id);
    try {
      await dismissExpenseAlert(item.id);
    } catch {
      window.alert('No se pudo marcar el pago como listo. Intentá de nuevo.');
    } finally {
      setAlertBusyId(null);
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
          salesItemsMap={scopedItemsMap}
          lowStock={showStock ? lowStock : []}
          totalCobrado={totalHoy}
          totalCash={totalCash}
          totalQr={totalQr}
          onNavigate={(path, opts) => navigate(path, opts)}
          onSelectSale={(sale) => navigate(`/recibo/${sale.id}`)}
          onReimprint={handleReimprint}
          printingSaleId={printingSaleId}
          orderChanges={homeOrderChanges}
          salesById={todaySalesById}
          showOrderChanges={isRestaurantMode}
        />
      </>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="p-4 sm:p-6 space-y-5 sm:space-y-7 max-w-7xl mx-auto pb-16"
    >
      {/* CABECERA: SEDE, SALUDO Y ACCIONES PRINCIPALES */}
      <DashboardHeader
        today={todayStr}
        businessName={business?.name || settings?.businessName || 'Mi negocio'}
        settings={settings}
        onShowQr={() => setShowQr(true)}
        onNavigate={(path, opts) => navigate(path, opts)}
        branches={branches}
        homeBranch={homeBranch}
        onBranchChange={setHomeBranch}
      />

      {/* 1 — PAGOS FIJOS: lo primero que el dueño necesita resolver */}
      <FixedExpenseAlerts
        alerts={fixedAlerts}
        onOpen={() => navigate('/egresos?tipo=fixed')}
        onSnooze={handleSnoozeAlert}
        onDismiss={handleDismissAlert}
        busyId={alertBusyId}
      />

      {/* 2 — PEDIDOS CON CAMBIOS (solo restaurante) */}
      {isRestaurantMode && (
        <OrderChangesCard
          changes={homeOrderChanges}
          salesById={todaySalesById}
          onOpen={() => navigate('/ventas?tab=bitacora')}
        />
      )}

      {/* 3 — ALERTAS OPERATIVAS: stock y vencimientos */}
      {((showStock && lowStock.length > 0) || !isRestaurantMode) && (
        <div className="mg-grid-auto">
          {showStock && (
            <LowStockAlert
              items={lowStock}
              onNavigate={(path, opts) => navigate(path, opts)}
              reorderPath={isRestaurantMode ? '/inventario' : '/compras'}
            />
          )}
          {!isRestaurantMode && (
            <ExpiryAlert
              expiredCount={expirySummary.expired}
              soonCount={expirySummary.soon}
              items={expirySummary.items}
              onNavigate={(path) => navigate(path)}
            />
          )}
        </div>
      )}

      {/* 4 — RESUMEN DEL DÍA (siempre visible, aunque sea 0) */}
      <section>
        <SectionHeader title={homeBranch !== 'all' ? `Resumen del día · ${(branches.find((b) => b.id === homeBranch)?.name) || 'Sucursal'}` : 'Resumen del día'} />
        <MagicMetricCards
          totalHoy={totalHoy}
          paidSalesCount={paidSalesCount}
          totalCash={totalCash}
          totalQr={totalQr}
          comprasTotal={comprasHoy.total}
          comprasCount={comprasHoy.count}
          gananciaNeta={gananciaHoy}
          margen={margenHoy}
          showCompras={!isRestaurantMode}
          onNavigate={(path) => navigate(path)}
        />
      </section>

      {/* 5 — PULSO DEL NEGOCIO: rendimiento mensual, sucursales y en vivo */}
      <OwnerPulse
        businessId={businessId}
        liveSales={daySales}
        salesItemsMap={scopedItemsMap}
        branchId={homeBranch}
        mainBranchId={mainBranchId}
        showBranches={!isRestaurantMode && canBranches}
        branchName={homeBranch !== 'all' ? (branches.find((b) => b.id === homeBranch)?.name || '') : ''}
        onNavigate={(path, opts) => navigate(path, opts)}
        onReimprint={handleReimprint}
        printingSaleId={printingSaleId}
      />

      {/* 6 — ANÁLISIS DETALLADO (siempre visible) */}
      <section className="bg-[var(--mg-bg-surface)] rounded-3xl p-4 sm:p-5 border border-[var(--mg-border)] shadow-[var(--mg-shadow-sm)] space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--mg-separator)] pb-3 gap-3 flex-wrap">
            <div>
              <h3 className="font-black text-base text-[var(--mg-brand-text)]">Análisis del día</h3>
              <p className="text-xs text-[var(--mg-text-muted)]">Productos, categorías y tendencia por hora</p>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              type="button"
              className="text-xs font-bold text-[var(--mg-accent-text)] hover:text-[var(--mg-accent-hover)] hover:underline flex items-center gap-1 disabled:opacity-50 min-h-[32px]"
            >
              {exporting ? 'Exportando...' : <><AppIcon name="csv" size={14} /> Exportar CSV</>}
            </button>
          </div>

          <div className="mg-grid-auto">
            <TopProductsCard data={topProductsChartData} />
          </div>

          <DashboardCharts
            visibleSalesCount={daySales.length}
            topProductsChartData={topProductsChartData}
            categorySalesChartData={categorySalesChartData}
            hourlyTrendData={hourlyTrendData}
          />
        </section>
      {/* MODALES */}

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

