import { useState } from 'react';
import { useImageUpload } from '../../hooks/useImageUpload';

const SPECIES = [
  { id: 'perro', label: '🐶 Perro' },
  { id: 'gato', label: '🐱 Gato' },
  { id: 'otro', label: '🐾 Otro' },
];

function Shell({ title, subtitle, onClose, children, wide = false }) {
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 mg-backdrop-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-[var(--mg-bg-surface)] w-full ${wide ? 'max-w-lg' : 'max-w-md'} rounded-t-[28px] sm:rounded-[28px] border border-[var(--mg-border)] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col mg-modal-in`}
      >
        <div className="p-4 border-b border-[var(--mg-separator)] flex items-center justify-between bg-[var(--mg-bg-elevated)] shrink-0">
          <div>
            <h3 className="font-extrabold text-[var(--mg-text-primary)] text-sm">{title}</h3>
            {subtitle && <p className="text-[11px] text-[var(--mg-text-muted)]">{subtitle}</p>}
          </div>
          <button
            type="button" onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] flex items-center justify-center font-bold text-base text-[var(--mg-text-muted)] shrink-0"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function SaveBar({ onCancel, saving, label = 'Guardar' }) {
  return (
    <div className="flex gap-2">
      <button type="button" onClick={onCancel} className="flex-1 mg-btn-tertiary !py-3 text-sm">
        Cancelar
      </button>
      <button type="submit" disabled={saving} className="flex-[2] mg-btn-primary !py-3 text-sm">
        {saving ? 'Guardando…' : label}
      </button>
    </div>
  );
}

// ── Mascota + dueño (crear o editar; dueño existente o nuevo en línea) ──
export function PetFormModal({ businessId, owners, initialPet, onSave, onClose }) {
  const isEdit = !!initialPet?.id;
  const { pickImage } = useImageUpload();
  const [ownerMode, setOwnerMode] = useState(initialPet?.ownerId ? 'exist' : 'new');
  const [ownerId, setOwnerId] = useState(initialPet?.ownerId || '');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [name, setName] = useState(initialPet?.name || '');
  const [species, setSpecies] = useState(initialPet?.species || 'perro');
  const [breed, setBreed] = useState(initialPet?.breed || '');
  const [sex, setSex] = useState(initialPet?.sex || '');
  const [birthdate, setBirthdate] = useState(initialPet?.birthdate || '');
  const [weight, setWeight] = useState(initialPet?.weight ?? '');
  const [color, setColor] = useState(initialPet?.color || '');
  const [chipCode, setChipCode] = useState(initialPet?.chipCode || '');
  const [photoUrl, setPhotoUrl] = useState(initialPet?.photo_url || initialPet?.photoUrl || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    try { e.target.value = ''; } catch { /* ignore */ }
    if (!file) return;
    try {
      const data = await pickImage(file, 300);
      if (data) setPhotoUrl(data);
    } catch {
      setError('No se pudo leer la foto.');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Ponle un nombre a la mascota.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        pet: {
          ...(initialPet || {}),
          name: name.trim(), species, breed: breed.trim(), sex,
          birthdate: birthdate || null,
          weight: weight === '' ? null : Number(weight),
          color: color.trim(), chipCode: chipCode.trim(), photoUrl,
        },
        ownerMode, ownerId,
        newOwner: { name: ownerName.trim(), phone: ownerPhone.trim() },
      });
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell title={isEdit ? '✏️ Editar paciente' : '🐾 Nueva mascota'} subtitle="Datos del paciente y su dueño" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-3.5">
        <div className="flex items-center gap-3">
          {photoUrl ? (
            <img src={photoUrl} alt="Mascota" className="w-16 h-16 rounded-2xl object-cover border-2 border-[var(--mg-accent-border)] shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-[var(--mg-bg-elevated)] border-2 border-dashed border-[var(--mg-border)] flex items-center justify-center text-3xl shrink-0">
              {species === 'gato' ? '🐱' : species === 'otro' ? '🐾' : '🐶'}
            </div>
          )}
          <label className="relative flex-1 bg-[var(--mg-accent-bg)] border border-[var(--mg-accent-border)] text-[var(--mg-accent)] font-extrabold py-2.5 rounded-xl text-xs text-center cursor-pointer overflow-hidden">
            📷 {photoUrl ? 'Cambiar foto' : 'Foto (opcional)'}
            <input type="file" accept="image/*" onChange={handlePhoto} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
          </label>
        </div>

        <Field label="Nombre de la mascota *">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Rocky" maxLength={60} required className="mg-input font-bold" />
        </Field>

        <div>
          <p className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider mb-1.5">Especie</p>
          <div className="grid grid-cols-3 gap-2">
            {SPECIES.map((s) => (
              <button
                key={s.id} type="button" onClick={() => setSpecies(s.id)}
                className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${species === s.id ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent)]' : 'border-[var(--mg-border)] text-[var(--mg-text-muted)]'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Raza">
            <input type="text" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Ej: Labrador" maxLength={60} className="mg-input text-xs" />
          </Field>
          <div>
            <p className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider mb-1">Sexo</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[{ id: 'macho', l: '♂️' }, { id: 'hembra', l: '♀️' }].map((s) => (
                <button
                  key={s.id} type="button" onClick={() => setSex(sex === s.id ? '' : s.id)}
                  className={`py-2 rounded-xl text-sm border-2 ${sex === s.id ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)]' : 'border-[var(--mg-border)]'}`}
                >
                  {s.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nacimiento">
            <input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} className="mg-input text-xs" />
          </Field>
          <Field label="Peso (Kg)">
            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Ej: 12.5" min="0" step="0.1" className="mg-input text-xs" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Color">
            <input type="text" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Ej: Café" maxLength={40} className="mg-input text-xs" />
          </Field>
          <Field label="Chip / código">
            <input type="text" value={chipCode} onChange={(e) => setChipCode(e.target.value)} placeholder="Opcional" maxLength={40} className="mg-input text-xs font-mono" />
          </Field>
        </div>

        {!isEdit && (
          <div className="bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-2xl p-3 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button" onClick={() => setOwnerMode('exist')}
                className={`py-2 rounded-xl text-xs font-bold border-2 ${ownerMode === 'exist' ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent)]' : 'border-[var(--mg-border)] text-[var(--mg-text-muted)]'}`}
              >
                Dueño existente
              </button>
              <button
                type="button" onClick={() => setOwnerMode('new')}
                className={`py-2 rounded-xl text-xs font-bold border-2 ${ownerMode === 'new' ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent)]' : 'border-[var(--mg-border)] text-[var(--mg-text-muted)]'}`}
              >
                Dueño nuevo
              </button>
            </div>
            {ownerMode === 'exist' ? (
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="mg-input text-xs font-bold">
                <option value="">Sin dueño / callejero</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} · {o.phone || 'sin tel.'}</option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Nombre del dueño" maxLength={60} className="mg-input text-xs" />
                <input type="tel" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="Tel/WhatsApp" inputMode="tel" maxLength={20} className="mg-input text-xs" />
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs font-bold text-[var(--mg-danger)] bg-[var(--mg-danger-bg)] border border-red-200 rounded-xl px-3 py-2">⚠️ {error}</p>
        )}

        <SaveBar onCancel={onClose} saving={saving} label={isEdit ? 'Guardar cambios' : 'Registrar paciente'} />
      </form>
    </Shell>
  );
}

