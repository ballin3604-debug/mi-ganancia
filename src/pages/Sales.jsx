import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { getProducts, subscribeToProducts } from '../services/products';
import ProductCatalogCard, { StockLabel } from '../components/ProductCatalogCard';
import ProductListRow, { RowAddButton } from '../components/ProductListRow';
import { AuditSalesList } from '../components/AuditSalesList';
import { registerSale, subscribeToSales, subscribeToSaleItems } from '../services/sales';
import { getBusinessMembers } from '../services/cashier';
import { getCustomers, addCustomer } from '../services/customers';
import { subscribeToCategories } from '../services/categories';
import { printReceipt } from '../components/Receipt';
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
import { useBranches } from '../context/BranchContext';
import { getSellOptions, defaultSellOption, presShortLabel } from '../utils/presentations';
import { AppIcon } from '../components/icons';
import { BranchSelect } from '../components/BranchSelect';
import MetricCard from '../components/ui/MetricCard';
import EmptyState from '../components/ui/EmptyState';
import SectionCard from '../components/ui/SectionCard';

function formatBs(amount) {
  return `Bs ${Number(amount || 0).toFixed(2)}`;
}

function ProductImage({ imageData, name, className }) {
  if (!imageData) {
    return (
      <div className={`${className} flex items-center justify-center bg-[var(--mg-bg-elevated)] text-[var(--mg-text-faint)]`}>
        <AppIcon name="paquete" size={18} />
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
        className="w-8 h-8 rounded-full bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] text-[var(--mg-text-primary)] font-black text-base flex items-center justify-center active:scale-90 shrink-0 hover:border-[var(--mg-border-hover)]"
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
        className="w-12 text-center font-bold text-sm bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-xl py-1.5 px-1 focus:outline-none focus:border-[var(--mg-accent)] focus:ring-2 focus:ring-[var(--mg-accent-bg)] text-[var(--mg-text-primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
          <button
            type="button"
            onClick={() => handleApply(quantity + 1)}
            disabled={quantity >= maxQty}
            aria-label="Agregar uno"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--mg-brand)] text-base font-black text-white active:scale-90 disabled:opacity-40"
      >
        +
      </button>
    </>
  );

  const trashBtn = (
    <button
      type="button"
      onClick={() => onUpdate(0)}
      className="text-[var(--mg-text-muted)] hover:text-[var(--mg-danger)] hover:bg-[var(--mg-danger-bg)] transition-colors p-1.5 rounded-xl shrink-0"
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
            <p className="mt-0.5 text-[11px] font-semibold text-[var(--mg-text-muted)]">
              {line.presentationId || factor > 1 ? `${line.presLabel} · ` : ''}{formatBs(unitPrice)} {factor > 1 ? 'por presentación' : 'c/u'}
            </p>
          </div>
          {trashBtn}
        </div>
        <div className="mt-2 flex items-center justify-between pl-[52px]">
          <div className="flex items-center gap-1.5">
            {stepper}
          </div>
          <span className="text-sm font-black tabular-nums text-[var(--mg-brand-text)]">
            {formatBs(unitPrice * quantity)}
          </span>
        </div>
        {errorMsg && (
          <span className="text-[var(--mg-danger)] text-[10px] font-bold mt-1 block pl-[52px]">
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
        <p className="mt-0.5 text-[11px] font-semibold text-[var(--mg-text-muted)]">
          {line.presentationId || factor > 1 ? `${line.presLabel} · ` : ''}{formatBs(unitPrice)} {factor > 1 ? 'por presentación' : 'c/u'}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <div className="flex items-center gap-1.5">
          {stepper}
          <span className="w-20 text-right text-sm font-black tabular-nums text-[var(--mg-brand-text)]">
            {formatBs(unitPrice * quantity)}
          </span>
          {trashBtn}
        </div>
        {errorMsg && (
          <span className="text-[var(--mg-danger)] text-[10px] font-bold mt-1">
            {errorMsg}
          </span>
        )}
      </div>
    </div>
  );
}

const CUSTOM_CLIENT_VALUE = '__custom__';
const RECENT_CATEGORY = 'Recientes';

export default function Sales() {
  const { businessId, user, sellerName, role, hasPermission } = useAuth();
  const isOwner = role !== 'cashier';
  const canSeeCosts = isOwner || hasPermission('ver_costos');
  const canExport = hasPermission('exportar');
  const { business, settings, sectorConfig } = useBusiness();
  // Restaurante: tickets sin cliente ni código de barras.
  const isRestaurantMode = !!sectorConfig?.features?.dishes;
  const { branches, activeBranchId, activeBranch, selectBranch } = useBranches();
  // Un almacén custodia y distribuye: no vende al público en ningún caso.
  const sellingBlocked = activeBranch?.type === 'almacen';
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') === 'reporte' ? 'reporte'
    : searchParams.get('tab') === 'cajeros' ? 'cajeros'
    : searchParams.get('tab') === 'auditoria' ? 'auditoria' : 'venta';
  // El cajero no tiene Por Cajero: cae a su reporte propio.
  const activeTab = (!isOwner && requestedTab === 'cajeros') ? 'reporte' : requestedTab;
  const [salesList, setSalesList] = useState([]);
  const [saleItemsList, setSaleItemsList] = useState([]);
  const navigate = useNavigate();
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
  function openScanner() {
    if (!hasPermission('scanner')) return;
    setScanMsg(null);
    setShowScanner(true);
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
        const pushLine = (key, prod, presId, variant, qty, unitPrice, factor, presLabel, presentationId = null) => {
          const already = usedBase[prod.id] || 0;
          const cap = prod.isDish
            ? qty
            : Math.floor(((hasB && activeBranchId ? Number(bMap.get(`${activeBranchId}:${prod.id}`) ?? 0) : prod.stock) - already) / factor);
          const q = Math.max(0, Math.min(qty, cap));
          if (q <= 0) return;
          usedBase[prod.id] = already + q * factor;
          restoredCart[key] = { productId: prod.id, presId, variant, qty: q, unitPrice, factor, presLabel, presentationId };
        };
        Object.entries(draft.cart || {}).forEach(([key, line]) => {
          if (typeof line === 'number') {
            const prod = prods.find((p) => p.id === key);
            if (!prod || (!prod.isDish && prod.stock <= 0)) return;
            const opt = defaultSellOption(prod);
            if (!opt) return;
            pushLine(opt.key, prod, opt.presId, opt.variant, line, opt.price, opt.factor, presShortLabel(prod, opt.presId, opt.variant, opt.presentationId), opt.presentationId);
            return;
          }
          if (!line || typeof line.qty !== 'number') return;
          const prod = prods.find((p) => p.id === line.productId);
          if (!prod || (!prod.isDish && prod.stock <= 0)) return;
          // Precio vigente del inventario (no el guardado en el borrador):
          // si el precio cambió mientras el borrador esperaba, el carrito nace actualizado.
          const freshOpts = getSellOptions(prod);
          const freshMatch = line.presentationId
            ? freshOpts.find((o) => o.presentationId === line.presentationId)
            : freshOpts.find((o) => o.presId === (line.presId || 'unit') && o.variant === (line.variant || 'unico'));
          const selected = freshMatch || freshOpts[0];
          if (!selected) return;
          pushLine(selected.key, prod, selected.presId, selected.variant, line.qty, selected.price, selected.factor, presShortLabel(prod, selected.presId, selected.variant, selected.presentationId), selected.presentationId);
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
          const match = line.presentationId
            ? opts.find((o) => o.presentationId === line.presentationId)
            : opts.find((o) => o.presId === (line.presId || 'unit') && o.variant === (line.variant || 'unico'));
          if (!match) return;
          if (Number(line.unitPrice) !== Number(match.price)
            || Number(line.factor) !== Number(match.factor)
            || line.presentationId !== match.presentationId) {
            next[key] = {
              ...line,
              presId: match.presId,
              variant: match.variant,
              presentationId: match.presentationId,
              unitPrice: match.price,
              factor: match.factor,
              presLabel: presShortLabel(prod, match.presId, match.variant, match.presentationId),
            };
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

  // Miembros (para saber qué cajeros pertenecen a cada sede)
  const [teamMembers, setTeamMembers] = useState([]);
  useEffect(() => {
    if (!businessId || !isOwner) return;
    getBusinessMembers(businessId).then(setTeamMembers).catch(() => setTeamMembers([]));
  }, [businessId, isOwner]);

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
  const scopedSalesReport = useMemo(() => {
    // El cajero solo ve sus propias ventas en reportes.
    const own = !isOwner && user?.uid
      ? filteredSalesReport.filter((s) => (s.createdBy || s.created_by) === user.uid)
      : filteredSalesReport;
    const inBranch = reportBranch === 'all'
      ? own
      : own.filter((s) => saleBranchId(s) === reportBranch);
    // Con sede filtrada: solo cajeros asignados a esa sede. Sin createdBy
    // (ventas viejas) o miembro sin restricción: se conservan.
    if (!isOwner || reportBranch === 'all' || teamMembers.length === 0) return inBranch;
    const byId = Object.fromEntries(teamMembers.map((m) => [m.id, m]));
    return inBranch.filter((s) => {
      const uid = s.createdBy || s.created_by;
      if (!uid) return true;
      const m = byId[uid];
      if (!m || !Array.isArray(m.branchIds) || m.branchIds.length === 0) return true;
      return m.branchIds.includes(reportBranch);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSalesReport, reportBranch, mainBranchId, isOwner, user?.uid, teamMembers]);

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
    const pick = (id) => { setReportBranch(id); setReportCashier('Todos'); };
    return (
      <BranchSelect
        branches={branches}
        value={reportBranch}
        onChange={pick}
        label="Sede"
        allLabel="Todas"
      />
    );
  }

  const sellersInRange = useMemo(() => {
    const set = new Set();
    scopedSalesReport.forEach((s) => set.add(s.seller_name || 'Sin nombre'));
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [scopedSalesReport]);

  // Totales por cajero calculados a nivel VENTA (no por ítem, para no duplicar).
  // "En caja" = efectivo + QR + mixto (plata que entró).
  // Usa la lista CON sede aplicada: resumen y detalle siempre cuadran.
  const cashierStats = useMemo(() => {
    const map = {};
    scopedSalesReport.forEach((s) => {
      const name = s.seller_name || 'Sin nombre';
      if (!map[name]) {
        map[name] = { name, ventas: 0, cash: 0, qr: 0, mixto: 0, ganancia: 0 };
      }
      const st = map[name];
      const total = Number(s.total || 0);
      st.ventas += 1;
      if (s.paymentMethod === 'cash') st.cash += total;
      else if (s.paymentMethod === 'qr') st.qr += total;
      else if (s.paymentMethod === 'mixto') st.mixto += total;
      else st.cash += total;
    });
    salesReportRows.forEach((r) => {
      const name = r.sellerName || 'Sin nombre';
      if (map[name]) map[name].ganancia += Number(r.ganancia || 0);
    });
    return Object.values(map)
      .map((st) => ({ ...st, enCaja: st.cash + st.qr + st.mixto, total: st.cash + st.qr + st.mixto }))
      .sort((a, b) => b.enCaja - a.enCaja);
  }, [scopedSalesReport, salesReportRows]);

  const cashierRows = useMemo(() => (
    reportCashier === 'Todos'
      ? salesReportRows
      : salesReportRows.filter((r) => (r.sellerName || 'Sin nombre') === reportCashier)
  ), [salesReportRows, reportCashier]);

  // Auditoría: todos los tickets, sin filtros (el cajero solo ve los suyos).
  const auditTickets = useMemo(() => {
    const list = (!isOwner && user?.uid
      ? salesList.filter((s) => (s.createdBy || s.created_by) === user.uid)
      : salesList.slice()
    ).sort((a, b) => {
      const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return db - da;
    });
    return list.map((s) => {
      const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      const valid = d instanceof Date && !Number.isNaN(d.getTime());
      const day = valid ? d.getDate() : '—';
      const month = valid ? d.toLocaleDateString('es-BO', { month: 'short' }).replace('.', '') : '';
      const year = valid ? d.getFullYear() : '';
      const time = valid ? d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) : '';
      const num = saleNumberById[s.id] || 0;
      return {
        id: s.id,
        raw: s,
        number: `#${String(num).padStart(4, '0')}`,
        seller: s.seller_name || 'Sin nombre',
        dateLabel: `${day} ${month} ${year} · ${time}`.trim(),
        total: Number(s.total || 0),
        sync_status: s.sync_status || 'confirmed',
      };
    });
  }, [salesList, saleNumberById, isOwner, user?.uid]);

  // Tickets (ventas) del cajero seleccionado: uno por venta, no por ítem.
  const cashierTickets = useMemo(() => {
    const list = reportCashier === 'Todos'
      ? scopedSalesReport
      : scopedSalesReport.filter((s) => (s.seller_name || 'Sin nombre') === reportCashier);
    return list.map((s) => ({
      id: s.id,
      number: saleNumberById[s.id] || 0,
      createdAt: s.createdAt,
      total: Number(s.total || 0),
      paymentMethod: s.paymentMethod,
      seller: s.seller_name || 'Sin nombre',
    }));
  }, [scopedSalesReport, reportCashier, saleNumberById]);

  const METHOD_META = {
    cash: { label: 'Efectivo', icon: 'cash', pill: 'bg-[var(--mg-success-bg)] text-[var(--mg-success-text)] border-[var(--mg-success-border)]' },
    qr: { label: 'QR', icon: 'qr', pill: 'bg-[var(--mg-accent-bg)] text-[var(--mg-accent-text)] border-[var(--mg-accent-border)]' },
    mixto: { label: 'Mixto', icon: 'mixto', pill: 'bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)] border-[var(--mg-brand-border)]' },
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
      render: (r) => r.sellerName || <span className="text-[var(--mg-text-faint)]">—</span>,
    },
    {
      key: 'totalVenta', label: 'Total Venta', align: 'right', width: 'w-32',
      render: (r) => <span className="font-black text-[var(--mg-brand-text)] tabular-nums whitespace-nowrap">{formatBs(r.subtotal)}</span>,
    },
    {
      key: 'ganancia', label: 'Ganancia', align: 'right', width: 'w-28',
      render: (r) => <span className="font-bold text-[var(--mg-success-text)] tabular-nums whitespace-nowrap">{formatBs(r.ganancia)}</span>,
    },
  ];

  function renderDetailTable(rows, emptyMessage, footerLabel) {
    // El cajero no ve costos ni ganancias.
    const visibleColumns = canSeeCosts ? detailColumns : detailColumns.filter((c) => c.key !== 'pCompra' && c.key !== 'ganancia');
    const visibleFooter = canSeeCosts
      ? [
          { key: 'cantidad', label: footerLabel, value: rows.reduce((sum, r) => sum + Number(r.baseQty ?? r.quantity ?? 0), 0) },
          { key: 'totalVenta', value: formatBs(rows.reduce((sum, r) => sum + Number(r.subtotal || 0), 0)) },
          { key: 'ganancia', value: formatBs(rows.reduce((sum, r) => sum + Number(r.ganancia || 0), 0)) },
        ]
      : [
          { key: 'cantidad', label: footerLabel, value: rows.reduce((sum, r) => sum + Number(r.baseQty ?? r.quantity ?? 0), 0) },
          { key: 'totalVenta', value: formatBs(rows.reduce((sum, r) => sum + Number(r.subtotal || 0), 0)) },
        ];
    return (
      <DataTable
        storageKey="mg-reporte-ventas-items-columns"
        getRowKey={(r) => r.rowKey}
        emptyMessage={emptyMessage}
        rows={rows}
        footer={visibleFooter}
        columns={visibleColumns}
      />
    );
  }

  // Lista de tickets por cajero: a la izquierda N° + fecha y hora,
  // a la derecha icono de billete con el precio.
  function renderTicketList() {
    const emptyMessage = reportCashier === 'Todos'
      ? 'No se encontraron ventas en el rango de fechas seleccionado.'
      : `Sin ventas de ${reportCashier} en este período.`;
    if (cashierTickets.length === 0) {
      return <EmptyState icon="recibo" title="Sin tickets" description={emptyMessage} />;
    }
    const total = cashierTickets.reduce((sum, t) => sum + t.total, 0);
    return (
      <SectionCard
        title={`Tickets (${cashierTickets.length})`}
        action={<p className="text-xs font-black text-[var(--mg-text-primary)] tabular-nums">Total: {formatBs(total)}</p>}
        bodyClassName="divide-y divide-[var(--mg-separator)]"
      >
          {cashierTickets.map((t) => {
            const d = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
            const valid = d instanceof Date && !Number.isNaN(d.getTime());
            const fecha = valid ? d.toLocaleDateString('es-BO') : '—';
            const hora = valid ? d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) : '';
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-[var(--mg-text-primary)] text-sm tabular-nums">
                    Ticket #{String(t.number).padStart(4, '0')}
                  </p>
                  <p className="text-[11px] text-[var(--mg-text-muted)] font-semibold mt-0.5 truncate">
                    {fecha}{hora ? ` · ${hora}` : ''}{reportCashier === 'Todos' ? ` · ${t.seller}` : ''}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 font-black text-[var(--mg-success-text)] text-sm sm:text-base tabular-nums shrink-0">
                  <AppIcon name="cash" size={20} />
                  {formatBs(t.total)}
                </span>
              </div>
            );
          })}
      </SectionCard>
    );
  }

  function handleExportSales() {
    const labels = { cash: 'Efectivo', qr: 'QR', mixto: 'Mixto' };
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
    // El cajero exporta sin costos ni ganancias (mismas columnas que ve).
    const visibleIdx = columns.map((_, i) => i).filter((i) => canSeeCosts || (i !== 5 && i !== 10));
    exportReportToPDF({
      businessName: settings?.businessName,
      title: reportCashier === 'Todos' ? 'Reporte de Ventas' : `Ventas de ${reportCashier}`,
      subtitle: 'Historial detallado de ventas por producto.',
      periodLabel: `Periodo: ${formattedStart} hasta ${formattedEnd}`,
      columns: visibleIdx.map((i) => columns[i]),
      rows: rows.map((r) => visibleIdx.map((i) => r[i])),
      totals: {
        label: 'Total del período',
        values: Object.fromEntries(
          Object.entries({
            4: cashierRows.reduce((sum, r) => sum + Number(r.baseQty ?? r.quantity ?? 0), 0),
            9: formatBs(cashierRows.reduce((sum, r) => sum + Number(r.subtotal || 0), 0)),
            10: formatBs(cashierRows.reduce((sum, r) => sum + Number(r.ganancia || 0), 0)),
          }).filter(([k]) => visibleIdx.includes(Number(k))).map(([k, v]) => [visibleIdx.indexOf(Number(k)), v])
        ),
      },
    });
  }

  // Fase 2: stock por sede operativa (con backfill local una vez)
  const stockRows = useBranchStocks(businessId, mainBranchId);
  const stockMap = useMemo(() => toStockMap(stockRows), [stockRows]);
  const hasBranchRows = stockRows.length > 0;
  const productsWithStock = useMemo(() => {
    const base = activeBranchId && hasBranchRows
      ? products.map((p) => ({ ...p, stock: Number(stockMap.get(`${activeBranchId}:${p.id}`) ?? 0) }))
      : products;
    // Plato: se vende sin inventario. Tope virtual solo en memoria (nunca se
    // guarda) para que los topes del carrito/escáner no bloqueen el ticket.
    return base.map((p) => (p.isDish ? { ...p, stock: 9999 } : p));
  }, [products, stockMap, activeBranchId, hasBranchRows]);

  const availableProducts = useMemo(() => {
    return productsWithStock.filter((p) => p.stock > 0 && !(p.isDish && p.isAvailable === false));
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
          presId: opt.presId, variant: opt.variant, presentationId: opt.presentationId,
          quantity: line, unitPrice: opt.price, factor: opt.factor,
          presLabel: presShortLabel(product, opt.presId, opt.variant, opt.presentationId),
        };
      }
      if (!line || typeof line.qty !== 'number') return null;
      const product = productsWithStock.find((p) => p.id === line.productId);
      if (!product) return null;
      const factor = Number(line.factor || 1);
      return {
        key, product,
        presId: line.presId || 'unit', variant: line.variant || 'unico',
        presentationId: line.presentationId || null,
        quantity: line.qty,
        unitPrice: Number(line.unitPrice ?? product.price),
        factor,
        presLabel: line.presLabel || presShortLabel(product, line.presId, line.variant, line.presentationId),
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
    if (sellingBlocked) {
      alert(`Estás operando en ${activeBranch?.name || 'un almacén'}: los almacenes no venden. Cambia a una sucursal para cobrar.`);
      return;
    }
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
              presentationId: unitOpt.presentationId,
              qty: q,
              unitPrice: unitOpt.price,
              factor: unitOpt.factor,
              presLabel: presShortLabel(product, unitOpt.presId, unitOpt.variant, unitOpt.presentationId),
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
          presentationId: opt.presentationId,
          qty: current + 1,
          unitPrice: opt.price,
          factor: opt.factor,
          presLabel: presShortLabel(product, opt.presId, opt.variant, opt.presentationId),
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
    if (sellingBlocked) {
      setScanMsg({ ok: false, text: 'Almacén: cambia a una sucursal para vender.' });
      return;
    }
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
            presentationId: opt.presentationId,
            qty: q,
            unitPrice: opt.price,
            factor: opt.factor,
            presLabel: presShortLabel(product, opt.presId, opt.variant, opt.presentationId),
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
    if (sellingBlocked) {
      alert('Los almacenes no venden. Cambia a una sucursal para cobrar.');
      return;
    }

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
      console.error('Error al registrar la venta:', err);
      alert(err?.message || 'Error al registrar la venta. Intenta de nuevo.');
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--mg-brand-border)] border-t-transparent" />
      </div>
    );
  }

  const renderCartContent = (isMobile = false) => {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header del Cart */}
        <div className="shrink-0 border-b border-[var(--mg-separator)] p-4">
          {isMobile && <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-[var(--mg-border-hover)]" />}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]">
                <AppIcon name="carrito" size={17} />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-black tracking-tight text-[var(--mg-brand-text)]">Tu carrito</h3>
                <p className="mt-0.5 text-[11px] font-semibold text-[var(--mg-text-muted)]">
                  {totalBaseUnits} {totalBaseUnits === 1 ? 'unidad' : 'unidades'} · {cartItems.length} {cartItems.length === 1 ? 'línea' : 'líneas'}
                </p>
                {branches.length > 1 && (
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--mg-text-secondary)]">
                    {branches.find((b) => b.id === activeBranchId)?.name || 'Sede'}
                  </p>
                )}
              </div>
            </div>
            {isMobile && (
              <button
                onClick={() => setShowCartModal(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)]"
                aria-label="Cerrar carrito"
              >
                <AppIcon name="cerrar" size={16} />
              </button>
            )}
          </div>
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
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--mg-text-muted)]">Método de pago</p>
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-1">
              {[
                { id: 'cash', label: 'Efectivo', icon: 'cash' },
                { id: 'qr', label: 'QR', icon: 'qr' },
                { id: 'mixto', label: 'Mixto', icon: 'mixto' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id)}
                  className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition-all ${
                    paymentMethod === m.id
                      ? 'bg-[var(--mg-brand)] text-white shadow-sm'
                      : 'text-[var(--mg-text-secondary)] hover:bg-[var(--mg-bg-surface)]'
                  }`}
                >
                  <AppIcon name={m.icon} size={14} color={paymentMethod === m.id ? '#fff' : undefined} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cliente (fuera en restaurante: el ticket va sin cliente) */}
          {!isRestaurantMode && (
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--mg-text-muted)]">
              Cliente
            </p>
            {isCustomClient ? (
              <input
                type="text"
                value={typedClientName}
                onChange={(e) => setTypedClientName(e.target.value)}
                placeholder="Nombre del cliente"
                autoFocus
                className="mg-input py-2.5 text-sm font-medium"
              />
            ) : (
              <select
                value={selectedCustomer?.id || ''}
                onChange={(e) => handleClientSelect(e.target.value)}
                className="mg-input py-2.5 text-sm font-medium"
              >
                <option value="">Sin cliente</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value={CUSTOM_CLIENT_VALUE}>+ Escribir otro...</option>
              </select>
            )}
          </div>
          )}

          {/* Calculadora de cambio para Efectivo */}
          {paymentMethod === 'cash' && (
            <div className="space-y-2 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3.5">
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
                    className="w-full rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] py-2 pl-9 pr-3 text-right text-sm font-bold text-[var(--mg-text-primary)] focus:border-[var(--mg-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--mg-accent-bg)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              {cashReceived !== '' && (
                <div className="flex items-center justify-between pt-2 border-t border-[var(--mg-separator)] text-xs">
                  {Number(cashReceived) < total ? (
                    <span className="flex items-center gap-1 font-bold text-[var(--mg-danger)]">
                      Monto insuficiente
                    </span>
                  ) : (
                    <>
                      <span className="text-[var(--mg-text-muted)] font-medium">Cambio a entregar:</span>
                      <span className="text-sm font-black text-[var(--mg-success-text)]">
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
            <div className="space-y-2.5 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3.5">
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
                    className="w-full rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] py-2 pl-9 pr-3 text-right text-sm font-bold text-[var(--mg-text-primary)] focus:border-[var(--mg-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--mg-accent-bg)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                    className="w-full rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] py-2 pl-9 pr-3 text-right text-sm font-bold text-[var(--mg-text-primary)] focus:border-[var(--mg-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--mg-accent-bg)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              
              <div className="pt-2 border-t border-[var(--mg-separator)] text-xs">
                {Number(mixedCash || 0) + Number(mixedQr || 0) < total ? (
                  <span className="flex items-center gap-1 font-bold text-[var(--mg-danger)]">
                    Falta cubrir {formatBs(total - (Number(mixedCash || 0) + Number(mixedQr || 0)))}
                  </span>
                ) : (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--mg-text-muted)] font-medium">Cambio (en efectivo):</span>
                    <span className="text-sm font-black text-[var(--mg-success-text)]">
                      {formatBs((Number(mixedCash || 0) + Number(mixedQr || 0)) - total)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Acciones principales */}
          <div className="pt-2">
            <div className="rounded-2xl bg-[var(--mg-brand)] p-4 text-white shadow-[var(--mg-shadow-md)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">Total a cobrar</p>
                  <p className="mt-1 text-3xl font-black tracking-tight tabular-nums">{formatBs(total)}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                  <AppIcon name="caja" size={19} color="#fff" />
                </span>
              </div>
              <div className="mt-4 flex gap-2">
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
                  className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-white/15 active:scale-95"
                >
                  Vaciar
                </button>
                <button
                  onClick={handleCheckoutClick}
                  disabled={registering ||
                    (paymentMethod === 'cash' && cashReceived !== '' && Number(cashReceived) < total) ||
                    (paymentMethod === 'mixto' && (Number(mixedCash || 0) + Number(mixedQr || 0)) < total)
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-[var(--mg-brand-deep)] transition-all hover:bg-white/90 active:scale-95 disabled:opacity-60"
                >
                  {registering ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--mg-brand)] border-t-transparent" />
                  ) : (
                    <>
                      <AppIcon name="check" size={16} color="var(--mg-brand-deep)" />
                      Cobrar
                    </>
                  )}
                </button>
              </div>
            </div>
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
            <div className="shrink-0 flex items-center justify-between gap-3 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3.5 shadow-[var(--mg-shadow-sm)]">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-brand)] text-white">
                  <AppIcon name="carrito" size={19} color="#fff" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--mg-text-muted)]">Punto de venta</p>
                  <h2 className="truncate text-lg font-black tracking-tight text-[var(--mg-brand-text)]">Nueva venta</h2>
                  <p className="truncate text-[11px] font-semibold text-[var(--mg-text-secondary)]">
                    {activeBranch?.name ? `${activeBranch.name} · ` : ''}{isRestaurantMode ? 'Busca o toca un plato' : 'Busca, escanea o toca un producto'}
                  </p>
                </div>
              </div>
              {totalBaseUnits > 0 && (
                <span className="shrink-0 rounded-full border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] px-3 py-1.5 text-xs font-black text-[var(--mg-accent-text)] lg:hidden">
                  {totalBaseUnits} en carrito
                </span>
              )}
            </div>
          )}

          {activeTab === 'venta' && sellingBlocked && (
            <div className="shrink-0 space-y-2.5 rounded-2xl border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] p-4">
              <p className="text-sm font-black text-[var(--mg-gold-text)]">
                Estás en {activeBranch?.name || 'un almacén'}: aquí no se vende
              </p>
              <p className="text-xs text-[var(--mg-text-secondary)]">
                Los almacenes custodian y distribuyen. Elige una sucursal para cobrar.
              </p>
              <div className="flex gap-2 flex-wrap">
                {branches.filter((b) => b.type !== 'almacen').map((b) => (
                  <button
                    key={b.id} type="button" onClick={() => selectBranch(b.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-black bg-[var(--mg-accent)] text-white active:scale-95"
                  >
                    Vender en {b.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'reporte' ? (
            <div className="flex-1 min-h-0 overflow-y-auto pb-24 lg:pb-6 space-y-4">
              <ReportHeader
                icon={<AppIcon name="carrito" size={21} />}
                title="Reporte de Ventas"
                subtitle="Historial detallado de tus ventas por producto."
                startDate={reportStartDate}
                endDate={reportEndDate}
                onStartDateChange={setReportStartDate}
                onEndDateChange={setReportEndDate}
                onExport={canExport ? handleExportSales : undefined}
                exportDisabled={salesReportRows.length === 0}
                branchSelector={renderBranchPills()}
              />

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard
                  label="Total vendido"
                  value={formatBs(salesReportRows.reduce((sum, r) => sum + Number(r.subtotal || 0), 0))}
                  hint={`${scopedSalesReport.length} ${scopedSalesReport.length === 1 ? 'ticket' : 'tickets'}`}
                  icon="caja"
                  tone="brand"
                />
                <MetricCard
                  label="Unidades"
                  value={salesReportRows.reduce((sum, r) => sum + Number(r.baseQty ?? r.quantity ?? 0), 0)}
                  hint="Vendidas en el período"
                  icon="paquete"
                  tone="action"
                />
                <MetricCard
                  label="Ticket promedio"
                  value={formatBs(scopedSalesReport.length ? salesReportRows.reduce((sum, r) => sum + Number(r.subtotal || 0), 0) / scopedSalesReport.length : 0)}
                  hint="Por venta"
                  icon="recibo"
                  tone="neutral"
                />
                {canSeeCosts ? (
                  <MetricCard
                    label="Ganancia"
                    value={formatBs(salesReportRows.reduce((sum, r) => sum + Number(r.ganancia || 0), 0))}
                    hint="Ventas menos costo"
                    icon="ranking"
                    tone="success"
                  />
                ) : null}
              </div>

              {renderDetailTable(salesReportRows, 'No se encontraron ventas en el rango de fechas seleccionado.', 'Total del período')}
            </div>
          ) : activeTab === 'cajeros' ? (
            <div className="flex-1 min-h-0 overflow-y-auto pb-24 lg:pb-6 space-y-4">
              <ReportHeader
                icon={<AppIcon name="equipo" size={21} />}
                title="Reporte por Cajero"
                subtitle="Lo que vendió cada vendedor y en qué método de pago."
                startDate={reportStartDate}
                endDate={reportEndDate}
                onStartDateChange={setReportStartDate}
                onEndDateChange={setReportEndDate}
                onExport={handleExportSales}
                exportDisabled={cashierRows.length === 0}
                branchSelector={renderBranchPills()}
              />

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard
                  label="En caja"
                  value={formatBs((reportCashier === 'Todos' ? cashierStats : cashierStats.filter((s) => s.name === reportCashier)).reduce((sum, s) => sum + s.enCaja, 0))}
                  hint="Efectivo + QR + mixto"
                  icon="caja"
                  tone="brand"
                />
                <MetricCard
                  label="Ventas"
                  value={(reportCashier === 'Todos' ? cashierStats : cashierStats.filter((s) => s.name === reportCashier)).reduce((sum, s) => sum + s.ventas, 0)}
                  hint="Tickets del período"
                  icon="recibo"
                  tone="action"
                />
                <MetricCard
                  label="Efectivo"
                  value={formatBs((reportCashier === 'Todos' ? cashierStats : cashierStats.filter((s) => s.name === reportCashier)).reduce((sum, s) => sum + s.cash, 0))}
                  hint="Cobrado en efectivo"
                  icon="cash"
                  tone="success"
                />
                {canSeeCosts ? (
                  <MetricCard
                    label="Ganancia"
                    value={formatBs((reportCashier === 'Todos' ? cashierStats : cashierStats.filter((s) => s.name === reportCashier)).reduce((sum, s) => sum + s.ganancia, 0))}
                    hint="Estimada del período"
                    icon="ranking"
                    tone="warning"
                  />
                ) : null}
              </div>

              <SectionCard
                title="Ventas por cajero"
                subtitle="Toca un cajero para ver su detalle"
                bodyClassName="p-4 space-y-3"
              >
                {/* Filtro de cajeros */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {['Todos', ...sellersInRange].map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setReportCashier(name)}
                      className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                        reportCashier === name
                          ? 'bg-[var(--mg-brand)] text-white shadow-sm'
                          : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] hover:text-[var(--mg-text-secondary)]'
                      }`}
                    >
                      {name === 'Todos' ? 'Todos' : name}
                    </button>
                  ))}
                </div>

                {cashierStats.length === 0 ? (
                  <EmptyState
                    icon="equipo"
                    title="Sin ventas en este período"
                    description="Cambia el rango de fechas o registra una nueva venta."
                    className="border-0 bg-[var(--mg-bg-elevated)] px-4 py-6 shadow-none"
                  />
                ) : reportCashier === 'Todos' ? (
                  /* Resumen comparativo: una fila por cajero */
                  <div className="overflow-x-auto rounded-2xl border border-[var(--mg-border)]">
                    <table className="w-full min-w-[640px] border-collapse bg-[var(--mg-bg-surface)] text-sm">
                      <thead>
                        <tr className="bg-[var(--mg-bg-section)]">
                          {['Cajero', 'Ventas', 'Efectivo', 'QR', 'Mixto', 'En caja', 'Ganancia'].map((h, i) => (
                            <th key={h} className={`whitespace-nowrap p-3 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--mg-text-secondary)] ${i >= 2 ? 'text-right' : 'text-left'}`}>
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
                            className="cursor-pointer border-t border-[var(--mg-separator)] transition-colors hover:bg-[var(--mg-accent-bg-soft)]"
                          >
                            <td className="whitespace-nowrap p-3 font-bold text-[var(--mg-text-primary)]">
                              {st.name}
                            </td>
                            <td className="p-3 text-left">
                              <span className="inline-block rounded-full bg-[var(--mg-bg-elevated)] px-2.5 py-0.5 text-xs font-black">
                                {st.ventas}
                              </span>
                            </td>
                            <td className="p-3 text-right font-semibold text-[var(--mg-success-text)]">{formatBs(st.cash)}</td>
                            <td className="p-3 text-right font-semibold text-[var(--mg-accent-text)]">{formatBs(st.qr)}</td>
                            <td className="p-3 text-right font-semibold text-[var(--mg-brand-text)]">{formatBs(st.mixto)}</td>
                            <td className="p-3 text-right font-black text-[var(--mg-brand-text)]">{formatBs(st.enCaja)}</td>
                            <td className="p-3 text-right font-bold text-[var(--mg-success-text)]">{formatBs(st.ganancia)}</td>
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
                          <div className="rounded-2xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] p-3 text-center">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">En caja</p>
                            <p className="text-lg font-black text-[var(--mg-brand-text)]">{formatBs(st.enCaja)}</p>
                          </div>
                          <div className="rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3 text-center">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Ventas</p>
                            <p className="text-lg font-black text-[var(--mg-text-primary)]">{st.ventas}</p>
                          </div>
                          <div className="rounded-2xl border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] p-3 text-center">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Ganancia</p>
                            <p className="text-lg font-black text-[var(--mg-success-text)]">{formatBs(st.ganancia)}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {[
                            { icon: 'cash', label: 'Efectivo', value: st.cash, cls: 'text-[var(--mg-success-text)] bg-[var(--mg-success-bg)] border-[var(--mg-success-border)]' },
                            { icon: 'qr', label: 'QR', value: st.qr, cls: 'text-[var(--mg-accent-text)] bg-[var(--mg-accent-bg)] border-[var(--mg-accent-border)]' },
                            { icon: 'mixto', label: 'Mixto', value: st.mixto, cls: 'text-[var(--mg-brand-text)] bg-[var(--mg-brand-bg)] border-[var(--mg-brand-border)]' },
                          ].map((m) => (
                            <div key={m.label} className={`rounded-2xl border p-2.5 text-center ${m.cls}`}>
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
              </SectionCard>

              {renderTicketList()}
            </div>
          ) : activeTab === 'auditoria' ? (
            <div className="flex-1 min-h-0 overflow-y-auto pb-24 lg:pb-6">
              <AuditSalesList
                sales={auditTickets}
                businessName={business?.name || ''}
                onSelectSale={(t) => navigate(`/recibo/${t.raw.id}`, {
                  state: { saleNumber: saleNumberById[t.raw.id] },
                })}
              />
            </div>
          ) : (
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
                placeholder={isRestaurantMode ? 'Buscar plato o producto...' : 'Buscar producto, marca o código...'}
                className="mg-input min-h-[52px] pl-11 text-base"
              />
            </div>
            {!isRestaurantMode && (
              <button
                type="button"
                onClick={openScanner}
                title="Escanear código de barras"
                aria-label="Escanear código de barras"
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-[var(--mg-brand)] text-white shadow-[var(--mg-shadow-md)] transition-all hover:bg-[var(--mg-brand-hover)] active:scale-90"
              >
                <AppIcon name="scan" size={23} color="#fff" />
              </button>
            )}
          </div>

          <div className="flex shrink-0 gap-2 overflow-x-auto px-0 pb-1 scrollbar-none">
            {['Todas', RECENT_CATEGORY, ...categories].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${
                  filterCategory === cat
                    ? 'border-[var(--mg-brand)] bg-[var(--mg-brand)] text-white shadow-sm'
                    : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-text-secondary)] hover:border-[var(--mg-border-hover)]'
                }`}
              >
                {cat === 'Todas'
                  ? (isRestaurantMode ? 'Todo el menú' : 'Todas')
                  : cat === RECENT_CATEGORY
                    ? (isRestaurantMode ? 'Más pedidos' : cat)
                    : cat}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pb-24 lg:pb-6">
            {filtered.length > 0 ? (
              <div className="flex flex-col gap-2 sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-3 p-1 mg-stagger">
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
                  const priceLabel = hasPack && packOpt
                    ? `${formatBs(product.price)} · ${formatBs(packOpt.price)}`
                    : formatBs(product.price);
                  const actionArea = inCart > 0 ? (
                    <div
                      className="flex items-center gap-1 rounded-full bg-[var(--mg-brand)] px-1 py-1 shadow-md"
                      onClick={(e) => e.stopPropagation()}
                    >
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
                    <RowAddButton onAdd={() => handleProductTap(product)} disabled={maxed} />
                  );
                  return (
                    <Fragment key={product.id}>
                      {/* Lista para celular */}
                      <div className="sm:hidden">
                        <ProductListRow
                          product={product}
                          subtitle={product.unitLabel || 'Unidad'}
                          priceLabel={priceLabel}
                          meta={<StockLabel stock={product.stock} minStock={product.minStock} isDish={product.isDish} />}
                          selected={usedBase > 0}
                          disabled={maxed}
                          onSelect={() => handleProductTap(product)}
                          actionArea={actionArea}
                        />
                      </div>
                      {/* Tarjetas para desktop */}
                      <div className="hidden sm:block">
                        <ProductCatalogCard
                          product={product}
                          priceLabel={priceLabel}
                          metaLabel={<StockLabel stock={product.stock} minStock={product.minStock} isDish={product.isDish} />}
                          selected={usedBase > 0}
                          disabled={maxed}
                          onSelect={() => handleProductTap(product)}
                          actionArea={
                            inCart > 0 ? actionArea : (
                              <button
                                type="button"
                                onClick={() => handleProductTap(product)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--mg-brand)] text-base font-black leading-none text-white shadow-sm active:scale-90"
                              >
                                +
                              </button>
                            )
                          }
                        />
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon="paquete"
                title={search
                  ? 'No encontramos ese producto'
                  : filterCategory === RECENT_CATEGORY
                    ? 'Todavía no hay ventas recientes'
                    : 'Sin productos disponibles'}
                description={!search && filterCategory !== RECENT_CATEGORY ? 'Ve a Inventario para agregar tu primer producto.' : 'Prueba con otra búsqueda o cambia de categoría.'}
              />
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
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                icon="carrito"
                title="Tu carrito está vacío"
                description={isRestaurantMode ? 'Toca un plato para agregarlo o busca por nombre.' : 'Toca un producto para agregarlo. Puedes escanear su código o buscar por nombre.'}
                className="w-full border-0 bg-transparent px-2 py-0"
              />
            </div>
          )}
        </aside>
      )}

      {/* Botón flotante para ver carrito (FAB - Sólo Mobile y pestaña venta) */}
      {activeTab === 'venta' && totalBaseUnits > 0 && !showCartModal && (
        <button
          onClick={() => setShowCartModal(true)}
          className="fixed bottom-20 right-4 z-40 flex items-center gap-3 rounded-2xl bg-[var(--mg-brand)] px-5 py-3.5 font-bold text-white shadow-2xl transition-all hover:bg-[var(--mg-brand-hover)] active:scale-95 lg:hidden"
        >
          <div className="relative flex items-center">
            <AppIcon name="carrito" size={20} color="#fff" />
            <span className="absolute -right-2.5 -top-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-[var(--mg-brand-deep)] shadow-md">
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
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)]">
                <svg className="h-9 w-9 text-[var(--mg-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" className="mg-draw-check" />
                </svg>
              </div>
            </div>

            <h3 className="text-lg font-black text-[var(--mg-text-primary)]">¡Cobro Exitoso!</h3>
            <p className="my-2 text-3xl font-black text-[var(--mg-success-text)]">{formatBs(showSuccessModal.total)}</p>

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
                  {showSuccessModal.paymentMethod === 'qr' ? 'QR' :
                   showSuccessModal.paymentMethod === 'cash' ? 'Efectivo' : 'Mixto'}
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
                    <span className="font-bold text-[var(--mg-success-text)]">{formatBs(showSuccessModal.cambio)}</span>
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
                    <span className="font-bold text-[var(--mg-success-text)]">{formatBs(showSuccessModal.cambio)}</span>
                  </div>
                </>
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
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] py-2.5 text-xs font-bold text-[var(--mg-brand-text)] shadow-sm transition-all hover:bg-[var(--mg-border-hover)] active:scale-95"
              >
                <AppIcon name="recibo" size={14} /> Imprimir recibo

                              </button>
              <button
                type="button"
                onClick={closeSuccessModal}
                className="w-full rounded-xl bg-[var(--mg-brand)] py-3 text-xs font-bold text-white shadow-md transition-all hover:bg-[var(--mg-brand-hover)] active:scale-95"
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
              type="button"
              onClick={() => setShowQrConfirmModal(false)}
              aria-label="Cerrar confirmación de pago"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] transition-colors hover:text-[var(--mg-text-primary)]"
            >
              <AppIcon name="cerrar" size={15} />
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
                  <span className="font-black text-[var(--mg-success-text)]">
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

            <div className="mb-5 flex items-start gap-2 rounded-2xl border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] p-3.5 text-left text-xs font-semibold leading-relaxed text-[var(--mg-gold-text)]">
              <span className="shrink-0"><AppIcon name="reloj" size={15} /></span>
              <span>Verifica que el cliente haya realizado el pago antes de confirmar.</span>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowQrConfirmModal(false)}
                className="flex-1 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] py-3.5 text-xs font-bold text-[var(--mg-text-secondary)] transition-all hover:bg-[var(--mg-bg-section)] active:scale-95"
              >
                Cancelar pago
              </button>
              <button
                type="button"
                onClick={() => handleRegister(true)}
                disabled={registering}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[var(--mg-brand)] py-3.5 text-xs font-bold text-white shadow-md transition-all hover:bg-[var(--mg-brand-hover)] active:scale-95"
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
          cartBaseUsed={productUsedBase(pickerProduct.id)}
          onPick={(opt) => addToCart(pickerProduct, opt)}
          onClose={() => setPickerProduct(null)}
          onGoCart={() => { setPickerProduct(null); setShowCartModal(true); }}
          cartTotalItems={totalBaseUnits}
        />
      )}

      {/* MODAL ESCÁNER DE CÓDIGOS */}
      {showScanner && (
        <div
          className="fixed inset-0 z-[90] flex flex-col bg-black"
          style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-black">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--mg-separator)] p-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]">
                  <AppIcon name="scan" size={17} />
                </span>
                <div>
                  <h3 className="font-black text-[var(--mg-text-primary)]">Búsqueda por escáner</h3>
                  <p className="text-[11px] font-semibold text-[var(--mg-text-muted)]">Apunta al código de barras del producto</p>
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
              <BarcodeScanner fullScreen onScan={handleBarcodeScan} message={scanMsg}>
                <div className="max-h-[18vh] shrink-0 overflow-y-auto rounded-xl bg-[var(--mg-bg-surface)] p-3">
                  <p className="mb-2 text-sm font-black text-[var(--mg-text-primary)]">Últimos escaneados</p>
                  {recentScans.length === 0 ? (
                    <p className="rounded-xl bg-[var(--mg-bg-elevated)] px-3 py-3 text-center text-xs text-[var(--mg-text-muted)]">
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
                          <div key={`${id}`} className="flex items-center gap-3 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-2.5">
                            {p.imageData ? (
                              <img src={p.imageData} alt={p.name} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                            ) : (
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-bg-elevated)]">
                                <AppIcon name="paquete" size={20} />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-[var(--mg-text-primary)]">{p.name}</p>
                              <p className="text-[11px] text-[var(--mg-text-muted)]">{formatBs(p.price)} c/u</p>
                            </div>
                            <span className="shrink-0 rounded-full border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-2.5 py-1 text-xs font-black text-[var(--mg-gold-text)]">
                              x {qty}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </BarcodeScanner>
            </div>

            <div className="flex shrink-0 gap-2 border-t border-[var(--mg-separator)] p-4">
              <button
                type="button"
                onClick={() => setShowScanner(false)}
                className="flex-1 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] py-3 text-sm font-bold text-[var(--mg-text-secondary)] transition-all hover:bg-[var(--mg-bg-section)] active:scale-95"
              >
                Seguir buscando
              </button>
              <button
                type="button"
                onClick={() => { setShowScanner(false); setShowCartModal(true); }}
                disabled={totalBaseUnits === 0}
                className="flex-1 rounded-2xl bg-[var(--mg-brand)] py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-[var(--mg-brand-hover)] active:scale-95 disabled:opacity-50"
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
