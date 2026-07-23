import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAllRequests, getAllBusinesses,
  approveRequest, rejectRequest,
  suspendBusiness, reactivateBusiness,
} from '../services/admin';
import { signOut } from '../services/auth';
import {
  getMasterProducts, addMasterProduct, deleteMasterProduct,
  importCatalogToBusiness, masterImagePath,
} from '../services/masterProducts';
import { generateUUID } from '../services/localDb';
import { useImageUpload } from '../hooks/useImageUpload';
import { DEFAULT_CATEGORIES } from '../services/categories';
import ProductCatalogCard from '../components/ProductCatalogCard';
import { clampNumberInput, blockInvalidNumberKeys } from '../utils/numberInput';

const EMPTY_CATALOG_FORM = {
  name: '', brand: '', category: 'Otros', unit: 'Unidad',
  suggestedPrice: '', suggestedCost: '', imageData: '',
};

function formatDate(ts) {
  if (!ts?.toDate) return '—';
  return ts.toDate().toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Badge({ status }) {
  const map = {
    pending:   'bg-amber-100 text-amber-700',
    approved:  'bg-[var(--mg-info-bg)] text-[var(--mg-accent)]',
    rejected:  'bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]',
    active:    'bg-[var(--mg-info-bg)] text-[var(--mg-accent)]',
    suspended: 'bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]',
  };
  const labels = {
    pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado',
    active: 'Activo', suspended: 'Suspendido',
  };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${map[status] || 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'}`}>
      {labels[status] || status}
    </span>
  );
}

function ConfirmModal({ message, onConfirm, onCancel, placeholder }) {
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
      <div className="bg-[var(--mg-bg-surface)] rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
        <p className="font-bold text-[var(--mg-text-primary)] text-base">{message}</p>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={placeholder || 'Nota (opcional)'}
          className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--mg-accent-border)]"
        />
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)] font-bold py-3 rounded-2xl text-sm active:scale-95">
            Cancelar
          </button>
          <button onClick={() => onConfirm(note)}
            className="flex-1 bg-[var(--mg-accent)] text-white font-bold py-3 rounded-2xl text-sm active:scale-95">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductThumb({ imageData, name }) {
  if (!imageData) {
    return (
      <div className="w-12 h-12 rounded-xl bg-[var(--mg-bg-elevated)] flex items-center justify-center text-xl shrink-0">
        📦
      </div>
    );
  }
  return <img src={imageData} alt={name} className="w-12 h-12 rounded-xl object-cover shrink-0 border border-[var(--mg-border)]" />;
}

