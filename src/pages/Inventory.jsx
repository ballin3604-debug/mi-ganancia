import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProducts, addProduct, updateProduct, deleteProduct, subscribeToReplenishments, updateReplenishmentExpiry } from '../services/products';
import { getCategories, subscribeToCategories, addCategory, removeCategory } from '../services/categories';
import { useImageUpload } from '../hooks/useImageUpload';
import SwipeableCard from '../components/SwipeableCard';
import { clampNumberInput, blockInvalidNumberKeys } from '../utils/numberInput';

function formatBs(amount) {
  return `Bs ${Number(amount || 0).toFixed(2)}`;
}

const EMPTY_FORM = {
  name: '', price: '', stock: '', minStock: '5',
  brand: '', category: 'Otros', description: '', imageData: '',
  supplierPrice: '', unit: 'Unidad', packageSize: '',
};

const EXPIRY_WARNING_DAYS = 30;

// Devuelve el lote de compra con el vencimiento más próximo (fecha + el id
// de ESE replenishment) — se necesita el id para poder editarlo después,
// ya que el vencimiento vive en el lote de compra, no en el producto.
function getNearestExpiry(replenishments, productId) {
  const candidates = replenishments
    .filter((r) => r.productId === productId && r.expiryDate)
    .map((r) => ({ id: r.id, date: new Date(`${r.expiryDate}T00:00:00`) }));
  if (candidates.length === 0) return null;
  return candidates.reduce((min, c) => (c.date < min.date ? c : min));
}

const CATEGORY_COLORS = [
  'bg-[var(--mg-info-bg)] text-[var(--mg-accent)]', 'bg-yellow-100 text-yellow-700',
  'bg-amber-100 text-amber-700', 'bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]',
  'bg-green-100 text-green-700', 'bg-cyan-100 text-cyan-700',
  'bg-purple-100 text-purple-700', 'bg-pink-100 text-pink-700',
  'bg-[var(--mg-warning-bg)] text-[var(--mg-warning)]', 'bg-lime-100 text-lime-700',
  'bg-teal-100 text-teal-700', 'bg-indigo-100 text-indigo-700',
  'bg-rose-100 text-rose-700', 'bg-violet-100 text-violet-700',
  'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)]',
];

function getCatColor(categories, catName) {
  const idx = categories.indexOf(catName);
  return CATEGORY_COLORS[idx % CATEGORY_COLORS.length] || CATEGORY_COLORS[CATEGORY_COLORS.length - 1];
}

function ProductImage({ imageData, name, size = 'md' }) {
  const sizeClass = size === 'sm' ? 'w-10 h-10' : 'w-14 h-14';
  if (!imageData) {
    return (
      <div className={`${sizeClass} bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center shrink-0 text-2xl`}>
        📦
      </div>
    );
  }
  return (
    <img src={imageData} alt={name}
      className={`${sizeClass} rounded-xl object-cover shrink-0 border border-[var(--mg-border)]`} />
  );
}

