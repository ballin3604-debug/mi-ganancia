import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranches } from '../context/BranchContext';
import {
  addBranch, updateBranch, setMainBranch, deleteBranch,
} from '../services/branches';
import { transferStock, getBranchStocks, getTransfers, toStockMap, subscribeBranchStock } from '../services/branchStock';
import { getProducts, subscribeToProducts } from '../services/products';
import { AppIcon } from './icons';
import MetricCard from './ui/MetricCard';

function BranchForm({ onDone }) {
  const { businessId } = useAuth();
  const { refreshBranches } = useBranches();
  const [name, setName] = useState('');
  const [type, setType] = useState('sucursal');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addBranch(businessId, { name, type, address });
      await refreshBranches();
      onDone();
    } catch (err) {
      alert(err.message || 'No se pudo crear la sede.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-2xl p-4 space-y-3">
      <div>
        <label className="text-xs font-bold text-[var(--mg-text-secondary)] block mb-1">Nombre de la sede *</label>
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Sucursal Mercado, Almacén Norte" maxLength={60} required autoFocus
          className="mg-input"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { id: 'sucursal', icon: 'tienda', label: 'Sucursal' },
          { id: 'almacen', icon: 'almacen', label: 'Almacén' },
        ].map((t) => (
          <button
            key={t.id} type="button" onClick={() => setType(t.id)}
            className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center gap-1.5 ${type === t.id ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent)]' : 'border-[var(--mg-border)] text-[var(--mg-text-muted)]'}`}
          >
            <AppIcon name={t.icon} size={15} /> {t.label}
          </button>
        ))}
      </div>
      <div>
        <label className="text-xs font-bold text-[var(--mg-text-secondary)] block mb-1">Dirección (opcional)</label>
        <input
          type="text" value={address} onChange={(e) => setAddress(e.target.value)}
          placeholder="Ej: Av. Principal #123" maxLength={120}
          className="mg-input"
        />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="flex-1 mg-btn-tertiary !py-2.5 text-sm">
          Cancelar
        </button>
        <button type="submit" disabled={saving || !name.trim()} className="flex-1 mg-btn-primary !py-2.5 text-sm">
          {saving ? 'Guardando…' : 'Crear sede'}
        </button>
      </div>
    </form>
  );
}

