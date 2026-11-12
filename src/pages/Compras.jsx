import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { subscribeToProducts, subscribeToReplenishments } from '../services/products';
import { subscribeToCategories } from '../services/categories';
import PurchaseProformas from './PurchaseProformas';
import DataTable from '../components/DataTable';
import { AuditPurchasesList } from '../components/AuditPurchasesList';
import { AppIcon } from '../components/icons';
import ReportHeader from '../components/ReportHeader';
import MetricCard from '../components/ui/MetricCard';
import { toLocalISODate } from '../utils/dateRanges';
import { getExpiryWarningDays } from '../utils/expiry';
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
  const { settings, sectorConfig } = useBusiness();
  const expiryWarningDays = getExpiryWarningDays(sectorConfig);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [initialProductId] = useState(() => location.state?.reorderProductId || null);
  const [products, setProducts] = useState([]);
  const [replenishments, setReplenishments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const tabParam = searchParams.get('tab');
  const activeTab = tabParam === 'historial' ? 'historial' : 'proformas'; // 'proformas' | 'historial'

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
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

  useEffect(() => {
    if (location.state?.reorderProductId) window.history.replaceState({}, '');
  }, [location.state]);

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
        const color = daysLeft < 0 ? 'text-[var(--mg-danger)]' : daysLeft <= expiryWarningDays ? 'text-[var(--mg-gold-text)]' : 'text-[var(--mg-text-secondary)]';
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

  if (activeTab === 'proformas') {
    return (
      <PurchaseProformas
        products={products}
        replenishments={replenishments}
        categories={categories}
        initialProductId={initialProductId}
      />
    );
  }

  return (
    <div className="flex flex-col lg:h-full lg:overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4 space-y-3 flex-1 flex flex-col min-h-0">
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
        </div>
      </div>
    </div>
  );
}
