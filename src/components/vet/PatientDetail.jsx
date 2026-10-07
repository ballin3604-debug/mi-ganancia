import { petAge, ownerWhatsApp } from '../../services/vet';
import { AppIcon } from '../icons';

function fmtDate(d) {
  if (!d) return '';
  const dt = d?.toDate ? d.toDate() : new Date(typeof d === 'string' && d.length === 10 ? `${d}T00:00:00` : d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Ficha del paciente: datos + acciones + línea de tiempo clínica.
export default function PatientDetail({
  pet, owner, records, vaccinations, prescriptions, reminders,
  onBack, onEdit, onDelete, onAction, onPrintCarnet, onPrintReceta,
}) {
  const timeline = [
    ...records.map((r) => ({ kind: 'record', date: r.visitDate, data: r })),
    ...vaccinations.map((v) => ({ kind: 'vaccination', date: v.dateApplied, data: v })),
    ...prescriptions.map((p) => ({
      kind: 'prescription',
      date: p.createdAt?.toDate ? p.createdAt.toDate().toISOString().slice(0, 10) : (p.createdAt || ''),
      data: p,
    })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const waLink = owner?.phone
    ? ownerWhatsApp(owner.phone, `Hola 🐾, te escribimos de la veterinaria por ${pet.name}.`)
    : null;

  return (
    <div className="space-y-3.5 mg-fade-in">
      <button type="button" onClick={onBack} className="text-sm font-bold text-[var(--mg-accent)] active:scale-95">
        ← Pacientes
      </button>

      {/* Encabezado */}
      <div className="bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] p-4 flex items-center gap-3.5">
        {pet.photoUrl ? (
          <img src={pet.photoUrl} alt={pet.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-[var(--mg-accent-border)] shrink-0" />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] flex items-center justify-center text-4xl shrink-0">
            {pet.species === 'gato' ? '🐱' : pet.species === 'otro' ? '🐾' : '🐶'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-[var(--mg-text-primary)] truncate">{pet.name}</h2>
          <p className="text-xs font-bold text-[var(--mg-text-muted)]">
            {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}{petAge(pet.birthdate) ? ` · ${petAge(pet.birthdate)}` : ''}
          </p>
          <p className="text-xs text-[var(--mg-text-secondary)] font-semibold mt-1">
            👤 {owner?.name || 'Sin dueño'}{owner?.phone ? ` · ${owner.phone}` : ''}
            {pet.weight ? ` · ⚖️ ${pet.weight} Kg` : ''}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button type="button" onClick={() => onEdit(pet)} className="w-9 h-9 rounded-xl bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] flex items-center justify-center active:scale-95" title="Editar">
            <AppIcon name="editar" size={15} />
          </button>
          <button type="button" onClick={() => onDelete(pet)} className="w-9 h-9 rounded-xl bg-[var(--mg-danger-bg)] border border-red-200 flex items-center justify-center active:scale-95" title="Eliminar">
            <AppIcon name="eliminar" size={15} />
          </button>
        </div>
      </div>

      {/* Acciones */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { id: 'record', icon: 'consulta', label: 'Consulta' },
          { id: 'prescription', icon: 'receta', label: 'Receta' },
          { id: 'vaccination', icon: 'vacuna', label: 'Vacuna' },
          { id: 'reminder', icon: 'recordatorio', label: 'Recordatorio' },
          { id: 'carnet', icon: 'carnet', label: 'Carnet' },
          ...(waLink ? [{ id: 'whatsapp', icon: 'whatsapp', label: 'WhatsApp' }] : []),
        ].map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onAction(a.id)}
            className={a.id === 'whatsapp'
              ? 'bg-[#25D366] text-white rounded-2xl py-2.5 font-bold text-[11px] active:scale-95 flex flex-col items-center gap-0.5'
              : 'bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-2xl py-2.5 font-bold text-[var(--mg-text-secondary)] text-[11px] active:scale-95 flex flex-col items-center gap-0.5'}
          >
            <AppIcon name={a.icon} size={20} color={a.id === 'whatsapp' ? '#fff' : undefined} />
            {a.label}
          </button>
        ))}
      </div>

      {/* Línea de tiempo */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-wider text-[var(--mg-text-muted)] mb-2 px-1">
          Historial clínico ({timeline.length})
        </h3>
        {timeline.length === 0 ? (
          <div className="text-center py-8 bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)]">
            <p className="text-3xl mb-1">📋</p>
            <p className="text-xs font-bold text-[var(--mg-text-muted)]">Sin registros todavía.<br />Toca Consulta, Receta o Vacuna para empezar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {timeline.map((t, i) => (
              <div key={`${t.kind}-${i}`} className="bg-[var(--mg-bg-surface)] rounded-2xl border border-[var(--mg-border)] p-3.5">
                {t.kind === 'record' && (
                  <>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1"><AppIcon name="consulta" size={10} /> CONSULTA</span>
                      <span className="text-[11px] font-bold text-[var(--mg-text-muted)]">{fmtDate(t.data.visitDate)}</span>
                    </div>
                    {t.data.reason && <p className="text-xs text-[var(--mg-text-secondary)]"><strong>Motivo:</strong> {t.data.reason}</p>}
                    {t.data.diagnosis && <p className="text-xs text-[var(--mg-text-secondary)] mt-0.5"><strong>Dx:</strong> {t.data.diagnosis}</p>}
                    {t.data.treatment && <p className="text-xs text-[var(--mg-text-secondary)] mt-0.5"><strong>Tx:</strong> {t.data.treatment}</p>}
                    {(t.data.weight || t.data.vetName) && (
                      <p className="text-[11px] text-[var(--mg-text-muted)] mt-1">
                        {t.data.weight ? `⚖️ ${t.data.weight} Kg ` : ''}{t.data.vetName ? `· 👨‍⚕️ ${t.data.vetName}` : ''}
                      </p>
                    )}
                  </>
                )}
                {t.kind === 'vaccination' && (
                  <>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"><AppIcon name="vacuna" size={10} /> VACUNA</span>
                      <span className="text-[11px] font-bold text-[var(--mg-text-muted)]">{fmtDate(t.data.dateApplied)}</span>
                    </div>
                    <p className="text-sm font-black text-[var(--mg-text-primary)]">{t.data.vaccineName}</p>
                    {t.data.nextDue && (
                      <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mt-1.5 inline-block">
                        Próxima: {fmtDate(t.data.nextDue)}
                      </p>
                    )}
                  </>
                )}
                {t.kind === 'prescription' && (
                  <>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1"><AppIcon name="receta" size={10} /> RECETA</span>
                      <span className="text-[11px] font-bold text-[var(--mg-text-muted)]">{fmtDate(t.data.createdAt)}</span>
                    </div>
                    <div className="space-y-1">
                      {(t.data.items || []).map((it, j) => (
                        <p key={j} className="text-xs text-[var(--mg-text-secondary)]">
                          <strong>{j + 1}. {it.name}</strong>
                          {(it.dosage || it.frequency || it.duration) && (
                            <span className="text-[var(--mg-text-muted)]"> — {[it.dosage, it.frequency, it.duration].filter(Boolean).join(' · ')}</span>
                          )}
                        </p>
                      ))}
                    </div>
                    <button
                      type="button" onClick={() => onPrintReceta(t.data)}
                      className="mt-2 text-[11px] font-black text-[var(--mg-accent)] bg-[var(--mg-accent-bg)] border border-[var(--mg-accent-border)] rounded-lg px-3 py-1.5 active:scale-95 flex items-center gap-1.5"
                    >
                      <AppIcon name="recibo" size={12} /> Imprimir receta
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {reminders.filter((r) => r.status === 'pending').length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
          <p className="text-[11px] font-black text-amber-800 uppercase tracking-wide mb-1.5">⏰ Pendientes de {pet.name}</p>
          {reminders.filter((r) => r.status === 'pending').map((r) => (
            <p key={r.id} className="text-xs font-semibold text-amber-900">• {r.title} — {fmtDate(r.dueDate)}</p>
          ))}
        </div>
      )}
    </div>
  );
}
