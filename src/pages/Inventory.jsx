import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  subscribeToProducts,
  subscribeToReplenishments,
  updateReplenishmentExpiry,
} from '../services/products';
import {
  getCategories,
  getDefaultCategories,
  subscribeToCategories,
  addCategory,
  removeCategory,
  renameCategory,
} from '../services/categories';
import { useImageUpload } from '../hooks/useImageUpload';
import { ConfirmModal } from '../components/settings/ConfirmModal';
import { clampNumberInput, blockInvalidNumberKeys } from '../utils/numberInput';

// Inventory Subcomponents
import { formatBs } from '../utils/currency';
import { InventoryCatalogItem } from '../components/inventory/InventoryCatalogItem';
import ProductListRow from '../components/ProductListRow';
import { StockLabel } from '../components/ProductCatalogCard';
import { ProductDetailModal } from '../components/inventory/ProductDetailModal';
import { ProductGridSkeleton } from '../components/inventory/ProductGridSkeleton';
import { InventoryHeader } from '../components/inventory/InventoryHeader';
import BarcodeScanner from '../components/BarcodeScanner';
import { AppIcon } from '../components/icons';
import PhotoCamera from '../components/PhotoCamera';
import { useBranches } from '../context/BranchContext';
import { useBranchStocks } from '../hooks/useBranchStocks';
import { toStockMap, setBranchStock } from '../services/branchStock';
import { ensureBasePresentation, getSellOptions, validatePresentationDefinitions } from '../utils/presentations';

const EMPTY_FORM = {
  name: '',
  barcode: '',
  unitLabel: '',
  sellPack: false,
  packLabel: '',
  packPrice: '',
  packPriceHot: '',
  price: '',
  stock: '',
  minStock: '5',
  brand: '',
  category: 'Otros',
  description: '',
  imageData: '',
  supplierPrice: '',
  unit: 'Unidad',
  packageSize: '',
  isDish: false,
  isAvailable: true,
  presentations: [],
};

const EXPIRY_WARNING_DAYS = 30;
const RECENT_PURCHASE_DAYS = 14;

function getNearestExpiry(replenishments, productId) {
  const candidates = replenishments
    .filter((r) => r.productId === productId && r.expiryDate)
    .map((r) => ({ id: r.id, date: new Date(`${r.expiryDate}T00:00:00`) }));
  if (candidates.length === 0) return null;
  return candidates.reduce((min, c) => (c.date < min.date ? c : min));
}

const CATEGORY_COLORS = [
  'border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent-text)]',
  'border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]',
  'border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]',
  'border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]',
  'border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent-text)]',
  'border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]',
  'border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]',
  'border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]',
];

function getCatColor(categories, catName) {
  const idx = categories.indexOf(catName);
  if (idx === -1) return CATEGORY_COLORS[0];
  return CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
}

// ── Borrador del formulario (recuperación ante recargas) ─────────────────
// En celulares, abrir la cámara puede hacer que el sistema mate la página;
// al volver, todo el estado de React se pierde y el formulario se cierra con
// los datos ya escritos. Guardamos el formulario en localStorage en cada
// cambio para reabrirlo intacto tras una recarga.
const PRODUCT_DRAFT_KEY = 'mg-product-form-draft';

function loadProductDraft() {
  try {
    const raw = localStorage.getItem(PRODUCT_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.open !== true || !d.form) return null;
    return d;
  } catch {
    return null;
  }
}

function clearProductDraft() {
  try { localStorage.removeItem(PRODUCT_DRAFT_KEY); } catch { /* ignore */ }
}

