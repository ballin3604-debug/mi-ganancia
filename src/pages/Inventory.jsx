import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
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
  subscribeToCategories,
  addCategory,
  removeCategory,
  renameCategory,
} from '../services/categories';
import { useImageUpload } from '../hooks/useImageUpload';
import { ConfirmModal } from '../components/settings/ConfirmModal';
import { clampNumberInput, blockInvalidNumberKeys } from '../utils/numberInput';

// Inventory Subcomponents
import { InventoryCatalogItem } from '../components/inventory/InventoryCatalogItem';
import { ProductDetailModal } from '../components/inventory/ProductDetailModal';
import { ProductGridSkeleton } from '../components/inventory/ProductGridSkeleton';
import { InventoryHeader } from '../components/inventory/InventoryHeader';
import { InventoryValuationCard } from '../components/inventory/InventoryValuationCard';
import { TransferModal } from '../components/inventory/TransferModal';
import BarcodeScanner from '../components/BarcodeScanner';
import { AppIcon } from '../components/icons';
import PhotoCamera from '../components/PhotoCamera';
import { UpgradeModal } from '../components/UpgradeScreen';
import { usePlan } from '../hooks/usePlan';
import { useBranches } from '../context/BranchContext';
import { useBranchStocks } from '../hooks/useBranchStocks';
import { toStockMap, setBranchStock } from '../services/branchStock';

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
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-purple-50 text-purple-700 border-purple-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-cyan-50 text-cyan-700 border-cyan-200',
  'bg-rose-50 text-rose-700 border-rose-200',
  'bg-teal-50 text-teal-700 border-teal-200',
  'bg-indigo-50 text-indigo-700 border-indigo-200',
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
  const { businessId } = useAuth();
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
  const [filterExpiry, setFilterExpiry] = useState('todos'); // 'todos' | 'porVencer' | 'vencidos'
  const [filterRecent, setFilterRecent] = useState(false);
  // Fase 2: vista por sede ('all' = totales). El formulario edita la sede vista
  // (o la principal si se ven todas).
  const [invBranch, setInvBranch] = useState('all');
  const { branches } = useBranches();
  const mainBranchId = branches.find((b) => b.isMain)?.id || branches[0]?.id || null;
  const stockRows = useBranchStocks(businessId, mainBranchId);
  const stockMap = useMemo(() => toStockMap(stockRows), [stockRows]);
  const hasBranchRows = stockRows.length > 0;
  const targetBranchId = invBranch === 'all' ? mainBranchId : invBranch;
  const viewProducts = useMemo(() => (
    hasBranchRows && invBranch !== 'all'
      ? products.map((p) => ({ ...p, stock: Number(stockMap.get(`${invBranch}:${p.id}`) ?? 0) }))
      : products
  ), [products, stockMap, invBranch, hasBranchRows]);

  // Selection / Modal states
  const [selectedDetailProduct, setSelectedDetailProduct] = useState(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Add/Edit Product form state (si la página se recargó al volver de la
  // cámara, el borrador guardado reabre el formulario con los datos intactos)
  const [showForm, setShowForm] = useState(() => searchParams.get('action') === 'nuevo' || !!loadProductDraft());
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(() => loadProductDraft()?.form || EMPTY_FORM);
  const [expiryDate, setExpiryDate] = useState(() => loadProductDraft()?.expiryDate || '');
  const [expiryReplenishmentId, setExpiryReplenishmentId] = useState(null);
  const [saving, setSaving] = useState(false);
  const editingRestoredRef = useRef(false);

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
  // Paywall escáner (Pro)
  const { can } = usePlan();
  const [showUpgrade, setShowUpgrade] = useState(false);

  function openScanner(mode) {
    if (can('scanner')) {
      setScanMsg('');
      setScannerMode(mode);
    } else {
      setShowUpgrade(true);
    }
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

  function openAdd(prefill = {}) {
    setEditingProduct(null);
    setForm({ ...EMPTY_FORM, ...prefill });
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
    const hasPack = Number(product.packageSize || 0) > 1 && product.packPrice !== '' && product.packPrice !== null && product.packPrice !== undefined;
    setForm({
      name: product.name,
      barcode: product.barcode || '',
      unitLabel: product.unitLabel || '',
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
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.price || form.stock === '') return;    if (form.sellPack && (Number(form.packageSize || 0) < 2 || !form.packPrice)) {
      alert('Para vender por paquete poné cuántas unidades trae y su precio.');
      return;
    }
    // Si no se vende por paquete, limpiar esos campos para no dejar restos
    const data = form.sellPack
      ? { ...form }
      : { ...form, packLabel: '', packPrice: '', packPriceHot: '', packageSize: '' };
    delete data.sellPack;
    const formStockVal = data.stock;
    delete data.stock;
    setSaving(true);
    try {
      if (editingProduct) {
        const globalCur = Number(products.find((p) => p.id === editingProduct.id)?.stock || 0);
        if (hasBranchRows && targetBranchId) {
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
      } else if (hasBranchRows && targetBranchId) {
        const created = await addProduct(businessId, { ...data, stock: 0 });
        await setBranchStock(businessId, { ...created, stock: 0 }, targetBranchId, Number(formStockVal));
      } else {
        await addProduct(businessId, { ...data, stock: Number(formStockVal) });
      }
      if (expiryReplenishmentId) {
        await updateReplenishmentExpiry(expiryReplenishmentId, expiryDate);
      }
      await fetchAll();
      closeForm();
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
  }, [search, filterCategory, filterExpiry, filterRecent, invBranch]);

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
        if (filterExpiry === 'todos') return true;
        const exp = productExpiry[p.id];
        if (!exp) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysLeft = Math.ceil((exp.date - today) / (1000 * 60 * 60 * 24));
        if (filterExpiry === 'vencidos') return daysLeft < 0;
        return daysLeft >= 0 && daysLeft <= EXPIRY_WARNING_DAYS;
      })
      .filter((p) => !filterRecent || recentlyPurchasedIds.has(p.id));
  }, [viewProducts, search, filterCategory, filterExpiry, filterRecent, productExpiry, recentlyPurchasedIds]);

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
        onOpenAddProduct={() => openAdd()}
        onOpenCatManager={() => setShowCatManager(true)}
        onOpenScanner={() => openScanner('search')}
        expiryCounts={expiryCounts}
      />

      {/* Dynamic Inventory Valuation Card (Changes investment total per active category) */}
      <InventoryValuationCard products={viewProducts} selectedCategory={filterCategory} />

      {/* Vista por sede (solo si hay varias): las tarjetas muestran ese stock */}
      {branches.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            key="all" type="button" onClick={() => setInvBranch('all')}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${invBranch === 'all' ? 'bg-[var(--mg-accent)] text-white shadow-sm' : 'bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] text-[var(--mg-text-muted)]'}`}
          >
            🏬 Todo el stock
          </button>
          {branches.map((b) => (
            <button
              key={b.id} type="button" onClick={() => setInvBranch(b.id)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${invBranch === b.id ? 'bg-[var(--mg-accent)] text-white shadow-sm' : 'bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] text-[var(--mg-text-muted)]'}`}
            >
              {b.type === 'almacen' ? '📦' : '🏪'} {b.name}
            </button>
          ))}
        </div>
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
          <div className="w-16 h-16 rounded-3xl bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] flex items-center justify-center text-3xl mx-auto mb-3 shadow-2xs">
            📦
          </div>
          <p className="font-black text-[var(--mg-text-primary)] text-base">No hay productos que coincidan</p>
          <p className="text-xs text-[var(--mg-text-muted)] mt-1 max-w-xs mx-auto font-medium">
            {search
              ? 'Intenta borrar la búsqueda o seleccionar otra categoría.'
              : 'Toca "+ Nuevo Producto" para empezar a construir tu catálogo visual.'}
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={() => openAdd()}
            className="mt-4 bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white font-extrabold px-4 py-2.5 rounded-2xl text-xs shadow-md transition-all inline-flex items-center gap-1.5"
          >
            <AppIcon name="agregar" size={14} color="#fff" />
            <span>Nuevo Producto</span>
          </motion.button>
        </motion.div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 mg-stagger">
            {visibleProducts.map((prod) => (
              <InventoryCatalogItem
                key={prod.id}
                product={prod}
                nearestExpiry={productExpiry[prod.id]}
                categoryColor={getCatColor(categories, prod.category)}
                onSelect={(p) => setSelectedDetailProduct(p)}
              />
            ))}
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

      {/* PAYWALL escáner */}
      {showUpgrade && (
        <UpgradeModal feature="scanner" title="El escáner es Pro" onClose={() => setShowUpgrade(false)} />
      )}

      {/* === MODAL: Escáner de código de barras === */}
      <AnimatePresence>
        {scannerMode && (
          <div
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs mg-backdrop-in"
            onClick={() => { setScannerMode(null); setScanMsg(''); }}
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
              <div className="p-4 overflow-y-auto">
                <BarcodeScanner onScan={handleScan} />
                {scanMsg && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-amber-700">
                    ⚠️ {scanMsg}
                  </div>
                )}
                {scanMsg && scannerMode === 'search' && (
                  <button
                    type="button"
                    onClick={() => { setScannerMode(null); setScanMsg(''); openAdd(); }}
                    className="mt-3 w-full bg-[var(--mg-accent)] text-white font-bold py-3 rounded-2xl text-sm active:scale-95"
                  >
                    + Crear producto con este código
                  </button>
                )}
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
                {/* Foto del producto */}
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
                          className="bg-[var(--mg-accent-bg)] border border-[var(--mg-accent-border)] text-[var(--mg-accent)] font-extrabold py-2 rounded-xl text-xs active:scale-95 flex flex-col items-center gap-0.5 cursor-pointer select-none transition-all"
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
                          className="w-full bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] font-bold py-1.5 rounded-xl text-[11px] border border-red-200 active:scale-95 transition-all"
                        >
                          Quitar foto
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nombre */}
                <div>
                  <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
                    Nombre del producto *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="Ej: Coca-Cola 2L"
                    className="mg-input font-bold text-sm"
                    required
                    autoFocus
                    maxLength={80}
                  />
                </div>

                {/* Código de barras */}
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
                      className="w-[46px] shrink-0 rounded-xl bg-[var(--mg-accent)] text-white flex items-center justify-center active:scale-95"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h2v14H3zM7 5h1v14H7zM10 5h3v14h-3zM15 5h1v14h-1zM18 5h3v14h-3z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Marca */}
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

                {/* Categoría */}
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
                      className="text-[11px] text-[var(--mg-accent)] font-extrabold hover:underline"
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

                {/* Precios */}
                <div className="grid grid-cols-2 gap-3">
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
                      className="mg-input text-sm font-black text-[var(--mg-accent)]"
                      required
                    />
                  </div>

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
                </div>

                {/* Stock y Unidad */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
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
                  </div>

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
                </div>

                {/* Venta por paquete (chipa/caja): unidad Y paquete */}
                <div className="bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-2xl p-3.5 space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!form.sellPack}
                      onChange={(e) => setField('sellPack', e.target.checked)}
                      className="w-5 h-5 accent-[#1670C2]"
                    />
                    <span className="text-xs font-extrabold text-[var(--mg-text-primary)]">
                      📦 También se vende por paquete
                    </span>
                  </label>
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
                            className="mg-input text-xs font-black text-[var(--mg-accent)]"
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

                {/* Expiry Date */}
                {expiryReplenishmentId && (
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

                {/* Descripción */}
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

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  disabled={saving}
                  className="w-full bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white font-extrabold py-3.5 rounded-2xl text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 min-h-[44px]"
                >
                  {saving ? 'Guardando...' : editingProduct ? 'Guardar Cambios' : 'Nuevo Producto'}
                </motion.button>
              </form>
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
                    className="bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white font-extrabold px-4 rounded-xl text-xs active:scale-95 transition-all disabled:opacity-50 min-h-[42px] shrink-0"
                  >
                    {savingCat ? '...' : <span className="flex items-center gap-1"><AppIcon name="agregar" size={13} color="#fff" /> Agregar</span>}
                  </button>
                </form>

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
                            className="bg-[var(--mg-accent)] text-white text-[11px] font-bold px-3 py-1 rounded-lg active:scale-95 disabled:opacity-50 shrink-0"
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
                              className="text-[var(--mg-accent)] text-xs font-extrabold px-2 py-1 hover:bg-[var(--mg-accent-bg)] rounded-lg transition-colors"
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
