import React, { useState } from 'react';
import { AppIcon } from '../icons';
import { MAX_MEMBERS, MEMBER_PERMISSIONS, DEFAULT_CASHIER_PERMISSIONS, updateMemberPermissions, updateMemberName } from '../../services/cashier';
import { ConfirmModal } from './ConfirmModal';
import QRCode from 'qrcode';

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' }) + ', ' +
    d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
}

function expiryLabel(iso) {
  if (!iso) return 'Sin vencimiento';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Vencido';
  const h = Math.floor(ms / 3600000);
  if (h < 24) return `Vence en ${h} h`;
  return `Vence en ${Math.floor(h / 24)} d`;
}

function QrModal({ code, onClose }) {
  const [img, setImg] = useState('');
  React.useEffect(() => {
    let alive = true;
    QRCode.toDataURL(String(code || ''), { width: 280, margin: 2 }).then((url) => {
      if (alive) setImg(url);
    }).catch(() => {});
    return () => { alive = false; };
  }, [code]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-[var(--mg-bg-surface)] rounded-3xl p-6 w-full max-w-xs text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--mg-text-muted)]">Escanea para vincular</p>
        {img ? (
          <img src={img} alt={`QR ${code}`} className="w-56 h-56 mx-auto my-4 rounded-2xl border border-[var(--mg-border)]" />
        ) : (
          <div className="w-56 h-56 mx-auto my-4 rounded-2xl bg-[var(--mg-bg-elevated)] animate-pulse" />
        )}
        <p className="font-mono font-black text-2xl tracking-widest text-[var(--mg-text-primary)]">{code}</p>
        <button type="button" onClick={onClose} className="mt-4 w-full py-2.5 rounded-xl bg-[var(--mg-bg-elevated)] font-bold text-xs">
          Cerrar
        </button>
      </div>
    </div>
  );
}