// ── Consulta clínica ──
export function RecordFormModal({ petName, vetDefault = '', onSave, onClose }) {
  const [vetName, setVetName] = useState(vetDefault);
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!reason.trim() && !diagnosis.trim()) {
      setError('Escribe el motivo o el diagnóstico.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ vetName, visitDate, reason, diagnosis, treatment, weight: weight === '' ? null : Number(weight) });
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell title="🩺 Nueva consulta" subtitle={petName} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} required className="mg-input text-xs" />
          </Field>
          <Field label="Peso hoy (Kg)">
            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Opcional" min="0" step="0.1" className="mg-input text-xs" />
          </Field>
        </div>
        <Field label="Motivo *">
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: vómito, decaído, control" maxLength={120} className="mg-input text-xs font-semibold" />
        </Field>
        <Field label="Diagnóstico">
          <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Ej: gastroenteritis leve" rows={2} maxLength={500} className="mg-input text-xs" />
        </Field>
        <Field label="Tratamiento indicado">
          <textarea value={treatment} onChange={(e) => setTreatment(e.target.value)} placeholder="Ej: dieta blanda 3 días + suero" rows={2} maxLength={500} className="mg-input text-xs" />
        </Field>
        <Field label="Veterinario">
          <input type="text" value={vetName} onChange={(e) => setVetName(e.target.value)} placeholder="Tu nombre" maxLength={60} className="mg-input text-xs" />
        </Field>
        {error && <p className="text-xs font-bold text-[var(--mg-danger)] bg-[var(--mg-danger-bg)] border border-red-200 rounded-xl px-3 py-2">⚠️ {error}</p>}
        <SaveBar onCancel={onClose} saving={saving} label="Guardar consulta" />
      </form>
    </Shell>
  );
}

