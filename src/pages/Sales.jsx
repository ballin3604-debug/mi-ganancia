import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { getProducts, subscribeToProducts } from '../services/products';
import ProductCatalogCard, { StockLabel } from '../components/ProductCatalogCard';
import { registerSale, subscribeToSales, subscribeToSaleItems } from '../services/sales';
import { getCustomers, addCustomer } from '../services/customers';
import { subscribeToCategories } from '../services/categories';
import { printReceipt } from '../components/Receipt';
import { addDebt } from '../services/debts';
import DataTable from '../components/DataTable';
import ReportHeader from '../components/ReportHeader';
import { toLocalISODate } from '../utils/dateRanges';
import { exportReportToPDF } from '../utils/pdfExport';
import { getCartDraft, saveCartDraft, clearCartDraft } from '../services/cartDraft';
import { clampNumberInput, blockInvalidNumberKeys } from '../utils/numberInput';
import { getBranchStocks, toStockMap } from '../services/branchStock';
import { useBranchStocks } from '../hooks/useBranchStocks';
import BarcodeScanner from '../components/BarcodeScanner';
import PresentationPicker from '../components/PresentationPicker';
import { UpgradeModal } from '../components/UpgradeScreen';
import { usePlan } from '../hooks/usePlan';
import { useBranches } from '../context/BranchContext';
import { getSellOptions, defaultSellOption, presShortLabel } from '../utils/presentations';
import { AppIcon } from '../components/icons';

function formatBs(amount) {
  return `Bs ${Number(amount || 0).toFixed(2)}`;
}

function ProductImage({ imageData, name, className }) {
  if (!imageData) {
    return (
      <div className={`${className} flex items-center justify-center text-3xl bg-white/20`}>
        📦
      </div>
    );
  }
  return <img src={imageData} alt={name} className={`${className} object-cover`} />;
}

function CartItemRow({ line, product, onUpdate, stacked = false, siblingBaseUsed = 0 }) {
  const quantity = line.quantity ?? 0;
  const unitPrice = line.unitPrice;
  const factor = line.factor || 1;
  // Tope real: lo que queda del stock descontando las OTRAS líneas del mismo producto
  const maxQty = Math.max(0, Math.floor(((product.stock || 0) - siblingBaseUsed) / factor));
  const [val, setVal] = useState(quantity);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setVal(quantity);
  }, [quantity, line.key]);

  useEffect(() => {
    if (!errorMsg) return;
    const timer = setTimeout(() => {
      setErrorMsg('');
    }, 3000);
    return () => clearTimeout(timer);
  }, [errorMsg]);

  const handleApply = (inputVal) => {
    let num = parseInt(inputVal, 10);
    
    if (isNaN(num) || num <= 0) {
      onUpdate(0);
      return;
    }

    num = Math.floor(num);

    if (num > maxQty) {
      setErrorMsg(maxQty <= 0 ? 'Sin stock disponible' : `Solo hay ${maxQty} disponibles`);
      num = maxQty;
    }

    setVal(num);
    onUpdate(num);
  };

  const handleChange = (e) => {
    setVal(e.target.value);
  };

  const handleKeyDown = (e) => {
    // Block keys that are not digits or control/editing keys
    // Specifically block '.', ',', 'e', 'E', '-', '+' which are allowed by default in type="number"
    if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E' || e.key === '-' || e.key === '+') {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      handleApply(e.target.value);
      e.target.blur();
    }
  };

  const stepper = (
    <>
      <button
        type="button"
        onClick={() => handleApply(quantity - 1)}
        aria-label="Quitar uno"
        className="w-8 h-8 rounded-full bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] text-[var(--mg-text-primary)] font-black text-base flex items-center justify-center active:scale-90 shrink-0"
      >
        −
      </button>
          <input
            type="number"
            min="1"
            max={maxQty}
            value={val}
        onChange={handleChange}
        onBlur={(e) => handleApply(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Cantidad"
        className="w-12 text-center font-bold text-sm bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-xl py-1 px-1 focus:outline-none focus:border-[var(--mg-accent-border)] text-[var(--mg-text-primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
          <button
            type="button"
            onClick={() => handleApply(quantity + 1)}
            disabled={quantity >= maxQty}
            aria-label="Agregar uno"
        className="w-8 h-8 rounded-full bg-[var(--mg-accent)] text-white font-black text-base flex items-center justify-center active:scale-90 disabled:opacity-40 shrink-0"
      >
        +
      </button>
    </>
  );

  const trashBtn = (
    <button
      type="button"
      onClick={() => onUpdate(0)}
      className="text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors p-1.5 rounded-xl shrink-0"
      title="Eliminar producto"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );

  // PC (barra angosta de 380px): nombre completo arriba y controles abajo.
  if (stacked) {
    return (
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <ProductImage
            imageData={product.imageData}
            name={product.name}
            className="w-10 h-10 rounded-xl shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[var(--mg-text-primary)] font-semibold leading-snug line-clamp-2">{product.name}</p>
            <p className="text-xs text-[var(--mg-text-faint)] mt-0.5">
              {factor > 1 ? `📦 ${line.presLabel} · ` : ''}{formatBs(unitPrice)} c/u
            </p>
          </div>
          {trashBtn}
        </div>
        <div className="flex items-center justify-between mt-2 pl-[52px]">
          <div className="flex items-center gap-1.5">
            {stepper}
          </div>
          <span className="text-[var(--mg-text-primary)] font-bold text-sm">
            {formatBs(unitPrice * quantity)}
          </span>
        </div>
        {errorMsg && (
          <span className="text-red-500 text-[10px] font-bold mt-1 animate-pulse block pl-[52px]">
            {errorMsg}
          </span>
        )}
      </div>
    );
  }

  // Celular (drawer ancho): todo en una fila como siempre.
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <ProductImage
        imageData={product.imageData}
        name={product.name}
        className="w-10 h-10 rounded-xl shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--mg-text-primary)] font-semibold truncate leading-tight">{product.name}</p>
        <p className="text-xs text-[var(--mg-text-faint)] mt-0.5">
          {factor > 1 ? `📦 ${line.presLabel} · ` : ''}{formatBs(unitPrice)} c/u
        </p>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <div className="flex items-center gap-1.5">
          {stepper}
          <span className="text-[var(--mg-text-primary)] font-bold text-sm w-20 text-right">
            {formatBs(unitPrice * quantity)}
          </span>
          {trashBtn}
        </div>
        {errorMsg && (
          <span className="text-red-500 text-[10px] font-bold mt-1 animate-pulse">
            {errorMsg}
          </span>
        )}
      </div>
    </div>
  );
}

const CUSTOM_CLIENT_VALUE = '__custom__';
const RECENT_CATEGORY = '🕐 Recientes';