export default function Inventory() {
  const { businessId, hasPermission } = useAuth();
  const { sectorConfig, tipoNegocio } = useBusiness();
  const { pickImage } = useImageUpload();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Data states
  const [products, setProducts] = useState([]);
  const [replenishments, setReplenishments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todas');
  const [filterExpiry, setFilterExpiry] = useState(() => { // 'todos' | 'porVencer' | 'vencidos'
    const f = searchParams.get('filtro');
    return f === 'vencidos' || f === 'porVencer' ? f : 'todos';
  });
  const [filterRecent, setFilterRecent] = useState(false);
  const [filterLowStock, setFilterLowStock] = useState(false);
  // Fase 2: vista por sede ('all' = totales). El formulario edita la sede vista
  // (o la principal si se ven todas).
  const { branches, activeBranchId } = useBranches();
  const [invBranch, setInvBranch] = useState(() => activeBranchId || 'all');
  // Panel de filtros colapsable en celular (en PC siempre visible).
  const [showFilters, setShowFilters] = useState(false);
  // Restaurante: sin vencimiento, sin código de barras, sin compras.
  const isRestaurantMode = !!sectorConfig?.features?.dishes;
  // El dueño puede ocultar existencias y alertas de stock desde Ajustes.
  const showStock = sectorConfig?.features?.stock !== false;
  const activeFilterCount =
    (filterCategory !== 'Todas' ? 1 : 0) +
    (filterExpiry !== 'todos' ? 1 : 0) +
    (filterRecent ? 1 : 0) +
    (showStock && filterLowStock ? 1 : 0);
  function clearAllFilters() {
    setFilterCategory('Todas');
    setFilterExpiry('todos');
    setFilterRecent(false);
    setFilterLowStock(false);
  }
  const mainBranchId = branches.find((b) => b.isMain)?.id || branches[0]?.id || null;
  const showExpiryFilters = !isRestaurantMode;
  const showBarcode = !isRestaurantMode;
  const stockRows = useBranchStocks(businessId, mainBranchId);
  const stockMap = useMemo(() => toStockMap(stockRows), [stockRows]);
  const hasBranchRows = stockRows.length > 0;
  const targetBranchId = invBranch === 'all' ? mainBranchId : invBranch;
  const viewProducts = useMemo(() => (
    hasBranchRows && invBranch !== 'all'
      ? products.map((p) => ({ ...p, stock: Number(stockMap.get(`${invBranch}:${p.id}`) ?? 0) }))
      : products
  ), [products, stockMap, invBranch, hasBranchRows]);

  useEffect(() => {
    if (!showStock) setFilterLowStock(false);
  }, [showStock]);

  // Selection / Modal states
  const [selectedDetailProduct, setSelectedDetailProduct] = useState(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Add/Edit Product form state (si la página se recargó al volver de la
  // cámara, el borrador guardado reabre el formulario con los datos intactos)
  const [showForm, setShowForm] = useState(() => searchParams.get('action') === 'nuevo' || !!loadProductDraft());
  const [packHelp, setPackHelp] = useState(false);
  const [practical, setPractical] = useState(() => searchParams.get('guia') === '1');
  const [stockMode, setStockMode] = useState('directo');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(() => loadProductDraft()?.form || EMPTY_FORM);
  const [expiryDate, setExpiryDate] = useState(() => loadProductDraft()?.expiryDate || '');
  const [expiryReplenishmentId, setExpiryReplenishmentId] = useState(null);
  const [saving, setSaving] = useState(false);
  const editingRestoredRef = useRef(false);

  useEffect(() => {
    if (!showForm || !sectorConfig?.features?.configurablePresentations) return;
    setForm((current) => ensureBasePresentation(current, sectorConfig.defaultUnit));
  }, [showForm, sectorConfig?.features?.configurablePresentations, sectorConfig?.defaultUnit]);

  // Category Manager modal state
  const [showCatManager, setShowCatManager] = useState(() => searchParams.get('action') === 'categorias');
  const [newCatName, setNewCatName] = useState('');
  const [savingCat, setSavingCat] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [editCatValue, setEditCatValue] = useState('');
  const [savingRename, setSavingRename] = useState(false);

  // Escáner de códigos: 'search' busca el producto, 'assign' llena el campo del formulario
  const [scannerMode, setScannerMode] = useState(null); // null | 'search' | 'assign'
  const [scanMsg, setScanMsg] = useState('');
  function openScanner(mode) {
    if (!hasPermission('scanner')) return;
    setScanMsg('');
    setScannerMode(mode);
  }
  // Cámara interna (no sale del formulario, la foto nunca se pierde)
  const [showCamera, setShowCamera] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!businessId) return;
    const [prods, cats] = await Promise.all([
      getProducts(businessId),
      getCategories(businessId),
    ]);
    setProducts(prods);
    setCategories(cats);
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Productos en vivo: ventas, compras u otros cambios (misma app u otro
  // dispositivo sincronizado) se reflejan sin recargar ni re-guardar.
  useEffect(() => {
    if (!businessId) return;
    const unsub = subscribeToProducts(businessId, (prods) => {
      setProducts(prods);
    });
    return unsub;
  }, [businessId]);

  // Guardar borrador en cada cambio mientras el formulario está abierto.
  // Así, si el sistema mata la página al abrir la cámara, al volver se restaura.
  useEffect(() => {
    if (!showForm) return;
    try {
      localStorage.setItem(PRODUCT_DRAFT_KEY, JSON.stringify({
        open: true,
        businessId: businessId || null,
        form,
        editingId: editingProduct?.id || null,
        expiryDate,
      }));
    } catch { /* cuota llena: el formulario sigue funcionando en memoria */ }
  }, [showForm, form, editingProduct, expiryDate, businessId]);

  // Al montar: si hay borrador de otro negocio (dispositivo compartido), descartarlo.
  // La restauración es silenciosa: el formulario simplemente vuelve intacto.
  useEffect(() => {
    if (!businessId) return;
    try {
      const raw = localStorage.getItem(PRODUCT_DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.businessId && d.businessId !== businessId) {
        clearProductDraft();
        setShowForm(false);
        setForm(EMPTY_FORM);
        setExpiryDate('');
      }
    } catch { /* ignore */ }
  }, [businessId]);

  // Tras recargar, reconectar el producto en edición (para no duplicarlo al guardar)
  useEffect(() => {
    if (loading || editingRestoredRef.current || products.length === 0) return;
    editingRestoredRef.current = true;
    const draft = loadProductDraft();
    if (draft?.editingId && showForm && !editingProduct) {
      const p = products.find((x) => x.id === draft.editingId);
      if (p) setEditingProduct(p);
    }
  }, [loading, products, showForm, editingProduct]);

  useEffect(() => {
    if (!businessId) return;
    const unsub = subscribeToCategories(businessId, setCategories);
    return unsub;
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    const unsub = subscribeToReplenishments(businessId, setReplenishments);
    return unsub;
  }, [businessId]);

  // Auto-open edit modal when coming from Dashboard navigation
  // (no pisa un borrador en curso: el borrador tiene prioridad)
  useEffect(() => {
    const product = location.state?.editProduct;
    if (product && !loading && !loadProductDraft()) {
      openEdit(product);
      window.history.replaceState({}, '');
    }
  }, [location.state, loading]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addPresentation() {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `presentation-${Date.now()}-${form.presentations.length}`;
    setForm((current) => ({
      ...current,
      presentations: [...(current.presentations || []), {
        id,
        name: '',
        factor: '',
        price: '',
        isBase: false,
      }],
    }));
  }

  function updatePresentation(id, patch) {
    setForm((current) => ({
      ...current,
      presentations: (current.presentations || []).map((presentation) => (
        presentation.id === id ? { ...presentation, ...patch } : presentation
      )),
    }));
  }

  function removePresentation(id) {
    setForm((current) => ({
      ...current,
      presentations: (current.presentations || []).filter((presentation) => presentation.id !== id),
    }));
  }

  async function handleImagePick(e) {
    const file = e.target.files?.[0];
    // Limpiar el input de inmediato: si la página se recarga al volver de la
    // cámara, el evento ya no existirá después del await.
    try { e.target.value = ''; } catch { /* ignore */ }
    if (!file) return;
    try {
      const data = await pickImage(file);
      if (data) setField('imageData', data);
    } catch (err) {
      console.error('Error al procesar imagen:', err);
      alert('No se pudo leer la imagen. Prueba con otra foto.');
    }
  }

  // Plato (restaurante): sin marca, sin vencimiento, sin paquete. Lleva stock
  // como cualquier producto: cada venta descuenta porciones.
  // El ticket dice "Plato" porque vive en unit_label.
  function toggleDish(value) {
    setStockMode('directo');
    setForm((f) => {
      if (value) {
        return {
          ...f,
          isDish: true,
          supplierPrice: '',
          sellPack: false,
          packLabel: '',
          packPrice: '',
          packPriceHot: '',
          packageSize: '',
          barcode: '',
          brand: '',
          unitLabel: f.unitLabel || sectorConfig?.defaultUnit || 'Plato',
        };
      }
      return {
        ...f,
        isDish: false,
        isAvailable: true,
        minStock: f.minStock === '0' ? '5' : f.minStock,
      };
    });
  }

  function openAdd(prefill = {}, forcePractical = false) {
    setEditingProduct(null);
    setPractical(forcePractical || products.length === 0 || searchParams.get('guia') === '1');
    setStockMode('directo');
    setShowAdvanced(false);
    setCelebrate(false);
    const nextForm = { ...EMPTY_FORM, ...prefill };
    if (sectorConfig?.features?.configurablePresentations) {
      nextForm.unitLabel = nextForm.unitLabel || sectorConfig.defaultUnit || 'Unidad';
      nextForm.presentations = [{
        id: 'base-unit',
        name: nextForm.unitLabel || 'Unidad',
        factor: 1,
        price: nextForm.price || '',
        isBase: true,
      }];
    }
    setForm(nextForm);
    setExpiryDate('');
    setExpiryReplenishmentId(null);
    setShowForm(true);
  }

  // Resultado del escáner: en modo 'assign' llena el formulario,
  // en modo 'search' busca el producto y lo abre.
  function handleScan(code) {
    const c = String(code || '').trim();
    if (!c) return;
    if (scannerMode === 'assign') {
      setField('barcode', c);
      setScannerMode(null);
      return;
    }
    const found = products.find((p) => String(p.barcode || '').trim().toLowerCase() === c.toLowerCase());
    if (found) {
      setScanMsg('');
      setScannerMode(null);
      setSelectedDetailProduct(found);
    } else {
      setScanMsg(`Código ${c} no registrado. Créalo con "Nuevo Producto".`);
      // Pre-llenar el código para crear rápido
      setForm((f) => ({ ...f, barcode: c }));
    }
  }

  function openEdit(product) {
    setEditingProduct(product);
    setPractical(false);
    setStockMode('directo');
    setShowAdvanced(true);
    setCelebrate(false);
    const hasPack = Number(product.packageSize || 0) > 1 && product.packPrice !== '' && product.packPrice !== null && product.packPrice !== undefined;
    setForm({
      name: product.name,
      barcode: product.isDish ? '' : (product.barcode || ''),
      unitLabel: product.unitLabel || (sectorConfig?.features?.configurablePresentations ? sectorConfig.defaultUnit : '') || '',
      sellPack: !!hasPack,
      packLabel: product.packLabel || '',
      packPrice: product.packPrice !== '' && product.packPrice !== null && product.packPrice !== undefined ? String(product.packPrice) : '',
      packPriceHot: product.packPriceHot !== '' && product.packPriceHot !== null && product.packPriceHot !== undefined ? String(product.packPriceHot) : '',
      price: String(product.price),
      stock: String(product.stock),
      minStock: String(product.minStock || 5),
      brand: product.brand || '',
      category: product.category || 'Otros',
      description: product.description || '',
      imageData: product.imageData || '',
      supplierPrice: product.supplierPrice ? String(product.supplierPrice) : '',
      unit: product.unit || 'Unidad',
      packageSize: product.packageSize ? String(product.packageSize) : '',
      isDish: !!product.isDish,
      isAvailable: product.isAvailable !== false,
      presentations: Array.isArray(product.presentations) && product.presentations.length > 0
        ? product.presentations.map((presentation) => ({ ...presentation }))
        : getSellOptions(product).map((option, index) => ({
          id: option.presentationId || (option.presId === 'unit' ? 'base-unit' : `legacy-${option.variant || index}`),
          name: option.label + (option.variant === 'frio' ? ' fría' : option.variant === 'caliente' ? ' caliente' : ''),
          factor: option.factor,
          price: option.price,
          isBase: option.presId === 'unit',
        })),
    });

    const nearest = getNearestExpiry(replenishments, product.id);
    if (nearest) {
      const y = nearest.date.getFullYear();
      const m = String(nearest.date.getMonth() + 1).padStart(2, '0');
      const d = String(nearest.date.getDate()).padStart(2, '0');
      setExpiryDate(`${y}-${m}-${d}`);
      setExpiryReplenishmentId(nearest.id);
    } else {
      setExpiryDate('');
      setExpiryReplenishmentId(null);
    }
    setShowForm(true);
  }

  function closeForm() {
    clearProductDraft();
    setShowForm(false);
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setExpiryDate('');
    setExpiryReplenishmentId(null);
    setShowAdvanced(false);
    setCelebrate(false);
    if (searchParams.get('guia')) {
      navigate('/inventario', { replace: true });
    }
  }

  async function handleSave(e, options = {}) {
    const { another = false } = options;
    if (e?.preventDefault) e.preventDefault();
    if (!form.name.trim() || !form.price || form.stock === '') return;
    if (!form.isDish && practical && stockMode === 'compra' && (!form.supplierPrice || Number(form.supplierPrice) <= 0)) {
      alert('Dinos cuánto te costó cada unidad: así tu ganancia se calcula sola.');
      return;
    }
    if (!form.isDish && !sectorConfig?.features?.configurablePresentations && form.sellPack && (Number(form.packageSize || 0) < 2 || !form.packPrice)) {
      alert('Para vender por paquete poné cuántas unidades trae y su precio.');
      return;
    }
    let data;
    if (form.isDish) {
      data = {
        ...form,
        barcode: '',
        brand: '',
        supplierPrice: '',
        packLabel: '',
        packPrice: '',
        packPriceHot: '',
        packageSize: '',
        isAvailable: form.isAvailable !== false,
      };
      delete data.presentations;
    } else if (sectorConfig?.features?.configurablePresentations) {
      try {
        const presentations = validatePresentationDefinitions(form.presentations, {
          baseName: form.unitLabel || 'Unidad',
          basePrice: form.price,
        });
        data = {
          ...form,
          unitLabel: presentations.find((presentation) => presentation.isBase)?.name || 'Unidad',
          presentations,
          packLabel: '',
          packPrice: '',
          packPriceHot: '',
          packageSize: '',
        };
      } catch (err) {
        alert(err.message || 'Revisa las presentaciones del producto.');
        return;
      }
    } else {
      data = form.sellPack
        ? { ...form }
        : { ...form, packLabel: '', packPrice: '', packPriceHot: '', packageSize: '' };
      delete data.presentations;
    }
    delete data.sellPack;
    const formStockVal = data.stock;
    const eraCatalogoVacio = products.length === 0;
    delete data.stock;
    setSaving(true);
    try {
      if (editingProduct) {
        const globalCur = Number(products.find((p) => p.id === editingProduct.id)?.stock || 0);
        if (targetBranchId) {
          // El stock vive en la sede: global nuevo = global actual + (nuevo − anterior de sede).
          // Se calcula ANTES de escribir, porque el UPDATE_PRODUCT encolaba el valor
          // viejo y al sincronizar pisaba al nuevo en el servidor (el pull lo "revertía").
          const oldBranch = Number(stockMap.get(`${targetBranchId}:${editingProduct.id}`) ?? globalCur);
          const newGlobal = Math.max(0, globalCur + (Number(formStockVal) - oldBranch));
          await setBranchStock(businessId, editingProduct, targetBranchId, Number(formStockVal));
          // Otros campos + stock neutro (expectedStock = stock → no mueve el global local,
          // pero la operación lleva el valor ya correcto al servidor).
          await updateProduct(editingProduct.id, { ...data, stock: newGlobal, expectedStock: newGlobal });
        } else {
          await updateProduct(editingProduct.id, { ...data, stock: Number(formStockVal), expectedStock: globalCur });
        }
      } else if (targetBranchId) {
        const created = await addProduct(businessId, { ...data, stock: Number(formStockVal) });
        await setBranchStock(businessId, { ...created, stock: Number(formStockVal) }, targetBranchId, Number(formStockVal));
      } else {
        await addProduct(businessId, { ...data, stock: Number(formStockVal) });
      }
      if (expiryReplenishmentId) {
        await updateReplenishmentExpiry(expiryReplenishmentId, expiryDate);
      }
      await fetchAll();
      if (another) {
        openAdd({}, true);
      } else {
        closeForm();
      }
      if (!another && !editingProduct && (eraCatalogoVacio || searchParams.get('guia') === '1')) {
        setCelebrate(true);
      }
    } catch (err) {
      console.error(err);
      alert(err?.message || 'Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!confirmDeleteProduct) return;
    setDeleting(true);
    try {
      await deleteProduct(confirmDeleteProduct.id);
      await fetchAll();
      setConfirmDeleteProduct(null);
      if (selectedDetailProduct?.id === confirmDeleteProduct.id) {
        setSelectedDetailProduct(null);
      }
    } catch (err) {
      console.error(err);
      alert('Error al eliminar producto.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddCategory(e) {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;
    if (categories.some((c) => c.toLowerCase() === name.toLowerCase())) {
      alert(`La categoría "${name}" ya existe.`);
      return;
    }
    setSavingCat(true);
    try {
      await addCategory(businessId, name);
      await fetchAll();
      setNewCatName('');
      // Si el formulario está abierto, seleccionar la categoría recién creada
      if (showForm) setField('category', name);
    } catch (err) {
      console.error('Error al agregar categoría:', err);
      alert(`No se pudo agregar la categoría.\n\n${err?.message || err}`);
    } finally {
      setSavingCat(false);
    }
  }

  async function handleAddSuggestedCategory(name) {
    if (!name || savingCat) return;
    if (categories.some((c) => c.toLowerCase() === name.toLowerCase())) return;
    setSavingCat(true);
    try {
      await addCategory(businessId, name);
      await fetchAll();
      if (showForm) setField('category', name);
    } catch (err) {
      console.error('Error al agregar categoría sugerida:', err);
      alert(`No se pudo agregar la categoría.\n\n${err?.message || err}`);
    } finally {
      setSavingCat(false);
    }
  }

  async function handleRemoveCategory(cat) {
    if (!window.confirm(`¿Eliminar categoría "${cat}"?`)) return;
    try {
      await removeCategory(businessId, cat);
      await fetchAll();
      if (filterCategory === cat) setFilterCategory('Todas');
      // Si el formulario usaba esa categoría, volver a 'Otros'
      if (showForm) {
        setForm((f) => (f.category === cat ? { ...f, category: 'Otros' } : f));
      }
    } catch (err) {
      console.error('Error al eliminar categoría:', err);
      alert(`No se pudo eliminar la categoría.\n\n${err?.message || err}`);
    }
  }

  function startEditCategory(cat) {
    setEditingCat(cat);
    setEditCatValue(cat);
  }

  function cancelEditCategory() {
    setEditingCat(null);
    setEditCatValue('');
  }

  async function handleRenameCategory(e) {
    e.preventDefault();
    const oldName = editingCat;
    const newName = editCatValue.trim();
    if (!oldName || !newName || newName === oldName) {
      cancelEditCategory();
      return;
    }
    setSavingRename(true);
    try {
      const affected = await renameCategory(businessId, oldName, newName);
      await fetchAll();
      if (filterCategory === oldName) setFilterCategory(newName);
      // Si el formulario usaba ese nombre, actualizarlo también
      if (showForm) {
        setForm((f) => (f.category === oldName ? { ...f, category: newName } : f));
      }
      cancelEditCategory();
      if (affected > 0) {
        console.log(`Categoría renombrada. ${affected} producto(s) reasignado(s).`);
      }
    } catch (err) {
      console.error('Error al renombrar categoría:', err);
      alert(`No se pudo renombrar la categoría.\n\n${err?.message || err}`);
    } finally {
      setSavingRename(false);
    }
  }

  const allCategories = useMemo(() => ['Todas', ...categories], [categories]);

  const categorySuggestions = useMemo(() => {
    const existing = new Set(categories.map((c) => c.toLowerCase()));
    return getDefaultCategories(tipoNegocio).filter(
      (c) => c !== 'Otros' && !existing.has(c.toLowerCase())
    );
  }, [categories, tipoNegocio]);

  // Product counts per category for the header pill badges
  const categoryCounts = useMemo(() => {
    const counts = { Todas: products.length };
    products.forEach((p) => {
      const cat = p.category || 'Otros';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [products]);

  // Mapa producto → vencimiento más próximo en UNA sola pasada.
  // (Antes se filtraba todo el historial por cada producto: O(P×R). Con
  // cientos de productos y miles de compras eso congelaba la pantalla.)
  const productExpiry = useMemo(() => {
    const nearest = {};
    for (const r of replenishments) {
      if (!r.productId || !r.expiryDate) continue;
      const date = new Date(`${r.expiryDate}T00:00:00`);
      if (Number.isNaN(date.getTime())) continue;
      const cur = nearest[r.productId];
      if (!cur || date < cur.date) nearest[r.productId] = { id: r.id, date };
    }
    const map = {};
    for (const p of products) map[p.id] = nearest[p.id] || null;
    return map;
  }, [products, replenishments]);

  // Expiry counts for quick filter buttons
  const expiryCounts = useMemo(() => {
    let porVencer = 0;
    let vencidos = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    products.forEach((p) => {
      const exp = productExpiry[p.id];
      if (!exp) return;
      const daysLeft = Math.ceil((exp.date - today) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) {
        vencidos += 1;
      } else if (daysLeft <= EXPIRY_WARNING_DAYS) {
        porVencer += 1;
      }
    });

    return { porVencer, vencidos };
  }, [products, productExpiry]);

  const recentlyPurchasedIds = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RECENT_PURCHASE_DAYS);
    const ids = new Set();
    replenishments.forEach((r) => {
      const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
      if (d >= cutoff) ids.add(r.productId);
    });
    return ids;
  }, [replenishments]);

  // Paginación de la grilla: renderizar cientos de tarjetas con foto de una
  // sola vez es lo que más frena el celular. Se muestran 48 y el resto carga
  // al bajar (scroll infinito) o con el botón.
  const PAGE_SIZE = 48;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef(null);

  // Al cambiar búsqueda/filtros/sede se vuelve al inicio de la lista
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, filterCategory, filterExpiry, filterRecent, filterLowStock, invBranch]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return viewProducts
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.brand || '').toLowerCase().includes(q) ||
          (p.barcode || '').toLowerCase().includes(q)
      )
      .filter((p) => filterCategory === 'Todas' || p.category === filterCategory)
      .filter((p) => {
        if (filterExpiry === 'todos' || !showExpiryFilters) return true;
        const exp = productExpiry[p.id];
        if (!exp) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysLeft = Math.ceil((exp.date - today) / (1000 * 60 * 60 * 24));
        if (filterExpiry === 'vencidos') return daysLeft < 0;
        return daysLeft >= 0 && daysLeft <= EXPIRY_WARNING_DAYS;
      })
      .filter((p) => !filterRecent || recentlyPurchasedIds.has(p.id))
      .filter((p) => !filterLowStock || !showStock || (Number(p.stock) || 0) <= (Number(p.minStock) || 5));
  }, [viewProducts, search, filterCategory, filterExpiry, filterRecent, filterLowStock, productExpiry, recentlyPurchasedIds, showExpiryFilters, showStock]);

  const lowStockCount = useMemo(() => (
    showStock
      ? viewProducts.filter((p) => (Number(p.stock) || 0) <= (Number(p.minStock) || 5)).length
      : 0
  ), [viewProducts, showStock]);

  const visibleProducts = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  // Scroll infinito: al llegar al final de la grilla se cargan más
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || visibleCount >= filtered.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
        }
      },
      { rootMargin: '600px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleCount, filtered.length]);

  async function handleQuickUpdateStock(product, newStock) {
    try {
      if (hasBranchRows && targetBranchId) {
        // Ajuste en la sede objetivo (el total se recalcula por delta)
        await setBranchStock(businessId, product, targetBranchId, newStock);
      } else {
        // updateProduct reescribe la fila completa (nombre, precio, marca, foto…),
        // así que hay que mandarle el producto entero y no solo el stock.
        // expectedStock hace que el cambio se aplique como diferencia sobre el
        // valor actual, para no pisar una venta hecha en otro dispositivo.
        await updateProduct(product.id, {
          ...product,
          stock: newStock,
          expectedStock: product.stock,
        });
      }
      await fetchAll();
      setSelectedDetailProduct((prev) => (prev && prev.id === product.id ? { ...prev, stock: newStock } : prev));
    } catch (err) {
      console.error('Error al actualizar stock:', err);
      alert('No se pudo actualizar el stock.');
    }
  }

  async function handleToggleAvailability(product) {
    if (!product?.isDish) return;
    const next = product.isAvailable === false;
    try {
      await updateProduct(product.id, {
        ...product,
        isAvailable: next,
        expectedStock: product.stock,
      });
      await fetchAll();
      setSelectedDetailProduct((prev) => (prev && prev.id === product.id ? { ...prev, isAvailable: next } : prev));
    } catch (err) {
      console.error('Error al cambiar disponibilidad:', err);
      alert('No se pudo cambiar la disponibilidad del plato.');
    }
  }

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 pb-28 mg-fade-in w-full mx-auto space-y-5 max-w-7xl">
      {/* Top Header & Search Controls */}
      <InventoryHeader
        totalProducts={products.length}
        search={search}
        onSearchChange={setSearch}
        categories={allCategories}
        selectedCategory={filterCategory}
        onCategoryChange={setFilterCategory}
        categoryCounts={categoryCounts}
        filterExpiry={filterExpiry}
        onExpiryFilterChange={setFilterExpiry}
        filterRecent={filterRecent}
        onRecentFilterToggle={() => setFilterRecent(!filterRecent)}
        filterLowStock={filterLowStock}
        onLowStockFilterToggle={() => setFilterLowStock(!filterLowStock)}
        lowStockCount={lowStockCount}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((v) => !v)}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearAllFilters}
        onOpenAddProduct={() => openAdd()}
        onOpenCatManager={() => setShowCatManager(true)}
        onOpenScanner={showBarcode ? () => openScanner('search') : undefined}
        searchPlaceholder={isRestaurantMode ? 'Buscar plato o producto...' : undefined}
        allLabel={isRestaurantMode ? 'Todo el menú' : undefined}
        showRecentFilter={!isRestaurantMode}
        showStock={showStock}
        expiryCounts={expiryCounts}
        showExpiryFilters={showExpiryFilters}
        branches={branches}
        invBranch={invBranch}
        onBranchChange={setInvBranch}
      />

      {/* Acceso al reporte de inventario (valorización y kardex): no aplica
          a restaurante, donde los platos no tienen stock que valorizar. */}
      {!isRestaurantMode && showStock && (
      <button
        type="button"
        onClick={() => navigate('/reportes?type=inventory')}
        className="group w-full flex items-center gap-3 bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-2xl px-4 py-3 shadow-[var(--mg-shadow-sm)] hover:border-[var(--mg-brand-border)] hover:shadow-[var(--mg-shadow-md)] active:scale-[0.99] transition-all text-left"
      >
        <span className="w-11 h-11 rounded-2xl bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)] border border-[var(--mg-brand-border)] flex items-center justify-center shrink-0">
          <AppIcon name="reportes" size={20} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-black text-[var(--mg-text-primary)]">Reporte de inventario</span>
          <span className="block text-[11px] text-[var(--mg-text-muted)] font-semibold truncate">Valorización, stock y kardex por producto</span>
        </span>
        <span className="text-lg font-black text-[var(--mg-brand-text)] shrink-0 transition-transform group-hover:translate-x-0.5">›</span>
      </button>
      )}

      {/* Catalog Grid View */}
      {loading ? (
        <ProductGridSkeleton count={12} />
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-14 bg-[var(--mg-bg-surface)] rounded-[26px] border border-[var(--mg-border)] shadow-xs p-8 max-w-lg mx-auto"
        >
          <div className="w-16 h-16 rounded-3xl bg-[var(--mg-brand-bg)] border border-[var(--mg-brand-border)] flex items-center justify-center mx-auto mb-3 shadow-[var(--mg-shadow-sm)] text-[var(--mg-brand-text)]">
            <AppIcon name="paquete" size={30} />
          </div>
          <p className="font-black text-[var(--mg-text-primary)] text-base">No hay productos que coincidan</p>
          <p className="text-xs text-[var(--mg-text-muted)] mt-1 max-w-xs mx-auto font-medium">
            {search
              ? 'Intenta borrar la búsqueda o seleccionar otra categoría.'
              : showStock
                ? 'Añade tu primer producto y empieza a vender. Lo esencial: nombre, precio y stock.'
                : 'Añade tu primer producto y empieza a vender. Lo esencial: nombre y precio.'}
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={() => openAdd()}
            className="mt-4 bg-[var(--mg-brand)] hover:bg-[var(--mg-brand-hover)] text-[var(--mg-brand-contrast)] font-extrabold px-4 py-2.5 rounded-2xl text-xs shadow-[var(--mg-shadow-md)] transition-all inline-flex items-center gap-1.5"
          >
            <AppIcon name="agregar" size={14} />
            <span>Nuevo Producto</span>
          </motion.button>
        </motion.div>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-3 mg-stagger">
            {visibleProducts.map((prod) => {
              const packSize = Number(prod.packageSize || 0);
              const hasPack = packSize > 1 && prod.packPrice !== '' && prod.packPrice !== null && prod.packPrice !== undefined && Number(prod.packPrice) > 0;
              return (
                <Fragment key={prod.id}>
                  {/* Lista para celular */}
                  <div className="sm:hidden">
                    <ProductListRow
                      product={prod}
                      subtitle={prod.unitLabel || 'Unidad'}
                      priceLabel={formatBs(Number(prod.price || 0))}
                      meta={
                        <span className="flex items-center gap-1.5 flex-wrap mt-1">
                          {showStock && <StockLabel stock={prod.stock} minStock={prod.minStock} isDish={prod.isDish} isAvailable={prod.isAvailable} />}
                          {hasPack && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-black bg-[var(--mg-accent-bg)] text-[var(--mg-accent-text)] border-[var(--mg-accent-border)]">
                              📦 {(prod.packLabel || 'Paquete').trim() || 'Paquete'} x{packSize}
                            </span>
                          )}
                        </span>
                      }
                      onSelect={() => setSelectedDetailProduct(prod)}
                      actionArea={
                        <span className="text-xl font-black text-[var(--mg-text-faint)] pr-1">›</span>
                      }
                    />
                  </div>
                  {/* Tarjetas para desktop */}
                  <div className="hidden sm:block">
                    <InventoryCatalogItem
                      product={prod}
                      nearestExpiry={productExpiry[prod.id]}
                      categoryColor={getCatColor(categories, prod.category)}
                      onSelect={(p) => setSelectedDetailProduct(p)}
                    />
                  </div>
                </Fragment>
              );
            })}
          </div>
          {/* Sentinela del scroll infinito + botón manual */}
          <div ref={loadMoreRef} />
          {visibleCount < filtered.length ? (
            <div className="flex flex-col items-center gap-2 pt-2">
              <p className="text-xs text-[var(--mg-text-muted)] font-semibold">
                Mostrando {visibleProducts.length} de {filtered.length}
              </p>
              <button
                type="button"
                onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length))}
                className="bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] text-[var(--mg-text-secondary)] font-bold px-6 py-2.5 rounded-2xl text-xs active:scale-95 shadow-sm"
              >
                Mostrar más ({filtered.length - visibleCount} restantes)
              </button>
            </div>
          ) : (
            filtered.length > PAGE_SIZE && (
              <p className="text-center text-xs text-[var(--mg-text-faint)] font-semibold pt-2">
                Mostrando los {filtered.length} productos
              </p>
            )
          )}
        </>
      )}

      {/* FAB Nuevo Producto (solo celular, en lugar del ?) */}
      <button
        type="button"
        onClick={() => openAdd()}
        title="Nuevo Producto"
        aria-label="Nuevo Producto"
        className="md:hidden fixed bottom-24 right-4 z-30 w-14 h-14 rounded-2xl bg-[var(--mg-brand)] hover:bg-[var(--mg-brand-hover)] text-[var(--mg-brand-contrast)] shadow-[var(--mg-shadow-lg)] flex items-center justify-center active:scale-90 transition-all"
      >
        <AppIcon name="agregar" size={26} />
      </button>

      {/* === MODAL: Ficha Completa de Producto (Bottom Sheet / Modal) === */}
      <ProductDetailModal
        product={selectedDetailProduct}
        nearestExpiry={selectedDetailProduct ? productExpiry[selectedDetailProduct.id] : null}
        categoryColor={selectedDetailProduct ? getCatColor(categories, selectedDetailProduct.category) : ''}
        isOpen={Boolean(selectedDetailProduct)}
        onClose={() => setSelectedDetailProduct(null)}
        onEdit={(p) => openEdit(p)}
        onDelete={(p) => setConfirmDeleteProduct(p)}
        onQuickUpdateStock={handleQuickUpdateStock}
        onToggleAvailability={handleToggleAvailability}
        branches={branches}
        stockRows={stockRows}
        businessId={businessId}
      />

      {/* === MODAL: Confirmar Eliminación === */}
      <ConfirmModal
        isOpen={Boolean(confirmDeleteProduct)}
        onClose={() => setConfirmDeleteProduct(null)}
        onConfirm={confirmDelete}
        title="¿Eliminar producto?"
        message={confirmDeleteProduct ? `Se eliminará "${confirmDeleteProduct.name}" de tu inventario.` : ''}
        confirmText="Eliminar"
        danger
        loading={deleting}
      />

      {/* === MODAL: Cámara interna (la foto se guarda sin salir del formulario) === */}
      <AnimatePresence>
        {showCamera && (
          <div
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs mg-backdrop-in"
            onClick={() => setShowCamera(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--mg-bg-surface)] w-full max-w-md rounded-t-[28px] sm:rounded-[28px] border border-[var(--mg-border)] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
            >
              <div className="p-4 border-b border-[var(--mg-separator)] flex items-center justify-between bg-[var(--mg-bg-elevated)]">
                <div>
                  <h3 className="font-extrabold text-[var(--mg-text-primary)] text-sm">
                    📷 Foto del producto
                  </h3>
                  <p className="text-[11px] text-[var(--mg-text-muted)]">
                    Encuadra y toca “Tomar foto”
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCamera(false)}
                  className="w-8 h-8 rounded-full bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] flex items-center justify-center font-bold text-base text-[var(--mg-text-muted)]"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 overflow-y-auto">
                <PhotoCamera
                  onCapture={(dataUrl) => {
                    setField('imageData', dataUrl);
                    setShowCamera(false);
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* === MODAL: Escáner de código de barras === */}
      <AnimatePresence>
        {scannerMode && (
          <div
            className="fixed inset-0 z-[70] flex flex-col bg-black mg-backdrop-in"
            style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-black"
            >
              <div className="p-4 border-b border-[var(--mg-separator)] flex items-center justify-between bg-[var(--mg-bg-elevated)]">
                <div>
                  <h3 className="font-extrabold text-[var(--mg-text-primary)] text-sm flex items-center gap-1.5">
                    <AppIcon name="scan" size={14} />
                    {scannerMode === 'assign' ? 'Escanear código para el producto' : 'Buscar por escáner'}
                  </h3>
                  <p className="text-[11px] text-[var(--mg-text-muted)]">
                    {scannerMode === 'assign' ? 'El código se pondrá en el formulario' : 'Apunta al código de barras'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setScannerMode(null); setScanMsg(''); }}
                  className="w-8 h-8 rounded-full bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] flex items-center justify-center font-bold text-base text-[var(--mg-text-muted)]"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-4">
                <BarcodeScanner fullScreen onScan={handleScan} message={scanMsg}>
                  {scanMsg && scannerMode === 'search' && (
                    <button
                      type="button"
                      onClick={() => { setScannerMode(null); setScanMsg(''); openAdd(); }}
                      className="w-full shrink-0 rounded-2xl bg-[var(--mg-brand)] py-3 text-sm font-bold text-[var(--mg-brand-contrast)] shadow-[var(--mg-shadow-md)] active:scale-95"
                    >
                      + Crear producto con este código
                    </button>
                  )}
                </BarcodeScanner>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* === MODAL: Nuevo / Editar Producto === */}
      <AnimatePresence>
        {showForm && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs mg-backdrop-in"
            onClick={closeForm}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--mg-bg-surface)] w-full max-w-md rounded-t-[28px] sm:rounded-[28px] border border-[var(--mg-border)] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
            >
              <div className="p-4 border-b border-[var(--mg-separator)] flex items-center justify-between bg-[var(--mg-bg-elevated)]">
                <h3 className="font-extrabold text-[var(--mg-text-primary)] text-sm flex items-center gap-1.5">
                  {editingProduct ? <><AppIcon name="editar" size={14} /> Editar Producto</> : <><AppIcon name="nuevoProducto" size={14} /> Nuevo Producto</>}
                </h3>
                <button
                  type="button"
                  onClick={closeForm}
                  className="w-8 h-8 rounded-full bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] flex items-center justify-center font-bold text-base text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)] transition-all active:scale-95"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4">
                {practical && !editingProduct && (
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full rounded-xl border border-dashed border-[var(--mg-border-hover)] py-2 text-[11px] font-extrabold text-[var(--mg-text-secondary)] hover:text-[var(--mg-text-primary)] transition-all active:scale-[0.98]"
                  >
                    {showAdvanced ? '▲ Ocultar detalles' : (isRestaurantMode ? '+ Más detalles (foto, marca…)' : '+ Más detalles (foto, código de barras, marca…)')}
                  </button>
                )}
                {(!practical || showAdvanced) && (
                <div>
                  <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-2">
                    Foto del Producto
                  </label>
                  <div className="flex items-center gap-3">
                    {form.imageData ? (
                      <img
                        src={form.imageData}
                        alt="Preview"
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-[var(--mg-accent-border)] shrink-0 shadow-xs"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-[var(--mg-bg-elevated)] flex items-center justify-center shrink-0 border-2 border-dashed border-[var(--mg-border)]">
                        <AppIcon name="camara" size={28} />
                      </div>
                    )}

                    <div className="flex flex-col gap-2 flex-1">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setShowCamera(true)}
                          className="bg-[var(--mg-accent-bg)] border border-[var(--mg-accent-border)] text-[var(--mg-accent-text)] font-extrabold py-2 rounded-xl text-xs active:scale-95 flex flex-col items-center gap-0.5 cursor-pointer select-none transition-all"
                        >
                          <AppIcon name="camara" size={14} />
                          <span>Cámara</span>
                        </button>

                        <label className="relative bg-[var(--mg-accent)] text-white font-extrabold py-2 rounded-xl text-xs active:scale-95 flex flex-col items-center gap-0.5 cursor-pointer select-none overflow-hidden transition-all shadow-xs">
                          <AppIcon name="galeria" size={14} color="#fff" />
                          <span>Galería</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImagePick}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </label>
                      </div>

                      {form.imageData && (
                        <button
                          type="button"
                          onClick={() => setField('imageData', '')}
                          className="w-full rounded-xl border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] py-1.5 text-[11px] font-bold text-[var(--mg-danger)] transition-all active:scale-95"
                        >
                          Quitar foto
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                )}

                {/* Nombre */}
                <div>
                  <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
                    Nombre del producto *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder={form.isDish ? 'Ej: Milanesa napolitana' : 'Ej: Coca-Cola 2L'}
                    className="mg-input font-bold text-sm"
                    required
                    autoFocus
                    maxLength={80}
                  />
                </div>

                {/* Plato o producto con stock (restaurante) */}
                {sectorConfig?.features?.dishes && (
                  <div>
                    <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
                      ¿Qué vas a vender?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        aria-pressed={!!form.isDish}
                        onClick={() => toggleDish(true)}
                        className={`rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.99] ${form.isDish ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)]' : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)]'}`}
                      >
                        <span className="block text-sm font-extrabold text-[var(--mg-text-primary)]">🍽️ Plato</span>
                        <span className="block text-[11px] font-semibold text-[var(--mg-text-secondary)]">Se cocina al momento: no lleva stock.</span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={!form.isDish}
                        onClick={() => toggleDish(false)}
                        className={`rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.99] ${!form.isDish ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)]' : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)]'}`}
                      >
                        <span className="block text-sm font-extrabold text-[var(--mg-text-primary)]">📦 Producto</span>
                        <span className="block text-[11px] font-semibold text-[var(--mg-text-secondary)]">Se cuenta y descuenta del inventario.</span>
                      </button>
                    </div>
                  </div>
                )}

                {form.isDish && (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-[var(--mg-text-primary)]">Disponible para vender</p>
                      <p className="text-[11px] font-semibold text-[var(--mg-text-muted)] leading-snug">
                        {form.isAvailable === false
                          ? 'Pausado: no aparece en Ventas hasta reactivarlo.'
                          : Number(form.stock) <= 0
                            ? 'Sin porciones: cargá stock para poder venderlo.'
                            : 'Se puede pedir en Ventas ahora mismo.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.isAvailable !== false}
                      aria-label="Disponible para vender"
                      onClick={() => setField('isAvailable', form.isAvailable === false)}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors active:scale-95 ${
                        form.isAvailable !== false ? 'bg-[var(--mg-success)]' : 'bg-[var(--mg-border-hover)]'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-all ${
                          form.isAvailable !== false ? 'left-[22px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                )}

                {(!practical || showAdvanced) && !form.isDish && showBarcode && (
                <div>
                  <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
                    Código de barras (opcional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.barcode}
                      onChange={(e) => setField('barcode', e.target.value)}
                      placeholder="Ej: 7771234567890"
                      inputMode="numeric"
                      className="mg-input font-mono text-xs flex-1 min-w-0"
                      maxLength={40}
                    />
                    <button
                      type="button"
                      onClick={() => openScanner('assign')}
                      title="Escanear código"
                      className="w-[46px] shrink-0 rounded-xl bg-[var(--mg-brand)] hover:bg-[var(--mg-brand-hover)] text-[var(--mg-brand-contrast)] flex items-center justify-center active:scale-95"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h2v14H3zM7 5h1v14H7zM10 5h3v14h-3zM15 5h1v14h-1zM18 5h3v14h-3z" />
                      </svg>
                    </button>
                  </div>
                </div>
                )}

                {(!practical || showAdvanced) && !form.isDish && (
                <div>
                  <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={(e) => setField('brand', e.target.value)}
                    placeholder="Ej: Coca-Cola, Pil, Fino..."
                    className="mg-input text-xs font-semibold"
                    maxLength={60}
                  />
                </div>
                )}

                {/* Categoría */}
                {(!practical || showAdvanced) && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider">
                      Categoría
                    </label>
                    <button
                      type="button"
                      // Abre el gestor ENCIMA del formulario sin cerrarlo:
                      // los datos ya escritos se conservan.
                      onClick={() => setShowCatManager(true)}
                      className="text-[11px] text-[var(--mg-accent-text)] font-extrabold hover:underline"
                    >
                      + Gestionar categorías
                    </button>
                  </div>
                  <select
                    value={form.category}
                    onChange={(e) => setField('category', e.target.value)}
                    className="mg-input text-xs font-bold"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                )}

                {/* Precios */}
                <div className={practical && !editingProduct ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-2 gap-3'}>
                  <div>
                    <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
                      Precio Venta (Bs) *
                    </label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) => setField('price', clampNumberInput(e.target.value, { max: 999999 }))}
                      onKeyDown={blockInvalidNumberKeys}
                      placeholder="0.00"
                      min="0"
                      max="999999"
                      step="0.01"
                      className="mg-input text-sm font-black text-[var(--mg-accent-text)]"
                      required
                    />
                  </div>

                  {!(practical && !editingProduct) && !form.isDish && (
                  <div>
                    <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
                      Precio Compra (Bs)
                    </label>
                    <input
                      type="number"
                      value={form.supplierPrice}
                      onChange={(e) => setField('supplierPrice', clampNumberInput(e.target.value, { max: 999999 }))}
                      onKeyDown={blockInvalidNumberKeys}
                      placeholder="0.00"
                      min="0"
                      max="999999"
                      step="0.01"
                      className="mg-input text-xs font-bold"
                    />
                  </div>
                  )}
                </div>

                {/* Stock y Unidad */}
                {form.isDish ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
                        Stock actual (porciones) *
                      </label>
                      <input
                        type="number"
                        value={form.stock}
                        onChange={(e) => setField('stock', clampNumberInput(e.target.value, { max: 999999 }))}
                        onKeyDown={blockInvalidNumberKeys}
                        placeholder="0"
                        min="0"
                        max="999999"
                        step="1"
                        className="mg-input text-sm font-black"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
                        Alerta cuando queden
                      </label>
                      <input
                        type="number"
                        value={form.minStock}
                        onChange={(e) => setField('minStock', clampNumberInput(e.target.value, { min: 1, max: 99999 }))}
                        onKeyDown={blockInvalidNumberKeys}
                        placeholder="5"
                        min="1"
                        max="99999"
                        step="1"
                        className="mg-input text-xs font-semibold"
                      />
                    </div>
                  </div>
                ) : (
                <div className={practical && !editingProduct ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-2 gap-3'}>
                  <div>
                    {practical && !editingProduct ? (
                      <div className="space-y-2.5">
                        <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block">
                          ¿Cómo entra tu stock?
                        </label>
                        <button
                          type="button"
                          aria-pressed={stockMode === 'directo'}
                          onClick={() => setStockMode('directo')}
                          className={`w-full rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.99] ${stockMode === 'directo' ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)]' : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)]'}`}
                        >
                          <span className="flex items-center gap-2.5">
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${stockMode === 'directo' ? 'bg-[var(--mg-accent)]' : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'}`}>
                              <AppIcon name="paquete" size={16} color={stockMode === 'directo' ? '#fff' : 'currentColor'} />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-extrabold text-[var(--mg-text-primary)]">Ya lo tengo</span>
                              <span className="block text-[11px] font-semibold text-[var(--mg-text-secondary)]">Cuento directo las unidades que hay ahora.</span>
                            </span>
                          </span>
                        </button>
                        {stockMode === 'directo' && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                                ¿Cuántas hay? *
                              </label>
                              <input
                                type="number"
                                value={form.stock}
                                onChange={(e) => setField('stock', clampNumberInput(e.target.value, { max: 999999 }))}
                                onKeyDown={blockInvalidNumberKeys}
                                placeholder="0"
                                min="0"
                                max="999999"
                                step="1"
                                className="mg-input text-sm font-black"
                                required
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                                Costo por und. (opcional)
                              </label>
                              <input
                                type="number"
                                value={form.supplierPrice}
                                onChange={(e) => setField('supplierPrice', clampNumberInput(e.target.value, { max: 999999 }))}
                                onKeyDown={blockInvalidNumberKeys}
                                placeholder="0.00"
                                min="0"
                                max="999999"
                                step="0.01"
                                className="mg-input text-xs font-bold"
                              />
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          aria-pressed={stockMode === 'compra'}
                          onClick={() => setStockMode('compra')}
                          className={`w-full rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.99] ${stockMode === 'compra' ? 'border-[var(--mg-gold)] bg-[var(--mg-gold-bg)]' : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)]'}`}
                        >
                          <span className="flex items-center gap-2.5">
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${stockMode === 'compra' ? 'bg-[var(--mg-gold)]' : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'}`}>
                              <AppIcon name="carrito" size={16} color={stockMode === 'compra' ? '#fff' : 'currentColor'} />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-extrabold text-[var(--mg-text-primary)]">Lo acabo de comprar</span>
                              <span className="block text-[11px] font-semibold text-[var(--mg-text-secondary)]">Registro la compra: el stock sube solo y sé mi ganancia real.</span>
                            </span>
                          </span>
                        </button>
                        {stockMode === 'compra' && (
                          <div className="space-y-2.5 rounded-2xl border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] p-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                                  ¿Cuántas llegaron? *
                                </label>
                                <input
                                  type="number"
                                  value={form.stock}
                                  onChange={(e) => setField('stock', clampNumberInput(e.target.value, { max: 999999 }))}
                                  onKeyDown={blockInvalidNumberKeys}
                                  placeholder="0"
                                  min="0"
                                  max="999999"
                                  step="1"
                                  className="mg-input text-sm font-black"
                                  required
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                                  ¿Cuánto te costó cada una? *
                                </label>
                                <input
                                  type="number"
                                  value={form.supplierPrice}
                                  onChange={(e) => setField('supplierPrice', clampNumberInput(e.target.value, { max: 999999 }))}
                                  onKeyDown={blockInvalidNumberKeys}
                                  placeholder="0.00"
                                  min="0"
                                  max="999999"
                                  step="0.01"
                                  className="mg-input text-xs font-black"
                                  required
                                />
                              </div>
                            </div>
                            <p className="text-[11px] font-semibold text-[var(--mg-gold-text)]">
                              Las próximas resurtidas hazlas siempre en Compras: el stock se suma solo y queda el registro.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
                          Stock Actual *{hasBranchRows && targetBranchId ? ` · ${(branches.find((b) => b.id === targetBranchId)?.name) || ''}` : ''}
                        </label>
                        <input
                          type="number"
                          value={form.stock}
                          onChange={(e) => setField('stock', clampNumberInput(e.target.value, { max: 999999 }))}
                          onKeyDown={blockInvalidNumberKeys}
                          placeholder="0"
                          min="0"
                          max="999999"
                          step="1"
                          className="mg-input text-sm font-black"
                          required
                        />
                      </>
                    )}
                  </div>

                  {!(practical && !editingProduct) && (
                  <div>
                    <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
                      Unidad de Medida
                    </label>
                    <select
                      value={form.unit}
                      onChange={(e) => setField('unit', e.target.value)}
                      className="mg-input text-xs font-bold"
                    >
                      <option value="Unidad">Unidad</option>
                      <option value="Caja">Caja</option>
                      <option value="Paquete">Paquete</option>
                      <option value="Litros">Litros</option>
                      <option value="Mililitros">Mililitros</option>
                      <option value="Gramos">Gramos</option>
                      <option value="Kilogramos">Kilogramos</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>
                  )}
                </div>
                )}

                {(!practical || showAdvanced) && !form.isDish && (sectorConfig?.features?.configurablePresentations ? (
                  <div className="bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-2xl p-3.5 space-y-3">
                    <div>
                      <h3 className="text-xs font-extrabold text-[var(--mg-text-primary)]">Presentaciones de venta</h3>
                      <p className="mt-1 text-[11px] text-[var(--mg-text-muted)]">
                        El inventario se cuenta en la unidad base. El precio base se define arriba; cada empaque convierte a unidades base.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] p-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Unidad base *</label>
                        <input
                          type="text"
                          value={form.unitLabel}
                          onChange={(e) => setField('unitLabel', e.target.value)}
                          placeholder="Ej: Botella"
                          maxLength={30}
                          className="mg-input text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Factor</label>
                        <div className="mg-input flex items-center text-xs font-black">1 unidad base</div>
                      </div>
                      <p className="col-span-2 text-[11px] font-semibold text-[var(--mg-brand-text)]">
                        Precio base: Bs {Number(form.price || 0).toFixed(2)} · el precio se edita en el campo Precio de venta.
                      </p>
                    </div>

                    {(form.presentations || []).filter((presentation) => !presentation.isBase).map((presentation) => (
                      <div key={presentation.id} className="grid grid-cols-1 items-end gap-2 rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3 sm:grid-cols-[1fr_0.7fr_1fr_auto]">
                        <div>
                          <label className="mb-1 block text-[10px] font-bold text-[var(--mg-text-muted)]">Nombre *</label>
                          <input
                            value={presentation.name}
                            onChange={(e) => updatePresentation(presentation.id, { name: e.target.value })}
                            placeholder="Six-pack"
                            list="presentation-name-options"
                            maxLength={40}
                            className="mg-input text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold text-[var(--mg-text-muted)]">Factor *</label>
                          <input
                            type="number"
                            value={presentation.factor}
                            onChange={(e) => updatePresentation(presentation.id, { factor: clampNumberInput(e.target.value, { min: 0, max: 999999 }) })}
                            onKeyDown={blockInvalidNumberKeys}
                            min="0"
                            step="any"
                            placeholder="6"
                            className="mg-input text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-bold text-[var(--mg-text-muted)]">Precio *</label>
                          <input
                            type="number"
                            value={presentation.price}
                            onChange={(e) => updatePresentation(presentation.id, { price: clampNumberInput(e.target.value, { min: 0, max: 999999 }) })}
                            onKeyDown={blockInvalidNumberKeys}
                            min="0"
                            step="0.01"
                            placeholder="72.00"
                            className="mg-input text-xs font-black"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removePresentation(presentation.id)}
                          aria-label={`Quitar presentación ${presentation.name || ''}`}
                          className="mb-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--mg-danger-bg)] font-black text-[var(--mg-danger)]"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addPresentation}
                      className="w-full rounded-xl border border-dashed border-[var(--mg-brand-border)] bg-[var(--mg-bg-surface)] px-3 py-2.5 text-xs font-extrabold text-[var(--mg-brand-text)]"
                    >
                      + Agregar presentación
                    </button>
                    <datalist id="presentation-name-options">
                      {sectorConfig.unitLabels.map((label) => <option key={label} value={label} />)}
                    </datalist>
                  </div>
                ) : (
                <div className="bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!form.sellPack}
                        onChange={(e) => setField('sellPack', e.target.checked)}
                        className="h-5 w-5 accent-[var(--mg-accent)]"
                      />
                      <span className="text-xs font-extrabold text-[var(--mg-text-primary)]">
                        📦 También se vende por paquete
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setPackHelp(!packHelp)}
                      aria-label="Ayuda: venta por paquete"
                      className="shrink-0 w-6 h-6 rounded-full bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] flex items-center justify-center"
                    >
                      <AppIcon name="ayuda" size={14} />
                    </button>
                  </div>
                  {packHelp && (
                    <p className="text-[11px] text-[var(--mg-accent-text)] font-semibold bg-[var(--mg-accent-bg-soft)] border border-[var(--mg-accent-border)] rounded-lg px-2 py-1.5">
                      Actívalo si además de la unidad suelta vendés el paquete cerrado (ej: lata suelta y chipa x12). El stock siempre vive en unidades: vender 1 paquete descuenta las unidades que trae.
                    </p>
                  )}
                  <p className="-mt-1 text-[11px] text-[var(--mg-text-muted)]">
                    Ej: la lata suelta y la chipa x12. El paquete se puede romper: el stock vive en unidades.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
                        Unidad se llama
                      </label>
                      <input
                        type="text"
                        value={form.unitLabel}
                        onChange={(e) => setField('unitLabel', e.target.value)}
                        placeholder="Ej: Lata"
                        className="mg-input text-xs font-semibold"
                        maxLength={20}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
                        Paquete se llama
                      </label>
                      <input
                        type="text"
                        value={form.packLabel}
                        onChange={(e) => setField('packLabel', e.target.value)}
                        placeholder="Ej: Chipa"
                        disabled={!form.sellPack}
                        className="mg-input text-xs font-semibold disabled:opacity-40"
                        maxLength={20}
                      />
                    </div>
                  </div>

                  {form.sellPack && (
                    <>
                      <div>
                        <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
                          ¿Cuántas unidades trae el paquete? *
                        </label>
                        <input
                          type="number"
                          value={form.packageSize}
                          onChange={(e) => setField('packageSize', clampNumberInput(e.target.value, { min: 1, max: 9999 }))}
                          onKeyDown={blockInvalidNumberKeys}
                          placeholder="Ej: 12"
                          min="1"
                          max="9999"
                          step="1"
                          className="mg-input text-xs font-semibold"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
                            Precio paquete frío *
                          </label>
                          <input
                            type="number"
                            value={form.packPrice}
                            onChange={(e) => setField('packPrice', clampNumberInput(e.target.value, { max: 999999 }))}
                            onKeyDown={blockInvalidNumberKeys}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            className="mg-input text-xs font-black text-[var(--mg-accent-text)]"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
                            Precio caliente (opcional)
                          </label>
                          <input
                            type="number"
                            value={form.packPriceHot}
                            onChange={(e) => setField('packPriceHot', clampNumberInput(e.target.value, { max: 999999 }))}
                            onKeyDown={blockInvalidNumberKeys}
                            placeholder="Igual que frío"
                            min="0"
                            step="0.01"
                            className="mg-input text-xs font-semibold"
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-[var(--mg-text-muted)]">
                        La unidad (<strong>{form.unitLabel || 'Unidad'}</strong>) se vende solo fría al precio de venta de arriba.
                      </p>
                    </>
                  )}
                </div>
                ))}

                {/* Expiry Date */}
                {expiryReplenishmentId && !form.isDish && (
                  <div>
                    <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
                      Fecha de Vencimiento
                    </label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="mg-input text-xs font-semibold"
                    />
                  </div>
                )}

                {/* Min stock alert */}
                {(!practical || showAdvanced) && !form.isDish && (
                <div>
                  <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
                    Alerta cuando queden (und.)
                  </label>
                  <input
                    type="number"
                    value={form.minStock}
                    onChange={(e) => setField('minStock', clampNumberInput(e.target.value, { min: 1, max: 99999 }))}
                    onKeyDown={blockInvalidNumberKeys}
                    placeholder="5"
                    min="1"
                    max="99999"
                    step="1"
                    className="mg-input text-xs font-semibold"
                  />
                </div>
                )}

                {/* Descripción */}
                {(!practical || showAdvanced) && (
                <div>
                  <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
                    Descripción (opcional)
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                    placeholder="Ej: Presentación 2 Litros, sin azúcar..."
                    className="mg-input text-xs font-semibold"
                    maxLength={120}
                  />
                </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  disabled={saving}
                  className="w-full bg-[var(--mg-brand)] hover:bg-[var(--mg-brand-hover)] text-[var(--mg-brand-contrast)] font-extrabold py-3.5 rounded-2xl text-xs shadow-[var(--mg-shadow-md)] transition-all active:scale-95 disabled:opacity-50 min-h-[44px]"
                >
                  {saving ? 'Guardando...' : editingProduct ? 'Guardar Cambios' : practical ? 'Guardar producto' : 'Nuevo Producto'}
                </motion.button>

                {practical && !editingProduct && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSave(null, { another: true })}
                    className="w-full bg-[var(--mg-brand-bg)] hover:bg-[var(--mg-accent-bg)] border border-[var(--mg-brand-border)] text-[var(--mg-brand-text)] font-extrabold py-3 rounded-2xl text-xs transition-all active:scale-95 disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-1.5"
                  >
                    <AppIcon name="agregar" size={14} />
                    <span>Guardar y añadir otro</span>
                  </button>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {celebrate && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 mg-backdrop-in"
            onClick={() => setCelebrate(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 24 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: 24 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--mg-bg-surface)] w-full max-w-xs rounded-[28px] border border-[var(--mg-border)] shadow-2xl p-6 text-center"
            >
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-[22px] border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)]">
                <AppIcon name="check" size={30} color="var(--mg-success)" strokeWidth={2.5} />
              </div>
              <h3 className="text-lg font-black text-[var(--mg-text-primary)] tracking-tight">¡Primer producto listo!</h3>
              <p className="mt-1.5 text-xs font-semibold leading-relaxed text-[var(--mg-text-secondary)]">
                Tu catálogo arrancó. Cuando vendas en Ventas, la ganancia queda plasmada.
              </p>
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCelebrate(false);
                    openAdd({}, true);
                  }}
                  className="mg-btn-primary min-h-12 text-sm"
                >
                  Añadir otro producto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCelebrate(false);
                    navigate('/ventas');
                  }}
                  className="min-h-12 rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] text-sm font-extrabold text-[var(--mg-text-secondary)] hover:bg-[var(--mg-bg-elevated)] transition-all active:scale-95"
                >
                  Empezar a vender
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* === MODAL: Gestionar Categorías (z alto: va ENCIMA del formulario) === */}
      <AnimatePresence>
        {showCatManager && (
          <div
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs mg-backdrop-in"
            onClick={() => setShowCatManager(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--mg-bg-surface)] w-full max-w-md rounded-t-[28px] sm:rounded-[28px] border border-[var(--mg-border)] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            >
              <div className="p-4 border-b border-[var(--mg-separator)] flex items-center justify-between bg-[var(--mg-bg-elevated)]">
                <h3 className="font-extrabold text-[var(--mg-text-primary)] text-sm flex items-center gap-1.5"><AppIcon name="etiqueta" size={14} /> Categorías del Sistema</h3>
                <button
                  type="button"
                  onClick={() => setShowCatManager(false)}
                  className="w-8 h-8 rounded-full bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] flex items-center justify-center font-bold text-base text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)] transition-all active:scale-95"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                {/* Agregar nueva */}
                <form onSubmit={handleAddCategory} className="flex gap-2">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Nueva categoría..."
                    className="mg-input text-xs font-semibold flex-1"
                    maxLength={40}
                  />
                  <button
                    type="submit"
                    disabled={!newCatName.trim() || savingCat}
                    className="bg-[var(--mg-brand)] hover:bg-[var(--mg-brand-hover)] text-[var(--mg-brand-contrast)] font-extrabold px-4 rounded-xl text-xs active:scale-95 transition-all disabled:opacity-50 min-h-[42px] shrink-0"
                  >
                    {savingCat ? '...' : <span className="flex items-center gap-1"><AppIcon name="agregar" size={13} /> Agregar</span>}
                  </button>
                </form>

                {categorySuggestions.length > 0 && (
                  <div className="rounded-xl border border-dashed border-[var(--mg-border-hover)] bg-[var(--mg-bg-elevated)] p-3">
                    <p className="text-[11px] font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider">
                      Sugerencias para tu rubro
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {categorySuggestions.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => handleAddSuggestedCategory(cat)}
                          disabled={savingCat}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--mg-text-secondary)] transition-all hover:border-[var(--mg-accent-border)] hover:text-[var(--mg-accent-text)] active:scale-95 disabled:opacity-50"
                        >
                          <span className="text-xs leading-none">+</span>
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lista de categorías */}
                <div className="space-y-2">
                  {categories.map((cat) => (
                    <div key={cat} className="bg-[var(--mg-bg-elevated)] rounded-xl px-3.5 py-2.5 border border-[var(--mg-border)]">
                      {editingCat === cat ? (
                        <form onSubmit={handleRenameCategory} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editCatValue}
                            onChange={(e) => setEditCatValue(e.target.value)}
                            autoFocus
                            maxLength={40}
                            className="flex-1 min-w-0 border border-[var(--mg-accent-border)] rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-[var(--mg-accent)]"
                          />
                          <button
                            type="submit"
                            disabled={savingRename || !editCatValue.trim()}
                            className="bg-[var(--mg-brand)] hover:bg-[var(--mg-brand-hover)] text-[var(--mg-brand-contrast)] text-[11px] font-bold px-3 py-1 rounded-lg active:scale-95 disabled:opacity-50 shrink-0"
                          >
                            {savingRename ? '...' : 'Guardar'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditCategory}
                            className="text-[var(--mg-text-muted)] text-[11px] font-semibold px-1.5 shrink-0"
                          >
                            Cancelar
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-3 h-3 rounded-full shrink-0 border ${getCatColor(categories, cat)}`} />
                            <span className="text-xs font-extrabold text-[var(--mg-text-primary)] truncate">{cat}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditCategory(cat)}
                              className="text-[var(--mg-accent-text)] text-xs font-extrabold px-2 py-1 hover:bg-[var(--mg-accent-bg)] rounded-lg transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveCategory(cat)}
                              className="text-[var(--mg-danger)] text-xs font-extrabold px-2 py-1 hover:bg-[var(--mg-danger-bg)] rounded-lg transition-colors"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
