import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { subscribeToProducts, subscribeToReplenishments } from '../services/products';
import { subscribeToCategories } from '../services/categories';
import PurchaseForm from '../components/PurchaseForm';
import DataTable from '../components/DataTable';
import ProductCatalogCard, { StockLabel } from '../components/ProductCatalogCard';
import ReportHeader from '../components/ReportHeader';
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
  const { businessId } = useAuth();
  const { settings } = useBusiness();
  const [searchParams] = useSearchParams();
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

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return toLocalISODate(d);
  });
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

  function handleSelectProduct(product) {
    setSelectedProduct(product);
    setShowMobilePanel(true);
  }

  function handleCloseSelection() {
    setSelectedProduct(null);
    setShowMobilePanel(false);
  }

  const filteredProducts = products
    .filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand || '').toLowerCase().includes(search.toLowerCase())
    )
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
      render: (r) => r.supplier || <span className="text-gray-300">—</span>,
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
        if (!r.expiryDate) return <span className="text-gray-300">—</span>;
        const expiry = new Date(`${r.expiryDate}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        const label = expiry.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
        const color = daysLeft < 0 ? 'text-red-500' : daysLeft <= 30 ? 'text-amber-600' : 'text-[var(--mg-text-secondary)]';
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
      render: (r) => <span className="font-black text-[var(--mg-accent)]">{formatBs(r.totalCost)}</span>,
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
        <div className="w-8 h-8 border-4 border-[var(--mg-accent-border)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row lg:h-full lg:overflow-hidden relative">
      {/* Columna Izquierda */}
      <div className="flex-1 flex flex-col min-h-0 lg:pr-4">
        <div className="p-4 space-y-3 flex-1 flex flex-col min-h-0">
          {activeTab === 'comprar' && (
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold text-[var(--mg-text-primary)]">Comprar</h2>
            </div>
          )}

          {activeTab === 'comprar' ? (
            <>
              <div className="shrink-0">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="🔍  Buscar producto o marca..."
                  className="w-full border-2 border-[var(--mg-border)] rounded-2xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent-border)] text-base"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1.5 -mx-4 px-4 scrollbar-hide shrink-0">
                {['Todas', ...categories].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilterCategory(cat)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      filterCategory === cat
                        ? 'bg-[var(--mg-accent)] text-white shadow-sm'
                        : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pb-24 lg:pb-6">
                {filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
                    {filteredProducts.map((product) => (
                      <ProductCatalogCard
                        key={product.id}
                        product={product}
                        priceLabel={`Costo: ${formatBs(product.supplierPrice)}`}
                        metaLabel={<StockLabel stock={product.stock} minStock={product.minStock} />}
                        selected={selectedProduct?.id === product.id}
                        onSelect={() => handleSelectProduct(product)}
                        actionArea={
                          <button
                            type="button"
                            onClick={() => handleSelectProduct(product)}
                            className="w-8 h-8 rounded-full bg-[var(--mg-accent)] text-white shadow-lg flex items-center justify-center active:scale-90 font-black text-base leading-none"
                          >
                            +
                          </button>
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-[var(--mg-text-faint)]">
                    <p className="text-5xl mb-3">📦</p>
                    <p className="font-semibold">{search ? 'No encontrado' : 'Sin productos'}</p>
                    {!search && <p className="text-sm mt-1">Ve a Inventario para agregar productos</p>}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto pb-24 lg:pb-6 space-y-4">
              <ReportHeader
                icon="🛍️"
                title="Reporte de Compras"
                subtitle="Historial detallado de tus compras y reposiciones de stock."
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onExport={handleExportPurchases}
                exportDisabled={filteredReplenishments.length === 0}
              />

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
              onClose={() => setSelectedProduct(null)}
              onSaved={() => setSelectedProduct(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--mg-text-faint)] p-6">
              <span className="text-5xl mb-3">🛍️</span>
              <p className="font-semibold text-sm">Selecciona un producto</p>
              <p className="text-xs text-center mt-1">Elegí un producto del catálogo para registrar una compra</p>
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
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3" />
            <PurchaseForm
              businessId={businessId}
              product={selectedProduct}
              onClose={handleCloseSelection}
              onSaved={handleCloseSelection}
            />
          </div>
        </div>
      )}
    </div>
  );
}
