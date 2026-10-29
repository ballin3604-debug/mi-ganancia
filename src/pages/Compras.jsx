import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { subscribeToProducts, subscribeToReplenishments } from '../services/products';
import { subscribeToCategories } from '../services/categories';
import { getPurchaseDraft } from '../services/purchaseDraft';
import PurchaseForm from '../components/PurchaseForm';
import DataTable from '../components/DataTable';
import ProductCatalogCard, { StockLabel } from '../components/ProductCatalogCard';
import { AuditPurchasesList } from '../components/AuditPurchasesList';
import ProductListRow, { RowAddButton } from '../components/ProductListRow';
import BarcodeScanner from '../components/BarcodeScanner';
import { AppIcon } from '../components/icons';
import { useBranches } from '../context/BranchContext';
import { toStockMap } from '../services/branchStock';
import { useBranchStocks } from '../hooks/useBranchStocks';
import ReportHeader from '../components/ReportHeader';
import MetricCard from '../components/ui/MetricCard';
import EmptyState from '../components/ui/EmptyState';
import { toLocalISODate } from '../utils/dateRanges';
import { exportReportToPDF } from '../utils/pdfExport';

function formatBs(amount) {
  return `Bs ${Number(amount || 0).toFixed(2)}`;
}

function formatDate(dateLike) {
  const d = dateLike?.toDate ? dateLike.toDate() : new Date(dateLike);
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Compras() {
  const { businessId, user, hasPermission } = useAuth();
  const { settings } = useBusiness();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [replenishments, setReplenishments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const activeTab = searchParams.get('tab') === 'historial' ? 'historial' : 'comprar'; // 'comprar' | 'historial'
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todas');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [purchaseDraft, setPurchaseDraft] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanMsg, setScanMsg] = useState('');
  function openScanner() {
    if (!hasPermission('scanner')) return;
    setScanMsg('');
    setShowScanner(true);
  }
  const hasTriedRestoreRef = useRef(false);
  // Fase 2: catálogo con stock de la sede operativa
  const { branches, activeBranchId } = useBranches();
  const mainBranchId = branches.find((b) => b.isMain)?.id || branches[0]?.id || null;
  const stockRows = useBranchStocks(businessId, mainBranchId);
  const stockMap = useMemo(() => toStockMap(stockRows), [stockRows]);
  const hasBranchRows = stockRows.length > 0;
  const productsWithStock = useMemo(() => {
    // Plato: no se compra ni se repone (no lleva inventario).
    const base = products.filter((p) => !p.isDish);
    return activeBranchId && hasBranchRows
      ? base.map((p) => ({ ...p, stock: Number(stockMap.get(`${activeBranchId}:${p.id}`) ?? 0) }))
      : base;
  }, [products, stockMap, activeBranchId, hasBranchRows]);

  const [startDate, setStartDate] = useState(() => toLocalISODate(new Date()));
  const [endDate, setEndDate] = useState(() => toLocalISODate(new Date()));

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);

    let prodsReady = false;
    let repsReady = false;
    const checkReady = () => {
      if (prodsReady && repsReady) setLoading(false);
    };

    const unsubCats = subscribeToCategories(businessId, setCategories);

    const unsubProds = subscribeToProducts(businessId, (data) => {
      setProducts(data);
      prodsReady = true;
      checkReady();
    });

    const unsubReps = subscribeToReplenishments(businessId, (data) => {
      setReplenishments(data);
      repsReady = true;
      checkReady();
    });

    return () => {
      unsubCats();
      unsubProds();
      unsubReps();
    };
  }, [businessId]);

  // Recupera una compra en curso si el usuario salió de la app a mitad de
  // registrarla (p.ej. abrió la calculadora del celular) — mismo mecanismo
  // que ya existe en Ventas para el carrito.
  useEffect(() => {
    if (!businessId || !user?.uid || products.length === 0) return;
    if (hasTriedRestoreRef.current || selectedProduct) return;
    hasTriedRestoreRef.current = true;

    getPurchaseDraft(businessId, user.uid).then((draft) => {
      if (!draft) return;
      const prod = productsWithStock.find((p) => p.id === draft.productId);
      if (!prod) return;
      // Restauración silenciosa: vuelve intacta sin mostrar avisos.
      setSelectedProduct(prod);
      setShowMobilePanel(true);
      setPurchaseDraft(draft);
    });
  }, [businessId, user?.uid, productsWithStock, selectedProduct]);

  function handleSelectProduct(product) {
    setPurchaseDraft(null);
    setSelectedProduct(product);
    setShowMobilePanel(true);
  }

  // Reordenar desde el Pulso: llega con el producto ya elegido.
  useEffect(() => {
    const reorderId = location.state?.reorderProductId;
    if (!reorderId || productsWithStock.length === 0) return;
    const prod = productsWithStock.find((p) => p.id === reorderId);
    if (prod) {
      setSelectedProduct(prod);
      setShowMobilePanel(true);
      // Se consume una sola vez para no reabrir al volver atrás
      window.history.replaceState({}, '');
    }
  }, [location.state, productsWithStock]);

  function handleCloseSelection() {
    setPurchaseDraft(null);
    setSelectedProduct(null);
    setShowMobilePanel(false);
  }

  function handleScan(code) {
    const c = String(code || '').trim().toLowerCase();
    if (!c) return;
    const found = productsWithStock.find((p) => String(p.barcode || '').trim().toLowerCase() === c);
    if (found) {
      setScanMsg('');
      setShowScanner(false);
      handleSelectProduct(found);
    } else {
      setScanMsg(`Código ${code} no registrado. Créalo primero en Inventario.`);
    }
  }

  const filteredProducts = productsWithStock
    .filter((p) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q)
      );
    })
    .filter((p) => filterCategory === 'Todas' || p.category === filterCategory);

  // Memoizado: replenishments puede tener miles de registros históricos, y
  // sin memoizar esto se re-ordenaba completo en cada render (incluida cada
  // tecla escrita en el buscador de "Comprar", que no tiene nada que ver).
  const start = useMemo(() => new Date(`${startDate}T00:00:00`), [startDate]);
  const end = useMemo(() => new Date(`${endDate}T23:59:59.999`), [endDate]);

  const filteredReplenishments = useMemo(() => replenishments
    .filter((r) => {
      const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
      return d >= start && d <= end;
    })
    .sort((a, b) => {
      const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return db - da;
    }), [replenishments, start, end]);

  const periodSummary = useMemo(() => ({
    total: filteredReplenishments.reduce((sum, r) => sum + Number(r.totalCost || 0), 0),
    units: filteredReplenishments.reduce((sum, r) => sum + Number(r.quantity || 0), 0),
    extras: filteredReplenishments.reduce((sum, r) => sum + Number(r.additionalExpenses || 0), 0),
    suppliers: new Set(filteredReplenishments.map((r) => (r.supplier || '').trim()).filter(Boolean)).size,
  }), [filteredReplenishments]);

  // Lista móvil sin filtros: todas las compras, recientes primero (como auditoría).
  const allReplenishmentsSorted = useMemo(() => replenishments
    .slice()
    .sort((a, b) => {
      const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return db - da;
    }), [replenishments]);

  // Última compra por producto: sirve para que el modal "aprenda" cómo se
  // suele comprar cada producto (por unidad o por caja de N) y se abra ya
  // preconfigurado. Se deduce del historial de reposiciones — sin columnas
  // nuevas en la base de datos.
  const lastPurchaseByProduct = useMemo(() => {
    const map = {};
    replenishments.forEach((r) => {
      const t = r.createdAt?.toDate ? r.createdAt.toDate().getTime() : new Date(r.createdAt).getTime();
      if (!map[r.productId] || t > map[r.productId].t) {
        map[r.productId] = { t, purchaseUnitType: r.purchaseUnitType, packageSize: r.packageSize };
      }
    });
    return map;
  }, [replenishments]);

  // N° Compra: correlativo estable, asignado por orden cronológico de TODO
  // el historial del negocio (no cambia si se mueve el filtro de fechas).
  const replenishmentNumberById = useMemo(() => {
    const map = {};
    replenishments
      .slice()
      .sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return da - db;
      })
      .forEach((r, i) => { map[r.id] = i + 1; });
    return map;
  }, [replenishments]);

  const historyColumns = [
    {
      key: 'fecha', label: 'Fecha', align: 'left', width: 'w-28',
      render: (r) => <span className="font-mono text-xs">{formatDate(r.createdAt)}</span>,
    },
    {
      key: 'numeroCompra', label: 'N° Compra', align: 'left', width: 'w-24',
      render: (r) => <span className="font-mono text-xs font-bold">{`#C${String(replenishmentNumberById[r.id]).padStart(3, '0')}`}</span>,
    },
    {
      key: 'producto', label: 'Producto', align: 'left',
      render: (r) => <span className="font-bold">{r.productName}</span>,
    },
    {
      key: 'proveedor', label: 'Proveedor', align: 'left', width: 'w-32',
      render: (r) => r.supplier || <span className="text-[var(--mg-text-faint)]">—</span>,
    },
    {
      key: 'cantidad', label: 'Cantidad', align: 'right', width: 'w-24',
      render: (r) => (
        r.purchaseUnitType === 'package' && r.packageCount && r.packageSize ? (
          <span>
            <span className="font-bold">{r.quantity} und.</span>
            <span className="block text-[10px] text-[var(--mg-text-faint)] font-normal">{r.packageCount} x {r.packageSize}</span>
          </span>
        ) : `${r.quantity} und.`
      ),
    },
    {
      key: 'vencimiento', label: 'Vencimiento', align: 'center', width: 'w-28',
      render: (r) => {
        if (!r.expiryDate) return <span className="text-[var(--mg-text-faint)]">—</span>;
        const expiry = new Date(`${r.expiryDate}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        const label = expiry.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
        const color = daysLeft < 0 ? 'text-[var(--mg-danger)]' : daysLeft <= 30 ? 'text-[var(--mg-gold-text)]' : 'text-[var(--mg-text-secondary)]';
        return <span className={`font-mono text-xs font-semibold ${color}`}>{label}</span>;
      },
    },
    {
      key: 'costoUnitario', label: 'Costo unitario', align: 'right', width: 'w-28',
      render: (r) => formatBs(r.supplierPrice),
    },
    {
      key: 'gastosExtras', label: 'Gastos extras', align: 'right', width: 'w-28',
      render: (r) => formatBs(r.additionalExpenses),
    },
    {
      key: 'total', label: 'Total', align: 'right', width: 'w-28',
      render: (r) => <span className="font-black text-[var(--mg-brand-text)]">{formatBs(r.totalCost)}</span>,
    },
  ];

  function handleExportPurchases() {
    const columns = [
      { label: 'Fecha' },
      { label: 'N° Compra' },
      { label: 'Producto' },
      { label: 'Proveedor' },
      { label: 'Cantidad', align: 'right' },
      { label: 'Vencimiento', align: 'center' },
      { label: 'Costo unitario', align: 'right' },
      { label: 'Gastos extras', align: 'right' },
      { label: 'Total', align: 'right' },
    ];
    const rows = filteredReplenishments.map((r) => [
      formatDate(r.createdAt),
      `#C${String(replenishmentNumberById[r.id]).padStart(3, '0')}`,
      r.productName,
      r.supplier || '',
      r.purchaseUnitType === 'package' && r.packageCount && r.packageSize
        ? `${r.quantity} und. (${r.packageCount} x ${r.packageSize})`
        : `${r.quantity} und.`,
      r.expiryDate ? new Date(`${r.expiryDate}T00:00:00`).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
      formatBs(r.supplierPrice),
      formatBs(r.additionalExpenses),
      formatBs(r.totalCost),
    ]);
    const formattedStart = start.toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' });
    const formattedEnd = end.toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' });
    exportReportToPDF({
      businessName: settings?.businessName,
      title: 'Reporte de Compras',
      subtitle: 'Historial detallado de compras y reposiciones de stock.',
      periodLabel: `Periodo: ${formattedStart} hasta ${formattedEnd}`,
      columns,
      rows,
      totals: {
        label: 'Total del período',
        values: {
          4: filteredReplenishments.reduce((sum, r) => sum + Number(r.quantity || 0), 0),
          7: formatBs(filteredReplenishments.reduce((sum, r) => sum + Number(r.additionalExpenses || 0), 0)),
          8: formatBs(filteredReplenishments.reduce((sum, r) => sum + Number(r.totalCost || 0), 0)),
        },
      },
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--mg-brand-border)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row lg:h-full lg:overflow-hidden relative">
      {/* Columna Izquierda */}
      <div className="flex-1 flex flex-col min-h-0 lg:pr-4">
        <div className="p-4 space-y-3 flex-1 flex flex-col min-h-0">
          {activeTab === 'comprar' && (
            <div className="flex shrink-0 items-center justify-between gap-3 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3.5 shadow-[var(--mg-shadow-sm)]">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)]">
                  <AppIcon name="paquete" size={19} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--mg-text-muted)]">Reposición</p>
                  <h2 className="truncate text-lg font-black tracking-tight text-[var(--mg-brand-text)]">Comprar</h2>
                  <p className="truncate text-[11px] font-semibold text-[var(--mg-text-secondary)]">
                    {branches.find((b) => b.id === activeBranchId)?.name
                      ? `${branches.find((b) => b.id === activeBranchId).name} · `
                      : ''}Registra lo que entra al inventario
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'comprar' ? (
            <>
              <div className="flex shrink-0 gap-2">
                <div className="relative min-w-0 flex-1">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--mg-text-muted)]">
                    <AppIcon name="search" size={18} />
                  </span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar producto, marca o código..."
                    className="mg-input min-h-[52px] pl-11 text-base"
                  />
                </div>
                <button
                  type="button"
                  onClick={openScanner}
                  title="Escanear código de barras"
                  aria-label="Escanear código de barras"
                  className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)] shadow-[var(--mg-shadow-md)] transition-all hover:bg-[var(--mg-brand-hover)] active:scale-90"
                >
                  <AppIcon name="scan" size={23} />
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1.5 -mx-4 px-4 scrollbar-hide shrink-0">
                {['Todas', ...categories].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilterCategory(cat)}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${
                      filterCategory === cat
                        ? 'border-[var(--mg-brand)] bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)] shadow-sm'
                        : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-text-secondary)] hover:border-[var(--mg-border-hover)]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pb-24 lg:pb-6">
                {filteredProducts.length > 0 ? (
                  <div className="flex flex-col gap-2 sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-3 p-1 mg-stagger">
                    {filteredProducts.map((product) => (
                      <Fragment key={product.id}>
                        {/* Lista para celular */}
                        <div className="sm:hidden">
                          <ProductListRow
                            product={product}
                            subtitle={product.unitLabel || 'Unidad'}
                            priceLabel={`Costo: ${formatBs(product.supplierPrice)}`}
                            meta={<StockLabel stock={product.stock} minStock={product.minStock} />}
                            selected={selectedProduct?.id === product.id}
                            onSelect={() => handleSelectProduct(product)}
                            actionArea={<RowAddButton onAdd={() => handleSelectProduct(product)} />}
                          />
                        </div>
                        {/* Tarjetas para desktop */}
                        <div className="hidden sm:block">
                          <ProductCatalogCard
                            product={product}
                            priceLabel={`Costo: ${formatBs(product.supplierPrice)}`}
                            metaLabel={<StockLabel stock={product.stock} minStock={product.minStock} />}
                            selected={selectedProduct?.id === product.id}
                            onSelect={() => handleSelectProduct(product)}
                            actionArea={
                              <button
                                type="button"
                                onClick={() => handleSelectProduct(product)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--mg-brand)] text-base font-black leading-none text-[var(--mg-brand-contrast)] shadow-sm active:scale-90"
                              >
                                +
                              </button>
                            }
                          />
                        </div>
                      </Fragment>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon="paquete"
                    title={search ? 'No encontramos ese producto' : 'Sin productos para comprar'}
                    description={search
                      ? 'Prueba con otro nombre, marca o código de barras.'
                      : 'Ve a Inventario para agregar tu primer producto.'}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto pb-24 lg:pb-6 space-y-4">
              {/* Filtros y exportar solo en PC; en celular lista minimalista como auditoría */}
              <div className="hidden space-y-4 lg:block">
                <ReportHeader
                  icon={<AppIcon name="paquete" size={21} />}
                  title="Reporte de Compras"
                  subtitle="Historial detallado de tus compras y reposiciones de stock."
                  startDate={startDate}
                  endDate={endDate}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                  onExport={handleExportPurchases}
                  exportDisabled={filteredReplenishments.length === 0}
                />

                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <MetricCard
                    label="Total comprado"
                    value={formatBs(periodSummary.total)}
                    hint={`${filteredReplenishments.length} ${filteredReplenishments.length === 1 ? 'compra' : 'compras'}`}
                    icon="caja"
                    tone="brand"
                  />
                  <MetricCard
                    label="Unidades"
                    value={periodSummary.units}
                    hint="Ingresadas al inventario"
                    icon="paquete"
                    tone="action"
                  />
                  <MetricCard
                    label="Gastos extra"
                    value={formatBs(periodSummary.extras)}
                    hint="Flete y otros costos"
                    icon="gastos"
                    tone="warning"
                  />
                  <MetricCard
                    label="Proveedores"
                    value={periodSummary.suppliers}
                    hint="Distintos en el período"
                    icon="equipo"
                    tone="neutral"
                  />
                </div>
              </div>

              {/* Lista simple en celular, tabla completa en PC */}
              <div className="space-y-3 lg:hidden">
                <div className="flex items-center gap-2.5 px-1">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]">
                    <AppIcon name="historial" size={17} />
                  </span>
                  <div>
                    <h2 className="text-sm font-black tracking-tight text-[var(--mg-brand-text)]">Historial de compras</h2>
                    <p className="text-[11px] font-semibold text-[var(--mg-text-muted)]">Todas tus reposiciones, de la más reciente a la más antigua.</p>
                  </div>
                </div>
                <AuditPurchasesList
                  rows={allReplenishmentsSorted.map((r) => ({
                    ...r,
                    number: `#C${String(replenishmentNumberById[r.id]).padStart(3, '0')}`,
                  }))}
                />
              </div>
              <div className="hidden lg:block">
                <DataTable
                  columns={historyColumns}
                  rows={filteredReplenishments}
                  storageKey="mg-compras-report-columns"
                  getRowKey={(r) => r.id}
                  emptyMessage="No hay compras registradas en el rango de fechas seleccionado."
                  footer={[
                    { key: 'cantidad', label: 'Total del período', value: filteredReplenishments.reduce((sum, r) => sum + Number(r.quantity || 0), 0) },
                    { key: 'gastosExtras', value: formatBs(filteredReplenishments.reduce((sum, r) => sum + Number(r.additionalExpenses || 0), 0)) },
                    { key: 'total', value: formatBs(filteredReplenishments.reduce((sum, r) => sum + Number(r.totalCost || 0), 0)) },
                  ]}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Botón para desplegar/contraer el panel de compra (Sólo Desktop) */}
      {activeTab === 'comprar' && (
      <>
      <button
        type="button"
        onClick={() => setPanelOpen((v) => !v)}
        title={panelOpen ? 'Ocultar panel' : 'Mostrar panel'}
        className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] text-[var(--mg-text-secondary)] shadow-md items-center justify-center z-20 active:scale-90 transition-all duration-300 ${
          panelOpen ? 'right-[372px]' : 'right-2'
        }`}
      >
        <svg
          className={`w-5 h-5 transition-transform duration-300 ${panelOpen ? '' : 'rotate-180'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 17l-5-5 5-5M11 17l-5-5 5-5" />
        </svg>
      </button>

      {/* Columna Derecha (Desktop): Panel de compra */}
      {panelOpen && (
        <aside className="hidden lg:flex flex-col w-[380px] border-l border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shrink-0 h-full overflow-y-auto">
          {selectedProduct ? (
            <PurchaseForm
              businessId={businessId}
              product={selectedProduct}
              initialDraft={purchaseDraft}
              lastPurchase={lastPurchaseByProduct[selectedProduct.id] || null}
              onClose={handleCloseSelection}
              onSaved={handleCloseSelection}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-5">
              <EmptyState
                icon="nuevoProducto"
                title="Selecciona un producto"
                description="Elige un producto del catálogo para registrar su compra y actualizar el stock."
                className="w-full border-0 bg-transparent px-2 py-0 shadow-none"
              />
            </div>
          )}
        </aside>
      )}
      </>
      )}

      {/* Hoja inferior (Mobile) */}
      {activeTab === 'comprar' && showMobilePanel && selectedProduct && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={handleCloseSelection}>
          <div
            className="bg-[var(--mg-bg-surface)] rounded-t-3xl w-full max-w-md shadow-2xl overflow-y-auto mg-slide-up"
            style={{ maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-[var(--mg-border-hover)]" />
            <PurchaseForm
              businessId={businessId}
              product={selectedProduct}
              initialDraft={purchaseDraft}
              lastPurchase={lastPurchaseByProduct[selectedProduct.id] || null}
              onClose={handleCloseSelection}
              onSaved={handleCloseSelection}
            />
          </div>
        </div>
      )}

      {/* MODAL ESCÁNER */}
      {showScanner && (
        <div
          className="fixed inset-0 z-[90] flex flex-col bg-black"
          style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-black">
            <div className="flex items-center justify-between border-b border-[var(--mg-separator)] p-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]">
                  <AppIcon name="scan" size={17} />
                </span>
                <div>
                  <h3 className="font-black text-[var(--mg-text-primary)]">Escanear para comprar</h3>
                  <p className="text-[11px] font-semibold text-[var(--mg-text-muted)]">El producto se abrirá para registrar la compra</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScanner(false)}
                aria-label="Cerrar escáner"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]"
              >
                <AppIcon name="cerrar" size={15} />
              </button>
            </div>
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-4">
              <BarcodeScanner fullScreen onScan={handleScan} message={scanMsg} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