// ── Receta ──
export function PrescriptionFormModal({ petName, onSave, onClose }) {
  const [items, setItems] = useState([{ name: '', dosage: '', frequency: '', duration: '' }]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setItem(i, patch) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave({ items, notes });
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell title="💊 Nueva receta" subtitle={petName} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-3">
        {items.map((it, i) => (
          <div key={i} className="bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black text-[var(--mg-text-muted)] uppercase">Medicamento {i + 1}</p>
              {items.length > 1 && (
                <button type="button" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} className="text-[var(--mg-danger)] font-black text-sm px-1">
                  ✕
                </button>
              )}
            </div>
            <input type="text" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="Ej: Amoxicilina 250mg" maxLength={80} className="mg-input text-xs font-bold" />
            <div className="grid grid-cols-3 gap-2">
              <input type="text" value={it.dosage} onChange={(e) => setItem(i, { dosage: e.target.value })} placeholder="Dosis (5ml)" maxLength={40} className="mg-input text-xs" />
              <input type="text" value={it.frequency} onChange={(e) => setItem(i, { frequency: e.target.value })} placeholder="Cada 8h" maxLength={40} className="mg-input text-xs" />
              <input type="text" value={it.duration} onChange={(e) => setItem(i, { duration: e.target.value })} placeholder="7 días" maxLength={40} className="mg-input text-xs" />
            </div>
          </div>
        ))}
        <button
          type="button" onClick={() => setItems((prev) => [...prev, { name: '', dosage: '', frequency: '', duration: '' }])}
          className="w-full border-2 border-dashed border-[var(--mg-accent-border)] text-[var(--mg-accent)] rounded-xl py-2 text-xs font-bold active:scale-95"
        >
          + Agregar medicamento
        </button>
        <Field label="Indicaciones generales">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: volver a control en 7 días" rows={2} maxLength={300} className="mg-input text-xs" />
        </Field>
        {error && <p className="text-xs font-bold text-[var(--mg-danger)] bg-[var(--mg-danger-bg)] border border-red-200 rounded-xl px-3 py-2">⚠️ {error}</p>}
        <SaveBar onCancel={onClose} saving={saving} label="Guardar receta" />
      </form>
    </Shell>
  );
}

// ── Vacuna ──
export function VaccinationFormModal({ petName, onSave, onClose }) {
  const [vaccineName, setVaccineName] = useState('');
  const [dateApplied, setDateApplied] = useState(() => new Date().toISOString().slice(0, 10));
  const [withNext, setWithNext] = useState(true);
  const [nextDue, setNextDue] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!vaccineName.trim()) {
      setError('Poné el nombre de la vacuna.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ vaccineName, dateApplied, nextDue: withNext ? nextDue : null });
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell title="💉 Registrar vacuna" subtitle={petName} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-3">
        <Field label="Vacuna *">
          <input type="text" value={vaccineName} onChange={(e) => setVaccineName(e.target.value)} placeholder="Ej: Antirrábica, Séxtuple" maxLength={80} className="mg-input text-xs font-bold" />
        </Field>
        <Field label="Fecha aplicada">
          <input type="date" value={dateApplied} onChange={(e) => setDateApplied(e.target.value)} required className="mg-input text-xs" />
        </Field>
        <label className="flex items-center gap-2.5 cursor-pointer select-none bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-xl px-3 py-2.5">
          <input type="checkbox" checked={withNext} onChange={(e) => setWithNext(e.target.checked)} className="w-5 h-5 accent-[#1670C2]" />
          <span className="text-xs font-bold text-[var(--mg-text-secondary)]">Crear recordatorio de próxima dosis</span>
        </label>
        {withNext && (
          <Field label="Próxima dosis">
            <input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} required={withNext} className="mg-input text-xs" />
          </Field>
        )}
        {error && <p className="text-xs font-bold text-[var(--mg-danger)] bg-[var(--mg-danger-bg)] border border-red-200 rounded-xl px-3 py-2">⚠️ {error}</p>}
        <SaveBar onCancel={onClose} saving={saving} label="Guardar vacuna" />
      </form>
    </Shell>
  );
}

// ── Recordatorio manual ──
const REMINDER_TYPES = [
  { id: 'vacuna', label: '💉 Vacuna' },
  { id: 'control', label: '🩺 Control' },
  { id: 'bano', label: '🛁 Baño' },
  { id: 'desparasitacion', label: '💊 Desparasitación' },
  { id: 'otro', label: '📌 Otro' },
];

export function ReminderFormModal({ petName, onSave, onClose }) {
  const [type, setType] = useState('control');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave({ type, title, dueDate });
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell title="⏰ Nuevo recordatorio" subtitle={petName} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {REMINDER_TYPES.map((t) => (
            <button
              key={t.id} type="button" onClick={() => setType(t.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-2 ${type === t.id ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent)]' : 'border-[var(--mg-border)] text-[var(--mg-text-muted)]'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Field label="Título *">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Control post operatorio" maxLength={100} className="mg-input text-xs font-bold" />
        </Field>
        <Field label="Fecha *">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required className="mg-input text-xs" />
        </Field>
        {error && <p className="text-xs font-bold text-[var(--mg-danger)] bg-[var(--mg-danger-bg)] border border-red-200 rounded-xl px-3 py-2">⚠️ {error}</p>}
        <SaveBar onCancel={onClose} saving={saving} label="Crear recordatorio" />
      </form>
    </Shell>
  );
}
