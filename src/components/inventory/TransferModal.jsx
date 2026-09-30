import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { transferStock, getTransfers } from '../../services/branchStock';

// Traspaso de stock entre sedes + mini historial del producto.
export function TransferModal({ businessId, product, branches, fromBranchId, branchStocks = {}, isOpen, onClose, onDone }) {
  const { user } = useAuth();
  const [from, setFrom] = useState(fromBranchId || '');
  const [to, setTo] = useState('');
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setFrom(fromBranchId || '');
    setTo('');
    setQty('');
    getTransfers(businessId, product.id, 5).then(setHistory).catch(() => setHistory([]));
  }, [isOpen, businessId, product.id, fromBranchId]);

  if (!isOpen) return null;

  const fromStock = Number(branchStocks[from] || 0);
  const qtyVal = Math.floor(Number(qty || 0));
  const valid = from && to && from !== to && qtyVal > 0 && qtyVal <= fromStock;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      await transferStock(businessId, user?.uid, product, from, to, qtyVal);
      onDone();
    } catch (err) {
      alert(err.message || 'No se pudo traspasar.');
    } finally {
      setSaving(false);
    }
  }

  const branchName = (id) => branches.find((b) => b.id === id)?.name || '—';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs mg-backdrop-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--mg-bg-surface)] w-full max-w-md rounded-t-[28px] sm:rounded-[28px] border border-[var(--mg-border)] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col mg-modal-in"
      >
        <div className="p-4 border-b border-[var(--mg-separator)] flex items-center justify-between bg-[var(--mg-bg-elevated)]">
          <div>
            <h3 className="font-extrabold text-[var(--mg-text-primary)] text-sm">🔀 Traspasar stock</h3>
            <p className="text-[11px] text-[var(--mg-text-muted)] truncate max-w-[240px]">{product.name}</p>
          </div>
          <button
            type="button" onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] flex items-center justify-center font-bold text-base text-[var(--mg-text-muted)]"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">Desde</label>
              <select value={from} onChange={(e) => setFrom(e.target.value)} className="mg-input text-xs font-bold" required>
                <option value="">Sede…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.type === 'almacen' ? '📦' : '🏪'} {b.name} ({branchStocks[b.id] ?? 0})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">Hacia</label>
              <select value={to} onChange={(e) => setTo(e.target.value)} className="mg-input text-xs font-bold" required>
                <option value="">Sede…</option>
                {branches.filter((b) => b.id !== from).map((b) => (
                  <option key={b.id} value={b.id}>{b.type === 'almacen' ? '📦' : '🏪'} {b.name} ({branchStocks[b.id] ?? 0})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--mg-text-muted)] block mb-1">
              Cantidad {from ? `(disponible: ${fromStock})` : ''}
            </label>
            <input
              type="number" value={qty} onChange={(e) => setQty(e.target.value)}
              placeholder="Ej: 10" min="1" step="1" required
              className="mg-input font-black"
            />
            {from && qtyVal > fromStock && (
              <p className="text-[11px] text-[var(--mg-danger)] font-bold mt-1">⚠️ Solo hay {fromStock} und. en {branchName(from)}</p>
            )}
          </div>

          <button
            type="submit" disabled={!valid || saving}
            className="w-full bg-[var(--mg-accent)] text-white font-extrabold py-3 rounded-2xl text-sm active:scale-95 disabled:opacity-50"
          >
            {saving ? 'Traspasando…' : `Traspasar ${qtyVal > 0 ? qtyVal : ''} und.`}
          </button>

          {history.length > 0 && (
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)] mb-1.5">
                Últimos traspasos
              </p>
              <div className="space-y-1.5">
                {history.map((t) => (
                  <div key={t.id} className="text-[11px] bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                    <span className="font-bold text-[var(--mg-text-secondary)] truncate">
                      {branchName(t.from_branch_id)} → {branchName(t.to_branch_id)}
                    </span>
                    <span className="font-black text-[var(--mg-text-primary)] shrink-0">×{t.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
