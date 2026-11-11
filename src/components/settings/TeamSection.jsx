import { useState, useRef, useEffect } from 'react';
import { AppIcon } from '../icons';
import { useBranches } from '../../context/BranchContext';
import { MEMBER_PERMISSIONS, DEFAULT_CASHIER_PERMISSIONS, maxMembersForPlan } from '../../services/cashier';
import { ConfirmModal } from './ConfirmModal';
import {
  DEFAULT_SHIFT_DAYS,
  SHIFT_PRESETS,
  WEEK_DAYS,
  formatShiftDays,
  formatShiftRange,
  getShiftStatus,
  normalizeShift,
  validateShift,
} from '../../utils/shifts';

const SHIFT_LABELS = SHIFT_PRESETS.map((preset) => preset.label);

function shiftIcon(label) {
  if (label === 'Mañana') return 'amanecer';
  if (label === 'Tarde') return 'atardecer';
  if (label === 'Noche') return 'luna';
  return 'reloj';
}

function ShiftChip({ shift, now = new Date(), compact = false }) {
  if (!shift) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-2 py-1 text-[10px] font-black text-[var(--mg-gold-text)]">
        <AppIcon name="alerta" size={11} /> Sin turno
      </span>
    );
  }
  const status = getShiftStatus(shift, now);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black ${
        status.active
          ? 'border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]'
          : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)]'
      }`}
    >
      <AppIcon name={shiftIcon(shift.label)} size={11} />
      {compact ? shift.label : `${shift.label} · ${formatShiftRange(shift)}`}
      {status.active ? <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[var(--mg-success)]" /> : null}
    </span>
  );
}

function PermissionsModal({ member, branches = [], busy, onClose, onSave }) {
  const isOwner = member.role !== 'cashier';
  const [selected, setSelected] = useState(() => (
    Array.isArray(member.customPermissions) && member.customPermissions.length > 0
      ? [...member.customPermissions]
      : [...DEFAULT_CASHIER_PERMISSIONS]
  ));
  const [selectedBranches, setSelectedBranches] = useState(() => (
    Array.isArray(member.branchIds) ? [...member.branchIds] : []
  ));
  if (isOwner) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={`Permisos de ${member.displayName}`} onClick={onClose}>
        <div className="w-full max-w-md rounded-3xl bg-[var(--mg-bg-surface)] p-6 shadow-[var(--mg-shadow-lg)]" onClick={(e) => e.stopPropagation()}>
          <p className="font-black text-[var(--mg-text-primary)]">Permisos de {member.displayName}</p>
          <p className="text-xs text-[var(--mg-text-muted)] mt-1">Los dueños siempre tienen todos los permisos.</p>
          <button type="button" onClick={onClose} className="mt-4 w-full py-2.5 rounded-xl bg-[var(--mg-bg-elevated)] font-bold text-xs">Cerrar</button>
        </div>
      </div>
    );
  }
  const toggle = (id) => {
    const def = MEMBER_PERMISSIONS.find((p) => p.id === id);
    if (def?.locked) return;
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const toggleBranch = (id) => {
    setSelectedBranches((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={`Permisos de ${member.displayName}`} onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-[var(--mg-bg-surface)] shadow-[var(--mg-shadow-lg)]" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-[var(--mg-border)]">
          <p className="font-black text-[var(--mg-text-primary)]">Permisos de {member.displayName}</p>
          <p className="text-xs text-[var(--mg-text-muted)] mt-0.5">Se aplican al instante en su teléfono.</p>
        </div>
        <div className="p-4 overflow-y-auto divide-y divide-[var(--mg-separator)]">
          {MEMBER_PERMISSIONS.map((p) => {
            const on = selected.includes(p.id);
            return (
              <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-[var(--mg-text-primary)]">{p.name}</p>
                  <p className="text-[11px] text-[var(--mg-text-muted)]">{p.description}</p>
                </div>
                <button
                  type="button" role="switch" aria-checked={on}
                  disabled={p.locked || busy}
                  onClick={() => toggle(p.id)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-[var(--mg-success)]' : 'bg-[var(--mg-border-hover)]'} ${p.locked ? 'opacity-60' : ''}`}
                  title={p.locked ? 'Siempre activo para cobrar' : undefined}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--mg-bg-surface)] shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
            );
          })}
        </div>
        <BranchesPicker branches={branches} selectedBranches={selectedBranches} onToggle={toggleBranch} />
        <div className="p-4 border-t border-[var(--mg-border)] flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[var(--mg-bg-elevated)] font-bold text-xs">Cancelar</button>
          <button type="button" onClick={() => onSave(selected, selectedBranches)} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-[var(--mg-accent)] text-white font-bold text-xs disabled:opacity-50">
            {busy ? 'Guardando…' : 'Guardar permisos'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BranchesPicker({ branches, selectedBranches, onToggle }) {
  if (branches.length <= 1) return null;
  return (
    <div className="px-4 pb-1">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)] mb-1.5">
        Sedes asignadas
      </p>
      <p className="text-[11px] text-[var(--mg-text-muted)] mb-2">
        Sin marcar = ve todas. Marca para limitarlo a esas sedes.
      </p>
      <div className="space-y-1.5">
        {branches.map((b) => {
          const on = selectedBranches.includes(b.id);
          return (
            <button
              key={b.id} type="button" onClick={() => onToggle(b.id)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${on ? 'border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent-text)]' : 'border-[var(--mg-border)] text-[var(--mg-text-secondary)]'}`}
            >
              <span className="truncate">{b.name}</span>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${on ? 'border-[var(--mg-accent)] bg-[var(--mg-accent)] text-white' : 'border-[var(--mg-border-hover)] text-transparent'}`}>
                ✓
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EditNameModal({ member, busy, onClose, onSave }) {
  const [name, setName] = useState(member.displayName || '');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Editar colaborador" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-[var(--mg-bg-surface)] p-5 shadow-[var(--mg-shadow-lg)]" onClick={(e) => e.stopPropagation()}>
        <p className="font-black text-[var(--mg-text-primary)]">Editar colaborador</p>
        <p className="text-xs text-[var(--mg-text-muted)] mt-0.5 mb-3">Así aparece en ventas y equipo.</p>
        <input
          value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={60}
          placeholder="Nombre y apellido"
          className="mg-input text-sm font-bold"
        />
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[var(--mg-bg-elevated)] font-bold text-xs">Cancelar</button>
          <button type="button" onClick={() => onSave(name)} disabled={busy || name.trim().length < 2} className="flex-1 py-2.5 rounded-xl bg-[var(--mg-accent)] text-white font-bold text-xs disabled:opacity-50">
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShiftModal({ member, busy, onClose, onSave, onClear }) {
  const base = member.shift
    ? normalizeShift(member.shift)
    : { label: 'Mañana', start: '08:00', end: '14:00', days: [...DEFAULT_SHIFT_DAYS] };
  const [label, setLabel] = useState(base.label);
  const [start, setStart] = useState(base.start);
  const [end, setEnd] = useState(base.end);
  const [days, setDays] = useState([...base.days]);
  const [error, setError] = useState('');

  const applyPreset = (preset) => {
    setLabel(preset.label);
    setStart(preset.start);
    setEnd(preset.end);
    setError('');
  };

  const toggleDay = (day) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day]));
  };

  const clean = normalizeShift({ label, start, end, days });
  const overnight = clean.start && clean.end && clean.end <= clean.start;

  async function handleSave() {
    const validation = validateShift(clean);
    if (validation) {
      setError(validation);
      return;
    }
    setError('');
    try {
      await onSave(clean);
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar el turno.');
    }
  }

  async function handleClear() {
    setError('');
    try {
      await onClear(member);
    } catch (clearError) {
      setError(clearError.message || 'No se pudo quitar el turno.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={`Turno de ${member.displayName}`} onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-[var(--mg-bg-surface)] shadow-[var(--mg-shadow-lg)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-[var(--mg-separator)] p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]">
            <AppIcon name="reloj" size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-[var(--mg-text-primary)]">Turno de {member.displayName}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[var(--mg-text-muted)]">
              El horario se repite cada semana hasta que lo cambies.
            </p>
          </div>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <div>
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">Turno rápido</p>
            <div className="grid grid-cols-3 gap-2">
              {SHIFT_PRESETS.map((preset) => {
                const on = label === preset.label && start === preset.start && end === preset.end;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-colors ${
                      on
                        ? 'border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]'
                        : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-secondary)] hover:border-[var(--mg-border-hover)]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-[11px] font-black">
                      <AppIcon name={shiftIcon(preset.label)} size={13} /> {preset.label}
                    </span>
                    <span className="text-[10px] font-bold tabular-nums opacity-80">{preset.start} – {preset.end}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">Entrada</span>
              <input type="time" value={start} onChange={(event) => { setStart(event.target.value); setLabel('Personalizado'); setError(''); }} className="mg-input min-h-[44px] !rounded-xl py-2 text-sm font-black tabular-nums" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">Salida</span>
              <input type="time" value={end} onChange={(event) => { setEnd(event.target.value); setLabel('Personalizado'); setError(''); }} className="mg-input min-h-[44px] !rounded-xl py-2 text-sm font-black tabular-nums" />
            </label>
          </div>

          {overnight ? (
            <p className="flex items-start gap-2 rounded-xl border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-3 py-2 text-[11px] font-bold text-[var(--mg-gold-text)]">
              <AppIcon name="luna" size={14} /> Turno nocturno: empieza un día y termina en la madrugada del día siguiente.
            </p>
          ) : null}

          <div>
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">Días de trabajo</p>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEK_DAYS.map((day) => {
                const on = days.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    aria-pressed={on}
                    title={day.label}
                    className={`min-h-[42px] rounded-xl border text-[11px] font-black transition-colors ${
                      on
                        ? 'border-[var(--mg-brand)] bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)]'
                        : 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
                    }`}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-black text-[var(--mg-text-primary)]">
                <AppIcon name={shiftIcon(clean.label)} size={14} /> {clean.label}
              </span>
              <span className="text-[11px] font-bold tabular-nums text-[var(--mg-text-secondary)]">{formatShiftRange(clean)}</span>
            </div>
            <p className="mt-1 text-[11px] font-semibold text-[var(--mg-text-muted)]">{formatShiftDays(clean.days)}</p>
          </div>

          {error ? <p role="alert" className="text-[11px] font-bold text-[var(--mg-danger)]">{error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--mg-border)] p-4">
          {member.shift ? (
            <button
              type="button"
              onClick={handleClear}
              disabled={busy}
              className="mr-auto min-h-[38px] rounded-xl px-3 text-[11px] font-black text-[var(--mg-danger)] transition-colors hover:bg-[var(--mg-danger-bg)] disabled:opacity-50"
            >
              Quitar turno
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="min-h-[38px] rounded-xl bg-[var(--mg-bg-elevated)] px-4 text-[11px] font-bold text-[var(--mg-text-secondary)]">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={busy} className="min-h-[38px] rounded-xl bg-[var(--mg-brand)] px-4 text-[11px] font-black text-[var(--mg-brand-contrast)] transition-all hover:bg-[var(--mg-brand-hover)] disabled:opacity-50">
            {busy ? 'Guardando…' : 'Guardar turno'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }) {
  if (role !== 'cashier') {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-2 py-0.5 text-[10px] font-black text-[var(--mg-gold-text)]">
        Dueño
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] px-2 py-0.5 text-[10px] font-black text-[var(--mg-accent-text)]">
      <AppIcon name="equipo" size={11} /> Cajero
    </span>
  );
}

function ActionButton({ icon, label, onClick, disabled, tone = 'neutral' }) {
  const tones = {
    neutral: 'text-[var(--mg-text-secondary)] hover:bg-[var(--mg-bg-elevated)] hover:text-[var(--mg-text-primary)]',
    brand: 'border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)] hover:bg-[var(--mg-brand)] hover:text-[var(--mg-brand-contrast)]',
    danger: 'text-[var(--mg-danger)] hover:bg-[var(--mg-danger-bg)]',
    gold: 'text-[var(--mg-gold-text)] hover:bg-[var(--mg-gold-bg)]',
    success: 'text-[var(--mg-success-text)] hover:bg-[var(--mg-success-bg)]',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg border px-2 text-[10px] font-black transition-colors disabled:opacity-40 ${tone === 'brand' ? '' : 'border-[var(--mg-border)]'} ${tones[tone]}`}
    >
      <AppIcon name={icon} size={12} /> {label}
    </button>
  );
}

function MemberCard({ m, isCurrentUser, busy, now, onShift, onPerms, onEdit, onRole, onStatus, onRemove }) {
  const isSuspended = m.status === 'suspended';
  const status = getShiftStatus(m.shift, now);
  return (
    <article className={`flex flex-col rounded-2xl border bg-[var(--mg-bg-surface)] p-4 shadow-xs transition-colors ${isSuspended ? 'border-[var(--mg-border)] opacity-75' : status.active ? 'border-[var(--mg-success-border)]' : 'border-[var(--mg-border)]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--mg-brand)] text-sm font-black text-[var(--mg-brand-contrast)]">
            {m.displayName?.charAt(0)?.toUpperCase() || 'U'}
            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--mg-bg-surface)] ${isSuspended ? 'bg-[var(--mg-gold)]' : 'bg-[var(--mg-success)]'}`} />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-xs font-black text-[var(--mg-text-primary)]">
              <span className="truncate">{m.displayName || 'Sin nombre'}</span>
              {isCurrentUser ? (
                <span className="rounded border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--mg-success-text)]">TÚ</span>
              ) : null}
            </p>
            <p className="mt-0.5 truncate text-[10px] font-semibold text-[var(--mg-text-muted)]">{m.email || 'Sin correo registrado'}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <RoleBadge role={m.role} />
              {isSuspended ? (
                <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-2 py-0.5 text-[10px] font-black text-[var(--mg-gold-text)]">Suspendido</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] px-2 py-0.5 text-[10px] font-black text-[var(--mg-success-text)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--mg-success)]" /> Activo
                </span>
              )}
            </div>
          </div>
        </div>
        {status.active ? (
          <span className="shrink-0 rounded-full bg-[var(--mg-success-bg)] px-2 py-1 text-[9px] font-black uppercase tracking-wide text-[var(--mg-success-text)]">En turno</span>
        ) : null}
      </div>

      <div className={`mt-3 rounded-xl border p-3 ${m.shift ? 'border-[var(--mg-border)] bg-[var(--mg-bg-elevated)]' : 'border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)]'}`}>
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <ShiftChip shift={m.shift} now={now} />
          {m.shift ? (
            <span className="text-[10px] font-bold text-[var(--mg-text-muted)]">{formatShiftDays(m.shift.days)}</span>
          ) : (
            <span className="text-[10px] font-bold text-[var(--mg-gold-text)]">
              {m.role === 'cashier' ? 'No podrá abrir caja' : 'Horario no asignado'}
            </span>
          )}
        </div>
        {m.shift ? (
          <p className="mt-1.5 text-[11px] font-semibold text-[var(--mg-text-secondary)]">
            {status.active
              ? `Trabajando hasta las ${status.windowEnd ? status.windowEnd.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false }) : m.shift.end}`
              : status.nextStart
                ? `Próximo turno: ${status.nextStart.toLocaleDateString('es-BO', { weekday: 'short', day: '2-digit', month: 'short' })} a las ${status.nextStart.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false })}`
                : 'Fuera de turno'}
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <ActionButton icon="reloj" label="Turno" tone="brand" onClick={onShift} disabled={busy} />
        <ActionButton icon="permisos" label="Permisos" onClick={onPerms} disabled={busy} />
        <ActionButton icon="editar" label="Nombre" onClick={onEdit} disabled={busy} />
        {!isCurrentUser ? (
          <>
            <ActionButton icon="traspaso" label="Rol" onClick={onRole} disabled={busy} />
            <ActionButton
              icon={isSuspended ? 'reactivar' : 'suspender'}
              label={isSuspended ? 'Reactivar' : 'Suspender'}
              tone={isSuspended ? 'success' : 'gold'}
              onClick={onStatus}
              disabled={busy}
            />
            <ActionButton icon="eliminar" label="Eliminar" tone="danger" onClick={onRemove} disabled={busy} />
          </>
        ) : null}
      </div>
    </article>
  );
}

export function TeamSection({
  members = [],
  membersLoading = false,
  roleUpdating = null,
  memberBusy = null,
  user,
  joinCode,
  ownerCode,
  codeLoading = false,
  codeCopied = false,
  ownerCopied = false,
  onCopyCode,
  onCopyOwnerCode,
  onRegenerateCode,
  onRegenerateOwnerCode,
  onToggleRole,
  invites = [],
  onInvite,
  onRevokeInvite,
  onResendInvite,
  onToggleStatus,
  onRemoveMember,
  onSavePermissions,
  onRenameMember,
  onSaveShift,
  onClearShift,
  businessName = 'Mi Ganancia',
  planId = 'pro',
  planName = 'Pro',
  maxMembers = maxMembersForPlan(planId),
}) {
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, type: null, data: null, title: '', message: '', danger: false,
  });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('cashier');
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [permMember, setPermMember] = useState(null);
  const [editMember, setEditMember] = useState(null);
  const [shiftMember, setShiftMember] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const { branches } = useBranches();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const ownersCount = members.filter((m) => m.role === 'owner').length;
  const activeCount = members.filter((m) => m.status !== 'suspended').length;
  const cashiers = members.filter((m) => m.role === 'cashier' && m.status !== 'suspended');
  const cashiersWithoutShift = cashiers.filter((m) => !m.shift).length;
  const activeShifts = members.filter((m) => m.status !== 'suspended' && getShiftStatus(m.shift, now).active).length;
  const emailInvites = invites.filter((i) => i.email);
  const activeCodes = (joinCode ? 1 : 0) + (ownerCode ? 1 : 0) + emailInvites.length;
  const usagePct = Math.min(100, Math.round((members.length / maxMembers) * 100));
  const atLimit = members.length >= maxMembers;

  const shiftFilters = [
    { id: 'all', label: 'Todos' },
    { id: 'active', label: 'En turno' },
    ...SHIFT_PRESETS.map((preset) => ({ id: preset.label, label: preset.label })),
    { id: 'custom', label: 'Personalizado' },
    { id: 'none', label: 'Sin turno' },
  ];

  const filtered = members.filter((m) => {
    const q = search.toLowerCase().trim();
    const okSearch = !q
      || m.displayName?.toLowerCase().includes(q)
      || (m.email || '').toLowerCase().includes(q);
    const okRole = roleFilter === 'all'
      || (roleFilter === 'owner' ? m.role !== 'cashier' : m.role === 'cashier');
    let okShift = true;
    if (shiftFilter === 'none') okShift = !m.shift;
    else if (shiftFilter === 'active') okShift = getShiftStatus(m.shift, now).active;
    else if (shiftFilter === 'custom') okShift = Boolean(m.shift) && !SHIFT_LABELS.includes(m.shift.label);
    else if (shiftFilter !== 'all') okShift = m.shift?.label === shiftFilter;
    return okSearch && okRole && okShift;
  });

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || memberBusy === 'invite' || atLimit) return;
    const invite = await onInvite(inviteEmail.trim(), inviteRole);
    if (invite) {
      setToast({ email: invite.email, active: members.length, max: maxMembers });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 4500);
      setInviteEmail('');
    }
  };

  const executeConfirm = () => {
    if (confirmModal.type === 'role') onToggleRole(confirmModal.data);
    else if (confirmModal.type === 'joinCode') onRegenerateCode();
    else if (confirmModal.type === 'ownerCode') onRegenerateOwnerCode();
    else if (confirmModal.type === 'remove') onRemoveMember(confirmModal.data);
    setConfirmModal({ isOpen: false, type: null, data: null, title: '', message: '', danger: false });
  };

  return (
    <div className="space-y-4">
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={executeConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
        loading={codeLoading || roleUpdating !== null}
        confirmText="Aceptar y Aplicar"
      />
      {permMember && (
        <PermissionsModal
          member={permMember}
          branches={branches}
          busy={memberBusy === permMember.id}
          onClose={() => setPermMember(null)}
          onSave={async (perms, branchIds) => {
            try {
              await onSavePermissions(permMember, perms, branchIds);
              setPermMember(null);
            } catch { /* el error ya se mostró */ }
          }}
        />
      )}
      {editMember && (
        <EditNameModal
          member={editMember}
          busy={memberBusy === editMember.id}
          onClose={() => setEditMember(null)}
          onSave={async (name) => {
            try {
              await onRenameMember(editMember, name);
              setEditMember(null);
            } catch { /* el error ya se mostró */ }
          }}
        />
      )}
      {shiftMember && (
        <ShiftModal
          member={shiftMember}
          busy={memberBusy === shiftMember.id}
          onClose={() => setShiftMember(null)}
          onSave={async (shift) => {
            await onSaveShift(shiftMember, shift);
            setShiftMember(null);
          }}
          onClear={async (member) => {
            await onClearShift(member);
            setShiftMember(null);
          }}
        />
      )}

      <div className="mg-grid-auto-sm">
        <div className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)] flex items-center gap-1.5">
              <AppIcon name="equipo" size={14} /> Puestos de equipo
            </p>
          </div>
          <p className="mt-2 text-2xl font-black text-[var(--mg-text-primary)] tabular-nums">
            {members.length}/{maxMembers}
            <span className="text-[11px] font-bold text-[var(--mg-text-muted)] ml-2">
              ({Math.max(0, maxMembers - members.length)} disponibles · {planName})
            </span>
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--mg-bg-elevated)]">
            <div className={`h-full rounded-full ${usagePct > 80 ? 'bg-[var(--mg-gold)]' : 'bg-[var(--mg-accent)]'}`} style={{ width: `${usagePct}%` }} />
          </div>
        </div>

        <div className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)] flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--mg-success)]" /> Estado del personal
            </p>
            <span className="rounded-md bg-[var(--mg-success-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--mg-success-text)]">Operativo</span>
          </div>
          <p className="mt-2 text-2xl font-black text-[var(--mg-text-primary)] tabular-nums">
            {activeCount}
            <span className="text-[11px] font-bold text-[var(--mg-text-muted)] ml-2">con acceso activo</span>
          </p>
          <p className="text-[11px] text-[var(--mg-text-muted)] mt-2">Suspendidos pierden el acceso al entrar.</p>
        </div>

        <div className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)] flex items-center gap-1.5">
              <AppIcon name="reloj" size={14} /> Turnos activos
            </p>
            <span className="rounded-md bg-[var(--mg-brand-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--mg-brand-text)]">Ahora</span>
          </div>
          <p className="mt-2 text-2xl font-black text-[var(--mg-text-primary)] tabular-nums">
            {activeShifts}
            <span className="text-[11px] font-bold text-[var(--mg-text-muted)] ml-2">en horario de trabajo</span>
          </p>
          <p className="text-[11px] text-[var(--mg-text-muted)] mt-2">
            {cashiersWithoutShift > 0 ? `${cashiersWithoutShift} cajero${cashiersWithoutShift === 1 ? '' : 's'} sin turno asignado.` : 'Todos los cajeros tienen horario.'}
          </p>
        </div>

        <div className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)] flex items-center gap-1.5">
              <AppIcon name="equipo" size={14} /> Códigos de vinculación
            </p>
            <span className="text-[10px] font-bold text-[var(--mg-text-muted)] bg-[var(--mg-bg-elevated)] px-2 py-0.5 rounded-md tabular-nums">{activeCodes} activos</span>
          </div>
          <p className="mt-2 text-2xl font-black text-[var(--mg-text-primary)] tabular-nums">
            {(joinCode ? 1 : 0) + (ownerCode ? 1 : 0)}
            <span className="text-[11px] font-bold text-[var(--mg-text-muted)] ml-2">claves + {emailInvites.length} por correo</span>
          </p>
          <p className="text-[11px] text-[var(--mg-text-muted)] mt-2">Vinculan teléfonos sin tu contraseña.</p>
        </div>
      </div>

      {atLimit && (
        <div className="rounded-2xl border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-4 py-3">
          <p className="text-xs font-black text-[var(--mg-gold-text)]">
            Límite de usuarios alcanzado ({members.length}/{maxMembers}).
          </p>
          <p className="text-[11px] font-semibold text-[var(--mg-gold-text)] mt-0.5">
            {planId === 'premium'
              ? 'Libera un puesto eliminando a un colaborador para invitar a otra persona.'
              : 'Pasa a Premium para trabajar con hasta 10 usuarios.'}
          </p>
        </div>
      )}

      {cashiersWithoutShift > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-4 py-3">
          <p className="flex items-center gap-2 text-[11px] font-bold text-[var(--mg-gold-text)]">
            <AppIcon name="alerta" size={15} />
            {cashiersWithoutShift === 1
              ? 'Un cajero no tiene turno y no podrá abrir caja.'
              : `${cashiersWithoutShift} cajeros no tienen turno y no podrán abrir caja.`}
          </p>
          <button type="button" onClick={() => setShiftFilter('none')} className="min-h-[32px] rounded-lg bg-[var(--mg-gold)] px-3 text-[10px] font-black text-white">
            Ver sin turno
          </button>
        </div>
      ) : null}

      <div className="bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[var(--mg-separator)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AppIcon name="equipo" size={18} />
              <div>
                <p className="font-black text-[var(--mg-text-primary)] text-sm">Equipo de Trabajo</p>
                <p className="text-[11px] text-[var(--mg-text-muted)]">Puestos, turnos, permisos y accesos</p>
              </div>
            </div>
            <span className="rounded-full border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] px-2.5 py-1 text-[10px] font-black text-[var(--mg-text-muted)]">
              {filtered.length} de {members.length}
            </span>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-[var(--mg-separator)] space-y-2.5">
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2"><AppIcon name="search" size={14} /></span>
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o correo..."
                className="mg-input text-xs font-semibold !pl-9"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: 'all', label: `Todos (${members.length})` },
                { id: 'owner', label: `Dueños (${ownersCount})` },
                { id: 'cashier', label: `Cajeros (${members.filter((m) => m.role === 'cashier').length})` },
              ].map((f) => (
                <button
                  key={f.id} type="button" onClick={() => setRoleFilter(f.id)}
                  className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${roleFilter === f.id ? 'bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)]' : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)]'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="shrink-0 pr-1 text-[9px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">Turno</span>
            {shiftFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setShiftFilter(filter.id)}
                className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  shiftFilter === filter.id
                    ? 'bg-[var(--mg-accent)] text-[var(--mg-brand-contrast)]'
                    : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)]'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {membersLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[var(--mg-accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]">
              <AppIcon name="equipo" size={22} />
            </span>
            <p className="mt-2 text-xs font-black text-[var(--mg-text-primary)]">Sin resultados para ese filtro</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[var(--mg-text-muted)]">Cambia la búsqueda o el turno seleccionado.</p>
          </div>
        ) : (
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {filtered.map((m) => {
              const isCurrentUser = m.id === user?.uid;
              const busy = roleUpdating === m.id || memberBusy === m.id;
              return (
                <MemberCard
                  key={m.id}
                  m={m}
                  isCurrentUser={isCurrentUser}
                  busy={busy}
                  now={now}
                  onShift={() => setShiftMember(m)}
                  onPerms={() => setPermMember(m)}
                  onEdit={() => setEditMember(m)}
                  onRole={() => onToggleRole(m)}
                  onStatus={() => onToggleStatus(m)}
                  onRemove={() => onRemoveConfirm(m)}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[var(--mg-separator)] flex items-center justify-between gap-2">
          <div>
            <p className="font-black text-[var(--mg-text-primary)] text-sm">Invitar por Correo Electrónico</p>
            <p className="text-[11px] text-[var(--mg-text-muted)]">Al iniciar sesión en la app con este correo, se vincula automáticamente sin ingresar código.</p>
          </div>
          <span className="text-[10px] font-bold text-[var(--mg-text-muted)] bg-[var(--mg-bg-elevated)] px-2 py-1 rounded-lg shrink-0">Revocable siempre</span>
        </div>
        <form onSubmit={handleInviteSubmit} className="p-4 grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <div className="md:col-span-6">
            <label className="text-[11px] font-bold text-[var(--mg-text-secondary)] block mb-1">Correo (Gmail o Workspace)</label>
            <input
              type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={atLimit ? `Límite de ${maxMembers} usuarios alcanzado` : 'colaborador@correo.com'}
              maxLength={120} disabled={atLimit}
              className="mg-input text-xs font-semibold disabled:opacity-60"
            />
          </div>
          <div className="md:col-span-3">
            <label className="text-[11px] font-bold text-[var(--mg-text-secondary)] block mb-1">Rol a otorgar</label>
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} disabled={atLimit} className="mg-input text-xs font-bold disabled:opacity-60">
              <option value="cashier">Cajero (ventas y cobros)</option>
              <option value="owner">Dueño / Socio (total)</option>
            </select>
          </div>
          <div className="md:col-span-3 flex items-end">
            <button type="submit" disabled={!inviteEmail.trim() || memberBusy === 'invite' || atLimit} className="w-full py-2.5 rounded-xl bg-[var(--mg-accent)] text-[var(--mg-brand-contrast)] font-black text-xs disabled:opacity-50">
              {memberBusy === 'invite' ? '…' : atLimit ? 'Límite alcanzado' : 'Enviar Invitación'}
            </button>
          </div>
        </form>
      </div>
      {toast && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 pointer-events-none">
          <div className="flex items-center gap-3 bg-[var(--mg-bg-surface)] border-2 border-[var(--mg-accent-border)] rounded-3xl px-5 py-4 shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-200">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--mg-success)] text-white">
              <AppIcon name="check" size={24} color="#fff" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black text-[var(--mg-text-primary)] truncate">
                Se agregó el correo {toast.email}
              </span>
              <span className="block text-xs font-bold text-[var(--mg-accent-text)] tabular-nums mt-0.5">
                Usuarios Activos {toast.active}/{toast.max}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );

  function onRemoveConfirm(m) {
    if (m.role === 'owner' && members.filter((x) => x.role === 'owner').length <= 1) {
      alert('No puedes eliminar al único dueño. Nombra otro dueño primero.');
      return;
    }
    setConfirmModal({
      isOpen: true, type: 'remove', data: m,
      title: `Eliminar a ${m.displayName}`,
      message: 'Se le quitará el acceso de inmediato. Sus ventas pasadas se conservan.',
      danger: true,
    });
  }
}
