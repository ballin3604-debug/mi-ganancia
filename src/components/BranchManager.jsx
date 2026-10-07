import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBranches } from '../context/BranchContext';
import { addBranch, updateBranch, setMainBranch, deleteBranch } from '../services/branches';
import { PremiumGate } from './UpgradeScreen';
import { AppIcon } from './icons';

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
          { id: 'sucursal', icon: '🏪', label: 'Sucursal' },
          { id: 'almacen', icon: '📦', label: 'Almacén' },
        ].map((t) => (
          <button
            key={t.id} type="button" onClick={() => setType(t.id)}
            className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${type === t.id ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent)]' : 'border-[var(--mg-border)] text-[var(--mg-text-muted)]'}`}
          >
            {t.icon} {t.label}
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

function BranchManagerInner() {
  const { businessId } = useAuth();
  const { branches, activeBranchId, selectBranch, refreshBranches, loading, loadError } = useBranches();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState('');

  if (loadError === 'missing-table') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
        <p className="text-2xl mb-1">🗄️</p>
        <p className="text-xs font-bold text-amber-800">
          Falta aplicar el SQL de sucursales en Supabase (scripts/migraciones-saas.sql).
        </p>
      </div>
    );
  }

  async function handleRename(branch) {
    const name = editName.trim();
    if (!name || name === branch.name) {
      setEditing(null);
      return;
    }
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

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-4 border-[var(--mg-accent-border)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-[var(--mg-accent-bg-soft)] border border-[var(--mg-accent-border)] rounded-2xl px-4 py-3">
        <p className="text-xs text-[var(--mg-text-secondary)] leading-relaxed">
          🏪 Vendés desde la sede marcada con <strong>Operando aquí</strong>. Las ventas se etiquetan por sede para ver reportes separados. El stock por ahora es único (Fase 2: stock por sede + traspasos).
        </p>
      </div>

      {branches.map((b) => {
        const active = b.id === activeBranchId;
        return (
          <div
            key={b.id}
            className={`bg-[var(--mg-bg-surface)] rounded-2xl p-4 border-2 transition-all ${active ? 'border-[var(--mg-accent)]' : 'border-[var(--mg-border)]'}`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] flex items-center justify-center text-xl shrink-0">
                {b.type === 'almacen' ? '📦' : '🏪'}
              </div>
              <div className="flex-1 min-w-0">
                {editing === b.id ? (
                  <div className="flex gap-1.5">
                    <input
                      type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                      autoFocus maxLength={60}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRename(b); if (e.key === 'Escape') setEditing(null); }}
                      className="flex-1 min-w-0 border border-[var(--mg-accent-border)] rounded-lg px-2 py-1 text-sm font-bold focus:outline-none"
                    />
                    <button type="button" onClick={() => handleRename(b)} disabled={busy === b.id} className="text-xs font-bold text-white bg-[var(--mg-accent)] px-2.5 rounded-lg">
                      OK
                    </button>
                  </div>
                ) : (
                  <p className="font-black text-[var(--mg-text-primary)] truncate">{b.name}</p>
                )}
                <p className="text-[11px] text-[var(--mg-text-muted)] font-semibold mt-0.5">
                  {b.type === 'almacen' ? 'Almacén' : 'Sucursal'}
                  {b.isMain ? ' · ⭐ Principal' : ''}
                  {b.address ? ` · ${b.address}` : ''}
                </p>
              </div>
              {active && (
                <span className="text-[10px] font-black uppercase tracking-wide text-white bg-[var(--mg-accent)] px-2 py-1 rounded-full shrink-0">
                  Operando aquí
                </span>
              )}
            </div>

            <div className="flex gap-1.5 mt-3 flex-wrap">
              {!active && (
                <button type="button" onClick={() => selectBranch(b.id)} className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] border border-[var(--mg-accent-border)] active:scale-95 flex items-center gap-1">
                  <AppIcon name="tienda" size={12} /> Operar aquí
                </button>
              )}
              {!b.isMain && (
                <button type="button" onClick={() => handleSetMain(b)} disabled={busy === b.id} className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)] border border-[var(--mg-border)] active:scale-95 disabled:opacity-50 flex items-center gap-1">
                  <AppIcon name="check" size={12} /> Hacer principal
                </button>
              )}
              <button type="button" onClick={() => { setEditing(b.id); setEditName(b.name); }} className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)] border border-[var(--mg-border)] active:scale-95 flex items-center">
                <AppIcon name="editar" size={13} />
              </button>
              {!b.isMain && (
                <button type="button" onClick={() => handleDelete(b)} disabled={busy === b.id} className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] border border-red-200 active:scale-95 disabled:opacity-50 flex items-center">
                  <AppIcon name="eliminar" size={13} />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {showForm ? (
        <BranchForm onDone={() => setShowForm(false)} />
      ) : (
        <button
          type="button" onClick={() => setShowForm(true)}
          className="w-full border-2 border-dashed border-[var(--mg-accent-border)] text-[var(--mg-accent)] rounded-2xl py-3 text-sm font-bold active:scale-95"
        >
          + Nueva sucursal o almacén
        </button>
      )}
    </div>
  );
}

export default function BranchManager() {
  return (
    <PremiumGate feature="branches" title="Sucursales y almacenes es Premium">
      <BranchManagerInner />
    </PremiumGate>
  );
}
