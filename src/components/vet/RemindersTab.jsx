import { useState } from 'react';
import { petAge, ownerWhatsApp, reminderMessage, setReminderStatus } from '../../services/vet';

function daysInfo(dueDate) {
  if (!dueDate) return { label: 'Sin fecha', tone: 'muted', diff: 9999 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${dueDate}T00:00:00`);
  const diff = Math.round((d - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `Venció hace ${Math.abs(diff)}d`, tone: 'bad', diff };
  if (diff === 0) return { label: '¡Hoy!', tone: 'warn', diff };
  if (diff <= 7) return { label: `En ${diff}d`, tone: 'warn', diff };
  return { label: d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' }), tone: 'muted', diff };
}

const TYPE_ICON = { vacuna: '💉', control: '🩺', bano: '🛁', desparasitacion: '💊', otro: '📌' };

// Lista de recordatorios con botón WhatsApp al dueño.
export default function RemindersTab({ reminders, petsById, ownersById, onChanged }) {
  const [busy, setBusy] = useState('');

  const pending = reminders
    .filter((r) => r.status === 'pending')
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

  async function handleDone(r) {
    setBusy(r.id);
    try {
      await setReminderStatus(r.id, 'done');
      onChanged();
    } catch (err) {
      alert(err.message || 'No se pudo actualizar.');
    } finally {
      setBusy('');
    }
  }

  async function handleSent(r) {
    setBusy(r.id);
    try {
      await setReminderStatus(r.id, 'sent');
      onChanged();
    } catch {
      setBusy('');
    }
  }

  if (pending.length === 0) {
    return (
      <div className="text-center py-12 bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] p-6">
        <p className="text-4xl mb-2">🎉</p>
        <p className="font-extrabold text-[var(--mg-text-primary)] text-sm">Sin recordatorios pendientes</p>
        <p className="text-xs text-[var(--mg-text-muted)] mt-1">Las próximas vacunas crean avisos solos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {pending.map((r) => {
        const pet = petsById[r.petId] || {};
        const owner = ownersById[pet.ownerId] || {};
        const info = daysInfo(r.dueDate);
        const msg = reminderMessage(pet.name || 'tu mascota', r.title, r.dueDate);
        return (
          <div
            key={r.id}
            className={`bg-[var(--mg-bg-surface)] rounded-2xl p-3.5 border-2 transition-all ${
              info.tone === 'bad' ? 'border-red-300 bg-red-50/40'
              : info.tone === 'warn' ? 'border-amber-200 bg-amber-50/40'
              : 'border-[var(--mg-border)]'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] flex items-center justify-center text-xl shrink-0">
                {TYPE_ICON[r.type] || '📌'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-[var(--mg-text-primary)] text-sm truncate">
                  {pet.name || '—'} <span className="font-semibold text-[var(--mg-text-muted)]">· {r.title}</span>
                </p>
                <p className="text-[11px] text-[var(--mg-text-muted)] font-semibold mt-0.5">
                  👤 {owner.name || 'Sin dueño'}{owner.phone ? ` · ${owner.phone}` : ''} · {petAge(pet.birthdate) ? `${petAge(pet.birthdate)} · ` : ''}{info.label}
                </p>
              </div>
              <span className={`text-[10px] font-black px-2 py-1 rounded-full shrink-0 ${
                info.tone === 'bad' ? 'bg-red-600 text-white'
                : info.tone === 'warn' ? 'bg-amber-400 text-white'
                : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
              }`}>
                {info.label}
              </span>
            </div>

            <div className="flex gap-2 mt-3">
              {owner.phone ? (
                <a
                  href={ownerWhatsApp(owner.phone, msg)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => handleSent(r)}
                  className="flex-[2] bg-[#25D366] text-white font-bold py-2.5 rounded-xl text-xs text-center active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <span>💬</span> WhatsApp al dueño
                </a>
              ) : (
                <span className="flex-[2] text-center text-[11px] font-bold text-[var(--mg-text-muted)] bg-[var(--mg-bg-elevated)] rounded-xl py-2.5">
                  Sin teléfono registrado
                </span>
              )}
              <button
                type="button"
                onClick={() => handleDone(r)}
                disabled={busy === r.id}
                className="flex-1 bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] text-[var(--mg-text-secondary)] font-bold py-2.5 rounded-xl text-xs active:scale-95 disabled:opacity-50"
              >
                ✓ Hecho
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