function ItemDetailSheet({ product, initial, onSave, onRemove, onClose }) {
  const [stock, setStock] = useState(initial?.stock ?? '');
  const [salePrice, setSalePrice] = useState(initial?.salePrice ?? (product.suggestedPrice ? String(product.suggestedPrice) : ''));
  const [supplierPrice, setSupplierPrice] = useState(initial?.supplierPrice ?? (product.suggestedCost ? String(product.suggestedCost) : ''));
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate ?? '');

  function handleSubmit(e) {
    e.preventDefault();
    if (!stock || !salePrice) return;
    onSave({ stock, salePrice, supplierPrice, expiryDate });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-[var(--mg-bg-surface)] rounded-t-3xl sm:rounded-3xl w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 space-y-4">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto sm:hidden" />
          <div className="flex items-center gap-3">
            <ProductThumb imageData={product.imageData} name={product.name} />
            <div className="min-w-0 flex-1">
              <p className="font-black text-[var(--mg-text-primary)] truncate">{product.name}</p>
              {product.brand && <p className="text-xs text-[var(--mg-text-faint)] truncate">{product.brand}</p>}
            </div>
            <button type="button" onClick={onClose} className="w-8 h-8 bg-[var(--mg-bg-elevated)] rounded-full flex items-center justify-center text-[var(--mg-text-muted)] font-bold text-lg shrink-0">×</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">Stock inicial *</label>
              <input
                type="number" min="0" max="999999" step="1"
                value={stock}
                onChange={(e) => setStock(clampNumberInput(e.target.value, { max: 999999 }))}
                onKeyDown={blockInvalidNumberKeys}
                placeholder="Ej: 20"
                autoFocus
                required
                className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--mg-text-primary)] focus:outline-none focus:border-[var(--mg-accent-border)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">Precio venta (Bs) *</label>
                <input
                  type="number" min="0" max="999999" step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(clampNumberInput(e.target.value, { max: 999999 }))}
                  onKeyDown={blockInvalidNumberKeys}
                  required
                  className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--mg-text-primary)] focus:outline-none focus:border-[var(--mg-accent-border)]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">Precio compra (Bs)</label>
                <input
                  type="number" min="0" max="999999" step="0.01"
                  value={supplierPrice}
                  onChange={(e) => setSupplierPrice(clampNumberInput(e.target.value, { max: 999999 }))}
                  onKeyDown={blockInvalidNumberKeys}
                  className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--mg-text-secondary)] focus:outline-none focus:border-[var(--mg-accent-border)]"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">Fecha de vencimiento (opcional)</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--mg-text-secondary)] focus:outline-none focus:border-[var(--mg-accent-border)]"
              />
            </div>
            <div className="flex gap-2 pt-1">
              {onRemove && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] font-bold py-3 px-4 rounded-2xl text-sm active:scale-95 shrink-0"
                >
                  Quitar
                </button>
              )}
              <button
                type="submit"
                disabled={!stock || !salePrice}
                className="flex-1 bg-[var(--mg-accent)] text-white font-bold py-3 rounded-2xl text-sm active:scale-95 disabled:opacity-50"
              >
                {onRemove ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function ImportCatalogModal({ business, masterProducts, onClose, onImported }) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todas');
  const [selected, setSelected] = useState({}); // { [masterProductId]: { stock, salePrice, supplierPrice, expiryDate } }
  const [editingProduct, setEditingProduct] = useState(null); // master product object currently in the mini-ficha
  const [importing, setImporting] = useState(false);

  const categories = ['Todas', ...Array.from(new Set(masterProducts.map((p) => p.category).filter(Boolean)))];

  const filtered = masterProducts
    .filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand || '').toLowerCase().includes(search.toLowerCase())
    )
    .filter((p) => filterCategory === 'Todas' || p.category === filterCategory);

  const selectedIds = Object.keys(selected);

  function handleSaveItem(data) {
    setSelected((prev) => ({ ...prev, [editingProduct.id]: data }));
    setEditingProduct(null);
  }

  function handleRemoveItem(id) {
    setSelected((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    setEditingProduct(null);
  }

  async function handleImport() {
    if (selectedIds.length === 0) return;
    setImporting(true);
    try {
      const items = selectedIds.map((id) => ({ id, ...selected[id] }));
      await importCatalogToBusiness(business.id, items);
      alert(`${items.length} producto(s) importado(s) a "${business.name}".`);
      onImported();
    } catch (err) {
      console.error(err);
      alert(`No se pudo importar el catálogo.\n\n${err?.message || err}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--mg-bg-surface)] rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[var(--mg-separator)] flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-black text-[var(--mg-text-primary)]">Importar catálogo</h3>
            <p className="text-xs text-[var(--mg-text-faint)]">Destino: {business.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-[var(--mg-bg-elevated)] rounded-full flex items-center justify-center text-[var(--mg-text-muted)] font-bold text-lg">×</button>
        </div>

        <div className="p-4 space-y-3 shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍  Buscar producto o marca..."
            className="w-full border-2 border-[var(--mg-border)] rounded-2xl px-4 py-2.5 focus:outline-none focus:border-[var(--mg-accent-border)] text-sm"
          />
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map((cat) => (
              <button key={cat} type="button" onClick={() => setFilterCategory(cat)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  filterCategory === cat ? 'bg-[var(--mg-accent)] text-white shadow-sm' : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
                }`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-[var(--mg-text-faint)]">
              <p className="text-4xl mb-3">📦</p>
              <p className="font-semibold">{masterProducts.length === 0 ? 'El catálogo maestro está vacío' : 'No encontrado'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {filtered.map((product) => {
                const isSelected = selected[product.id] !== undefined;
                return (
                  <ProductCatalogCard
                    key={product.id}
                    product={product}
                    priceLabel={`Bs ${Number(product.suggestedPrice || 0).toFixed(2)}`}
                    metaLabel={isSelected ? (
                      <p className="text-[11px] font-bold text-green-600 mt-1">Stock: {selected[product.id].stock}</p>
                    ) : null}
                    selected={isSelected}
                    onSelect={() => setEditingProduct(product)}
                    actionArea={
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setEditingProduct(product); }}
                        className={`w-8 h-8 rounded-full text-white shadow-lg flex items-center justify-center active:scale-90 font-black text-base leading-none ${
                          isSelected ? 'bg-green-500' : 'bg-[var(--mg-accent)]'
                        }`}
                        title={isSelected ? 'Editar datos' : 'Agregar'}
                      >
                        {isSelected ? '✓' : '+'}
                      </button>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[var(--mg-separator)] flex items-center gap-3 shrink-0">
          <p className="flex-1 text-sm font-bold text-[var(--mg-text-secondary)]">
            {selectedIds.length} seleccionado(s)
          </p>
          <button
            type="button"
            disabled={selectedIds.length === 0 || importing}
            onClick={handleImport}
            className="bg-[var(--mg-accent)] text-white font-bold py-3 px-6 rounded-2xl text-sm active:scale-95 disabled:opacity-50"
          >
            {importing ? 'Importando...' : `Importar ${selectedIds.length || ''}`}
          </button>
        </div>
      </div>

      {editingProduct && (
        <ItemDetailSheet
          product={editingProduct}
          initial={selected[editingProduct.id]}
          onSave={handleSaveItem}
          onRemove={selected[editingProduct.id] ? () => handleRemoveItem(editingProduct.id) : null}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </div>
  );
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const { uploadProductImage } = useImageUpload();
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [masterProducts, setMasterProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null); // { type, data }
  const [processing, setProcessing] = useState('');

  const [catalogForm, setCatalogForm] = useState(EMPTY_CATALOG_FORM);
  const [catalogFormId, setCatalogFormId] = useState(() => generateUUID());
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [uploadingCatalogImage, setUploadingCatalogImage] = useState(false);
  const catalogNameRef = useRef(null);
  const [importBusiness, setImportBusiness] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [reqs, biz, cat] = await Promise.all([getAllRequests(), getAllBusinesses(), getMasterProducts()]);
    setRequests(reqs);
    setBusinesses(biz);
    setMasterProducts(cat);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function setCatalogField(key, value) {
    setCatalogForm((f) => ({ ...f, [key]: value }));
  }

  async function handleCatalogImagePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCatalogImage(true);
    try {
      const url = await uploadProductImage(file, masterImagePath(catalogFormId));
      if (url) setCatalogField('imageData', url);
    } catch (err) {
      console.error(err);
      alert('No se pudo subir la imagen. Verifica tu conexión.');
    } finally {
      setUploadingCatalogImage(false);
      e.target.value = '';
    }
  }

  async function handleSaveCatalogProduct(e) {
    e.preventDefault();
    if (!catalogForm.name.trim()) return;
    setSavingCatalog(true);
    try {
      await addMasterProduct({ ...catalogForm, id: catalogFormId });
      const updated = await getMasterProducts();
      setMasterProducts(updated);
      setCatalogForm(EMPTY_CATALOG_FORM);
      setCatalogFormId(generateUUID());
      catalogNameRef.current?.focus();
    } catch (err) {
      console.error(err);
      alert(`No se pudo guardar el producto.\n\n${err?.message || err}`);
    } finally {
      setSavingCatalog(false);
    }
  }

  async function handleDeleteCatalogProduct(product) {
    if (!window.confirm(`¿Eliminar "${product.name}" del catálogo maestro?`)) return;
    try {
      await deleteMasterProduct(product.id);
      setMasterProducts((prev) => prev.filter((p) => p.id !== product.id));
    } catch (err) {
      console.error(err);
      alert('No se pudo eliminar.');
    }
  }

  const pending  = requests.filter((r) => r.status === 'pending');
  const reviewed = requests.filter((r) => r.status !== 'pending');

  async function handleApprove(req, note) {
    setProcessing(req.id);
    try {
      await approveRequest(req, note);
      await fetchAll();
    } finally { setProcessing(''); setConfirm(null); }
  }

  async function handleReject(req, note) {
    setProcessing(req.id);
    try {
      await rejectRequest(req.id, req.userId, note);
      await fetchAll();
    } finally { setProcessing(''); setConfirm(null); }
  }

  async function handleSuspend(biz, note) {
    setProcessing(biz.id);
    try {
      await suspendBusiness(biz.id, biz.ownerId);
      await fetchAll();
    } finally { setProcessing(''); setConfirm(null); }
  }

  async function handleReactivate(biz) {
    setProcessing(biz.id);
    try {
      await reactivateBusiness(biz.id, biz.ownerId);
      await fetchAll();
    } finally { setProcessing(''); }
  }

  return (
    <div className="min-h-screen bg-[var(--mg-bg-elevated)]">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white px-4 py-4 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black">Panel Admin</h1>
            <p className="text-indigo-200 text-xs">Mi Ganancia — Control SaaS</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')}
              className="text-indigo-200 text-sm font-semibold">
              ← Mi app
            </button>
            <button onClick={signOut} className="text-indigo-200 text-sm font-semibold">
              Salir
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">

        {/* Stats rápidas */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-amber-600">{pending.length}</p>
            <p className="text-xs text-amber-500 font-semibold">Pendientes</p>
          </div>
          <div className="bg-[var(--mg-accent)] border-2 border-[var(--mg-accent-border)] rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-[var(--mg-accent)]">
              {businesses.filter((b) => b.status === 'active').length}
            </p>
            <p className="text-xs text-[var(--mg-accent)] font-semibold">Activos</p>
          </div>
          <div className="bg-[var(--mg-bg-elevated)] border-2 border-[var(--mg-border)] rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-[var(--mg-text-secondary)]">{businesses.length}</p>
            <p className="text-xs text-[var(--mg-text-muted)] font-semibold">Total negocios</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-[var(--mg-border)] rounded-2xl p-1">
          {[
            { key: 'requests', label: `Solicitudes (${pending.length})` },
            { key: 'businesses', label: `Negocios (${businesses.length})` },
            { key: 'catalog', label: `Catálogo (${masterProducts.length})` },
            { key: 'history', label: 'Historial' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                tab === key ? 'bg-[var(--mg-bg-surface)] text-[var(--mg-text-primary)] shadow-sm' : 'text-[var(--mg-text-muted)]'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── SOLICITUDES PENDIENTES ── */}
            {tab === 'requests' && (
              <div className="space-y-3">
                {pending.length === 0 ? (
                  <div className="text-center py-12 text-[var(--mg-text-faint)]">
                    <p className="text-4xl mb-3">✅</p>
                    <p className="font-semibold">Sin solicitudes pendientes</p>
                  </div>
                ) : pending.map((req) => (
                  <div key={req.id} className="bg-[var(--mg-bg-surface)] rounded-2xl p-4 border-2 border-amber-200 shadow-sm">
                    <div className="flex items-start gap-3 mb-3">
                      <img src={req.photoURL || ''} alt=""
                        onError={(e) => { e.target.style.display='none'; }}
                        className="w-11 h-11 rounded-xl object-cover border border-[var(--mg-border)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[var(--mg-text-primary)] truncate">{req.displayName}</p>
                        <p className="text-[var(--mg-text-faint)] text-xs truncate">{req.email}</p>
                        <p className="text-xs text-[var(--mg-text-faint)] mt-0.5">{formatDate(req.createdAt)}</p>
                      </div>
                      <Badge status={req.status} />
                    </div>

                    <div className="bg-indigo-50 rounded-xl px-3 py-2 mb-3">
                      <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wide">Negocio solicitado</p>
                      <p className="font-bold text-indigo-700 text-base">{req.businessName}</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        disabled={processing === req.id}
                        onClick={() => setConfirm({ type: 'reject', data: req })}
                        className="flex-1 bg-[var(--mg-danger-bg)] border-2 border-[var(--mg-danger)] text-[var(--mg-danger)] font-bold py-2.5 rounded-xl text-sm active:scale-95 disabled:opacity-50"
                      >
                        ✕ Rechazar
                      </button>
                      <button
                        disabled={processing === req.id}
                        onClick={() => setConfirm({ type: 'approve', data: req })}
                        className="flex-2 bg-[var(--mg-accent)] text-white font-bold py-2.5 px-5 rounded-xl text-sm active:scale-95 disabled:opacity-50 flex-[2]"
                      >
                        {processing === req.id ? '...' : '✓ Aprobar acceso'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── NEGOCIOS ACTIVOS ── */}
            {tab === 'businesses' && (
              <div className="space-y-3">
                {businesses.length === 0 ? (
                  <div className="text-center py-12 text-[var(--mg-text-faint)]">
                    <p className="text-4xl mb-3">🏪</p>
                    <p className="font-semibold">Sin negocios aún</p>
                  </div>
                ) : businesses.map((biz) => (
                  <div key={biz.id}
                    className={`bg-[var(--mg-bg-surface)] rounded-2xl p-4 border-2 shadow-sm ${
                      biz.status === 'suspended' ? 'border-[var(--mg-danger)]' : 'border-[var(--mg-border)]'
                    }`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[var(--mg-text-primary)] text-base truncate">{biz.name}</p>
                        <p className="text-[var(--mg-text-faint)] text-xs mt-0.5">ID: {biz.id.slice(0, 10)}...</p>
                        <p className="text-[var(--mg-text-faint)] text-xs">Creado: {formatDate(biz.createdAt)}</p>
                      </div>
                      <Badge status={biz.status || 'active'} />
                    </div>

                    {biz.status === 'suspended' ? (
                      <button
                        disabled={processing === biz.id}
                        onClick={() => handleReactivate(biz)}
                        className="w-full bg-[var(--mg-accent)] text-white font-bold py-2.5 rounded-xl text-sm active:scale-95 disabled:opacity-50"
                      >
                        {processing === biz.id ? '...' : '✓ Reactivar negocio'}
                      </button>
                    ) : (
                      <button
                        disabled={processing === biz.id}
                        onClick={() => setConfirm({ type: 'suspend', data: biz })}
                        className="w-full bg-[var(--mg-danger-bg)] border-2 border-[var(--mg-danger)] text-[var(--mg-danger)] font-bold py-2.5 rounded-xl text-sm active:scale-95 disabled:opacity-50"
                      >
                        {processing === biz.id ? '...' : '🔒 Suspender acceso'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setImportBusiness(biz)}
                      className="w-full mt-2 bg-[var(--mg-info-bg)] border-2 border-[var(--mg-accent-border)] text-[var(--mg-accent)] font-bold py-2.5 rounded-xl text-sm active:scale-95"
                    >
                      📦 Importar catálogo
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ── CATÁLOGO MAESTRO ── */}
            {tab === 'catalog' && (
              <div className="space-y-4">
                <form onSubmit={handleSaveCatalogProduct} className="bg-[var(--mg-bg-surface)] rounded-2xl p-4 border-2 border-[var(--mg-border)] space-y-3">
                  <div className="flex items-center gap-3">
                    {catalogForm.imageData ? (
                      <img src={catalogForm.imageData} alt="Preview"
                        className="w-16 h-16 rounded-xl object-cover border-2 border-[var(--mg-accent-border)] shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-[var(--mg-bg-elevated)] flex items-center justify-center text-2xl shrink-0 border-2 border-dashed border-gray-300">
                        📷
                      </div>
                    )}
                    <label className="relative flex-1 bg-[var(--mg-info-bg)] border-2 border-[var(--mg-accent-border)] text-[var(--mg-accent)] font-bold py-2.5 rounded-xl text-sm text-center active:scale-95 cursor-pointer select-none overflow-hidden">
                      {uploadingCatalogImage ? 'Subiendo...' : (catalogForm.imageData ? 'Cambiar foto' : 'Subir foto')}
                      <input type="file" accept="image/*" onChange={handleCatalogImagePick} disabled={uploadingCatalogImage}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                    </label>
                  </div>

                  <input ref={catalogNameRef} type="text" value={catalogForm.name}
                    onChange={(e) => setCatalogField('name', e.target.value)}
                    placeholder="Nombre del producto *" required autoFocus maxLength={80}
                    className="w-full border-2 border-[var(--mg-border)] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[var(--mg-accent-border)] text-sm" />

                  <input type="text" value={catalogForm.brand}
                    onChange={(e) => setCatalogField('brand', e.target.value)}
                    placeholder="Marca" maxLength={60}
                    className="w-full border-2 border-[var(--mg-border)] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[var(--mg-accent-border)] text-sm" />

                  <div className="grid grid-cols-2 gap-2">
                    <select value={catalogForm.category} onChange={(e) => setCatalogField('category', e.target.value)}
                      className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2.5 focus:outline-none focus:border-[var(--mg-accent-border)] text-sm bg-[var(--mg-bg-surface)]">
                      {DEFAULT_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <select value={catalogForm.unit} onChange={(e) => setCatalogField('unit', e.target.value)}
                      className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2.5 focus:outline-none focus:border-[var(--mg-accent-border)] text-sm bg-[var(--mg-bg-surface)]">
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

                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" min="0" max="999999" step="0.01" value={catalogForm.suggestedPrice}
                      onChange={(e) => setCatalogField('suggestedPrice', clampNumberInput(e.target.value, { max: 999999 }))}
                      onKeyDown={blockInvalidNumberKeys}
                      placeholder="Precio sugerido (Bs)"
                      className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2.5 focus:outline-none focus:border-[var(--mg-accent-border)] text-sm font-bold text-[var(--mg-text-primary)]" />
                    <input type="number" min="0" max="999999" step="0.01" value={catalogForm.suggestedCost}
                      onChange={(e) => setCatalogField('suggestedCost', clampNumberInput(e.target.value, { max: 999999 }))}
                      onKeyDown={blockInvalidNumberKeys}
                      placeholder="Costo sugerido (Bs)"
                      className="w-full border-2 border-[var(--mg-border)] rounded-xl px-3 py-2.5 focus:outline-none focus:border-[var(--mg-accent-border)] text-sm" />
                  </div>

                  <button type="submit" disabled={savingCatalog || uploadingCatalogImage}
                    className="w-full bg-[var(--mg-accent)] text-white font-bold py-3 rounded-2xl text-sm active:scale-95 disabled:opacity-50">
                    {savingCatalog ? 'Guardando...' : '+ Agregar al catálogo'}
                  </button>
                </form>

                <div className="space-y-2">
                  {masterProducts.length === 0 ? (
                    <div className="text-center py-8 text-[var(--mg-text-faint)]">
                      <p className="text-4xl mb-3">🗂️</p>
                      <p className="font-semibold">Catálogo maestro vacío</p>
                    </div>
                  ) : masterProducts.map((product) => (
                    <div key={product.id} className="bg-[var(--mg-bg-surface)] rounded-2xl p-3 border border-[var(--mg-border)] flex items-center gap-3">
                      {product.imageData ? (
                        <img src={product.imageData} alt={product.name}
                          className="w-11 h-11 rounded-xl object-cover shrink-0 border border-[var(--mg-border)]" />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-[var(--mg-bg-elevated)] flex items-center justify-center text-xl shrink-0">📦</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[var(--mg-text-primary)] text-sm truncate">{product.name}</p>
                        <p className="text-xs text-[var(--mg-text-faint)] truncate">{product.brand || '—'} · {product.category}</p>
                      </div>
                      <p className="text-sm font-black text-[var(--mg-accent)] shrink-0">Bs {Number(product.suggestedPrice || 0).toFixed(2)}</p>
                      <button onClick={() => handleDeleteCatalogProduct(product)}
                        className="w-8 h-8 hover:bg-red-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-[var(--mg-danger)] active:scale-95 transition-all shrink-0">
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── HISTORIAL ── */}
            {tab === 'history' && (
              <div className="space-y-2">
                {reviewed.length === 0 ? (
                  <div className="text-center py-12 text-[var(--mg-text-faint)]">
                    <p className="text-4xl mb-3">📋</p>
                    <p className="font-semibold">Sin historial aún</p>
                  </div>
                ) : reviewed.map((req) => (
                  <div key={req.id} className="bg-[var(--mg-bg-surface)] rounded-2xl p-4 border border-[var(--mg-border)] flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[var(--mg-text-primary)] text-sm truncate">{req.businessName}</p>
                      <p className="text-[var(--mg-text-faint)] text-xs truncate">{req.email}</p>
                      {req.adminNote && (
                        <p className="text-[var(--mg-text-faint)] text-xs italic mt-0.5">"{req.adminNote}"</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <Badge status={req.status} />
                      <p className="text-gray-300 text-xs mt-1">{formatDate(req.reviewedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Refresh */}
        <button onClick={fetchAll}
          className="w-full bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] font-semibold py-3 rounded-2xl text-sm active:scale-95">
          🔄 Actualizar
        </button>
      </div>

      {/* Confirm Modal */}
      {confirm?.type === 'approve' && (
        <ConfirmModal
          message={`¿Aprobar acceso a "${confirm.data.businessName}"?`}
          placeholder="Nota de bienvenida (opcional)"
          onConfirm={(note) => handleApprove(confirm.data, note)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.type === 'reject' && (
        <ConfirmModal
          message={`¿Rechazar solicitud de "${confirm.data.businessName}"?`}
          placeholder="Motivo del rechazo (opcional)"
          onConfirm={(note) => handleReject(confirm.data, note)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.type === 'suspend' && (
        <ConfirmModal
          message={`¿Suspender acceso a "${confirm.data.name}"?`}
          placeholder="Motivo de suspensión (opcional)"
          onConfirm={(note) => handleSuspend(confirm.data, note)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {importBusiness && (
        <ImportCatalogModal
          business={importBusiness}
          masterProducts={masterProducts}
          onClose={() => setImportBusiness(null)}
          onImported={() => setImportBusiness(null)}
        />
      )}
    </div>
  );
}
