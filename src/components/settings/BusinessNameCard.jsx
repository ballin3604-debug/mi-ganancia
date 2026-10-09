import { useState } from 'react';
import { AppIcon } from '../icons';

export function BusinessNameCard({ currentName, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(value);
      setEditing(false);
    } catch (err) {
      alert(err.message || 'No se pudo guardar el nombre.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-10 h-10 rounded-2xl bg-[var(--mg-accent-bg)] border border-[var(--mg-accent-border)] text-[var(--mg-accent)] flex items-center justify-center shrink-0 font-black text-lg">
            {(editing ? value : currentName)?.charAt(0)?.toUpperCase() || 'M'}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--mg-text-muted)]">Nombre del negocio</p>
            {editing ? (
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                maxLength={60}
                placeholder="Ej: Tienda Don Freddy"
                className="mg-input text-sm font-black py-1.5 mt-0.5"
              />
            ) : (
              <p className="font-black text-[var(--mg-text-primary)] text-base truncate">{currentName || 'Mi negocio'}</p>
            )}
            {!editing && (
              <p className="text-[var(--mg-text-muted)] text-[11px]">Sale en recibos, PDFs y reportes</p>
            )}
          </div>
        </div>
        {editing ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-3 py-2 rounded-xl bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] text-[var(--mg-text-secondary)] text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={value.trim().length < 2 || saving}
              className="px-3 py-2 rounded-xl bg-[var(--mg-accent)] text-white text-xs font-bold disabled:opacity-50"
            >
              {saving ? '...' : 'Guardar'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setValue(currentName || ''); setEditing(true); }}
            className="px-3.5 py-2 bg-[var(--mg-bg-elevated)] hover:bg-[var(--mg-bg-section)] text-[var(--mg-text-primary)] font-bold text-xs rounded-xl border border-[var(--mg-border)] transition-all active:scale-95 shrink-0 min-h-[40px] flex items-center gap-1.5"
          >
            <AppIcon name="editar" size={13} /> <span>Cambiar</span>
          </button>
        )}
      </div>
    </div>
  );
}
