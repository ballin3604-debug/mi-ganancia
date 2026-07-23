import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { getProducts } from '../services/products';
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

function CartItemRow({ product, quantity, onUpdate }) {
  const [val, setVal] = useState(quantity);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setVal(quantity);
  }, [quantity]);

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

    if (num > product.stock) {
      setErrorMsg(`Solo hay ${product.stock} disponibles`);
      num = product.stock;
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

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <ProductImage
        imageData={product.imageData}
        name={product.name}
        className="w-10 h-10 rounded-xl shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--mg-text-primary)] font-semibold truncate leading-tight">{product.name}</p>
        <p className="text-xs text-[var(--mg-text-faint)] mt-0.5">{formatBs(product.price)} c/u</p>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max={product.stock}
            value={val}
            onChange={handleChange}
            onBlur={(e) => handleApply(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-16 text-center font-bold text-sm bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-border)] rounded-xl py-1 px-2 focus:outline-none focus:border-[var(--mg-accent-border)] text-[var(--mg-text-primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            style={{ width: '4.5rem' }}
          />
          <span className="text-[var(--mg-text-primary)] font-bold text-sm w-20 text-right">
            {formatBs(product.price * quantity)}
          </span>
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

export default function Sales() {
  const { businessId, user, sellerName } = useAuth();
  const { business, settings } = useBusiness();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'reporte' ? 'reporte' : 'venta';
  const [salesList, setSalesList] = useState([]);
  const [saleItemsList, setSaleItemsList] = useState([]);
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return toLocalISODate(d);
  });
  const [reportEndDate, setReportEndDate] = useState(() => toLocalISODate(new Date()));
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
  const [restoreNotice, setRestoreNotice] = useState('');

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

        let adjusted = false;
        const restoredCart = {};
        Object.entries(draft.cart || {}).forEach(([productId, qty]) => {
          const prod = prods.find((p) => p.id === productId);
          if (!prod || prod.stock <= 0) { adjusted = true; return; }
          const clamped = Math.min(qty, prod.stock);
          if (clamped !== qty) adjusted = true;
          restoredCart[productId] = clamped;
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

        const hadDraftItems = Object.keys(draft.cart || {}).length > 0;
        const hasRestoredItems = Object.keys(restoredCart).length > 0;
        if (hasRestoredItems) {
          setRestoreNotice(adjusted
            ? 'Recuperamos tu venta en curso — ajustamos algunas cantidades por falta de stock.'
            : 'Recuperamos tu venta en curso.');
        } else if (hadDraftItems) {
          setRestoreNotice('Tu venta en curso ya no está disponible — los productos cambiaron de stock.');
        }
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
    if (!restoreNotice) return;
    const t = setTimeout(() => setRestoreNotice(''), 5000);
    return () => clearTimeout(t);
  }, [restoreNotice]);

  useEffect(() => {
    if (!businessId) return;
    const unsub = subscribeToSales(businessId, setSalesList);
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

  const salesReportRows = useMemo(() => filteredSalesReport.flatMap((s) =>
    (itemsBySaleId[s.id] || []).map((item) => {
      const unitCost = Number(item.supplier_price || 0);
      const ganancia = Number(item.subtotal || 0) - unitCost * Number(item.quantity || 0);
      return {
        rowKey: item.id,
        createdAt: s.createdAt,
        saleNumber: saleNumberById[s.id],
        productName: item.productName,
        category: item.category || 'Otros',
        quantity: item.quantity,
        supplierPrice: unitCost,
        price: Number(item.price || 0),
        subtotal: Number(item.subtotal || 0),
        ganancia,
        paymentMethod: s.paymentMethod,
        sellerName: s.seller_name,
      };
    })
  ), [filteredSalesReport, itemsBySaleId, saleNumberById]);

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
    const rows = salesReportRows.map((r) => {
      const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
      return [
        d.toLocaleDateString('es-BO'),
        `#${String(r.saleNumber).padStart(4, '0')}`,
        r.productName,
        r.category,
        r.quantity,
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
      title: 'Reporte de Ventas',
      subtitle: 'Historial detallado de ventas por producto.',
      periodLabel: `Periodo: ${formattedStart} hasta ${formattedEnd}`,
      columns,
      rows,
      totals: {
        label: 'Total del período',
        values: {
          4: salesReportRows.reduce((sum, r) => sum + Number(r.quantity || 0), 0),
          9: formatBs(salesReportRows.reduce((sum, r) => sum + Number(r.subtotal || 0), 0)),
          10: formatBs(salesReportRows.reduce((sum, r) => sum + Number(r.ganancia || 0), 0)),
        },
      },
    });
  }

  const availableProducts = products.filter((p) => p.stock > 0);
  const filtered = availableProducts
    .filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand || '').toLowerCase().includes(search.toLowerCase())
    )
    .filter((p) => filterCategory === 'Todas' || p.category === filterCategory);

  const cartItems = Object.entries(cart)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === id), quantity: qty }))
    .filter((item) => item.product);

  const total = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  function addToCart(product) {
    setCart((prev) => {
      const current = prev[product.id] || 0;
      if (current >= product.stock) return prev;
      return { ...prev, [product.id]: current + 1 };
    });
  }

  function removeFromCart(productId) {
    setCart((prev) => {
      const current = prev[productId] || 0;
      if (current <= 1) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: current - 1 };
    });
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
        const productSummary = cartItems.map(item => `${item.product.name} (x${item.quantity})`).join(', ');
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
        itemCount: totalItems,
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
      items: showSuccessModal.items,
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
            <h3 className="text-lg font-bold text-[var(--mg-text-primary)]">Tu Carrito ({totalItems})</h3>
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
          {cartItems.map(({ product, quantity }) => (
            <CartItemRow
              key={product.id}
              product={product}
              quantity={quantity}
              onUpdate={(newQty) => {
                setCart((prev) => {
                  if (newQty <= 0) {
                    const { [product.id]: _, ...rest } = prev;
                    return rest;
                  }
                  return { ...prev, [product.id]: newQty };
                });
              }}
            />
          ))}
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
      {restoreNotice && (
        <div className="fixed top-0 inset-x-0 z-50 flex justify-center px-4 pt-2 pointer-events-none">
          <div className="bg-[var(--mg-accent)] text-white rounded-2xl px-4 py-3 shadow-lg max-w-md w-full text-sm font-semibold text-center pointer-events-auto">
            🛒 {restoreNotice}
          </div>
        </div>
      )}
      {/* Columna Izquierda: Listado y Búsqueda de Productos */}
      <div className="flex-1 flex flex-col min-h-0 lg:pl-0 lg:pr-4">

        <div className="p-4 space-y-3 flex-1 flex flex-col min-h-0">
          {activeTab === 'venta' && (
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold text-[var(--mg-text-primary)]">Nueva Venta</h2>
              {totalItems > 0 && (
                <span className="bg-[var(--mg-accent)] text-white text-xs font-black px-3 py-1.5 rounded-full lg:hidden">
                  {totalItems} en carrito
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

              <DataTable
                storageKey="mg-reporte-ventas-items-columns"
                getRowKey={(r) => r.rowKey}
                emptyMessage="No se encontraron ventas en el rango de fechas seleccionado."
                rows={salesReportRows}
                footer={[
                  { key: 'cantidad', label: 'Total del período', value: salesReportRows.reduce((sum, r) => sum + Number(r.quantity || 0), 0) },
                  { key: 'totalVenta', value: formatBs(salesReportRows.reduce((sum, r) => sum + Number(r.subtotal || 0), 0)) },
                  { key: 'ganancia', value: formatBs(salesReportRows.reduce((sum, r) => sum + Number(r.ganancia || 0), 0)) },
                ]}
                columns={[
                  {
                    key: 'fecha', label: 'Fecha', align: 'left', width: 'w-28',
                    render: (r) => {
                      const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
                      return <span className="font-mono text-xs">{d.toLocaleDateString('es-BO')}</span>;
                    },
                  },
                  {
                    key: 'numeroVenta', label: 'N° Venta', align: 'left', width: 'w-24',
                    render: (r) => <span className="font-mono text-xs font-bold">{`#${String(r.saleNumber).padStart(4, '0')}`}</span>,
                  },
                  {
                    key: 'producto', label: 'Producto', align: 'left',
                    render: (r) => r.productName,
                  },
                  {
                    key: 'categoria', label: 'Categoría', align: 'left', width: 'w-32',
                    render: (r) => r.category,
                  },
                  {
                    key: 'cantidad', label: 'Cantidad', align: 'right', width: 'w-20',
                    render: (r) => r.quantity,
                  },
                  {
                    key: 'pCompra', label: 'P. Compra', align: 'right', width: 'w-28',
                    render: (r) => formatBs(r.supplierPrice),
                  },
                  {
                    key: 'pVenta', label: 'P. Venta', align: 'right', width: 'w-28',
                    render: (r) => formatBs(r.price),
                  },
                  {
                    key: 'metodoPago', label: 'Método de pago', align: 'center', width: 'w-36',
                    render: (r) => {
                      const labels = { cash: 'Efectivo', qr: 'QR', mixto: 'Mixto', fiado: 'Fiado', tarjeta: 'Tarjeta' };
                      return (
                        <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-full">
                          {labels[r.paymentMethod] || r.paymentMethod}
                        </span>
                      );
                    },
                  },
                  {
                    key: 'vendedor', label: 'Vendedor', align: 'left', width: 'w-32',
                    render: (r) => r.sellerName || <span className="text-gray-300">—</span>,
                  },
                  {
                    key: 'totalVenta', label: 'Total Venta', align: 'right', width: 'w-32',
                    render: (r) => <span className="font-black text-[#1670C2]">{formatBs(r.subtotal)}</span>,
                  },
                  {
                    key: 'ganancia', label: 'Ganancia', align: 'right', width: 'w-28',
                    render: (r) => <span className="font-bold text-green-600">{formatBs(r.ganancia)}</span>,
                  },
                ]}
              />
            </div>
          ) : (
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

          {/* Filtro por Categorías */}
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
            {filtered.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
                {filtered.map((product) => {
                  const inCart = cart[product.id] || 0;
                  const maxed = inCart >= product.stock;
                  return (
                    <ProductCatalogCard
                      key={product.id}
                      product={product}
                      priceLabel={formatBs(product.price)}
                      metaLabel={<StockLabel stock={product.stock} minStock={product.minStock} />}
                      selected={inCart > 0}
                      disabled={maxed}
                      onSelect={() => addToCart(product)}
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
                            onClick={() => addToCart(product)}
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
                <p className="font-semibold">{search ? 'No encontrado' : 'Sin productos disponibles'}</p>
                {!search && <p className="text-sm mt-1">Ve a Inventario para agregar</p>}
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
              <span className="text-5xl mb-3">🛒</span>
              <p className="font-semibold text-sm">Tu carrito está vacío</p>
              <p className="text-xs text-center mt-1">Haz clic en los productos para agregarlos al carrito</p>
            </div>
          )}
        </aside>
      )}

      {/* Botón flotante para ver carrito (FAB - Sólo Mobile) */}
      {totalItems > 0 && !showCartModal && (
        <button
          onClick={() => setShowCartModal(true)}
          className="lg:hidden fixed bottom-20 right-4 bg-[var(--mg-accent)] text-white font-bold py-3.5 px-5 rounded-full shadow-2xl flex items-center gap-3 transition-all z-40 active:scale-95 hover:bg-[var(--mg-accent-hover)]"
          style={{ boxShadow: '0 8px 30px rgba(0, 122, 255, 0.45)' }}
        >
          <div className="relative">
            <span className="text-xl">🛒</span>
            <span className="absolute -top-2.5 -right-2.5 bg-white text-[var(--mg-accent)] text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md">
              {totalItems}
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 cursor-pointer"
          onClick={closeSuccessModal}
        >
          <div
            className="bg-[var(--mg-bg-surface)] rounded-3xl p-6 w-full max-w-xs text-center shadow-2xl relative cursor-default animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <style>{`
              @keyframes drawCheck {
                to { stroke-dashoffset: 0; }
              }
              @keyframes scaleUp {
                from { transform: scale(0.85); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
              }
              .animate-draw-check {
                stroke-dasharray: 50;
                stroke-dashoffset: 50;
                animation: drawCheck 0.4s ease-out forwards 0.2s;
              }
              .animate-modal-in {
                animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
              }
            `}</style>
            
            {/* Check Icon animado */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center border-2 border-green-200">
                <svg className="w-9 h-9 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" className="animate-draw-check" />
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
                🖨️ Imprimir recibo
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
    </div>
  );
}
