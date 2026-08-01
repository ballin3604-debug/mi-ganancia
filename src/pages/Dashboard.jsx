import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { subscribeToTodaySales, getSaleItems, exportDetailedCSV } from '../services/sales';
import { getProducts } from '../services/products';
import { printReceipt } from '../components/Receipt';
import { getThisMonthIncome, getThisMonthExpenses, subscribeToThisMonthIncome } from '../services/expenses';
import { getDebts } from '../services/debts';
import { signOut } from '../services/auth';

function formatBs(amount) {
  return `Bs ${Number(amount || 0).toFixed(2)}`;
}

function getPaymentMethodLabel(method) {
  if (method === 'qr') return '📲 QR';
  if (method === 'cash') return '💵 Efectivo';
  if (method === 'mixto') return '🔀 Mixto';
  if (method === 'fiado') return '⏳ Fiado';
  return '💵 Efectivo';
}

function StatCard({ label, value, sub, gradient, icon, subColor = 'text-white/70' }) {
  return (
    <div className={`rounded-2xl p-4 ${gradient} shadow-md`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{label}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-black mt-1 text-white">{value}</p>
      {sub && <p className={`text-sm font-medium mt-0.5 ${subColor}`}>{sub}</p>}
    </div>
  );
}

function MiniBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.max(8, (value / max) * 100) : 8;
  return (
    <div className="flex items-center gap-2">
      <p className="text-xs text-[var(--mg-text-muted)] w-16 truncate shrink-0">{label}</p>
      <div className="flex-1 bg-[var(--mg-bg-elevated)] rounded-full h-3 overflow-hidden">
        <div className={`h-3 rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs font-bold text-[var(--mg-text-secondary)] w-14 text-right shrink-0">{formatBs(value)}</p>
    </div>
  );
}

function ProductThumb({ imageData }) {
  if (!imageData) return (
    <div className="w-7 h-7 bg-[var(--mg-bg-elevated)] rounded-lg flex items-center justify-center text-sm shrink-0">📦</div>
  );
  return <img src={imageData} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0 border border-[var(--mg-border)]" />;
}

function DonutChart({ data, totalLabel, isCurrency }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cumulativeAngle = 0;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-[var(--mg-text-faint)] text-xs">
        <span>No hay datos</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-2">
      <div className="relative w-28 h-28 shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {data.map((item, idx) => {
            const percentage = item.value / total;
            const angle = percentage * 360;
            const r = 25;
            const circ = 2 * Math.PI * r;
            const strokeLength = percentage * circ;
            const rotation = cumulativeAngle;
            cumulativeAngle += angle;

            return (
              <circle
                key={idx}
                cx="50"
                cy="50"
                r={r}
                fill="transparent"
                stroke={item.color}
                strokeWidth="11"
                strokeDasharray={`${strokeLength} ${circ}`}
                strokeDashoffset={0}
                transform={`rotate(${rotation} 50 50)`}
                className="transition-all duration-300 hover:stroke-[13px] cursor-pointer"
              />
            );
          })}
          <circle cx="50" cy="50" r="19" fill="var(--mg-bg-surface)" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[8px] text-[var(--mg-text-muted)] uppercase font-extrabold">{totalLabel}</span>
          <span className="text-xs font-black text-[var(--mg-text-primary)] truncate max-w-[55px]">
            {isCurrency ? `${Math.round(total)} Bs` : total}
          </span>
        </div>
      </div>
      
      {/* Leyenda */}
      <div className="flex-1 space-y-1.5 w-full min-w-0">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between text-[11px] text-[var(--mg-text-secondary)] font-bold font-mono">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="truncate">{item.label}</span>
            </div>
            <span className="text-[var(--mg-text-muted)] ml-2 shrink-0">
              {isCurrency ? `${Math.round(item.value)} Bs` : `${item.value} ud.`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ data, labelEvery = 4 }) {
  const maxVal = Math.max(...data.map(d => d.total), 1);
  const height = 160;
  const width = 640;
  const padding = 24;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - (d.total / maxVal) * (height - 2 * padding);
    return { x, y, index: i, label: d.label, total: d.total };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="p-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <defs>
          <linearGradient id="dashboardLineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1670C2" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#1670C2" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        
        {/* Grid lines */}
        {[0, 0.5, 1].map((ratio, i) => {
          const y = padding + ratio * (height - 2 * padding);
          return (
            <line
              key={i}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="var(--mg-border)"
              strokeWidth="0.5"
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Area */}
        <path d={areaD} fill="url(#dashboardLineGrad)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke="#1670C2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data Points */}
        {points.filter(p => p.total > 0).map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="#1670C2" stroke="#fff" strokeWidth="1" />
            <text x={p.x} y={p.y - 7} fontSize="7" fontWeight="bold" fill="var(--mg-text-primary)" textAnchor="middle">
              Bs {p.total.toFixed(0)}
            </text>
          </g>
        ))}

        {/* X Axis Labels */}
        {points.filter(p => p.index % labelEvery === 0).map((p, i) => (
          <text key={i} x={p.x} y={height - 4} fontSize="7.5" fontWeight="semibold" fill="var(--mg-text-muted)" textAnchor="middle">
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function SaleDetailModal({ sale, businessId, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sale) return;
    getSaleItems(businessId, sale.id)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [sale, businessId]);

  if (!sale) return null;
  const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date();

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-[var(--mg-bg-surface)] rounded-t-3xl w-full max-w-md shadow-2xl"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 overflow-y-auto" style={{ maxHeight: '85vh' }}>
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-[var(--mg-text-primary)]">Detalle de Venta</h3>
              <p className="text-[var(--mg-text-faint)] text-xs mt-0.5">
                {date.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })}
                {' · '}
                {date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-[var(--mg-bg-elevated)] rounded-full flex items-center justify-center text-[var(--mg-text-muted)] font-bold text-lg">×</button>
          </div>

          <div className="bg-[var(--mg-accent)] rounded-2xl p-4 mb-4 text-white">
            <p className="text-white/70 text-sm">Total cobrado</p>
            <p className="text-4xl font-black">{formatBs(sale.total)}</p>
            <p className="text-white/70 text-sm mt-1">
              {sale.itemCount || items.length} productos vendidos
              {' · '}
              {getPaymentMethodLabel(sale.paymentMethod)}
            </p>
            {sale.paymentMethod === 'mixto' && (
              <div className="text-xs text-white/80 mt-1.5 pt-1.5 border-t border-white/10 flex justify-between gap-4">
                <span>💵 Efectivo: {formatBs(sale.montoEfectivo)}</span>
                <span>📲 QR: {formatBs(sale.montoQR)}</span>
              </div>
            )}
            {sale.paymentMethod === 'cash' && sale.montoRecibido !== undefined && sale.montoRecibido !== null && (
              <div className="text-xs text-white/80 mt-1.5 pt-1.5 border-t border-white/10 flex justify-between gap-4">
                <span>Recibido: {formatBs(sale.montoRecibido)}</span>
                <span>Cambio: {formatBs(sale.cambio)}</span>
              </div>
            )}
            {sale.sellerName && (
              <p className="text-white/60 text-xs mt-1">Vendido por: {sale.sellerName}</p>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-[var(--mg-accent-border)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-bold text-[var(--mg-text-muted)] uppercase tracking-wide mb-3">Productos</p>
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 bg-[var(--mg-bg-elevated)] rounded-2xl p-3">
                  <ProductThumb imageData={item.imageData} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[var(--mg-text-primary)] text-sm truncate">{item.productName}</p>
                    {item.productBrand && <p className="text-[var(--mg-text-faint)] text-xs">{item.productBrand}</p>}
                    {item.category && <p className="text-[var(--mg-text-faint)] text-xs">{item.category}</p>}
                    <p className="text-[var(--mg-text-faint)] text-xs">{item.quantity} × {formatBs(item.price)}</p>
                  </div>
                  <p className="font-black text-[var(--mg-accent)] shrink-0">{formatBs(item.subtotal)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-[var(--mg-text-faint)] py-4 text-sm">Sin detalle de productos</p>
          )}

          <button onClick={onClose}
            className="w-full mt-5 bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)] font-bold py-3.5 rounded-2xl active:scale-95">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

const BAR_COLORS = ['bg-[var(--mg-accent)]', 'bg-blue-500', 'bg-purple-500', 'bg-orange-400', 'bg-pink-500'];

export default function Dashboard() {
  const { businessId, user, role, sellerName } = useAuth();
  const isOwner = role === 'owner';
  const { business, settings } = useBusiness();
  const navigate = useNavigate();
  const [todaySales, setTodaySales] = useState([]);
  const [products, setProducts] = useState([]);
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [monthIncome, setMonthIncome] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState([]);
  const [salesItemsMap, setSalesItemsMap] = useState({});
  const [printingSaleId, setPrintingSaleId] = useState(null);
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('Todos');
  const [filterCategory, setFilterCategory] = useState('Todas');

  useEffect(() => {
    if (!businessId) return;

    const unsubSales = subscribeToTodaySales(businessId, (sales) => {
      setTodaySales(sales);
    });

    const unsubIncome = subscribeToThisMonthIncome(businessId, (total) => {
      setMonthIncome(total);
    });

    Promise.allSettled([
      getProducts(businessId),
      getThisMonthExpenses(businessId),
      getDebts(businessId),
    ])
      .then(([prods, exps, dbs]) => {
        if (prods.status === 'fulfilled')  setProducts(prods.value);
        if (exps.status === 'fulfilled')   setMonthExpenses(exps.value);
        if (dbs.status === 'fulfilled')    setDebts(dbs.value);
      })
      .finally(() => setLoading(false));

    return () => {
      unsubSales();
      unsubIncome();
    };
  }, [businessId]);

  useEffect(() => {
    if (!showQr) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowQr(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showQr]);

  // Para deudas / fiados
  const pendingDebts = debts.filter((d) => d.status === 'pending');
  const totalPendingDebts = pendingDebts.reduce((sum, d) => sum + (d.amount || 0), 0);
  const uniqueClientsCount = new Set(pendingDebts.map(d => (d.clientName || '').trim().toLowerCase())).size;

  // Para cajeros: solo sus propias ventas del día
  const visibleSales = useMemo(() => (
    isOwner ? todaySales : todaySales.filter((s) => s.createdBy === user?.uid)
  ), [isOwner, todaySales, user?.uid]);

  const categoriesList = useMemo(() => {
    return ['Todas', ...new Set(products.map(p => p.category || 'Otros').filter(Boolean))];
  }, [products]);

  const filteredSales = useMemo(() => {
    return visibleSales.filter(s => {
      const matchesMethod = filterPaymentMethod === 'Todos' || s.paymentMethod === filterPaymentMethod;
      const itemsOfSale = salesItemsMap[s.id] || [];
      const matchesCategory = filterCategory === 'Todas' || itemsOfSale.some(item => item.category === filterCategory);
      return matchesMethod && matchesCategory;
    });
  }, [visibleSales, salesItemsMap, filterPaymentMethod, filterCategory]);

  const topProductsChartData = useMemo(() => {
    const productsCount = {};
    Object.values(salesItemsMap).flat().forEach(item => {
      const name = item.productName || 'Desconocido';
      productsCount[name] = (productsCount[name] || 0) + (item.quantity || 0);
    });

    const sorted = Object.entries(productsCount)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const topLimit = 6;
    const top = sorted.slice(0, topLimit);
    const others = sorted.slice(topLimit);
    if (others.length > 0) {
      const othersSum = others.reduce((sum, item) => sum + item.value, 0);
      top.push({ label: 'Otros', value: othersSum });
    }

    const colors = ['#1670C2', '#38bdf8', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#34d399', '#94a3b8'];
    return top.map((item, i) => ({ ...item, color: colors[i % colors.length] }));
  }, [salesItemsMap]);

  const categorySalesChartData = useMemo(() => {
    const categoryTotals = {};
    Object.values(salesItemsMap).flat().forEach(item => {
      const cat = item.category || 'Otros';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (item.subtotal || 0);
    });

    const sorted = Object.entries(categoryTotals)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const colors = ['#8b5cf6', '#10b981', '#1670C2', '#f59e0b', '#f43f5e', '#38bdf8', '#34d399', '#94a3b8'];
    return sorted.map((item, i) => ({ ...item, color: colors[i % colors.length] }));
  }, [salesItemsMap]);

  const hourlyTrendData = useMemo(() => {
    // 48 franjas de 30 minutos (00:00, 00:30, 01:00, ... 23:30)
    const trend = Array.from({ length: 48 }, (_, i) => ({
      slot: i,
      label: `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
      total: 0,
    }));
    visibleSales.forEach(s => {
      if (!s.createdAt) return;
      const d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      const slot = d.getHours() * 2 + (d.getMinutes() >= 30 ? 1 : 0);
      trend[slot].total += s.total || 0;
    });
    return trend;
  }, [visibleSales]);

  const hourlyBands = useMemo(() => {
    const bands = {};
    visibleSales.forEach(s => {
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

  const lowStock = products.filter((p) => p.stock <= (p.minStock || 5));

  const inventoryValue = useMemo(() => {
    return products.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);
  }, [products]);

  const outOfStock = useMemo(() => {
    return products.filter((p) => (p.stock || 0) <= 0);
  }, [products]);

  const granelProducts = useMemo(() => {
    return products.filter(p => p.unit && p.unit !== 'Unidad' && p.unit !== 'Caja');
  }, [products]);

  const topProductToday = useMemo(() => {
    if (topProductsChartData.length === 0) return 'Ninguno';
    const first = topProductsChartData[0];
    if (!first || first.label === 'Otros') {
      const nonOthers = topProductsChartData.find(x => x.label !== 'Otros');
      return nonOthers ? nonOthers.label : 'Ninguno';
    }
    return first.label;
  }, [topProductsChartData]);
  const maxTotal = visibleSales.length > 0 ? Math.max(...visibleSales.map((s) => s.total)) : 1;
  const totalMonthExpenses = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const monthProfit = monthIncome - totalMonthExpenses;
  const monthMargin = monthIncome > 0 ? (monthProfit / monthIncome) * 100 : null;

  // Totales por método de pago (con soporte para mixtos y excluyendo fiados)
  const totalQr = visibleSales.reduce((sum, s) => {
    if (s.paymentMethod === 'qr') return sum + (s.total || 0);
    if (s.paymentMethod === 'mixto') return sum + (s.montoQR || 0);
    return sum;
  }, 0);

  const totalCash = visibleSales.reduce((sum, s) => {
    if (s.paymentMethod === 'cash') return sum + (s.total || 0);
    if (s.paymentMethod === 'mixto') return sum + (s.montoEfectivo || 0);
    if (s.paymentMethod !== 'qr' && s.paymentMethod !== 'mixto' && s.paymentMethod !== 'fiado') return sum + (s.total || 0);
    return sum;
  }, 0);

  const totalHoy = totalCash + totalQr;
  const paidSalesCount = visibleSales.filter(s => s.paymentMethod !== 'fiado').length;

  const countQr = visibleSales.filter((s) => s.paymentMethod === 'qr' || (s.paymentMethod === 'mixto' && (s.montoQR || 0) > 0)).length;
  const countCash = visibleSales.filter((s) => s.paymentMethod === 'cash' || (s.paymentMethod === 'mixto' && (s.montoEfectivo || 0) > 0) || (s.paymentMethod !== 'qr' && s.paymentMethod !== 'mixto' && s.paymentMethod !== 'fiado')).length;

  async function handleExport() {
    setExporting(true);
    try {
      await exportDetailedCSV(businessId);
    } catch { alert('Error al exportar.'); }
    finally { setExporting(false); }
  }

  // Navigate to inventory with product pre-selected for editing
  function handleLowStockClick(product) {
    navigate('/inventario', { state: { editProduct: product } });
  }

  // Fetch items for visible sales
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
        date: date,
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

  const today = new Date().toLocaleDateString('es-BO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--mg-accent-border)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* BANNER PRINCIPAL (ESTILO BANCA DIGITAL) */}
      <div
        className="relative text-white rounded-[24px] p-5 shadow-lg -mx-4 sm:mx-0 overflow-hidden"
        style={{ background: 'linear-gradient(155deg, var(--mg-accent) 0%, var(--mg-accent-mid) 55%, var(--mg-accent-deep) 100%)' }}
      >
        {/* Halo dorado sutil — eco de la flecha del logo */}
        <div
          className="absolute -top-16 -right-20 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(217,154,43,0.28) 0%, transparent 70%)' }}
        />
        <div className="relative flex items-center justify-between mb-5">
          <div>
            <p className="text-blue-100 text-[10px] uppercase font-bold tracking-wider">{today}</p>
            <h2 className="text-xl font-black mt-0.5">
              Hola, {user?.displayName?.split(' ')[0] || 'vendedor'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* QR Button (Glassmorphism style) */}
            {settings?.qrData && (
              <button
                onClick={() => setShowQr(true)}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                title="Ver QR de cobro"
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </button>
            )}
            <img src={user?.photoURL || ''} alt=""
              onError={(e) => { e.target.style.display = 'none'; }}
              className="w-10 h-10 rounded-2xl border-2 border-white/30 object-cover" />
          </div>
        </div>

        {/* Balance / Resumen de Ventas del día */}
        <div className="relative bg-white/10 backdrop-blur-md rounded-[20px] p-4 border border-white/15">
          <p className="text-blue-100 text-[10px] font-bold uppercase tracking-wider">Ventas de Hoy (Total Cobrado)</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-black tracking-tight" style={{ color: '#f2c15c' }}>{formatBs(totalHoy)}</span>
            <span className="text-blue-100 text-xs font-semibold">({paidSalesCount} {paidSalesCount === 1 ? 'venta cobrada' : 'ventas cobradas'})</span>
          </div>

          {/* Desglose de Ventas por Método de Pago */}
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/10">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
              <svg className="w-5 h-5 text-white/80 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <div className="min-w-0">
                <p className="text-blue-100 text-[10px] font-semibold uppercase tracking-wide">Efectivo</p>
                <p className="text-sm sm:text-base font-black text-white mt-0.5 truncate">{formatBs(totalCash)}</p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
              <svg className="w-5 h-5 text-white/80 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <div className="min-w-0">
                <p className="text-blue-100 text-[10px] font-semibold uppercase tracking-wide">QR / Trans.</p>
                <p className="text-sm sm:text-base font-black text-white mt-0.5 truncate">{formatBs(totalQr)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ACCESOS RÁPIDOS (ESTILO SOBRIO Y PROFESIONAL) */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mg-stagger">
        <button
          onClick={() => navigate('/ventas')}
          className="flex flex-col items-center p-3 rounded-[20px] active:scale-95 transition-all shadow-md group text-white"
          style={{ background: 'linear-gradient(155deg, var(--mg-accent) 0%, var(--mg-accent-mid) 100%)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <span className="text-[10px] font-bold">Vender</span>
        </button>

        <button
          onClick={() => navigate('/inventario')}
          className="flex flex-col items-center p-3 bg-white border border-[var(--mg-border)] rounded-[20px] active:scale-95 transition-all shadow-sm hover:bg-gray-50 group"
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)] flex items-center justify-center mb-1.5 border border-[var(--mg-gold-border)] group-hover:scale-105 transition-transform">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-[var(--mg-text-secondary)]">Inventario</span>
        </button>

        <button
          onClick={() => navigate('/egresos')}
          className="flex flex-col items-center p-3 bg-white border border-[var(--mg-border)] rounded-[20px] active:scale-95 transition-all shadow-sm hover:bg-gray-50 group"
        >
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center mb-1.5 border border-red-100 group-hover:scale-105 transition-transform">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-[var(--mg-text-secondary)]">Egresos</span>
        </button>

        <button
          onClick={() => navigate('/reportes?type=profit')}
          className="flex flex-col items-center p-3 bg-white border border-[var(--mg-border)] rounded-[20px] active:scale-95 transition-all shadow-sm hover:bg-gray-50 group"
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] flex items-center justify-center mb-1.5 border border-[var(--mg-accent-border)] group-hover:scale-105 transition-transform">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-[var(--mg-text-secondary)]">Reportes</span>
        </button>

        <button
          onClick={() => setShowQr(true)}
          className="flex flex-col items-center p-3 bg-white border border-[var(--mg-border)] rounded-[20px] active:scale-95 transition-all shadow-sm hover:bg-gray-50 group"
        >
          <div className="w-10 h-10 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center mb-1.5 border border-gray-200 group-hover:scale-105 transition-transform">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-[var(--mg-text-secondary)]">Mostrar QR</span>
        </button>
      </div>

      {/* TARJETAS DE ESTADÍSTICAS DEL INVENTARIO Y CATÁLOGO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mg-stagger">
        {/* Productos en catálogo */}
        <div className="bg-white border border-[var(--mg-border)] rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--mg-text-muted)]">Productos en Catálogo</span>
            <p className="text-3xl font-black text-[var(--mg-text-primary)] mt-1">{products.length}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[var(--mg-accent-bg)] flex items-center justify-center border border-[var(--mg-accent-border)] text-[var(--mg-accent)] shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        </div>

        {/* Valor total del inventario */}
        <div className="bg-white border border-[var(--mg-border)] rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--mg-text-muted)]">Valor Total Inventario</span>
            <p className="text-3xl font-black text-[var(--mg-text-primary)] mt-1">{formatBs(inventoryValue)}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[var(--mg-gold-bg)] flex items-center justify-center border border-[var(--mg-gold-border)] text-[var(--mg-gold-text)] shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Productos stock bajo */}
        <button
          onClick={() => navigate('/inventario')}
          className="bg-white border border-[var(--mg-border)] rounded-2xl p-6 shadow-sm flex items-center justify-between text-left active:scale-98 transition-all hover:bg-gray-50/50"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--mg-text-muted)]">Productos Stock Bajo</span>
            <p className={`text-3xl font-black mt-1 ${lowStock.length > 0 ? 'text-amber-600' : 'text-[var(--mg-text-primary)]'}`}>
              {lowStock.length}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ${
            lowStock.length > 0 ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-gray-50 border-gray-200 text-gray-500'
          }`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </button>

        {/* Productos agotados (rojo solo para alertas de "agotado") */}
        <button
          onClick={() => navigate('/inventario')}
          className="bg-white border border-[var(--mg-border)] rounded-2xl p-6 shadow-sm flex items-center justify-between text-left active:scale-98 transition-all hover:bg-gray-50/50"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--mg-text-muted)]">Productos Agotados</span>
            <p className={`text-3xl font-black mt-1 ${outOfStock.length > 0 ? 'text-red-600' : 'text-[var(--mg-text-primary)]'}`}>
              {outOfStock.length}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ${
            outOfStock.length > 0 ? 'bg-red-50 border-red-200 text-red-600' : 'bg-gray-50 border-gray-200 text-gray-500'
          }`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
        </button>

        {/* Productos más vendidos */}
        <div className="bg-white border border-[var(--mg-border)] rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-1 min-w-0 flex-1 pr-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--mg-text-muted)]">Más Vendido Hoy</span>
            <p className="text-xl font-black text-[var(--mg-text-primary)] mt-1.5 truncate">{topProductToday}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[var(--mg-success-bg)] flex items-center justify-center border border-green-200 text-[var(--mg-success-text)] shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
        </div>

        {/* Productos a granel */}
        <div className="bg-white border border-[var(--mg-border)] rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--mg-text-muted)]">Productos a Granel</span>
            <p className="text-3xl font-black text-[var(--mg-text-primary)] mt-1">{granelProducts.length}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-200 text-gray-500 shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Monthly summary (dueño) / Mis ventas por método de pago (cajero) */}
      {isOwner ? (
        <div className="bg-[var(--mg-bg-surface)] rounded-2xl border border-[var(--mg-border)] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--mg-border)] flex items-center justify-between">
            <p className="font-bold text-[var(--mg-text-secondary)] text-sm">Resumen del mes</p>
            {monthMargin !== null && (
              <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${
                monthMargin >= 0 ? 'bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]' : 'bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]'
              }`}>
                {monthMargin >= 0 ? '▲' : '▼'} {Math.abs(monthMargin).toFixed(0)}% margen
              </span>
            )}
          </div>
          <div className="p-4 space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-[var(--mg-text-muted)] font-medium">Ingresos</span>
                <span className="text-xs font-black text-[var(--mg-accent)]">{formatBs(monthIncome)}</span>
              </div>
              <div className="bg-[var(--mg-bg-elevated)] rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-2.5 rounded-full bg-[var(--mg-accent)] transition-all duration-700"
                  style={{ width: monthIncome > 0 ? '100%' : '4%' }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-[var(--mg-text-muted)] font-medium">Egresos</span>
                <span className="text-xs font-black text-[var(--mg-danger)]">{formatBs(totalMonthExpenses)}</span>
              </div>
              <div className="bg-[var(--mg-bg-elevated)] rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-2.5 rounded-full bg-gradient-to-r from-red-400 to-rose-500 transition-all duration-700"
                  style={{ width: monthIncome > 0 ? `${Math.min(100, (totalMonthExpenses / monthIncome) * 100)}%` : '4%' }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-[var(--mg-border)]">
              <span className="text-sm font-bold text-[var(--mg-text-secondary)]">Ganancia neta</span>
              <span className={`text-lg font-black ${monthProfit >= 0 ? 'text-[var(--mg-accent)]' : 'text-[var(--mg-danger)]'}`}>
                {monthProfit >= 0 ? '+' : ''}{formatBs(monthProfit)}
              </span>
            </div>

            {/* Fiado pendiente — dinero por cobrar, no realizado todavía */}
            {totalPendingDebts > 0 && (
              <button
                onClick={() => navigate('/cxc')}
                className="w-full flex items-center gap-3 bg-[var(--mg-gold-bg)] border border-[var(--mg-gold-border)] rounded-xl px-3.5 py-3 mt-1 active:scale-[0.98] transition-all text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-white/70 flex items-center justify-center text-[var(--mg-gold-text)] shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--mg-gold-text)]">Fiado pendiente</p>
                  <p className="text-[11px] text-[var(--mg-text-muted)]">{uniqueClientsCount} {uniqueClientsCount === 1 ? 'cliente' : 'clientes'} te deben</p>
                </div>
                <span className="text-base font-black text-[var(--mg-gold-text)] shrink-0">{formatBs(totalPendingDebts)}</span>
              </button>
            )}
          </div>
          <button
            onClick={() => navigate('/egresos')}
            className="w-full px-4 py-3 bg-[var(--mg-bg-elevated)] text-xs text-[var(--mg-text-faint)] font-semibold border-t border-[var(--mg-border)] active:bg-[var(--mg-bg-elevated)] transition-colors flex items-center justify-center gap-1"
          >
            Ver egresos detallados ›
          </button>
        </div>
      ) : (
        <div className="bg-[var(--mg-bg-surface)] rounded-2xl border border-[var(--mg-border)] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--mg-border)]">
            <p className="font-bold text-[var(--mg-text-secondary)] text-sm">Mis ventas de hoy por método de pago</p>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between bg-[var(--mg-info-bg)] rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <div>
                  <p className="text-sm font-bold text-[var(--mg-text-secondary)]">Efectivo</p>
                  <p className="text-xs text-[var(--mg-text-faint)]">{countCash} {countCash === 1 ? 'venta' : 'ventas'}</p>
                </div>
              </div>
              <p className="text-lg font-black text-[var(--mg-accent)]">{formatBs(totalCash)}</p>
            </div>
            <div className="flex items-center justify-between bg-[var(--mg-info-bg)] rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-sm font-bold text-[var(--mg-text-secondary)]">QR</p>
                  <p className="text-xs text-[var(--mg-text-faint)]">{countQr} {countQr === 1 ? 'venta' : 'ventas'}</p>
                </div>
              </div>
              <p className="text-lg font-black text-[var(--mg-accent)]">{formatBs(totalQr)}</p>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-[var(--mg-border)]">
              <span className="text-sm font-bold text-[var(--mg-text-secondary)]">Total cobrado</span>
              <span className="text-lg font-black text-[var(--mg-text-primary)]">{formatBs(totalHoy)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Reponer pronto — cada item es clickeable */}
      {lowStock.length > 0 && (
        <div className="bg-[var(--mg-warning-bg)] border-2 border-[var(--mg-warning)] rounded-2xl p-4">
          <p className="font-bold text-[var(--mg-warning)] mb-3 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-[var(--mg-warning)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Reponer pronto — toca para editar
          </p>
          <div className="space-y-2">
            {lowStock.slice(0, 5).map((p) => (
              <button
                key={p.id}
                onClick={() => handleLowStockClick(p)}
                className="w-full flex items-center gap-2 bg-[var(--mg-bg-surface)] rounded-xl px-3 py-2.5 active:scale-95 transition-all border border-orange-100"
              >
                {p.imageData
                  ? <img src={p.imageData} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                  : (
                    <div className="w-8 h-8 bg-gray-50 border border-gray-200 text-gray-400 rounded-lg flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  )
                }
                <span className="text-[var(--mg-warning)] text-sm font-semibold flex-1 text-left truncate">{p.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-black text-[var(--mg-warning)] text-sm">{p.stock} und.</span>
                  <span className="text-orange-400 text-lg">›</span>
                </div>
              </button>
            ))}
            {lowStock.length > 5 && (
              <p className="text-orange-400 text-xs text-center mt-1">+{lowStock.length - 5} más</p>
            )}
          </div>
        </div>
      )}

      {/* Sección de Dashboard con Gráficos */}
      {visibleSales.length > 0 && (
        <div className="space-y-6 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Gráfico 1: Productos más vendidos */}
            <div className="bg-[var(--mg-bg-surface)] rounded-2xl border border-[var(--mg-border)] p-5 shadow-sm">
              <h4 className="text-sm font-bold text-[var(--mg-text-secondary)] mb-3">🍩 Productos más vendidos (unidades)</h4>
              <DonutChart data={topProductsChartData} totalLabel="Unidades" isCurrency={false} />
            </div>

            {/* Gráfico 2: Ventas por Categoría */}
            <div className="bg-[var(--mg-bg-surface)] rounded-2xl border border-[var(--mg-border)] p-5 shadow-sm">
              <h4 className="text-sm font-bold text-[var(--mg-text-secondary)] mb-3">🍩 Ventas por Categoría (Bs)</h4>
              <DonutChart data={categorySalesChartData} totalLabel="Total" isCurrency={true} />
            </div>

            {/* Gráfico 3: Tendencia por Media Hora — más ancho para apreciar mejor los datos */}
            <div className="lg:col-span-2 bg-[var(--mg-bg-surface)] rounded-2xl border border-[var(--mg-border)] p-5 shadow-sm flex flex-col justify-between">
              <h4 className="text-sm font-bold text-[var(--mg-text-secondary)] mb-3">📈 Ventas por Media Hora (Bs)</h4>
              <LineChart data={hourlyTrendData} labelEvery={4} />
            </div>
          </div>

          {/* Tabla de Franja Horaria (cada 30 min) */}
          <div className="bg-[var(--mg-bg-surface)] rounded-2xl border border-[var(--mg-border)] p-5 shadow-sm">
            <h4 className="text-sm font-bold text-[var(--mg-text-secondary)] mb-3">⏰ Ventas por Franja Horaria (cada 30 min)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--mg-border)] text-[var(--mg-text-muted)] font-bold uppercase text-[10px]">
                    <th className="py-2.5">Franja Horaria</th>
                    <th className="py-2.5 text-center">Cantidad de Ventas</th>
                    <th className="py-2.5 text-right">Monto Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--mg-separator)] font-semibold text-[var(--mg-text-secondary)]">
                  {hourlyBands.map((band, i) => (
                    <tr key={i} className="hover:bg-[var(--mg-bg-elevated)] transition-colors">
                      <td className="py-3 font-mono">{band.label}</td>
                      <td className="py-3 text-center">{band.count} {band.count === 1 ? 'venta' : 'ventas'}</td>
                      <td className="py-3 text-right font-black text-[var(--mg-accent)]">{formatBs(band.total)}</td>
                    </tr>
                  ))}
                  {hourlyBands.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-[var(--mg-text-faint)]">No hay ventas registradas</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Ventas del día */}
      {visibleSales.length > 0 ? (
        <div className="bg-[var(--mg-bg-surface)] rounded-2xl border border-[var(--mg-border)] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--mg-border)] flex items-center justify-between">
            <h3 className="font-bold text-[var(--mg-text-secondary)]">{isOwner ? 'Ventas de hoy' : 'Mis ventas de hoy'}</h3>
            <span className="text-xs bg-[var(--mg-accent)] text-white font-bold px-2 py-1 rounded-full">
              {filteredSales.length} de {visibleSales.length} ventas
            </span>
          </div>

          {/* Filtros de Venta */}
          <div className="bg-[var(--mg-bg-elevated)] p-4 border-b border-[var(--mg-border)] grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--mg-text-muted)] block mb-1">Método de Pago</label>
              <select
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className="w-full bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--mg-text-primary)] focus:outline-none focus:border-[var(--mg-accent-border)]"
              >
                <option value="Todos">Todos los métodos</option>
                <option value="cash">💵 Efectivo</option>
                <option value="qr">📲 QR</option>
                <option value="mixto">🔀 Mixto</option>
                <option value="fiado">⏳ Fiado (CxC)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--mg-text-muted)] block mb-1">Categoría de Producto</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--mg-text-primary)] focus:outline-none focus:border-[var(--mg-accent-border)]"
              >
                {categoriesList.map(cat => (
                  <option key={cat} value={cat}>{cat === 'Todas' ? 'Todas las categorías' : cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* VISTA DE ESCRITORIO (TABLA) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--mg-bg-elevated)] border-b border-[var(--mg-border)] text-[var(--mg-text-muted)] text-xs uppercase font-bold">
                  <th className="px-4 py-3">Hora</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Productos</th>
                  <th className="px-4 py-3">Pago</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--mg-separator)] text-sm">
                {filteredSales.map((sale) => {
                  const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date();
                  const itemsList = salesItemsMap[sale.id];
                  return (
                    <tr key={sale.id} className="hover:bg-[var(--mg-bg-elevated)] transition-colors">
                      <td className="px-4 py-3 font-medium text-[var(--mg-text-primary)]">
                        {date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-[var(--mg-text-primary)]">{sale.clientName || 'S/N'}</p>
                        {sale.clientNit && sale.clientNit !== '0' && (
                          <p className="text-[10px] text-[var(--mg-text-faint)]">NIT: {sale.clientNit}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--mg-text-secondary)] max-w-xs truncate" title={
                        itemsList ? itemsList.map(item => `${item.productName} (x${item.quantity})`).join(', ') : ''
                      }>
                        {itemsList ? (
                          itemsList.map(item => `${item.productName} (x${item.quantity})`).join(', ')
                        ) : (
                          <span className="text-[var(--mg-text-faint)]">Cargando...</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {getPaymentMethodLabel(sale.paymentMethod)}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-[var(--mg-accent)]">
                        {formatBs(sale.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => setSelectedSale(sale)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                          >
                            Ver Detalle
                          </button>
                          <button
                            onClick={() => handleReimprint(sale)}
                            disabled={printingSaleId === sale.id}
                            className="bg-[var(--mg-accent-bg)] hover:bg-[var(--mg-accent-border)] text-[var(--mg-accent)] px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50"
                          >
                            🖨️ {printingSaleId === sale.id ? '...' : 'Reimprimir'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-[var(--mg-text-muted)] font-medium text-base bg-gray-50/30">
                      No se encontraron ventas para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* VISTA MOBILE (TARJETAS COMPACTAS) */}
          <div className="md:hidden divide-y divide-[var(--mg-separator)]">
            {filteredSales.map((sale) => {
              const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date();
              const itemsList = salesItemsMap[sale.id];
              return (
                <div key={sale.id} className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-[var(--mg-text-faint)]">
                        {date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="font-bold text-sm text-[var(--mg-text-primary)] mt-0.5">
                        {sale.clientName || 'S/N'}
                      </p>
                      {sale.clientNit && sale.clientNit !== '0' && (
                        <p className="text-[10px] text-[var(--mg-text-faint)]">NIT: {sale.clientNit}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-black text-sm text-[var(--mg-accent)]">{formatBs(sale.total)}</p>
                      <p className="text-[10px] text-[var(--mg-text-faint)] mt-0.5">
                        {getPaymentMethodLabel(sale.paymentMethod)}
                      </p>
                    </div>
                  </div>

                  {/* Productos */}
                  <div className="text-xs bg-[var(--mg-bg-elevated)] p-2 rounded-xl text-[var(--mg-text-secondary)]">
                    {itemsList ? (
                      <p className="line-clamp-2">
                        {itemsList.map(item => `${item.productName} (x${item.quantity})`).join(', ')}
                      </p>
                    ) : (
                      <p className="text-[var(--mg-text-faint)]">Cargando productos...</p>
                    )}
                  </div>

                  {/* Botones de acción */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setSelectedSale(sale)}
                      className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all text-center"
                    >
                      Ver Detalle
                    </button>
                    <button
                      onClick={() => handleReimprint(sale)}
                      disabled={printingSaleId === sale.id}
                      className="flex-1 bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] py-2 rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      🖨️ {printingSaleId === sale.id ? 'Reimprimiendo...' : 'Reimprimir'}
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredSales.length === 0 && (
              <div className="p-8 text-center text-[var(--mg-text-muted)] text-sm font-semibold">
                No se encontraron ventas para los filtros seleccionados.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-10 bg-[var(--mg-bg-surface)] rounded-2xl border border-[var(--mg-border)]">
          <p className="text-5xl mb-3">📊</p>
          <p className="font-semibold text-[var(--mg-text-muted)]">Sin ventas hoy</p>
          <p className="text-sm text-[var(--mg-text-faint)] mt-1">Ve a Ventas para registrar</p>
        </div>
      )}

      {/* Exportar — solo dueños */}
      <div className="space-y-2 pb-2">
        {isOwner && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold py-3.5 rounded-2xl text-sm active:scale-95 transition-all disabled:opacity-50 shadow-md"
          >
            {exporting ? 'Exportando...' : '📥 Exportar ventas detalladas (CSV)'}
          </button>
        )}
        <button onClick={signOut} className="w-full text-gray-300 text-sm py-2">
          Cerrar sesión
        </button>
      </div>

      {selectedSale && (
        <SaleDetailModal
          sale={selectedSale}
          businessId={businessId}
          onClose={() => setSelectedSale(null)}
        />
      )}

      {showQr && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setShowQr(false)}
        >
          <div 
            className="bg-[var(--mg-bg-surface)] rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl relative cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botón cerrar */}
            <button 
              onClick={() => setShowQr(false)}
              className="absolute top-4 right-4 text-2xl text-[var(--mg-text-muted)] font-bold cursor-pointer hover:text-[var(--mg-text-primary)] transition-colors"
            >
              ×
            </button>
            
            <h3 className="text-lg font-black text-[var(--mg-text-primary)] mb-4">📲 QR de Cobro</h3>

            {settings?.qrData ? (
              <div className="space-y-4">
                <img 
                  src={settings.qrData} 
                  alt="QR de Cobro" 
                  className="w-64 h-64 object-contain mx-auto border-2 border-[var(--mg-border)] rounded-2xl p-2 bg-white" 
                />
                <p className="text-xs text-[var(--mg-text-muted)] leading-relaxed px-2">
                  Cualquier cliente puede escanear este código para realizar un pago.
                </p>
              </div>
            ) : (
              <div className="py-6 space-y-4">
                <span className="text-5xl block">⚠️</span>
                <p className="text-sm font-semibold text-[var(--mg-text-secondary)] px-4">
                  Aún no subiste tu QR de cobro. Ve a Ajustes para agregarlo.
                </p>
                <button
                  onClick={() => {
                    setShowQr(false);
                    navigate('/configuracion');
                  }}
                  className="bg-[#1670C2] hover:bg-[#0f5c9e] text-white font-bold py-2.5 px-6 rounded-xl text-xs active:scale-95 transition-all shadow-md"
                >
                  Ir a Ajustes
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