export default function Inventory() {
  const { businessId } = useAuth();
  const { pickImage } = useImageUpload();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [replenishments, setReplenishments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(() => searchParams.get('action') === 'nuevo');
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expiryDate, setExpiryDate] = useState('');
  const [expiryReplenishmentId, setExpiryReplenishmentId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todas');

  // Category management
  const [showCatManager, setShowCatManager] = useState(() => searchParams.get('action') === 'categorias');
  const [newCatName, setNewCatName] = useState('');
  const [savingCat, setSavingCat] = useState(false);

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

  useEffect(() => { fetchAll(); }, [fetchAll]);

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

  // Auto-open edit modal when coming from Dashboard "reponer pronto"
  useEffect(() => {
    const product = location.state?.editProduct;
    if (product && !loading) {
      openEdit(product);
      // Clear state so back navigation doesn't re-open
      window.history.replaceState({}, '');
    }
  }, [location.state, loading]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleImagePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await pickImage(file);
    if (data) setField('imageData', data);
    e.target.value = '';
  }

  function openAdd() {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setExpiryDate('');
    setExpiryReplenishmentId(null);
    setShowForm(true);
  }

  function openEdit(product) {
    setEditingProduct(product);
    setForm({
      name: product.name,
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
    // El vencimiento vive en el lote de compra (replenishments), no en el
    // producto — se toma el más próximo para poder mostrarlo/editarlo acá.
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
    setShowForm(false);
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setExpiryDate('');
    setExpiryReplenishmentId(null);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.price || form.stock === '') return;
    setSaving(true);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, { ...form, expectedStock: editingProduct.stock });
      } else {
        await addProduct(businessId, form);
      }
      if (expiryReplenishmentId) {
        await updateReplenishmentExpiry(expiryReplenishmentId, expiryDate);
      }
      await fetchAll();
      closeForm();
    } catch (err) {
      console.error(err);
      alert('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product) {
    if (!window.confirm(`¿Eliminar "${product.name}"?`)) return;
    try {
      await deleteProduct(product.id);
      await fetchAll();
    } catch { alert('Error al eliminar.'); }
  }

  async function handleAddCategory(e) {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;
    // Evitar duplicados (insensible a mayúsculas) — arrayUnion no avisaría
    if (categories.some((c) => c.toLowerCase() === name.toLowerCase())) {
      alert(`La categoría "${name}" ya existe.`);
      return;
    }
    setSavingCat(true);
    try {
      await addCategory(businessId, name);
      await fetchAll();
      setNewCatName('');
    } catch (err) {
      console.error('Error al agregar categoría:', err);
      alert(`No se pudo agregar la categoría.\n\n${err?.message || err}`);
    } finally { setSavingCat(false); }
  }

  async function handleRemoveCategory(cat) {
    if (!window.confirm(`¿Eliminar categoría "${cat}"?`)) return;
    try {
      await removeCategory(businessId, cat);
      await fetchAll();
      if (filterCategory === cat) setFilterCategory('Todas');
    } catch (err) {
      console.error('Error al eliminar categoría:', err);
      alert(`No se pudo eliminar la categoría.\n\n${err?.message || err}`);
    }
  }

  const allCategories = ['Todas', ...categories];
  const filtered = products
    .filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand || '').toLowerCase().includes(search.toLowerCase())
    )
    .filter((p) => filterCategory === 'Todas' || p.category === filterCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--mg-accent-border)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--mg-text-primary)]">Inventario</h2>
          <p className="text-[var(--mg-text-faint)] text-xs">{products.length} productos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCatManager(true)}
            className="bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)] rounded-2xl px-4 h-10 font-bold text-sm active:scale-95 flex items-center justify-center shrink-0"
            title="Gestionar categorías"
          >
            Categorías
          </button>
          <button
            onClick={() => navigate('/compras')}
            className="bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] border border-[var(--mg-accent-border)] rounded-2xl px-4 h-10 flex items-center gap-1.5 font-bold text-sm active:scale-95 shrink-0"
          >
            🛒 Compras
          </button>
          <button
            onClick={openAdd}
            className="bg-[var(--mg-accent)] text-white rounded-2xl px-4 h-10 flex items-center gap-1.5 font-bold text-sm shadow-md active:scale-95 shrink-0"
          >
            <span className="text-xl leading-none">+</span> Agregar
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍  Buscar por nombre o marca..."
        className="w-full border-2 border-[var(--mg-border)] rounded-2xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent-border)]"
      />

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {allCategories.map((cat) => (
          <button
            key={cat}
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

      {/* Swipe hint */}
      {filtered.length > 0 && (
        <p className="text-gray-300 text-xs text-center">← Desliza un producto para editar o borrar</p>
      )}

      {/* Products List with swipe */}
      <div className="space-y-2">
        {filtered.map((product) => {
          const isLow = product.stock <= (product.minStock || 5);
          const isOut = product.stock === 0;
          const catColor = getCatColor(categories, product.category);
          const nearestExpiry = getNearestExpiry(replenishments, product.id);
          let expiryDaysLeft = null;
          if (nearestExpiry) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            expiryDaysLeft = Math.ceil((nearestExpiry.date - today) / (1000 * 60 * 60 * 24));
          }
          const showExpiryBadge = expiryDaysLeft !== null && expiryDaysLeft <= EXPIRY_WARNING_DAYS;
          const expiryDateLabel = nearestExpiry?.date.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
          return (
            <SwipeableCard
              key={product.id}
              onEdit={() => openEdit(product)}
              onDelete={() => handleDelete(product)}
            >
              <div className={`group bg-[var(--mg-bg-surface)] p-3 border-2 flex items-center justify-between gap-3 rounded-2xl ${
                isOut ? 'border-[var(--mg-danger)]' : isLow ? 'border-[var(--mg-warning)]' : 'border-[var(--mg-border)]'
              }`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <ProductImage imageData={product.imageData} name={product.name} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[var(--mg-text-primary)] truncate text-sm">
                      {product.name} {product.unit && product.unit !== 'Unidad' ? `(${product.unit})` : ''}
                    </p>
                    {product.brand && (
                      <p className="text-[var(--mg-text-faint)] text-xs truncate">{product.brand}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${catColor}`}>
                        {product.category}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        isOut ? 'bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]' : isLow ? 'bg-[var(--mg-warning-bg)] text-[var(--mg-warning)]' : 'bg-green-100 text-green-700'
                      }`}>
                        {isOut ? '❌ Agotado' : isLow ? `⚠️ ${product.stock}` : `✓ ${product.stock}`}
                      </span>
                      {showExpiryBadge && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          expiryDaysLeft < 0 ? 'bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]' : 'bg-[var(--mg-warning-bg)] text-[var(--mg-warning)]'
                        }`}>
                          {expiryDaysLeft < 0 ? `⏰ Vencido (${expiryDateLabel})` : `⏰ Vence ${expiryDateLabel}`}
                        </span>
                      )}
                    </div>
                    <p className="text-[var(--mg-accent)] font-bold text-sm mt-1">{formatBs(product.price)}</p>
                  </div>
                </div>

                {/* Acciones directas (visibles siempre en móvil, hover en desktop) */}
                <div className="flex items-center gap-1 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(product);
                    }}
                    className="w-9 h-9 hover:bg-[var(--mg-accent-bg)] rounded-xl flex items-center justify-center text-gray-500 hover:text-[var(--mg-accent)] active:scale-95 transition-all shrink-0"
                    title="Editar producto"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(product);
                    }}
                    className="w-9 h-9 hover:bg-red-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-[var(--mg-danger)] active:scale-95 transition-all shrink-0"
                    title="Eliminar producto"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </SwipeableCard>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-[var(--mg-text-faint)]">
          <p className="text-5xl mb-3">📦</p>
          <p className="font-semibold">{search ? 'No encontrado' : 'Sin productos'}</p>
          {!search && <p className="text-sm mt-1">Toca "Agregar" para empezar</p>}
        </div>
      )}


      {/* === MODAL: Agregar/Editar Producto === */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={closeForm}>
          <div
            className="bg-[var(--mg-bg-surface)] rounded-t-3xl w-full max-w-md shadow-2xl overflow-y-auto"
            style={{ maxHeight: '93vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 pb-10 space-y-4">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto" />
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-[var(--mg-text-primary)]">
                  {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                </h3>
                <button onClick={closeForm} className="w-8 h-8 bg-[var(--mg-bg-elevated)] rounded-full flex items-center justify-center text-[var(--mg-text-muted)] font-bold text-lg">×</button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">

                {/* Foto del producto */}
                <div>
                  <p className="text-sm font-semibold text-[var(--mg-text-muted)] block mb-2">Foto del producto</p>
                  <div className="flex items-center gap-3">
                    {/* Preview */}
                    {form.imageData ? (
                      <img src={form.imageData} alt="Preview"
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-[var(--mg-accent-border)] shrink-0" />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-[var(--mg-bg-elevated)] flex items-center justify-center text-3xl shrink-0 border-2 border-dashed border-gray-300">
                        📷
                      </div>
                    )}
                    <div className="flex flex-col gap-2 flex-1">
                      <div className="grid grid-cols-2 gap-2">
                        {/* Cámara — input DENTRO del label, cubre toda el área */}
                        <label className="relative bg-[var(--mg-info-bg)] border-2 border-[var(--mg-accent-border)] text-[var(--mg-accent)] font-bold py-2.5 rounded-xl text-sm active:scale-95 flex flex-col items-center gap-0.5 cursor-pointer select-none overflow-hidden">
                          <span>📷</span>
                          <span className="text-xs">Cámara</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleImagePick}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </label>
                        {/* Galería — input DENTRO del label, cubre toda el área */}
                        <label className="relative bg-[var(--mg-accent)] border-2 border-[var(--mg-accent-border)] text-white font-bold py-2.5 rounded-xl text-sm active:scale-95 flex flex-col items-center gap-0.5 cursor-pointer select-none overflow-hidden">
                          <span>🖼️</span>
                          <span className="text-xs">Galería</span>
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
                          className="w-full bg-[var(--mg-danger-bg)] text-red-400 font-semibold py-2 rounded-xl text-xs active:scale-95"
                        >
                          Quitar foto
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nombre */}
                <div>
                  <label className="text-sm font-semibold text-[var(--mg-text-muted)] block mb-1">Nombre *</label>
                  <input type="text" value={form.name} onChange={(e) => setField('name', e.target.value)}
                    placeholder="Ej: Coca Cola 2L"
                    className="w-full border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent-border)] text-base"
                    required autoFocus maxLength={80} />
                </div>

                {/* Marca */}
                <div>
                  <label className="text-sm font-semibold text-[var(--mg-text-muted)] block mb-1">Marca</label>
                  <input type="text" value={form.brand} onChange={(e) => setField('brand', e.target.value)}
                    placeholder="Ej: Coca Cola, Pil, Samsung..."
                    className="w-full border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent-border)] text-base"
                    maxLength={60} />
                </div>

                {/* Categoría */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-semibold text-[var(--mg-text-muted)]">Categoría</label>
                    <button type="button" onClick={() => { closeForm(); setShowCatManager(true); }}
                      className="text-xs text-[var(--mg-accent)] font-semibold">
                      + Gestionar categorías
                    </button>
                  </div>
                  <select value={form.category} onChange={(e) => setField('category', e.target.value)}
                    className="w-full border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent-border)] text-base bg-[var(--mg-bg-surface)]">
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Precios */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold text-[var(--mg-text-muted)] block mb-1">Precio de Venta (Bs) *</label>
                    <input type="number" value={form.price}
                      onChange={(e) => setField('price', clampNumberInput(e.target.value, { max: 999999 }))}
                      onKeyDown={blockInvalidNumberKeys}
                      placeholder="0.00" min="0" max="999999" step="0.01"
                      className="w-full border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent-border)] text-base font-bold text-[var(--mg-text-primary)]"
                      required />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[var(--mg-text-muted)] block mb-1">Precio de compra (Bs)</label>
                    <input type="number" value={form.supplierPrice}
                      onChange={(e) => setField('supplierPrice', clampNumberInput(e.target.value, { max: 999999 }))}
                      onKeyDown={blockInvalidNumberKeys}
                      placeholder="0.00" min="0" max="999999" step="0.01"
                      className="w-full border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent-border)] text-base" />
                  </div>
                </div>

                {/* Stock y Unidad */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold text-[var(--mg-text-muted)] block mb-1">Stock *</label>
                    <input type="number" value={form.stock}
                      onChange={(e) => setField('stock', clampNumberInput(e.target.value, { max: 999999 }))}
                      onKeyDown={blockInvalidNumberKeys}
                      placeholder="0" min="0" max="999999" step="1"
                      className="w-full border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent-border)] text-base font-bold text-[var(--mg-text-primary)]"
                      required />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[var(--mg-text-muted)] block mb-1">Unidad de medida</label>
                    <select value={form.unit} onChange={(e) => setField('unit', e.target.value)}
                      className="w-full border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent-border)] text-base bg-[var(--mg-bg-surface)]">
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

                {/* Unidades por paquete (default para compras por paquete) */}
                <div>
                  <label className="text-sm font-semibold text-[var(--mg-text-muted)] block mb-1">Unidades por paquete (opcional)</label>
                  <input type="number" value={form.packageSize}
                    onChange={(e) => setField('packageSize', clampNumberInput(e.target.value, { min: 1, max: 9999 }))}
                    onKeyDown={blockInvalidNumberKeys}
                    placeholder="Ej: 6 (para comprar por paquetes)" min="1" max="9999" step="1"
                    className="w-full border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent-border)] text-base" />
                </div>

                {/* Fecha de vencimiento — vive en el lote de compra, no en el
                    producto, así que solo aparece si hay una compra registrada
                    con vencimiento (ej. este producto vino de una compra o de
                    una importación del catálogo). */}
                {expiryReplenishmentId && (
                  <div>
                    <label className="text-sm font-semibold text-[var(--mg-text-muted)] block mb-1">Fecha de vencimiento</label>
                    <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent-border)] text-base" />
                    <p className="text-[11px] text-[var(--mg-text-faint)] mt-1">Corresponde a la compra más próxima a vencer de este producto.</p>
                  </div>
                )}

                {/* Alerta */}
                <div>
                  <label className="text-sm font-semibold text-[var(--mg-text-muted)] block mb-1">Alerta cuando queden (und.)</label>
                  <input type="number" value={form.minStock}
                    onChange={(e) => setField('minStock', clampNumberInput(e.target.value, { min: 1, max: 99999 }))}
                    onKeyDown={blockInvalidNumberKeys}
                    placeholder="5" min="1" max="99999" step="1"
                    className="w-full border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent-border)] text-base" />
                </div>

                {/* Descripción */}
                <div>
                  <label className="text-sm font-semibold text-[var(--mg-text-muted)] block mb-1">Descripción (opcional)</label>
                  <input type="text" value={form.description} onChange={(e) => setField('description', e.target.value)}
                    placeholder="Ej: 2 litros, sin azúcar..."
                    className="w-full border-2 border-[var(--mg-border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--mg-accent-border)] text-base"
                    maxLength={120} />
                </div>

                <button type="submit" disabled={saving}
                  className="w-full bg-[var(--mg-accent)] text-white font-bold py-4 rounded-2xl text-base active:scale-95 transition-all disabled:opacity-50">
                  {saving ? 'Guardando...' : editingProduct ? 'Guardar cambios' : 'Agregar producto'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Gestionar Categorías === */}
      {showCatManager && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setShowCatManager(false)}>
          <div
            className="bg-[var(--mg-bg-surface)] rounded-t-3xl w-full max-w-md shadow-2xl overflow-y-auto"
            style={{ maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 pb-10 space-y-4">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto" />
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-[var(--mg-text-primary)]">Categorías</h3>
                <button onClick={() => setShowCatManager(false)}
                  className="w-8 h-8 bg-[var(--mg-bg-elevated)] rounded-full flex items-center justify-center text-[var(--mg-text-muted)] font-bold text-lg">×</button>
              </div>

              {/* Agregar nueva */}
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Nueva categoría..."
                  className="flex-1 border-2 border-[var(--mg-border)] rounded-xl px-3 py-2.5 focus:outline-none focus:border-[var(--mg-accent-border)] text-sm"
                  maxLength={40}
                />
                <button type="submit" disabled={!newCatName.trim() || savingCat}
                  className="bg-[var(--mg-accent)] text-white font-bold px-4 rounded-xl text-sm active:scale-95 disabled:opacity-50">
                  {savingCat ? '...' : '+ Agregar'}
                </button>
              </form>

              {/* Lista de categorías */}
              <div className="space-y-2">
                {categories.map((cat, i) => (
                  <div key={cat} className="flex items-center justify-between bg-[var(--mg-bg-elevated)] rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${CATEGORY_COLORS[i % CATEGORY_COLORS.length].split(' ')[0].replace('bg-', 'bg-').replace('-100', '-400')}`} />
                      <span className="text-sm font-semibold text-[var(--mg-text-secondary)]">{cat}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveCategory(cat)}
                      className="text-red-400 text-sm active:scale-95 font-semibold px-2"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