function BranchTransferModal({ businessId, userId, branches, products, stockMap, initialFromId, onClose, onDone }) {
  const [productId, setProductId] = useState('');
  const [query, setQuery] = useState('');
  const [fromId, setFromId] = useState(initialFromId || '');
  const [toId, setToId] = useState('');
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const matches = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return products.slice(0, 8);
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, query]);

  const selected = products.find((p) => p.id === productId) || null;
  const available = fromId && selected ? Number(stockMap.get(`${fromId}:${selected.id}`) ?? selected.stock ?? 0) : 0;

  useEffect(() => {
    if (branches.length > 0 && !fromId) setFromId(initialFromId || branches[0].id);
    if (branches.length > 1 && !toId) {
      const other = branches.find((b) => b.id !== (initialFromId || branches[0].id));
      if (other) setToId(other.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches.length]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!selected || !fromId || !toId || fromId === toId || !(Number(qty) > 0)) {
      setError('Elige producto, dos sedes distintas y cantidad mayor a 0.');
      return;
    }
    setSaving(true);
    try {
      await transferStock(businessId, userId, selected, fromId, toId, Math.floor(Number(qty)));
      onDone();
    } catch (err) {
      setError(err.message || 'No se pudo hacer el traspaso.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-[var(--mg-bg-surface)] w-full max-w-md rounded-t-[28px] sm:rounded-[28px] border border-[var(--mg-border)] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)]">
          <h3 className="font-extrabold text-[var(--mg-text-primary)] text-sm flex items-center gap-1.5">
            <AppIcon name="traspaso" size={15} /> Traspasar stock entre sedes
          </h3>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto">
          <div>
            <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">Producto *</label>
            {selected ? (
              <div className="flex items-center justify-between bg-[var(--mg-accent-bg)] border border-[var(--mg-accent-border)] rounded-xl px-3 py-2">
                <span className="text-xs font-black text-[var(--mg-text-primary)] truncate">{selected.name}</span>
                <button type="button" onClick={() => { setProductId(''); setQuery(''); }} className="text-[11px] font-bold text-[var(--mg-accent)] shrink-0">Cambiar</button>
              </div>
            ) : (
              <>
                <input
                  type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar producto o código..."
                  className="mg-input text-xs font-semibold"
                />
                {query.trim() && (
                  <div className="mt-1.5 border border-[var(--mg-border)] rounded-xl overflow-hidden divide-y divide-[var(--mg-separator)] max-h-40 overflow-y-auto">
                    {matches.map((p) => (
                      <button key={p.id} type="button" onClick={() => { setProductId(p.id); setQuery(''); }} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-[var(--mg-bg-elevated)]">
                        {p.name}
                      </button>
                    ))}
                    {matches.length === 0 && <p className="px-3 py-2 text-xs text-[var(--mg-text-muted)]">Sin resultados.</p>}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">Origen *</label>
              <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="mg-input text-xs font-bold">
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">Destino *</label>
              <select value={toId} onChange={(e) => setToId(e.target.value)} className="mg-input text-xs font-bold">
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">
              Cantidad * {selected && fromId ? <span className="font-normal">(disponible: {available} und.)</span> : null}
            </label>
            <input
              type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)}
              placeholder="Ej: 12" className="mg-input text-xs font-bold"
            />
          </div>
          {error && <p className="rounded-xl border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] px-3 py-2 text-xs font-bold text-[var(--mg-danger)]">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 mg-btn-tertiary !py-2.5 text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 mg-btn-primary !py-2.5 text-sm">
              {saving ? 'Traspasando…' : 'Traspasar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BranchManagerInner() {
  const { businessId, user } = useAuth();
  const { branches, activeBranchId, selectBranch, refreshBranches, loading, loadError } = useBranches();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [stockRows, setStockRows] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [filterType, setFilterType] = useState('all'); // all | sucursal | almacen
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState('');
  const [transferFrom, setTransferFrom] = useState(null);
  const [showTransfer, setShowTransfer] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    getProducts(businessId).then(setProducts).catch(() => {});
    const unsub = subscribeToProducts(businessId, setProducts);
    return unsub;
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    let alive = true;
    getBranchStocks(businessId).then((rows) => { if (alive) setStockRows(rows || []); }).catch(() => {});
    const unsub = subscribeBranchStock(businessId, (rows) => { if (alive) setStockRows(rows || []); });
    return () => { alive = false; unsub(); };
  }, [businessId]);

  const stockMap = useMemo(() => toStockMap(stockRows), [stockRows]);
  const hasRows = stockRows.length > 0;
  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);

  const filtered = useMemo(() => (
    branches.filter((b) => {
      if (filterType === 'sucursal' && b.type === 'almacen') return false;
      if (filterType === 'almacen' && b.type !== 'almacen') return false;
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return b.name.toLowerCase().includes(q) || (b.address || '').toLowerCase().includes(q);
    })
  ), [branches, filterType, search]);

  const branchStats = useMemo(() => {
    const map = {};
    branches.forEach((b) => { map[b.id] = { total: 0, skus: 0 }; });
    if (hasRows) {
      const seen = {};
      stockRows.forEach((r) => {
        const s = Number(r.stock || 0);
        if (!map[r.branch_id]) map[r.branch_id] = { total: 0, skus: 0 };
        map[r.branch_id].total += s;
        const k = `${r.branch_id}:${r.product_id}`;
        if (s > 0 && !seen[k]) { seen[k] = true; map[r.branch_id].skus += 1; }
      });
    } else {
      // Legado sin filas por sede: todo vive en el global
      const mainId = branches.find((b) => b.isMain)?.id || branches[0]?.id;
      if (mainId && map[mainId]) {
        map[mainId].total = products.reduce((s, p) => s + Number(p.stock || 0), 0);
        map[mainId].skus = products.filter((p) => Number(p.stock || 0) > 0).length;
      }
    }
    return map;
  }, [branches, stockRows, products, hasRows]);

  const sucCount = branches.filter((b) => b.type !== 'almacen').length;
  const almCount = branches.filter((b) => b.type === 'almacen').length;
  const consolidated = Object.values(branchStats).reduce((s, b) => s + b.total, 0);
  const activeBranch = branches.find((b) => b.id === activeBranchId) || null;

  async function loadHistory() {
    try {
      setTransfers(await getTransfers(businessId, null, 30));
    } catch { setTransfers([]); }
  }

  async function handleRename(branch) {
    const name = editName.trim();
    if (!name || name === branch.name) { setEditing(null); return; }
    setBusy(branch.id);
    try {
      await updateBranch(branch.id, { name });
      await refreshBranches();
      setEditing(null);
    } catch (err) {
      alert(err.message || 'No se pudo renombrar.');
    } finally {
      setBusy('');
    }
  }

  async function handleSetMain(branch) {
    setBusy(branch.id);
    try {
      await setMainBranch(businessId, branch.id);
      await refreshBranches();
    } catch (err) {
      alert(err.message || 'No se pudo cambiar la principal.');
    } finally {
      setBusy('');
    }
  }

  async function handleDelete(branch) {
    if (!window.confirm(`¿Eliminar "${branch.name}"? Solo se puede si no tiene ventas ni gastos.`)) return;
    setBusy(branch.id);
    try {
      await deleteBranch(businessId, branch);
      await refreshBranches();
    } catch (err) {
      alert(err.message || 'No se pudo eliminar.');
    } finally {
      setBusy('');
    }
  }

  if (loadError === 'missing-table') {
    return (
      <div className="rounded-2xl border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] p-4 text-center">
        <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--mg-gold-border)] bg-[var(--mg-bg-surface)]">
          <AppIcon name="almacen" size={20} />
        </span>
        <p className="text-xs font-bold text-[var(--mg-gold-text)]">
          Falta aplicar el SQL de sucursales en Supabase (scripts/migraciones-saas.sql).
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-4 border-[var(--mg-accent-border)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--mg-text-muted)]">Gestión de sedes</p>
        <div className="flex items-center gap-2 sm:shrink-0">
          <button
            type="button"
            onClick={() => { setShowHistory((v) => { if (!v) loadHistory(); return !v; }); }}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
              showHistory
                ? 'border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent)]'
                : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-text-secondary)]'
            }`}
          >
            <AppIcon name="historial" size={14} /> Historial{transfers.length > 0 ? ` (${transfers.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--mg-accent)] px-4 py-2 text-xs font-black text-white transition-all hover:bg-[var(--mg-accent-hover)]"
          >
            <AppIcon name="mas" size={14} color="#fff" /> Añadir sede
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg-soft)] p-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent)]">
              <AppIcon name="tienda" size={18} />
            </span>
            <div>
              <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-[var(--mg-text-primary)]">
                Operando en: {activeBranch?.name || '—'}
                <span className="rounded-md bg-[var(--mg-accent-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--mg-accent)]">Punto de venta activo</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--mg-text-secondary)]">
                Las ventas se registran en esta sede. Los <strong>almacenes</strong> abastecen a tus sucursales con traspasos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setTransferFrom(null); setShowTransfer(true); }}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--mg-accent-border)] bg-[var(--mg-bg-surface)] px-3 py-2 text-xs font-bold text-[var(--mg-accent)] transition-all hover:bg-[var(--mg-accent-bg)]"
          >
            <AppIcon name="traspaso" size={14} /> Traspasar stock
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total de sedes" value={branches.length} hint={`${sucCount} POS · ${almCount} almacenes`} icon="sucursales" tone="brand" />
        <MetricCard label="Sucursales (POS)" value={sucCount} hint="Cajas y tickets por sede" icon="tienda" tone="action" />
        <MetricCard label="Almacenes y bodegas" value={almCount} hint="Recepción y despacho" icon="almacen" tone="warning" />
        <MetricCard label="Stock consolidado" value={consolidated.toLocaleString('es-BO')} hint={`Operando en ${activeBranch?.name || '—'}`} icon="paquete" tone="success" />
      </div>

      {/* Historial de traspasos */}
      {showHistory && (
        <div className="bg-[var(--mg-bg-surface)] rounded-2xl border border-[var(--mg-border)] p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-black uppercase tracking-wider text-[var(--mg-text-primary)] flex items-center gap-1.5">
              <AppIcon name="historial" size={14} /> Últimos traspasos entre sedes
            </p>
            <button type="button" onClick={() => setShowHistory(false)} className="text-[11px] font-bold text-[var(--mg-text-muted)] hover:underline">Cerrar</button>
          </div>
          {transfers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-[var(--mg-text-muted)] uppercase text-[10px] border-b border-[var(--mg-border)]">
                    <th className="py-2 pr-2">Producto</th>
                    <th className="py-2 pr-2">Origen</th>
                    <th className="py-2 pr-2">Destino</th>
                    <th className="py-2 pr-2 text-right">Cant.</th>
                    <th className="py-2 text-right">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--mg-separator)] font-bold">
                  {transfers.map((t) => {
                    const pname = byId[t.product_id]?.name || 'Producto';
                    const from = branches.find((b) => b.id === t.from_branch_id)?.name || '—';
                    const to = branches.find((b) => b.id === t.to_branch_id)?.name || '—';
                    const d = t.created_at ? new Date(t.created_at) : null;
                    return (
                      <tr key={t.id}>
                        <td className="py-2 pr-2 text-[var(--mg-text-primary)]">{pname}</td>
                        <td className="py-2 pr-2 text-[var(--mg-text-secondary)]">{from}</td>
                        <td className="py-2 pr-2 text-[var(--mg-text-secondary)]">{to}</td>
                        <td className="py-2 pr-2 text-right tabular-nums text-[#1670C2]">{t.quantity} und.</td>
                        <td className="py-2 text-right text-[var(--mg-text-muted)] font-semibold">{d ? d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' }) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-[var(--mg-text-muted)] font-medium py-2">Aún no hay traspasos registrados.</p>
          )}
        </div>
      )}

      {/* Filtros + búsqueda + crear */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 p-1 bg-[var(--mg-bg-elevated)] rounded-xl border border-[var(--mg-border)] overflow-x-auto scrollbar-none">
          {[
            { id: 'all', label: `Todas (${branches.length})` },
            { id: 'sucursal', label: `Sucursales (${sucCount})` },
            { id: 'almacen', label: `Almacenes (${almCount})` },
          ].map((f) => (
            <button
              key={f.id} type="button" onClick={() => setFilterType(f.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${filterType === f.id ? 'bg-[var(--mg-bg-surface)] text-[var(--mg-text-primary)] shadow-xs border border-[var(--mg-border)]' : 'text-[var(--mg-text-muted)]'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <span className="absolute left-3 top-1/2 -translate-y-1/2"><AppIcon name="search" size={14} /></span>
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o dirección..."
              className="w-full bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-xl pl-9 pr-8 py-2 text-xs font-bold placeholder:font-normal focus:outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--mg-text-muted)] text-xs">×</button>
            )}
          </div>
          <button
            type="button" onClick={() => setShowForm(true)}
            className="px-3.5 py-2 bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <AppIcon name="mas" size={14} color="#fff" /> Añadir sede
          </button>
        </div>
      </div>

      {/* Tarjetas de sedes */}
      {filtered.length > 0 ? (
        <div className="mg-grid-auto">
          {filtered.map((b) => {
            const active = b.id === activeBranchId;
            const st = branchStats[b.id] || { total: 0, skus: 0 };
            return (
              <div key={b.id} className={`bg-[var(--mg-bg-surface)] rounded-[22px] border-2 overflow-hidden flex flex-col transition-all ${active ? 'border-[var(--mg-accent)] shadow-md' : 'border-[var(--mg-border)]'}`}>
                {active && (
                  <div className="bg-[var(--mg-accent)] px-4 py-1.5 flex items-center justify-between text-white">
                    <span className="text-[10px] font-black tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> OPERANDO AQUÍ
                    </span>
                    <span className="text-[10px] font-semibold opacity-90">Punto de venta activo</span>
                  </div>
                )}
                <div className="p-4 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="w-11 h-11 rounded-xl bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] flex items-center justify-center shrink-0">
                        <AppIcon name={b.type === 'almacen' ? 'almacen' : 'tienda'} size={20} />
                      </span>
                      <div className="min-w-0">
                        {editing === b.id ? (
                          <div className="flex gap-1.5">
                            <input
                              type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                              autoFocus maxLength={60}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(b); if (e.key === 'Escape') setEditing(null); }}
                              className="flex-1 min-w-0 border border-[var(--mg-accent-border)] rounded-lg px-2 py-1 text-sm font-bold focus:outline-none"
                            />
                            <button type="button" onClick={() => handleRename(b)} disabled={busy === b.id} className="text-xs font-bold text-white bg-[var(--mg-accent)] px-2.5 rounded-lg">OK</button>
                          </div>
                        ) : (
                          <p className="font-black text-[var(--mg-text-primary)] truncate">{b.name}</p>
                        )}
                        <p className="text-[11px] text-[var(--mg-text-muted)] font-semibold mt-0.5">
                          {b.type === 'almacen' ? 'Almacén / Bodega' : 'Sucursal Comercial'}
                          {b.isMain ? ' · ⭐ Casa Matriz' : ''}
                          {b.address ? ` · ${b.address}` : ''}
                        </p>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setEditing(b.id); setEditName(b.name); }} title="Editar sede" className="p-1.5 text-[var(--mg-text-muted)] hover:bg-[var(--mg-bg-elevated)] rounded-lg shrink-0">
                      <AppIcon name="editar" size={14} />
                    </button>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[var(--mg-separator)] flex items-center gap-3 text-[11px] font-bold text-[var(--mg-text-secondary)]">
                    <span className="tabular-nums">{st.total.toLocaleString('es-BO')} und. en stock</span>
                    <span className="text-[var(--mg-text-faint)]">·</span>
                    <span className="tabular-nums">{st.skus} SKUs</span>
                  </div>
                </div>

                <div className="px-4 py-2.5 bg-[var(--mg-bg-elevated)]/60 border-t border-[var(--mg-separator)] flex items-center gap-1.5 flex-wrap">
                  {!active ? (
                    <button type="button" onClick={() => selectBranch(b.id)} className="px-3 py-1.5 text-[11px] font-black text-[var(--mg-accent)] bg-[var(--mg-bg-surface)] border border-[var(--mg-accent-border)] rounded-xl active:scale-95 flex items-center gap-1">
                      <AppIcon name="ok" size={12} /> Operar aquí
                    </button>
                  ) : (
                    <span className="text-[11px] font-bold text-[var(--mg-accent)] flex items-center gap-1 px-1">
                      <span className="w-2 h-2 rounded-full bg-[var(--mg-accent)]" /> Sede activa en caja
                    </span>
                  )}
                  <button type="button" onClick={() => navigate('/inventario')} className="px-2.5 py-1.5 text-[11px] font-bold text-[var(--mg-text-secondary)] hover:bg-[var(--mg-bg-surface)] rounded-xl flex items-center gap-1">
                    <AppIcon name="paquete" size={12} /> Ver stock ({st.total.toLocaleString('es-BO')})
                  </button>
                  <button type="button" onClick={() => { setTransferFrom(b.id); setShowTransfer(true); }} className="px-2.5 py-1.5 text-[11px] font-bold text-[var(--mg-text-secondary)] hover:bg-[var(--mg-bg-surface)] rounded-xl flex items-center gap-1">
                    <AppIcon name="traspaso" size={12} /> Traspaso
                  </button>
                  {!b.isMain && (
                    <>
                      <button type="button" onClick={() => handleSetMain(b)} disabled={busy === b.id} className="px-2.5 py-1.5 text-[11px] font-bold text-[var(--mg-text-secondary)] hover:bg-[var(--mg-bg-surface)] rounded-xl disabled:opacity-50">
                        Hacer principal
                      </button>
                      <button type="button" onClick={() => handleDelete(b)} disabled={busy === b.id} className="px-2.5 py-1.5 text-[11px] font-bold text-[var(--mg-danger)] hover:bg-[var(--mg-danger-bg)] rounded-xl disabled:opacity-50 flex items-center">
                        <AppIcon name="eliminar" size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[var(--mg-bg-surface)] rounded-2xl border border-[var(--mg-border)] p-10 text-center">
          <p className="font-black text-[var(--mg-text-primary)]">Sin sedes con ese criterio</p>
          <p className="text-xs text-[var(--mg-text-muted)] mt-1 mb-4">Ajusta la búsqueda o crea una nueva sede.</p>
          <button type="button" onClick={() => { setSearch(''); setFilterType('all'); setShowForm(true); }} className="px-4 py-2 bg-[var(--mg-accent)] text-white text-xs font-black rounded-xl">
            Añadir sede
          </button>
        </div>
      )}

      {showForm && (
        <BranchForm onDone={() => { setShowForm(false); refreshBranches(); }} />
      )}

      {showTransfer && (
        <BranchTransferModal
          businessId={businessId}
          userId={user?.uid || user?.id}
          branches={branches}
          products={products}
          stockMap={stockMap}
          initialFromId={transferFrom}
          onClose={() => { setShowTransfer(false); setTransferFrom(null); }}
          onDone={() => { setShowTransfer(false); setTransferFrom(null); refreshBranches(); }}
        />
      )}
    </div>
  );
}

export default function BranchManager() {
  return <BranchManagerInner />;
}