export default function Sales() {
  const { businessId, user, sellerName } = useAuth();
  const { business, settings } = useBusiness();
  const { branches, activeBranchId } = useBranches();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'reporte' ? 'reporte'
    : searchParams.get('tab') === 'cajeros' ? 'cajeros' : 'venta';
  const [salesList, setSalesList] = useState([]);
  const [saleItemsList, setSaleItemsList] = useState([]);
  // Si se llega acá desde otro reporte (p.ej. "Total Vendido" en Ganancias
  // Diarias) con ?start=&end=, se respeta ese rango en vez del default de
  // mes-a-la-fecha — así el usuario no tiene que volver a fijarse si las
  // fechas coinciden con el reporte del que vino.
  const [reportStartDate, setReportStartDate] = useState(() => {
    const fromUrl = searchParams.get('start');
    if (fromUrl) return fromUrl;
    return toLocalISODate(new Date());
  });
  const [reportEndDate, setReportEndDate] = useState(() => searchParams.get('end') || toLocalISODate(new Date()));
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [typedClientName, setTypedClientName] = useState('');
  const [isCustomClient, setIsCustomClient] = useState(false);
  const [cashReceived, setCashReceived] = useState('');
  const [mixedCash, setMixedCash] = useState('');
  const [mixedQr, setMixedQr] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [showCartModal, setShowCartModal] = useState(false);
  const [showQrConfirmModal, setShowQrConfirmModal] = useState(false);
  const [cartOpen, setCartOpen] = useState(true);
  const [categories, setCategories] = useState([]);
  const [filterCategory, setFilterCategory] = useState('Todas');
  // ── Escáner de códigos de barras ──
  const [showScanner, setShowScanner] = useState(false);
  const [scanMsg, setScanMsg] = useState(null); // { ok, text }
  const [recentScans, setRecentScans] = useState([]); // [{ id, at }]
  // ── Picker de presentación (unidad / paquete frío-caliente) ──
  const [pickerProduct, setPickerProduct] = useState(null);
  // ── Paywall escáner (Pro) ──
  const { can } = usePlan();
  const [showUpgrade, setShowUpgrade] = useState(false);

  function openScanner() {
    if (can('scanner')) {
      setScanMsg(null);
      setShowScanner(true);
    } else {
      setShowUpgrade(true);
    }
  }

  const hasRestoredRef = useRef(false);
  const draftStateRef = useRef(null);
  draftStateRef.current = {
    cart, paymentMethod, selectedCustomer, typedClientName, isCustomClient,
    cashReceived, mixedCash, mixedQr, clientPhone, dueDate,
  };

  function buildDraftPayload(s) {
    return {
      cart: s.cart,
      paymentMethod: s.paymentMethod,
      selectedCustomerId: s.selectedCustomer?.id || null,
      typedClientName: s.typedClientName,
      isCustomClient: s.isCustomClient,
      cashReceived: s.cashReceived,
      mixedCash: s.mixedCash,
      mixedQr: s.mixedQr,
      clientPhone: s.clientPhone,
      dueDate: s.dueDate,
    };
  }

  useEffect(() => {
    if (!showQrConfirmModal) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowQrConfirmModal(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showQrConfirmModal]);

  useEffect(() => {
    if (!businessId || !user?.uid) return;
    setLoading(true);
    Promise.all([
      getProducts(businessId),
      getCustomers(businessId),
    ])
      .then(async ([prods, clis]) => {
        setProducts(prods);
        setCustomers(clis);

        const draft = await getCartDraft(businessId, user.uid);
        if (!draft) return;

        // Restauración silenciosa: el carrito vuelve intacto sin mostrar avisos.
        // Valida stock en unidades base de la SEDE operativa (paquetes × factor)
        // y convierte borradores viejos { productId: cantidad } a línea de unidad.
        const bRows = await getBranchStocks(businessId).catch(() => []);
        const bMap = toStockMap(bRows);
        const hasB = bRows.length > 0;
        const restoredCart = {};
        const usedBase = {};
        const pushLine = (key, prod, presId, variant, qty, unitPrice, factor, presLabel) => {
          const already = usedBase[prod.id] || 0;
          const q = Math.max(0, Math.min(qty, Math.floor(((hasB && activeBranchId ? Number(bMap.get(`${activeBranchId}:${prod.id}`) ?? 0) : prod.stock) - already) / factor)));
          if (q <= 0) return;
          usedBase[prod.id] = already + q * factor;
          restoredCart[key] = { productId: prod.id, presId, variant, qty: q, unitPrice, factor, presLabel };
        };
        Object.entries(draft.cart || {}).forEach(([key, line]) => {
          if (typeof line === 'number') {
            const prod = prods.find((p) => p.id === key);
            if (!prod || prod.stock <= 0) return;
            const opt = defaultSellOption(prod);
            if (!opt) return;
            pushLine(opt.key, prod, opt.presId, opt.variant, line, opt.price, opt.factor, presShortLabel(prod, opt.presId, opt.variant));
            return;
          }
          if (!line || typeof line.qty !== 'number') return;
          const prod = prods.find((p) => p.id === line.productId);
          if (!prod || prod.stock <= 0) return;
          const factor = Number(line.factor || 1);
          // Precio vigente del inventario (no el guardado en el borrador):
          // si el precio cambió mientras el borrador esperaba, el carrito nace actualizado.
          const freshOpts = getSellOptions(prod);
          const freshMatch = freshOpts.find((o) => o.presId === (line.presId || 'unit') && o.variant === (line.variant || 'unico')) || freshOpts[0];
          const freshPrice = freshMatch ? freshMatch.price : prod.price;
          pushLine(key, prod, line.presId || 'unit', line.variant || 'unico', line.qty, freshPrice, factor, line.presLabel || presShortLabel(prod, line.presId, line.variant));
        });

        setCart(restoredCart);
        setPaymentMethod(draft.paymentMethod || 'cash');
        setTypedClientName(draft.typedClientName || '');
        setIsCustomClient(!!draft.isCustomClient);
        if (draft.selectedCustomerId) {
          setSelectedCustomer(clis.find((c) => c.id === draft.selectedCustomerId) || null);
        }
        setCashReceived(draft.cashReceived || '');
        setMixedCash(draft.mixedCash || '');
        setMixedQr(draft.mixedQr || '');
        setClientPhone(draft.clientPhone || '');
        setDueDate(draft.dueDate || '');
      })
      .catch((err) => console.error(err))
      .finally(() => {
        setLoading(false);
        hasRestoredRef.current = true;
      });
  }, [businessId, user?.uid]);

  useEffect(() => {
    if (!businessId || !user?.uid || !hasRestoredRef.current) return;
    const timer = setTimeout(() => {
      saveCartDraft(businessId, user.uid, buildDraftPayload(draftStateRef.current));
    }, 500);
    return () => clearTimeout(timer);
  }, [businessId, user?.uid, cart, paymentMethod, selectedCustomer, typedClientName, isCustomClient, cashReceived, mixedCash, mixedQr, clientPhone, dueDate]);

  useEffect(() => {
    if (!businessId || !user?.uid) return;
    function flush() {
      if (!hasRestoredRef.current || !draftStateRef.current) return;
      saveCartDraft(businessId, user.uid, buildDraftPayload(draftStateRef.current));
    }
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') flush();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flush);
    };
  }, [businessId, user?.uid]);

  useEffect(() => {
    if (!businessId) return;
    const unsub = subscribeToSales(businessId, setSalesList);
    return unsub;
  }, [businessId]);

  // Precios vivos: si el inventario cambia (editar precio, presentación o
  // eliminar producto) mientras hay una venta armándose, el carrito refleja
  // el precio vigente sin tener que quitar y volver a agregar el producto.
  useEffect(() => {
    if (!businessId) return;
    const unsub = subscribeToProducts(businessId, (prods) => {
      setProducts(prods);
      setCart((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.entries(next).forEach(([key, line]) => {
          if (!line || typeof line.qty !== 'number') return;
          const prod = prods.find((p) => p.id === line.productId);
          if (!prod) return;
          const opts = getSellOptions(prod);
          const match = opts.find((o) => o.presId === (line.presId || 'unit') && o.variant === (line.variant || 'unico')) || opts[0];
          if (!match) return;
          if (Number(line.unitPrice) !== Number(match.price)) {
            next[key] = { ...line, unitPrice: match.price };
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    });
    return unsub;
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    const unsub = subscribeToCategories(businessId, setCategories);
    return unsub;
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    const unsub = subscribeToSaleItems(businessId, setSaleItemsList);
    return unsub;
  }, [businessId]);

  // Memoizado: salesList/saleItemsList pueden tener miles de registros
  // históricos, y sin memoizar este bloque se re-ordenaba/re-agrupaba
  // completo en cada render (incluido cada tecla escrita en el buscador
  // o cada cambio de cantidad en el carrito, que no tienen nada que ver).
  const reportStart = useMemo(() => new Date(`${reportStartDate}T00:00:00`), [reportStartDate]);
  const reportEnd = useMemo(() => new Date(`${reportEndDate}T23:59:59.999`), [reportEndDate]);

  const filteredSalesReport = useMemo(() => salesList
    .filter((s) => {
      const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      return d >= reportStart && d <= reportEnd;
    })
    .sort((a, b) => {
      const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return db - da;
    }), [salesList, reportStart, reportEnd]);

  // N° Venta: número correlativo estable, asignado por orden cronológico
  // de TODO el historial del negocio (no cambia si se mueve el filtro de fechas).
  const saleNumberById = useMemo(() => {
    const map = {};
    salesList
      .slice()
      .sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return da - db;
      })
      .forEach((s, i) => { map[s.id] = i + 1; });
    return map;
  }, [salesList]);

  const itemsBySaleId = useMemo(() => {
    const map = {};
    saleItemsList.forEach((item) => {
      if (!map[item.saleId]) map[item.saleId] = [];
      map[item.saleId].push(item);
    });
    return map;
  }, [saleItemsList]);

  // ── Filtro por sucursal (reportes) ───────────────────────────────
  // Ventas viejas sin sede se cuentan en la principal.
  const [reportBranch, setReportBranch] = useState('all');
  const mainBranchId = branches.find((b) => b.isMain)?.id || branches[0]?.id || null;
  const saleBranchId = (s) => s.branchId || s.branch_id || mainBranchId;
  const scopedSalesReport = useMemo(() => (
    reportBranch === 'all'
      ? filteredSalesReport
      : filteredSalesReport.filter((s) => saleBranchId(s) === reportBranch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [filteredSalesReport, reportBranch, mainBranchId]);

  const salesReportRows = useMemo(() => scopedSalesReport.flatMap((s) =>
    (itemsBySaleId[s.id] || []).map((item) => {
      const unitCost = Number(item.supplier_price || 0);
      const factor = Number(item.presentation_factor ?? item.presentationFactor ?? 1);
      const baseQty = Number(item.quantity || 0) * factor;
      const ganancia = Number(item.subtotal || 0) - unitCost * baseQty;
      const presLabel = item.presentation || '';
      return {
        rowKey: item.id,
        createdAt: s.createdAt,
        saleNumber: saleNumberById[s.id],
        productName: presLabel ? `${item.productName} · ${presLabel}` : item.productName,
        category: item.category || 'Otros',
        quantity: item.quantity,
        quantityLabel: factor > 1 ? `${item.quantity} (${presLabel} x${factor})` : String(item.quantity ?? ''),
        baseQty,
        supplierPrice: unitCost,
        price: Number(item.price || 0),
        subtotal: Number(item.subtotal || 0),
        ganancia,
        paymentMethod: s.paymentMethod,
        sellerName: s.seller_name,
      };
    })
  ), [scopedSalesReport, itemsBySaleId, saleNumberById]);

  // ── Reporte por cajero ─────────────────────────────────────────────
  const [reportCashier, setReportCashier] = useState('Todos');

  function renderBranchPills() {
    if (branches.length <= 1) return null;
    return (
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          key="all" type="button" onClick={() => setReportBranch('all')}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${reportBranch === 'all' ? 'bg-[var(--mg-accent)] text-white shadow-sm' : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'}`}
        >
          🏬 Todas
        </button>
        {branches.map((b) => (
          <button
            key={b.id} type="button" onClick={() => setReportBranch(b.id)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${reportBranch === b.id ? 'bg-[var(--mg-accent)] text-white shadow-sm' : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'}`}
          >
            {b.type === 'almacen' ? '📦' : '🏪'} {b.name}
          </button>
        ))}
      </div>
    );
  }

  const sellersInRange = useMemo(() => {
    const set = new Set();
    scopedSalesReport.forEach((s) => set.add(s.seller_name || 'Sin nombre'));
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [scopedSalesReport]);

  // Totales por cajero calculados a nivel VENTA (no por ítem, para no duplicar).
  // "En caja" = efectivo + QR + mixto (plata que entró). Fiado va aparte.
  const cashierStats = useMemo(() => {
    const map = {};
    filteredSalesReport.forEach((s) => {
      const name = s.seller_name || 'Sin nombre';
      if (!map[name]) {
        map[name] = { name, ventas: 0, cash: 0, qr: 0, mixto: 0, fiado: 0, ganancia: 0 };
      }
      const st = map[name];
      const total = Number(s.total || 0);
      st.ventas += 1;
      if (s.paymentMethod === 'cash') st.cash += total;
      else if (s.paymentMethod === 'qr') st.qr += total;
      else if (s.paymentMethod === 'mixto') st.mixto += total;
      else if (s.paymentMethod === 'fiado') st.fiado += total;
      else st.cash += total;
    });
    salesReportRows.forEach((r) => {
      const name = r.sellerName || 'Sin nombre';
      if (map[name]) map[name].ganancia += Number(r.ganancia || 0);
    });
    return Object.values(map)
      .map((st) => ({ ...st, enCaja: st.cash + st.qr + st.mixto, total: st.cash + st.qr + st.mixto + st.fiado }))
      .sort((a, b) => b.enCaja - a.enCaja);
  }, [scopedSalesReport, salesReportRows]);

  const cashierRows = useMemo(() => (
    reportCashier === 'Todos'
      ? salesReportRows
      : salesReportRows.filter((r) => (r.sellerName || 'Sin nombre') === reportCashier)
  ), [salesReportRows, reportCashier]);

  const METHOD_META = {
    cash: { label: 'Efectivo', icon: 'cash', pill: 'bg-green-50 text-green-700 border-green-200' },
    qr: { label: 'QR', icon: 'qr', pill: 'bg-blue-50 text-blue-700 border-blue-200' },
    mixto: { label: 'Mixto', icon: 'mixto', pill: 'bg-purple-50 text-purple-700 border-purple-200' },
    fiado: { label: 'Fiado', icon: 'fiado', pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  };
  function methodBadge(method) {
    const m = METHOD_META[method] || METHOD_META.cash;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full border ${m.pill}`}>
        <AppIcon name={m.icon} size={12} /> {m.label}
      </span>
    );
  }

  // Tabla de detalle compartida por "Reporte de Ventas" y "Por Cajero"
  const detailColumns = [
    {
      key: 'fecha', label: 'Fecha', align: 'center', width: 'w-28',
      render: (r) => {
        const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
        return <span className="font-mono text-xs whitespace-nowrap">{d.toLocaleDateString('es-BO')}</span>;
      },
    },
    {
      key: 'numeroVenta', label: 'N° Venta', align: 'center', width: 'w-24',
      render: (r) => <span className="font-mono text-xs font-bold whitespace-nowrap">{`#${String(r.saleNumber).padStart(4, '0')}`}</span>,
    },
    {
      key: 'producto', label: 'Producto', align: 'left',
      render: (r) => <span className="block max-w-[190px] font-semibold leading-snug">{r.productName}</span>,
    },
    {
      key: 'categoria', label: 'Categoría', align: 'left', width: 'w-32',
      render: (r) => <span className="whitespace-nowrap">{r.category}</span>,
    },
    {
      key: 'cantidad', label: 'Cantidad', align: 'center', width: 'w-20',
      render: (r) => <span className="tabular-nums" title={`${r.baseQty ?? r.quantity} und. base`}>{r.quantityLabel ?? r.quantity}</span>,
    },
    {
      key: 'pCompra', label: 'P. Compra', align: 'right', width: 'w-28',
      render: (r) => <span className="tabular-nums whitespace-nowrap">{formatBs(r.supplierPrice)}</span>,
    },
    {
      key: 'pVenta', label: 'P. Venta', align: 'right', width: 'w-28',
      render: (r) => <span className="tabular-nums whitespace-nowrap">{formatBs(r.price)}</span>,
    },
    {
      key: 'metodoPago', label: 'Método de pago', align: 'center', width: 'w-36',
      render: (r) => methodBadge(r.paymentMethod),
    },
    {
      key: 'vendedor', label: 'Vendedor', align: 'left', width: 'w-32',
      render: (r) => r.sellerName || <span className="text-gray-300">—</span>,
    },
    {
      key: 'totalVenta', label: 'Total Venta', align: 'right', width: 'w-32',
      render: (r) => <span className="font-black text-[#1670C2] tabular-nums whitespace-nowrap">{formatBs(r.subtotal)}</span>,
    },
    {
      key: 'ganancia', label: 'Ganancia', align: 'right', width: 'w-28',
      render: (r) => <span className="font-bold text-green-600 tabular-nums whitespace-nowrap">{formatBs(r.ganancia)}</span>,
    },
  ];

  function renderDetailTable(rows, emptyMessage, footerLabel) {
    return (
      <DataTable
        storageKey="mg-reporte-ventas-items-columns"
        getRowKey={(r) => r.rowKey}
        emptyMessage={emptyMessage}
        rows={rows}
        footer={[
          { key: 'cantidad', label: footerLabel, value: rows.reduce((sum, r) => sum + Number(r.baseQty ?? r.quantity ?? 0), 0) },
          { key: 'totalVenta', value: formatBs(rows.reduce((sum, r) => sum + Number(r.subtotal || 0), 0)) },
          { key: 'ganancia', value: formatBs(rows.reduce((sum, r) => sum + Number(r.ganancia || 0), 0)) },
        ]}
        columns={detailColumns}
      />
    );
  }

  function handleExportSales() {
    const labels = { cash: 'Efectivo', qr: 'QR', mixto: 'Mixto', fiado: 'Fiado' };
    const columns = [
      { label: 'Fecha' },
      { label: 'N° Venta' },
      { label: 'Producto' },
      { label: 'Categoría' },
      { label: 'Cantidad', align: 'right' },
      { label: 'P. Compra', align: 'right' },
      { label: 'P. Venta', align: 'right' },
      { label: 'Método de pago', align: 'center' },
      { label: 'Vendedor' },
      { label: 'Total Venta', align: 'right' },
      { label: 'Ganancia', align: 'right' },
    ];
    const rows = cashierRows.map((r) => {
      const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
      return [
        d.toLocaleDateString('es-BO'),
        `#${String(r.saleNumber).padStart(4, '0')}`,
        r.productName,
        r.category,
        r.quantityLabel ?? r.quantity,
        formatBs(r.supplierPrice),
        formatBs(r.price),
        labels[r.paymentMethod] || r.paymentMethod,
        r.sellerName || '',
        formatBs(r.subtotal),
        formatBs(r.ganancia),
      ];
    });
    const formattedStart = reportStart.toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' });
    const formattedEnd = reportEnd.toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' });
    exportReportToPDF({
      businessName: settings?.businessName,
      title: reportCashier === 'Todos' ? 'Reporte de Ventas' : `Ventas de ${reportCashier}`,
      subtitle: 'Historial detallado de ventas por producto.',
      periodLabel: `Periodo: ${formattedStart} hasta ${formattedEnd}`,
      columns,
      rows,
      totals: {
        label: 'Total del período',
        values: {
          4: cashierRows.reduce((sum, r) => sum + Number(r.baseQty ?? r.quantity ?? 0), 0),
          9: formatBs(cashierRows.reduce((sum, r) => sum + Number(r.subtotal || 0), 0)),
          10: formatBs(cashierRows.reduce((sum, r) => sum + Number(r.ganancia || 0), 0)),
        },
      },
    });
  }

  // Fase 2: stock por sede operativa (con backfill local una vez)
  const stockRows = useBranchStocks(businessId, mainBranchId);
  const stockMap = useMemo(() => toStockMap(stockRows), [stockRows]);
  const hasBranchRows = stockRows.length > 0;
  const productsWithStock = useMemo(() => (
    activeBranchId && hasBranchRows
      ? products.map((p) => ({ ...p, stock: Number(stockMap.get(`${activeBranchId}:${p.id}`) ?? 0) }))
      : products
  ), [products, stockMap, activeBranchId, hasBranchRows]);

  const availableProducts = useMemo(() => {
    return productsWithStock.filter((p) => p.stock > 0);
  }, [productsWithStock]);

  // Productos vendidos recientemente (últimos 20, más reciente primero) —
  // para encontrar rápido lo que más se repite sin buscar por categoría.
  const recentProductIds = useMemo(() => {
    const saleDateById = {};
    salesList.forEach((s) => {
      saleDateById[s.id] = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
    });
    const seen = new Set();
    const ordered = [];
    saleItemsList
      .map((item) => ({ productId: item.productId, date: saleDateById[item.saleId] }))
      .filter((x) => x.date)
      .sort((a, b) => b.date - a.date)
      .forEach((x) => {
        if (!seen.has(x.productId)) {
          seen.add(x.productId);
          ordered.push(x.productId);
        }
      });
    return ordered.slice(0, 20);
  }, [salesList, saleItemsList]);

  const filtered = availableProducts
    .filter((p) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q)
      );
    })
    .filter((p) => {
      if (filterCategory === RECENT_CATEGORY) return recentProductIds.includes(p.id);
      return filterCategory === 'Todas' || p.category === filterCategory;
    });
  if (filterCategory === RECENT_CATEGORY) {
    filtered.sort((a, b) => recentProductIds.indexOf(a.id) - recentProductIds.indexOf(b.id));
  }

  // Carrito por LÍNEAS: cada clave es productId|presentación|variante.
  // Ej: "abc|pack|frio" (chipa fría) y "abc|unit|unico" (lata) conviven.
  const cartItems = Object.entries(cart)
    .map(([key, line]) => {
      // Compat con borradores viejos { productId: cantidad }
      if (typeof line === 'number') {
        const product = productsWithStock.find((p) => p.id === key);
        if (!product) return null;
        const opt = defaultSellOption(product);
        if (!opt) return null;
        return {
          key: opt.key, product,
          presId: opt.presId, variant: opt.variant,
          quantity: line, unitPrice: opt.price, factor: opt.factor,
          presLabel: presShortLabel(product, opt.presId, opt.variant),
        };
      }
      if (!line || typeof line.qty !== 'number') return null;
      const product = productsWithStock.find((p) => p.id === line.productId);
      if (!product) return null;
      const factor = Number(line.factor || 1);
      return {
        key, product,
        presId: line.presId || 'unit', variant: line.variant || 'unico',
        quantity: line.qty,
        unitPrice: Number(line.unitPrice ?? product.price),
        factor,
        presLabel: line.presLabel || presShortLabel(product, line.presId, line.variant),
      };
    })
    .filter((item) => item.product);

  const total = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  // Unidades base (paquetes × su factor) para mostrar y validar stock
  const totalBaseUnits = cartItems.reduce((sum, item) => sum + item.quantity * item.factor, 0);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Unidades base ya comprometidas de un producto (todas sus líneas)
  function productUsedBase(productId) {
    return cartItems
      .filter((i) => i.product.id === productId)
      .reduce((sum, i) => sum + i.quantity * i.factor, 0);
  }

  function addToCart(product, option) {
    const opt = option || defaultSellOption(product);
    if (!opt) return;
    setCart((prev) => {
      const rest = { ...prev };
      // 1. Migrar borrador legacy {productId: cantidad} a línea de unidad
      // (capada a stock) para no duplicar ni perder unidades.
      if (typeof rest[product.id] === 'number') {
        const unitOpt = defaultSellOption(product);
        const legacyQty = rest[product.id];
        delete rest[product.id];
        if (unitOpt) {
          const maxU = Math.floor((product.stock || 0) / unitOpt.factor);
          const q = Math.min(legacyQty, Math.max(0, maxU));
          if (q > 0) {
            rest[unitOpt.key] = {
              productId: product.id,
              presId: unitOpt.presId,
              variant: unitOpt.variant,
              qty: q,
              unitPrice: unitOpt.price,
              factor: unitOpt.factor,
              presLabel: presShortLabel(product, unitOpt.presId, unitOpt.variant),
            };
          }
        }
      }
      // 2. Sumar a la línea pedida respetando el stock en unidades base.
      const line = rest[opt.key];
      const current = line && typeof line.qty === 'number' ? line.qty : 0;
      const usedOthers = Object.entries(rest)
        .filter(([k]) => k !== opt.key)
        .reduce((sum, [, l]) => {
          const pid = (l && typeof l === 'object') ? l.productId : null;
          if (pid !== product.id) return sum;
          return sum + (Number(l.qty || 0) * Number(l.factor || 1));
        }, 0);
      const maxForLine = Math.floor(((product.stock || 0) - usedOthers) / opt.factor);
      if (current >= maxForLine) return prev;
      return {
        ...rest,
        [opt.key]: {
          productId: product.id,
          presId: opt.presId,
          variant: opt.variant,
          qty: current + 1,
          unitPrice: opt.price,
          factor: opt.factor,
          presLabel: presShortLabel(product, opt.presId, opt.variant),
        },
      };
    });
  }

  function findByBarcode(code) {
    const c = String(code || '').trim().toLowerCase();
    if (!c) return null;
    return productsWithStock.find((p) => String(p.barcode || '').trim().toLowerCase() === c) || null;
  }

  function handleBarcodeScan(code) {
    const product = findByBarcode(code);
    if (!product) {
      setScanMsg({ ok: false, text: `Código ${code} no registrado. Ve a Inventario para crearlo.` });
      return;
    }
    if (product.stock <= 0) {
      setScanMsg({ ok: false, text: `"${product.name}" sin stock.` });
      return;
    }
    if (productUsedBase(product.id) >= product.stock) {
      setScanMsg({ ok: false, text: `"${product.name}" ya está al máximo del stock (${product.stock}).` });
      return;
    }
    addToCart(product);
    // Agrupar por producto: si ya estaba en la lista, subirlo al frente
    // en vez de crear una fila duplicada.
    setRecentScans((prev) => [{ id: product.id, at: Date.now() }, ...prev.filter((r) => r.id !== product.id)].slice(0, 20));
    setScanMsg({ ok: true, text: `"${product.name}" agregado ✓` });
  }

  function removeFromCart(productId) {
    // Stepper rápido de la tarjeta: opera sobre la línea de UNIDAD
    const product = productsWithStock.find((p) => p.id === productId);
    const opt = product ? defaultSellOption(product) : null;
    const key = opt ? opt.key : productId;
    setCart((prev) => {
      const rest = { ...prev };
      // Migrar legacy igual que en addToCart
      if (typeof rest[productId] === 'number' && opt) {
        const legacyQty = rest[productId];
        delete rest[productId];
        const maxU = Math.floor((product.stock || 0) / opt.factor);
        const q = Math.min(legacyQty, Math.max(0, maxU));
        if (q > 0) {
          rest[key] = {
            productId,
            presId: opt.presId,
            variant: opt.variant,
            qty: q,
            unitPrice: opt.price,
            factor: opt.factor,
            presLabel: presShortLabel(product, opt.presId, opt.variant),
          };
        }
      }
      const line = rest[key];
      const current = line && typeof line.qty === 'number' ? line.qty : 0;
      if (current <= 1) {
        const { [key]: _, ...remaining } = rest;
        return remaining;
      }
      return { ...rest, [key]: { ...line, qty: current - 1 } };
    });
  }

  // Tocar la tarjeta: si hay varias presentaciones abre el picker, si no suma directo
  function handleProductTap(product) {
    const options = getSellOptions(product);
    if (options.length > 1) {
      setPickerProduct(product);
    } else {
      addToCart(product, options[0]);
    }
  }

  function handleClientSelect(value) {
    if (value === CUSTOM_CLIENT_VALUE) {
      setSelectedCustomer(null);
      setIsCustomClient(true);
      setTypedClientName('');
    } else if (value === '') {
      setSelectedCustomer(null);
      setIsCustomClient(false);
      setTypedClientName('');
    } else {
      const c = customers.find((cust) => cust.id === value);
      setSelectedCustomer(c || null);
      setIsCustomClient(false);
      setTypedClientName(c?.name || '');
    }
  }

  async function handleRegister(isQrConfirmed = false) {
    if (cartItems.length === 0) return;

    const finalClientName = (selectedCustomer?.name || typedClientName).trim() || 'S/N';
    const finalClientNit = selectedCustomer?.nit || '0';

    setRegistering(true);
    try {
      if (isCustomClient && finalClientName !== 'S/N' &&
        !customers.some((c) => c.name.toLowerCase() === finalClientName.toLowerCase())) {
        await addCustomer(businessId, { name: finalClientName });
      }

      const extraFields = {};
      if (paymentMethod === 'qr' && isQrConfirmed) {
        extraFields.confirmadoPor = user?.displayName || user?.email || 'Vendedor';
        extraFields.metodoConfirmacion = 'manual';
      } else if (paymentMethod === 'cash' && cashReceived !== '') {
        extraFields.montoRecibido = Number(cashReceived);
        extraFields.cambio = Number(cashReceived) - total;
      } else if (paymentMethod === 'mixto') {
        extraFields.montoEfectivo = Number(mixedCash || 0);
        extraFields.montoQR = Number(mixedQr || 0);
        extraFields.cambio = Math.max(0, (Number(mixedCash || 0) + Number(mixedQr || 0)) - total);
        if (Number(mixedQr || 0) > 0 && isQrConfirmed) {
          extraFields.confirmadoPor = user?.displayName || user?.email || 'Vendedor';
        }
      } else if (paymentMethod === 'fiado') {
        extraFields.status = 'pending_payment';
        extraFields.clientPhone = clientPhone.trim();
        extraFields.dueDate = dueDate || null;
      }
      // Sede operativa de esta venta (para reportes por sucursal)
      if (activeBranchId) extraFields.branchId = activeBranchId;

      const saleId = await registerSale(
        businessId,
        user.uid,
        cartItems,
        finalClientName,
        finalClientNit,
        paymentMethod,
        sellerName || user.displayName || '',
        extraFields
      );

      if (paymentMethod === 'fiado') {
        const productSummary = cartItems.map(item =>
          item.factor > 1 ? `${item.product.name} (${item.presLabel} x${item.quantity})` : `${item.product.name} (x${item.quantity})`
        ).join(', ');
        await addDebt(businessId, {
          clientName: finalClientName,
          clientNit: finalClientNit,
          clientPhone: clientPhone,
          dueDate: dueDate,
          amount: total,
          description: productSummary,
          saleId: saleId,
        });
      }
      
      const saleDetails = {
        saleId,
        total,
        clientName: finalClientName,
        clientNit: finalClientNit,
        paymentMethod,
        itemCount: totalBaseUnits,
        time: new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }),
        items: [...cartItems],
        montoRecibido: paymentMethod === 'cash' && cashReceived !== '' ? Number(cashReceived) : null,
        montoEfectivo: paymentMethod === 'mixto' ? Number(mixedCash || 0) : null,
        montoQR: paymentMethod === 'mixto' ? Number(mixedQr || 0) : null,
        cambio: paymentMethod === 'cash' && cashReceived !== '' 
          ? (Number(cashReceived) - total) 
          : (paymentMethod === 'mixto' ? Math.max(0, (Number(mixedCash || 0) + Number(mixedQr || 0)) - total) : null),
      };
      
      setShowSuccessModal(saleDetails);

      const updated = await getProducts(businessId);
      setProducts(updated);
      if (isCustomClient) {
        setCustomers(await getCustomers(businessId));
      }
    } catch (err) {
      console.error(err);
      alert('Error al registrar la venta. Intenta de nuevo.');
    } finally {
      setRegistering(false);
      setShowQrConfirmModal(false);
    }
  }

  function handleCheckoutClick() {
    if (cartItems.length === 0) return;
    // Guardián final: ninguna línea puede superar el stock real (fresco).
    // Si el stock bajó (otra venta sincronizada), se avisa y no se cobra.
    const exceeded = cartItems.find((item) => {
      const fresh = productsWithStock.find((p) => p.id === item.product.id);
      const stock = fresh ? fresh.stock : item.product.stock;
      return item.quantity * item.factor > (stock || 0);
    });
    if (exceeded) {
      const fresh = productsWithStock.find((p) => p.id === exceeded.product.id);
      const stock = fresh ? fresh.stock : exceeded.product.stock;
      alert(`"${exceeded.product.name}" ya no tiene stock suficiente (quedan ${stock || 0} und.). Ajusta la cantidad.`);
      return;
    }
    if (paymentMethod === 'cash' && cashReceived !== '' && Number(cashReceived) < total) {
      alert('El monto recibido es insuficiente.');
      return;
    }
    if (paymentMethod === 'mixto') {
      const mixedSum = Number(mixedCash || 0) + Number(mixedQr || 0);
      if (mixedSum < total) {
        alert('El monto total ingresado es insuficiente.');
        return;
      }
      const qrAmount = Number(mixedQr || 0);
      if (qrAmount > 0) {
        if (!settings?.qrData) {
          alert('Primero debes subir tu QR de cobro en Ajustes.');
          return;
        }
        setShowQrConfirmModal(true);
        return;
      }
    }
    if (paymentMethod === 'fiado') {
      if (!(selectedCustomer?.name || typedClientName).trim()) {
        alert('Para ventas al fiado, selecciona o escribe el nombre del cliente.');
        return;
      }
    }
    if (paymentMethod === 'qr') {
      if (!settings?.qrData) {
        alert('Primero debes subir tu QR de cobro en Ajustes.');
        return;
      }
      setShowQrConfirmModal(true);
    } else {
      handleRegister(false);
    }
  }

  function closeSuccessModal() {
    setShowSuccessModal(null);
    setCart({});
    setSearch('');
    setTypedClientName('');
    setSelectedCustomer(null);
    setIsCustomClient(false);
    setPaymentMethod('cash');
    setCashReceived('');
    setMixedCash('');
    setMixedQr('');
    setClientPhone('');
    setDueDate('');
    setShowCartModal(false);
    clearCartDraft(businessId, user.uid);
  }

  function handlePrintSuccessSale() {
    if (!showSuccessModal) return;
    printReceipt({
      business,
      settings,
      saleId: showSuccessModal.saleId,
      items: showSuccessModal.items.map((it) => ({
        quantity: it.quantity,
        productName: it.factor > 1 ? `${it.product.name} · ${it.presLabel}` : it.product.name,
        productBrand: it.product.brand || '',
        price: it.unitPrice,
        subtotal: it.unitPrice * it.quantity,
      })),
      total: showSuccessModal.total,
      date: new Date(),
      clientName: showSuccessModal.clientName,
      clientNit: showSuccessModal.clientNit,
      sellerName: sellerName || user.displayName || '',
      paymentMethod: showSuccessModal.paymentMethod,
      montoRecibido: showSuccessModal.paymentMethod === 'cash' ? showSuccessModal.montoRecibido : showSuccessModal.montoEfectivo,
      cambio: showSuccessModal.cambio,
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--mg-accent-border)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderCartContent = (isMobile = false) => {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header del Cart */}
        <div className="p-4 border-b border-[var(--mg-separator)] flex items-center justify-between shrink-0">
          <div className="flex-1 text-center">
            {isMobile && <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-2" />}
            <h3 className="text-lg font-bold text-[var(--mg-text-primary)]">Tu Carrito ({totalBaseUnits} und.)</h3>
            {cartItems.length > 1 && (
              <p className="text-[11px] font-bold text-[var(--mg-text-muted)]">{cartItems.length} líneas</p>
            )}
            {branches.length > 1 && (
              <p className="text-[11px] font-bold text-[var(--mg-text-muted)]">
                📍 {branches.find((b) => b.id === activeBranchId)?.name || 'Sede'}
              </p>
            )}
          </div>
          {isMobile && (
            <button
              onClick={() => setShowCartModal(false)}
              className="w-8 h-8 bg-[var(--mg-bg-elevated)] rounded-full flex items-center justify-center text-[var(--mg-text-secondary)] font-bold text-lg"
            >
              ×
            </button>
          )}
        </div>

        {/* Listado de Productos */}
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--mg-separator)]">
          {cartItems.map((item) => {
            const siblingBaseUsed = cartItems
              .filter((i) => i.key !== item.key && i.product.id === item.product.id)
              .reduce((sum, i) => sum + i.quantity * i.factor, 0);
            return (
            <CartItemRow
              key={item.key}
              line={item}
              product={item.product}
              stacked={!isMobile}
              siblingBaseUsed={siblingBaseUsed}
              onUpdate={(newQty) => {
                setCart((prev) => {
                  if (newQty <= 0) {
                    const { [item.key]: _, ...rest } = prev;
                    return rest;
                  }
                  const line = prev[item.key];
                  if (!line || typeof line.qty !== 'number') return prev;
                  // Revalidar tope con las líneas hermanas al momento de guardar
                  const sib = Object.entries(prev)
                    .filter(([k, l]) => k !== item.key && l && typeof l === 'object' && l.productId === item.product.id)
                    .reduce((sum, [, l]) => sum + Number(l.qty || 0) * Number(l.factor || 1), 0);
                  const max = Math.max(0, Math.floor(((item.product.stock || 0) - sib) / (item.factor || 1)));
                  if (max <= 0) {
                    const { [item.key]: _, ...rest } = prev;
                    return rest;
                  }
                  return { ...prev, [item.key]: { ...line, qty: Math.min(newQty, max) } };
                });
              }}
            />
            );
          })}
        </div>

        {/* Sección de Pago */}
        <div className="border-t border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)] p-4 space-y-4 shrink-0">
          {/* Método de pago */}
          <div>
            <p className="text-xs text-[var(--mg-text-muted)] font-semibold mb-2">Método de Pago</p>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--mg-text-primary)] focus:outline-none focus:border-[var(--mg-accent-border)]"
            >
              <option value="cash">💵 Efectivo</option>
              <option value="qr">📲 QR</option>
              <option value="mixto">🔀 Mixto</option>
              <option value="fiado">⏳ Fiado (CxC)</option>
            </select>
          </div>

          {/* Cliente */}
          <div>
            <p className="text-xs text-[var(--mg-text-muted)] font-semibold mb-1">
              Cliente {paymentMethod === 'fiado' && <span className="text-red-500 font-bold">*</span>}
            </p>
            {isCustomClient ? (
              <input
                type="text"
                value={typedClientName}
                onChange={(e) => setTypedClientName(e.target.value)}
                placeholder="Nombre del cliente"
                autoFocus
                className="w-full bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--mg-accent-border)] text-[var(--mg-text-primary)] font-medium"
              />
            ) : (
              <select
                value={selectedCustomer?.id || ''}
                onChange={(e) => handleClientSelect(e.target.value)}
                className="w-full bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--mg-accent-border)] text-[var(--mg-text-primary)] font-medium"
              >
                <option value="">Sin cliente</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value={CUSTOM_CLIENT_VALUE}>+ Escribir otro...</option>
              </select>
            )}
          </div>

          {/* Calculadora de cambio para Efectivo */}
          {paymentMethod === 'cash' && (
            <div className="bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-[var(--mg-text-muted)] font-semibold">Paga con / Recibido</p>
                  <p className="text-[10px] text-[var(--mg-text-faint)] font-medium">Monto entregado por cliente</p>
                </div>
                <div className="relative max-w-[140px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--mg-text-muted)]">Bs</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="999999"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(clampNumberInput(e.target.value, { max: 999999 }))}
                    onKeyDown={blockInvalidNumberKeys}
                    placeholder="Ej: 100"
                    className="w-full bg-[var(--mg-bg-elevated)] border-2 border-[var(--mg-border)] rounded-xl pl-9 pr-3 py-2 text-sm text-right focus:outline-none focus:border-[var(--mg-accent-border)] text-[var(--mg-text-primary)] font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              {cashReceived !== '' && (
                <div className="flex items-center justify-between pt-2 border-t border-[var(--mg-separator)] text-xs">
                  {Number(cashReceived) < total ? (
                    <span className="text-red-500 font-bold flex items-center gap-1 animate-pulse">
                      ⚠️ Monto insuficiente
                    </span>
                  ) : (
                    <>
                      <span className="text-[var(--mg-text-muted)] font-medium">Cambio a entregar:</span>
                      <span className="text-sm font-black text-green-600">
                        {formatBs(Number(cashReceived) - total)}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Calculadora de cambio para Pago Mixto */}
          {paymentMethod === 'mixto' && (
            <div className="bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-[var(--mg-text-muted)] font-semibold">Monto Efectivo</p>
                </div>
                <div className="relative max-w-[140px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--mg-text-muted)]">Bs</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="999999"
                    value={mixedCash}
                    onChange={(e) => setMixedCash(clampNumberInput(e.target.value, { max: 999999 }))}
                    onKeyDown={blockInvalidNumberKeys}
                    placeholder="Ej: 50"
                    className="w-full bg-[var(--mg-bg-elevated)] border-2 border-[var(--mg-border)] rounded-xl pl-9 pr-3 py-2 text-sm text-right focus:outline-none focus:border-[var(--mg-accent-border)] text-[var(--mg-text-primary)] font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-[var(--mg-text-muted)] font-semibold">Monto QR</p>
                </div>
                <div className="relative max-w-[140px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--mg-text-muted)]">Bs</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="999999"
                    value={mixedQr}
                    onChange={(e) => setMixedQr(clampNumberInput(e.target.value, { max: 999999 }))}
                    onKeyDown={blockInvalidNumberKeys}
                    placeholder="Ej: 50"
                    className="w-full bg-[var(--mg-bg-elevated)] border-2 border-[var(--mg-border)] rounded-xl pl-9 pr-3 py-2 text-sm text-right focus:outline-none focus:border-[var(--mg-accent-border)] text-[var(--mg-text-primary)] font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              
              <div className="pt-2 border-t border-[var(--mg-separator)] text-xs">
                {Number(mixedCash || 0) + Number(mixedQr || 0) < total ? (
                  <span className="text-red-500 font-bold flex items-center gap-1 animate-pulse">
                    ⚠️ Falta cubrir {formatBs(total - (Number(mixedCash || 0) + Number(mixedQr || 0)))}
                  </span>
                ) : (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--mg-text-muted)] font-medium">Cambio (en efectivo):</span>
                    <span className="text-sm font-black text-green-600">
                      {formatBs((Number(mixedCash || 0) + Number(mixedQr || 0)) - total)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Campos adicionales para Fiado */}
          {paymentMethod === 'fiado' && (
            <div className="grid grid-cols-2 gap-2 bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-2xl p-3.5">
              <div>
                <p className="text-xs text-[var(--mg-text-muted)] font-semibold mb-1">Teléfono</p>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="Ej: 71234567"
                  className="w-full bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--mg-accent-border)] text-[var(--mg-text-primary)] font-medium"
                />
              </div>
              <div>
                <p className="text-xs text-[var(--mg-text-muted)] font-semibold mb-1">Fecha Límite</p>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--mg-accent-border)] text-[var(--mg-text-primary)] font-medium cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Acciones principales */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1">
              <p className="text-[10px] text-[var(--mg-text-faint)] uppercase font-semibold">Total a Cobrar</p>
              <p className="text-2xl font-black text-[var(--mg-accent)]">{formatBs(total)}</p>
            </div>
            <button
              onClick={() => {
                if (confirm('¿Vaciar el carrito?')) {
                  setCart({});
                  setTypedClientName('');
                  setSelectedCustomer(null);
                  setIsCustomClient(false);
                  setPaymentMethod('cash');
                  setCashReceived('');
                  setMixedCash('');
                  setMixedQr('');
                  setClientPhone('');
                  setDueDate('');
                  setShowCartModal(false);
                  clearCartDraft(businessId, user.uid);
                }
              }}
              className="bg-gray-100 text-gray-500 font-bold p-3.5 rounded-2xl text-sm active:scale-95 shrink-0"
            >
              Vaciar
            </button>
            <button
              onClick={handleCheckoutClick}
              disabled={registering || 
                (paymentMethod === 'cash' && cashReceived !== '' && Number(cashReceived) < total) ||
                (paymentMethod === 'mixto' && (Number(mixedCash || 0) + Number(mixedQr || 0)) < total) ||
                (paymentMethod === 'fiado' && !(selectedCustomer?.name || typedClientName).trim())
              }
              className="bg-[var(--mg-accent)] text-white font-bold py-3.5 px-6 rounded-2xl text-sm active:scale-95 transition-all disabled:opacity-60 shrink-0 shadow-lg flex items-center gap-2"
              style={{ boxShadow: '0 8px 20px rgba(0, 122, 255, 0.3)' }}
            >
              {registering ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Cobrar'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row lg:h-full lg:overflow-hidden relative">
      {/* Columna Izquierda: Listado y Búsqueda de Productos */}
      <div className="flex-1 flex flex-col min-h-0 lg:pl-0 lg:pr-4">

        <div className="p-4 space-y-3 flex-1 flex flex-col min-h-0">
          {activeTab === 'venta' && (
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold text-[var(--mg-text-primary)]">Nueva Venta</h2>
              {totalBaseUnits > 0 && (
                <span className="bg-[var(--mg-accent)] text-white text-xs font-black px-3 py-1.5 rounded-full lg:hidden">
                  {totalBaseUnits} en carrito
                </span>
              )}
            </div>
          )}

          {activeTab === 'reporte' ? (
            <div className="flex-1 min-h-0 overflow-y-auto pb-24 lg:pb-6 space-y-4">
              <ReportHeader
                icon="🛒"
                title="Reporte de Ventas"
                subtitle="Historial detallado de tus ventas por producto."
                startDate={reportStartDate}
                endDate={reportEndDate}
                onStartDateChange={setReportStartDate}
                onEndDateChange={setReportEndDate}
                onExport={handleExportSales}
                exportDisabled={salesReportRows.length === 0}
              />

              {renderBranchPills()}
              {renderDetailTable(salesReportRows, 'No se encontraron ventas en el rango de fechas seleccionado.', 'Total del período')}
            </div>
          ) : activeTab === 'cajeros' ? (
            <div className="flex-1 min-h-0 overflow-y-auto pb-24 lg:pb-6 space-y-4">
              <ReportHeader
                icon="👥"
                title="Reporte por Cajero"
                subtitle="Lo que vendió cada vendedor y en qué método de pago."
                startDate={reportStartDate}
                endDate={reportEndDate}
                onStartDateChange={setReportStartDate}
                onEndDateChange={setReportEndDate}
                onExport={handleExportSales}
                exportDisabled={cashierRows.length === 0}
              />

              {/* ── Por cajero ── */}
              {renderBranchPills()}
              <div className="bg-[var(--mg-bg-surface)] rounded-[20px] border border-[var(--mg-border)] p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="font-black text-[var(--mg-text-primary)] text-sm flex items-center gap-1.5"><AppIcon name="equipo" size={15} /> Ventas por cajero</h3>
                  <p className="text-[11px] text-[var(--mg-text-muted)] font-semibold">Toca un cajero para ver su detalle</p>
                </div>

                {/* Filtro de cajeros */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {['Todos', ...sellersInRange].map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setReportCashier(name)}
                      className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                        reportCashier === name
                          ? 'bg-[var(--mg-accent)] text-white shadow-sm'
                          : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
                      }`}
                    >
                      {name === 'Todos' ? 'Todos' : name}
                    </button>
                  ))}
                </div>

                {cashierStats.length === 0 ? (
                  <p className="text-xs text-[var(--mg-text-muted)] text-center py-3 bg-[var(--mg-bg-elevated)] rounded-xl">
                    Sin ventas en este período.
                  </p>
                ) : reportCashier === 'Todos' ? (
                  /* Resumen comparativo: una fila por cajero */
                  <div className="overflow-x-auto rounded-2xl border border-[var(--mg-border)]">
                    <table className="w-full text-sm min-w-[640px] border-collapse bg-white">
                      <thead>
                        <tr className="bg-[var(--mg-bg-elevated)]">
                          {['Cajero', 'Ventas', 'Efectivo', 'QR', 'Mixto', 'Fiado', 'En caja', 'Ganancia'].map((h, i) => (
                            <th key={h} className={`p-2.5 text-xs font-black text-[var(--mg-text-secondary)] uppercase tracking-wide whitespace-nowrap ${i >= 2 ? 'text-right' : 'text-left'}`}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cashierStats.map((st) => (
                          <tr
                            key={st.name}
                            onClick={() => setReportCashier(st.name)}
                            className="border-t border-[var(--mg-separator)] hover:bg-blue-50/40 cursor-pointer transition-colors"
                          >
                            <td className="p-2.5 font-bold text-[var(--mg-text-primary)] whitespace-nowrap">
                              👤 {st.name}
                            </td>
                            <td className="p-2.5 text-left">
                              <span className="inline-block bg-[var(--mg-bg-elevated)] rounded-full px-2.5 py-0.5 text-xs font-black">
                                {st.ventas}
                              </span>
                            </td>
                            <td className="p-2.5 text-right font-semibold text-green-700">{formatBs(st.cash)}</td>
                            <td className="p-2.5 text-right font-semibold text-blue-700">{formatBs(st.qr)}</td>
                            <td className="p-2.5 text-right font-semibold text-purple-700">{formatBs(st.mixto)}</td>
                            <td className="p-2.5 text-right font-semibold text-amber-700">{formatBs(st.fiado)}</td>
                            <td className="p-2.5 text-right font-black text-[var(--mg-accent)]">{formatBs(st.enCaja)}</td>
                            <td className="p-2.5 text-right font-bold text-green-600">{formatBs(st.ganancia)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* Ficha del cajero seleccionado */
                  (() => {
                    const st = cashierStats.find((s) => s.name === reportCashier);
                    if (!st) return null;
                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2.5">
                          <div className="bg-[var(--mg-bg-elevated)] rounded-2xl p-3 text-center border border-[var(--mg-border)]">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">En caja</p>
                            <p className="text-lg font-black text-[var(--mg-accent)]">{formatBs(st.enCaja)}</p>
                          </div>
                          <div className="bg-[var(--mg-bg-elevated)] rounded-2xl p-3 text-center border border-[var(--mg-border)]">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Ventas</p>
                            <p className="text-lg font-black text-[var(--mg-text-primary)]">{st.ventas}</p>
                          </div>
                          <div className="bg-[var(--mg-bg-elevated)] rounded-2xl p-3 text-center border border-[var(--mg-border)]">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Ganancia</p>
                            <p className="text-lg font-black text-green-600">{formatBs(st.ganancia)}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { icon: 'cash', label: 'Efectivo', value: st.cash, cls: 'text-green-700 bg-green-50 border-green-200' },
                            { icon: 'qr', label: 'QR', value: st.qr, cls: 'text-blue-700 bg-blue-50 border-blue-200' },
                            { icon: 'mixto', label: 'Mixto', value: st.mixto, cls: 'text-purple-700 bg-purple-50 border-purple-200' },
                            { icon: 'fiado', label: 'Fiado', value: st.fiado, cls: 'text-amber-700 bg-amber-50 border-amber-200' },
                          ].map((m) => (
                            <div key={m.label} className={`rounded-2xl p-2.5 text-center border ${m.cls}`}>
                              <p className="flex justify-center"><AppIcon name={m.icon} size={18} /></p>
                              <p className="text-[10px] font-extrabold uppercase tracking-wide opacity-80">{m.label}</p>
                              <p className="text-sm font-black">{formatBs(m.value)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>

              {renderDetailTable(
                cashierRows,
                reportCashier === 'Todos'
                  ? 'No se encontraron ventas en el rango de fechas seleccionado.'
                  : `Sin ventas de ${reportCashier} en este período.`,
                `Total ${reportCashier === 'Todos' ? 'del período' : `de ${reportCashier}`}`
              )}
            </div>
          ) : (
          <>
          <div className="shrink-0 flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍  Buscar producto, marca o código..."
              className="flex-1 min-w-0 border-2 border-[var(--mg-border)] rounded-2xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent-border)] text-base"
            />
            <button
              type="button"
              onClick={openScanner}
              title="Escanear código de barras"
              aria-label="Escanear código de barras"
              className="w-[52px] h-[52px] shrink-0 rounded-2xl bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white shadow-lg flex items-center justify-center active:scale-90 transition-all"
              style={{ boxShadow: '0 8px 20px rgba(22,112,194,0.35)' }}
            >
              <AppIcon name="scan" size={24} color="#fff" />
            </button>
          </div>

          {/* Filtro por Categorías */}
          <div className="flex gap-2 overflow-x-auto pb-1.5 -mx-4 px-4 scrollbar-hide shrink-0">
            {['Todas', RECENT_CATEGORY, ...categories].map((cat) => (
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
            {filtered.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 p-1 mg-stagger">
                {filtered.map((product) => {
                  const options = getSellOptions(product);
                  const hasPack = options.some((o) => o.presId === 'pack');
                  const usedBase = productUsedBase(product.id);
                  const maxed = usedBase >= product.stock;
                  // Stepper de la tarjeta: línea de UNIDAD (rápido); el paquete se elige con tap
                  const unitKey = options[0]?.key;
                  const inCart = (unitKey && cart[unitKey] && typeof cart[unitKey].qty === 'number')
                    ? cart[unitKey].qty
                    : (typeof cart[product.id] === 'number' ? cart[product.id] : 0);
                  const packOpt = options.find((o) => o.presId === 'pack');
                  return (
                    <ProductCatalogCard
                      key={product.id}
                      product={product}
                      priceLabel={hasPack && packOpt
                        ? `${formatBs(product.price)} · 📦 ${formatBs(packOpt.price)}`
                        : formatBs(product.price)}
                      metaLabel={<StockLabel stock={product.stock} minStock={product.minStock} />}
                      selected={usedBase > 0}
                      disabled={maxed}
                      onSelect={() => handleProductTap(product)}
                      actionArea={
                        inCart > 0 ? (
                          <div className="flex items-center gap-1 bg-[var(--mg-accent)] rounded-full shadow-lg px-1 py-1">
                            <button
                              type="button"
                              onClick={() => removeFromCart(product.id)}
                              className="w-5 h-5 rounded-full bg-white/20 text-white font-black text-xs flex items-center justify-center active:scale-90"
                            >
                              −
                            </button>
                            <span className="text-white font-black text-xs w-3 text-center">{inCart}</span>
                            <button
                              type="button"
                              onClick={() => addToCart(product)}
                              disabled={maxed}
                              className="w-5 h-5 rounded-full bg-white/20 text-white font-black text-xs flex items-center justify-center active:scale-90 disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleProductTap(product)}
                            className="w-8 h-8 rounded-full bg-[var(--mg-accent)] text-white shadow-lg flex items-center justify-center active:scale-90 font-black text-base leading-none"
                          >
                            +
                          </button>
                        )
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-[var(--mg-text-faint)]">
                <p className="text-5xl mb-3">📦</p>
                <p className="font-semibold">
                  {search
                    ? 'No encontrado'
                    : filterCategory === RECENT_CATEGORY
                      ? 'Todavía no hay ventas recientes'
                      : 'Sin productos disponibles'}
                </p>
                {!search && filterCategory !== RECENT_CATEGORY && <p className="text-sm mt-1">Ve a Inventario para agregar</p>}
              </div>
            )}
          </div>
          </>
          )}
        </div>
      </div>

      {/* Botón para desplegar/contraer el carrito (Sólo Desktop) */}
      {activeTab === 'venta' && (
      <>
      <button
        type="button"
        onClick={() => setCartOpen((v) => !v)}
        title={cartOpen ? 'Ocultar carrito' : 'Mostrar carrito'}
        className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] text-[var(--mg-text-secondary)] shadow-md items-center justify-center z-20 active:scale-90 transition-all duration-300 ${
          cartOpen ? 'right-[372px]' : 'right-2'
        }`}
      >
        <svg
          className={`w-5 h-5 transition-transform duration-300 ${cartOpen ? '' : 'rotate-180'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 17l-5-5 5-5M11 17l-5-5 5-5" />
        </svg>
      </button>

      {/* Columna Derecha (Desktop Sidebar): Carrito */}
      {cartOpen && (
        <aside className="hidden lg:flex flex-col w-[380px] border-l border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shrink-0 h-full overflow-hidden">
          {cartItems.length > 0 ? (
            renderCartContent(false)
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--mg-text-faint)] p-6">
              <AppIcon name="carrito" size={48} />
              <p className="font-semibold text-sm mt-3">Tu carrito está vacío</p>
              <p className="text-xs text-center mt-1">Haz clic en los productos para agregarlos al carrito</p>
            </div>
          )}
        </aside>
      )}

      {/* Botón flotante para ver carrito (FAB - Sólo Mobile y pestaña venta) */}
      {activeTab === 'venta' && totalBaseUnits > 0 && !showCartModal && (
        <button
          onClick={() => setShowCartModal(true)}
          className="lg:hidden fixed bottom-20 right-4 bg-[var(--mg-accent)] text-white font-bold py-3.5 px-5 rounded-full shadow-2xl flex items-center gap-3 transition-all z-40 active:scale-95 hover:bg-[var(--mg-accent-hover)]"
          style={{ boxShadow: '0 8px 30px rgba(0, 122, 255, 0.45)' }}
        >
          <div className="relative flex items-center">
            <AppIcon name="carrito" size={20} color="#fff" />
            <span className="absolute -top-2.5 -right-2.5 bg-white text-[var(--mg-accent)] text-[10px] font-black min-w-5 h-5 px-1 rounded-full flex items-center justify-center shadow-md">
              {totalBaseUnits}
            </span>
          </div>
          <div className="text-left border-l border-white/20 pl-3">
            <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold leading-none">Ver Carrito</p>
            <p className="text-sm font-black leading-tight mt-0.5">{formatBs(total)}</p>
          </div>
        </button>
      )}

      {/* Modal / Drawer del Carrito (Sólo Mobile) */}
      {showCartModal && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setShowCartModal(false)}>
          <div
            className="bg-[var(--mg-bg-surface)] rounded-t-3xl w-full max-w-md shadow-2xl flex flex-col mg-slide-up"
            style={{ maxHeight: '85vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {renderCartContent(true)}
          </div>
        </div>
      )}
      </>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ÉXITO */}
      {showSuccessModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 cursor-pointer mg-backdrop-in"
          onClick={closeSuccessModal}
        >
          <div
            className="bg-[var(--mg-bg-surface)] rounded-3xl p-6 w-full max-w-xs text-center shadow-2xl relative cursor-default mg-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Check Icon animado */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center border-2 border-green-200">
                <svg className="w-9 h-9 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" className="mg-draw-check" />
                </svg>
              </div>
            </div>

            <h3 className="text-lg font-black text-[var(--mg-text-primary)]">¡Cobro Exitoso!</h3>
            <p className="text-3xl font-black text-green-600 my-2">{formatBs(showSuccessModal.total)}</p>

            {/* Datos Detallados */}
            <div className="bg-[var(--mg-bg-elevated)] rounded-2xl p-3 text-left text-xs space-y-1.5 border border-[var(--mg-border)] my-4 text-[var(--mg-text-secondary)]">
              <div className="flex justify-between">
                <span className="text-[var(--mg-text-muted)] font-medium">Cliente:</span>
                <span className="font-bold text-[var(--mg-text-primary)] truncate max-w-[140px]">{showSuccessModal.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--mg-text-muted)] font-medium">NIT/CI:</span>
                <span className="font-semibold">{showSuccessModal.clientNit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--mg-text-muted)] font-medium">Método de Pago:</span>
                <span className="font-bold text-[var(--mg-text-primary)]">
                  {showSuccessModal.paymentMethod === 'qr' ? '📲 QR' : 
                   showSuccessModal.paymentMethod === 'cash' ? '💵 Efectivo' :
                   showSuccessModal.paymentMethod === 'mixto' ? '🔀 Mixto' : '⏳ Fiado (CxC)'}
                </span>
              </div>
              {showSuccessModal.paymentMethod === 'cash' && showSuccessModal.montoRecibido !== null && showSuccessModal.montoRecibido !== undefined && (
                <>
                  <div className="flex justify-between">
                    <span className="text-[var(--mg-text-muted)] font-medium">Recibido:</span>
                    <span className="font-semibold text-[var(--mg-text-primary)]">{formatBs(showSuccessModal.montoRecibido)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--mg-text-muted)] font-medium">Cambio:</span>
                    <span className="font-bold text-green-600">{formatBs(showSuccessModal.cambio)}</span>
                  </div>
                </>
              )}
              {showSuccessModal.paymentMethod === 'mixto' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-[var(--mg-text-muted)] font-medium">Monto Efectivo:</span>
                    <span className="font-semibold text-[var(--mg-text-primary)]">{formatBs(showSuccessModal.montoEfectivo)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--mg-text-muted)] font-medium">Monto QR:</span>
                    <span className="font-semibold text-[var(--mg-text-primary)]">{formatBs(showSuccessModal.montoQR)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--mg-text-muted)] font-medium">Cambio:</span>
                    <span className="font-bold text-green-600">{formatBs(showSuccessModal.cambio)}</span>
                  </div>
                </>
              )}
              {showSuccessModal.paymentMethod === 'fiado' && (
                <div className="text-center py-1 bg-red-50 text-red-700 rounded-lg font-bold text-[10px] uppercase">
                  Deuda Registrada Pendiente
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[var(--mg-text-muted)] font-medium">Productos:</span>
                <span className="font-semibold">{showSuccessModal.itemCount} {showSuccessModal.itemCount === 1 ? 'unidad' : 'unidades'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--mg-text-muted)] font-medium">Hora:</span>
                <span className="font-semibold">{showSuccessModal.time}</span>
              </div>
            </div>

            {/* Botones de Interacción */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handlePrintSuccessSale}
                className="w-full bg-[var(--mg-accent-bg)] hover:bg-[var(--mg-accent-border)] text-[var(--mg-accent)] font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <AppIcon name="recibo" size={14} /> Imprimir recibo

                              </button>
              <button
                type="button"
                onClick={closeSuccessModal}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl text-xs active:scale-95 transition-all shadow-md"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {showQrConfirmModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setShowQrConfirmModal(false)}
        >
          <div 
            className="bg-[var(--mg-bg-surface)] rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl relative cursor-default animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowQrConfirmModal(false)}
              className="absolute top-4 right-4 text-2xl text-[var(--mg-text-muted)] font-bold cursor-pointer hover:text-[var(--mg-text-primary)] transition-colors"
            >
              ×
            </button>

            <h3 className="text-lg font-black text-[var(--mg-text-primary)] mb-1">Confirmar Pago QR</h3>
            <p className="text-sm font-semibold text-[var(--mg-text-muted)] mb-4">
              {paymentMethod === 'mixto' ? `Monto QR a cobrar: ${formatBs(Number(mixedQr || 0))}` : `Total: ${formatBs(total)}`}
            </p>

            {paymentMethod === 'mixto' && (
              <div className="bg-[var(--mg-bg-elevated)] rounded-2xl p-3.5 text-left text-xs space-y-1.5 border border-[var(--mg-border)] mb-4 text-[var(--mg-text-secondary)]">
                <div className="flex justify-between">
                  <span className="text-[var(--mg-text-muted)] font-medium">Monto Efectivo:</span>
                  <span className="font-bold text-[var(--mg-text-primary)]">{formatBs(Number(mixedCash || 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--mg-text-muted)] font-medium">Monto QR a cobrar:</span>
                  <span className="font-bold text-[var(--mg-text-primary)]">{formatBs(Number(mixedQr || 0))}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--mg-separator)] pt-1.5 mt-1.5">
                  <span className="text-[var(--mg-text-muted)] font-medium">Cambio (en efectivo):</span>
                  <span className="font-black text-green-600">
                    {formatBs(Math.max(0, (Number(mixedCash || 0) + Number(mixedQr || 0)) - total))}
                  </span>
                </div>
              </div>
            )}

            <div className="bg-[var(--mg-bg-elevated)] p-2 rounded-2xl border border-[var(--mg-border)] inline-block mb-4">
              <img 
                src={settings?.qrData} 
                alt="QR de Cobro" 
                className="w-56 h-56 object-contain bg-white rounded-xl"
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold p-3.5 rounded-2xl mb-5 leading-relaxed text-left flex items-start gap-2">
              <span className="text-base shrink-0">⚠️</span>
              <span>Verifica que el cliente haya realizado el pago antes de confirmar.</span>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowQrConfirmModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold py-3.5 rounded-2xl text-xs active:scale-95 transition-all"
              >
                Cancelar pago
              </button>
              <button
                type="button"
                onClick={() => handleRegister(true)}
                disabled={registering}
                className="flex-1 bg-[var(--mg-accent)] hover:bg-[#0f5c9e] text-white font-bold py-3.5 rounded-2xl text-xs active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                {registering ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Confirmar pago'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SELECTOR DE PRESENTACIÓN (unidad / paquete frío-caliente) */}
      {pickerProduct && (
        <PresentationPicker
          product={pickerProduct}
          cartCounts={Object.fromEntries(
            Object.entries(cart)
              .filter(([, l]) => l && typeof l === 'object' && l.productId === pickerProduct.id)
              .map(([k, l]) => [k, l.qty])
          )}
          onPick={(opt) => addToCart(pickerProduct, opt)}
          onClose={() => setPickerProduct(null)}
          onGoCart={() => { setPickerProduct(null); setShowCartModal(true); }}
          cartTotalItems={totalBaseUnits}
        />
      )}

      {/* PAYWALL escáner */}
      {showUpgrade && (
        <UpgradeModal feature="scanner" title="El escáner es Pro" onClose={() => setShowUpgrade(false)} />
      )}

      {/* MODAL ESCÁNER DE CÓDIGOS */}      {showScanner && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setShowScanner(false)}
        >
          <div
            className="bg-[var(--mg-bg-surface)] rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden mg-slide-up flex flex-col"
            style={{ maxHeight: '92vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--mg-separator)] flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-black text-[var(--mg-text-primary)]">Búsqueda por escáner</h3>
                <p className="text-[11px] text-[var(--mg-text-muted)]">Apunta al código de barras del producto</p>
              </div>
              <button
                type="button"
                onClick={() => setShowScanner(false)}
                className="w-8 h-8 bg-[var(--mg-bg-elevated)] rounded-full flex items-center justify-center text-[var(--mg-text-muted)] font-bold text-lg shrink-0"
              >
                ×
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              <BarcodeScanner onScan={handleBarcodeScan} />

              {scanMsg && (
                <div className={`rounded-xl px-3.5 py-2.5 text-xs font-bold ${scanMsg.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-600'}`}>
                  {scanMsg.ok ? '✅ ' : '⚠️ '}{scanMsg.text}
                </div>
              )}

              {/* Últimos escaneados */}
              <div>
                <p className="text-sm font-black text-[var(--mg-text-primary)] mb-2">Últimos escaneados</p>
                {recentScans.length === 0 ? (
                  <p className="text-xs text-[var(--mg-text-muted)] bg-[var(--mg-bg-elevated)] rounded-xl px-3 py-3 text-center">
                    Aún no escaneaste nada. Los productos que agregues saldrán aquí.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {recentScans.map(({ id }) => {
                      const p = productsWithStock.find((x) => x.id === id);
                      if (!p) return null;
                      const qty = cartItems
                        .filter((i) => i.product.id === id)
                        .reduce((sum, i) => sum + i.quantity * i.factor, 0);
                      return (
                        <div key={`${id}`} className="flex items-center gap-3 bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-2xl p-2.5">
                          {p.imageData ? (
                            <img src={p.imageData} alt={p.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-[var(--mg-bg-elevated)] flex items-center justify-center text-2xl shrink-0">📦</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[var(--mg-text-primary)] truncate">{p.name}</p>
                            <p className="text-[11px] text-[var(--mg-text-muted)]">{formatBs(p.price)} c/u</p>
                          </div>
                          <span className="text-xs font-black text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 shrink-0">
                            x {qty}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-[var(--mg-separator)] flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowScanner(false)}
                className="flex-1 bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)] font-bold py-3 rounded-2xl text-sm active:scale-95"
              >
                Seguir buscando
              </button>
              <button
                type="button"
                onClick={() => { setShowScanner(false); setShowCartModal(true); }}
                disabled={totalBaseUnits === 0}
                className="flex-1 bg-[var(--mg-accent)] text-white font-bold py-3 rounded-2xl text-sm active:scale-95 disabled:opacity-50"
              >
                Ver carrito ({totalBaseUnits})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