function PermissionsModal({ member, busy, onClose, onSave }) {
  const isOwner = member.role !== 'cashier';
  const [selected, setSelected] = useState(() => (
    Array.isArray(member.customPermissions) && member.customPermissions.length > 0
      ? [...member.customPermissions]
      : [...DEFAULT_CASHIER_PERMISSIONS]
  ));
  if (isOwner) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
        <div className="bg-[var(--mg-bg-surface)] rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-[var(--mg-bg-surface)] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[88vh]" onClick={(e) => e.stopPropagation()}>
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
                  className={`w-11 h-6 rounded-full shrink-0 transition-colors relative ${on ? 'bg-emerald-500' : 'bg-slate-300'} ${p.locked ? 'opacity-60' : ''}`}
                  title={p.locked ? 'Siempre activo para cobrar' : undefined}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="p-4 border-t border-[var(--mg-border)] flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[var(--mg-bg-elevated)] font-bold text-xs">Cancelar</button>
          <button type="button" onClick={() => onSave(selected)} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-[var(--mg-accent)] text-white font-bold text-xs disabled:opacity-50">
            {busy ? 'Guardando…' : 'Guardar permisos'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditNameModal({ member, busy, onClose, onSave }) {
  const [name, setName] = useState(member.displayName || '');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-[var(--mg-bg-surface)] rounded-3xl p-5 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
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

function RoleBadge({ role }) {
  if (role !== 'cashier') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black bg-amber-50 text-amber-800 border border-amber-200">
        👑 Dueño
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black bg-blue-50 text-blue-800 border border-blue-200">
      <AppIcon name="equipo" size={12} /> Cajero
    </span>
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
  onUpgradePlan,
}) {
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, type: null, data: null, title: '', message: '', danger: false,
  });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('cashier');
  const [inviteSent, setInviteSent] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [qrCode, setQrCode] = useState(null);
  const [permMember, setPermMember] = useState(null);
  const [editMember, setEditMember] = useState(null);

  const ownersCount = members.filter((m) => m.role === 'owner').length;
  const activeCount = members.filter((m) => m.status !== 'suspended').length;
  const emailInvites = invites.filter((i) => i.email);
  const activeCodes = (joinCode ? 1 : 0) + (ownerCode ? 1 : 0) + emailInvites.length;
  const usagePct = Math.min(100, Math.round((members.length / MAX_MEMBERS) * 100));

  const filtered = members.filter((m) => {
    const q = search.toLowerCase().trim();
    const okSearch = !q
      || m.displayName?.toLowerCase().includes(q)
      || (m.email || '').toLowerCase().includes(q);
    const okRole = roleFilter === 'all'
      || (roleFilter === 'owner' ? m.role !== 'cashier' : m.role === 'cashier');
    return okSearch && okRole;
  });

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || memberBusy === 'invite') return;
    const invite = await onInvite(inviteEmail.trim(), inviteRole);
    if (invite) {
      setInviteSent(invite);
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
      {qrCode && <QrModal code={qrCode} onClose={() => setQrCode(null)} />}
      {permMember && (
        <PermissionsModal
          member={permMember}
          busy={memberBusy === permMember.id}
          onClose={() => setPermMember(null)}
          onSave={async (perms) => {
            try {
              await onSavePermissions(permMember, perms);
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

      {/* Métricas */}
      <div className="mg-grid-auto-sm">
        <div className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)] flex items-center gap-1.5">
              <AppIcon name="equipo" size={14} /> Puestos de equipo
            </p>
            <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">Plan Pro</span>
          </div>
          <p className="mt-2 text-2xl font-black text-[var(--mg-text-primary)] tabular-nums">
            {members.length}/{MAX_MEMBERS}
            <span className="text-[11px] font-bold text-[var(--mg-text-muted)] ml-2">({MAX_MEMBERS - members.length} disponibles)</span>
          </p>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-2">
            <div className={`h-full rounded-full ${usagePct > 80 ? 'bg-amber-500' : 'bg-[#1670C2]'}`} style={{ width: `${usagePct}%` }} />
          </div>
          <button type="button" onClick={onUpgradePlan} className="mt-2 text-[11px] font-bold text-[#1670C2] hover:underline">
            ¿Necesitas más cajeros? Ampliar cupos →
          </button>
        </div>

        <div className="bg-[var(--mg-bg-surface)] rounded-[22px] p-4 border border-[var(--mg-border)] shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Estado del personal
            </p>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">Operativo</span>
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

      {/* Miembros */}
      <div className="bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[var(--mg-separator)]">
          <div className="flex items-center gap-2">
            <AppIcon name="equipo" size={18} />
            <div>
              <p className="font-black text-[var(--mg-text-primary)] text-sm">Equipo de Trabajo</p>
              <p className="text-[11px] text-[var(--mg-text-muted)]">Quién entra, con qué rol y qué puede hacer</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-[var(--mg-separator)] flex flex-col md:flex-row md:items-center gap-2.5">
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
              { id: 'owner', label: `Dueños (${members.filter((m) => m.role !== 'cashier').length})` },
              { id: 'cashier', label: `Cajeros (${members.filter((m) => m.role === 'cashier').length})` },
            ].map((f) => (
              <button
                key={f.id} type="button" onClick={() => setRoleFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${roleFilter === f.id ? 'bg-slate-900 text-white' : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {membersLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[var(--mg-accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[640px]">
              <thead>
                <tr className="text-[var(--mg-text-muted)] uppercase text-[10px] border-b border-[var(--mg-separator)]">
                  <th className="px-4 py-2.5">Colaborador</th>
                  <th className="px-3 py-2.5">Rol</th>
                  <th className="px-3 py-2.5">Estado</th>
                  <th className="px-3 py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--mg-separator)]">
                {filtered.map((m) => {
                  const isCurrentUser = m.id === user?.uid;
                  const isSuspended = m.status === 'suspended';
                  const busy = roleUpdating === m.id || memberBusy === m.id;
                  return (
                    <TableRow
                      key={m.id} m={m} isCurrentUser={isCurrentUser} isSuspended={isSuspended} busy={busy}
                      onPerms={() => setPermMember(m)} onEdit={() => setEditMember(m)}
                      onRole={() => onToggleRole(m)} onStatus={() => onToggleStatus(m)} onRemove={() => onRemoveConfirm(m)}
                    />
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-center text-xs text-[var(--mg-text-muted)] font-bold py-8">Sin resultados para ese filtro.</p>
            )}
          </div>
        )}
      </div>

      {/* Códigos rápidos */}
      <div className="bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[var(--mg-separator)]">
          <p className="font-black text-[var(--mg-text-primary)] text-sm">Códigos de Vinculación Rápida</p>
          <p className="text-[11px] text-[var(--mg-text-muted)]">Comparte el código o el QR para vincular teléfonos a esta tienda</p>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <QuickCodeCard
            title="Código para Cajeros" badge="Acceso Básico" accent="blue"
            desc="Cobrar, recibos e inventario. Sin ganancias."
            code={joinCode} codeLoading={codeLoading} copied={codeCopied}
            onCopy={onCopyCode} onShowQr={() => setQrCode(joinCode)}
            onRegenerate={onRegenerateCode} emptyLabel="Generar Código Cajero"
          />
          <QuickCodeCard
            title="Código para Dueños y Socios" badge="Acceso Total" accent="amber"
            desc="Inventario, ganancias, auditoría y ajustes."
            code={ownerCode} codeLoading={codeLoading} copied={ownerCopied}
            onCopy={onCopyOwnerCode} onShowQr={() => setQrCode(ownerCode)}
            onRegenerate={onRegenerateOwnerCode} emptyLabel="Generar Código Dueño"
          />
        </div>
        <p className="px-4 pb-4 text-[11px] text-[var(--mg-text-muted)]">
          ¿Cómo funciona? 1. El personal descarga Mi Ganancia → 2. Pulsa “Unirse” → 3. Escribe el PIN. Los PIN caducan solos.
        </p>
      </div>

      {/* Invitar por correo */}
      <div className="bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[var(--mg-separator)] flex items-center justify-between gap-2">
          <div>
            <p className="font-black text-[var(--mg-text-primary)] text-sm">Invitar por Correo Electrónico</p>
            <p className="text-[11px] text-[var(--mg-text-muted)]">Código atado a su cuenta de Google. Vence en 7 días.</p>
          </div>
          <span className="text-[10px] font-bold text-[var(--mg-text-muted)] bg-[var(--mg-bg-elevated)] px-2 py-1 rounded-lg shrink-0">Revocable siempre</span>
        </div>
        <form onSubmit={handleInviteSubmit} className="p-4 grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <div className="md:col-span-6">
            <label className="text-[11px] font-bold text-[var(--mg-text-secondary)] block mb-1">Correo (Gmail o Workspace)</label>
            <input
              type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colaborador@correo.com" maxLength={120}
              className="mg-input text-xs font-semibold"
            />
          </div>
          <div className="md:col-span-3">
            <label className="text-[11px] font-bold text-[var(--mg-text-secondary)] block mb-1">Rol a otorgar</label>
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="mg-input text-xs font-bold">
              <option value="cashier">Cajero (ventas y cobros)</option>
              <option value="owner">Dueño / Socio (total)</option>
            </select>
          </div>
          <div className="md:col-span-3 flex items-end">
            <button type="submit" disabled={!inviteEmail.trim() || memberBusy === 'invite'} className="w-full py-2.5 rounded-xl bg-[var(--mg-accent)] text-white font-black text-xs disabled:opacity-50">
              {memberBusy === 'invite' ? '…' : 'Enviar Invitación'}
            </button>
          </div>
        </form>
        {inviteSent && (
          <div className="mx-4 mb-3 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-xs">
            <p className="font-bold text-emerald-800">
              Código para {inviteSent.email}: <span className="font-mono font-black tracking-widest">{inviteSent.code}</span>
            </p>
            <p className="text-emerald-700 mt-0.5">Pásaselo por WhatsApp. Solo esa cuenta puede usarlo.</p>
          </div>
        )}
        {emailInvites.length > 0 && (
          <div className="px-4 pb-4 space-y-1.5">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--mg-text-muted)]">Pendientes ({emailInvites.length})</p>
            {emailInvites.map((i) => (
              <div key={i.code} className="flex items-center gap-2 bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-xl px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[var(--mg-text-primary)] truncate">{i.email}</p>
                  <p className="text-[11px] font-mono font-black tracking-widest text-[var(--mg-accent)]">
                    {i.code} <span className="font-sans font-semibold text-[var(--mg-text-muted)]">· {i.role === 'owner' ? 'Dueño' : 'Cajero'} · {expiryLabel(i.expiresAt)}</span>
                  </p>
                </div>
                <button type="button" onClick={() => onResendInvite(i)} title="Reenviar (nuevo código)" className="text-[11px] font-bold text-[var(--mg-text-secondary)] hover:underline shrink-0">Reenviar</button>
                <button type="button" onClick={() => onRevokeInvite(i.code)} title="Revocar invitación" className="text-[11px] font-bold text-[var(--mg-danger)] hover:underline shrink-0">Cancelar</button>
              </div>
            ))}
          </div>
        )}
      </div>
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

function TableRow({ m, isCurrentUser, isSuspended, busy, onPerms, onEdit, onRole, onStatus, onRemove }) {
  return (
    <tr className={isSuspended ? 'opacity-70' : ''}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative w-9 h-9 rounded-full bg-slate-600 text-white flex items-center justify-center font-black text-xs shrink-0">
            {m.displayName?.charAt(0)?.toUpperCase() || 'U'}
            {m.status === 'active' && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
            )}
          </span>
          <span className="min-w-0">
            <span className="font-bold text-[var(--mg-text-primary)] text-xs flex items-center gap-1.5">
              {m.displayName}
              {isCurrentUser && (
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">TÚ</span>
              )}
            </span>
            <span className="block text-[11px] text-[var(--mg-text-muted)] truncate">{m.email || 'Sin correo registrado'}</span>
          </span>
        </div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap"><RoleBadge role={m.role} /></td>
      <td className="px-3 py-3 whitespace-nowrap">
        {isSuspended ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Suspendido</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Activo</span>
        )}
      </td>
      <td className="px-3 py-3 text-right whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          {!isCurrentUser && (
            <button type="button" onClick={onRole} disabled={busy} title="Cambiar rol (Dueño/Cajero)" className="p-1.5 rounded-lg text-[var(--mg-text-muted)] hover:bg-[var(--mg-bg-elevated)] disabled:opacity-50 text-[11px] font-black">
              ⇄
            </button>
          )}
          <button type="button" onClick={onPerms} title="Ver permisos" className="p-1.5 rounded-lg text-[var(--mg-text-muted)] hover:bg-[var(--mg-bg-elevated)]">
            <AppIcon name="plan" size={14} />
          </button>
          <button type="button" onClick={onEdit} title="Editar nombre" className="p-1.5 rounded-lg text-[var(--mg-text-muted)] hover:bg-[var(--mg-bg-elevated)]">
            <AppIcon name="editar" size={14} />
          </button>
          {!isCurrentUser && (
            <>
              <button
                type="button" onClick={onStatus} disabled={busy} title={isSuspended ? 'Reactivar' : 'Suspender'}
                className={`p-1.5 rounded-lg disabled:opacity-50 ${isSuspended ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-600 hover:bg-amber-50'}`}
              >
                <span className="text-sm font-black leading-none">{isSuspended ? '▶' : '⏸'}</span>
              </button>
              <button
                type="button" onClick={onRemove} disabled={busy} title="Eliminar"
                className="p-1.5 rounded-lg text-[var(--mg-danger)] hover:bg-[var(--mg-danger-bg)] disabled:opacity-50"
              >
                <AppIcon name="eliminar" size={14} />
              </button>
            </>
          )}
        </span>
      </td>
    </tr>
  );
}

function QuickCodeCard({ title, badge, accent, desc, code, codeLoading, copied, onCopy, onShowQr, onRegenerate, emptyLabel }) {
  const amber = accent === 'amber';
  return (
    <div className={`rounded-2xl border p-4 flex flex-col ${amber ? 'border-amber-200 bg-amber-50/40' : 'border-blue-100 bg-blue-50/40'}`}>
      <p className="font-bold text-[var(--mg-text-primary)] text-sm flex items-center gap-2">
        {title}
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${amber ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'}`}>{badge}</span>
      </p>
      <p className="text-[11px] text-[var(--mg-text-muted)] mt-0.5">{desc}</p>
      {code ? (
        <div className="mt-3 bg-white rounded-xl p-3 border border-[var(--mg-border)] flex items-center justify-between gap-2">
          <span>
            <span className="block text-[10px] uppercase tracking-wider text-[var(--mg-text-muted)] font-bold">PIN de vinculación</span>
            <span className="font-mono font-black text-xl tracking-widest text-[var(--mg-text-primary)]">{code}</span>
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <button type="button" onClick={onCopy} className={`px-3 py-2 rounded-lg text-[11px] font-bold ${amber ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'}`}>
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
            <button type="button" onClick={onShowQr} title="Mostrar QR" className={`p-2 rounded-lg text-white ${amber ? 'bg-amber-600' : 'bg-blue-600'}`}>
              <AppIcon name="qr" size={15} color="#fff" />
            </button>
          </span>
        </div>
      ) : (
        <button type="button" onClick={onRegenerate} disabled={codeLoading} className="mt-3 w-full py-2.5 rounded-xl bg-[var(--mg-accent)] text-white font-bold text-xs disabled:opacity-50">
          {codeLoading ? 'Generando…' : emptyLabel}
        </button>
      )}
      {code && (
        <button type="button" onClick={onRegenerate} disabled={codeLoading} className="mt-2 text-[11px] font-bold text-[var(--mg-text-muted)] hover:underline self-start">
          Renovar PIN
        </button>
      )}
    </div>
  );
}
