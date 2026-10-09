import React, { useState } from 'react';
import { AppIcon } from '../icons';
import { MAX_MEMBERS } from '../../services/cashier';
import { ConfirmModal } from './ConfirmModal';

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
  onToggleStatus,
  onRemoveMember
}) {
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: null, // 'role' | 'joinCode' | 'ownerCode' | 'remove'
    data: null,
    title: '',
    message: '',
    danger: false
  });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSent, setInviteSent] = useState(null); // { code, email }

  // Contador de dueños activos para evitar dejar el negocio sin ningún dueño
  const ownersCount = members.filter((m) => m.role === 'owner').length;

  const handleRoleClick = (member) => {
    const isOwnerCurrently = member.role === 'owner';
    const newRole = isOwnerCurrently ? 'cajero' : 'dueño';

    // Bloqueo si intenta quitar el rol al último dueño
    if (isOwnerCurrently && ownersCount <= 1) {
      alert('⚠️ No puedes cambiar el rol de este usuario porque el negocio debe conservar al menos a un Dueño (👑).');
      return;
    }

    setConfirmModal({
      isOpen: true,
      type: 'role',
      data: member,
      title: `Cambiar rol a ${member.displayName}`,
      message: `¿Estás seguro de cambiar a ${member.displayName} al rol de ${newRole.toUpperCase()}?`,
      danger: isOwnerCurrently // quitar rol de dueño es acción sensible
    });
  };

  const handleRegenerateJoinCodeClick = () => {
    setConfirmModal({
      isOpen: true,
      type: 'joinCode',
      title: 'Regenerar Código de Cajero',
      message: 'Si regeneras el código, el código anterior dejará de funcionar inmediatamente para nuevos accesos.',
      danger: true
    });
  };

  const handleRegenerateOwnerCodeClick = () => {
    setConfirmModal({
      isOpen: true,
      type: 'ownerCode',
      title: ownerCode ? 'Regenerar Código de Dueño' : 'Generar Código de Dueño',
      message: ownerCode
        ? 'El código de dueño anterior quedará invalidado inmediatamente.'
        : 'Se generará una clave especial para invitar a otro dueño adicional.',
      danger: !!ownerCode
    });
  };

  const executeConfirm = () => {
    if (confirmModal.type === 'role') {
      onToggleRole(confirmModal.data);
    } else if (confirmModal.type === 'joinCode') {
      onRegenerateCode();
    } else if (confirmModal.type === 'ownerCode') {
      onRegenerateOwnerCode();
    } else if (confirmModal.type === 'remove') {
      onRemoveMember(confirmModal.data);
    }
    setConfirmModal({ isOpen: false, type: null, data: null, title: '', message: '', danger: false });
  };

  const handleRemoveClick = (member) => {
    if (member.role === 'owner' && ownersCount <= 1) {
      alert('No puedes eliminar al único dueño. Nombra otro dueño primero.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      type: 'remove',
      data: member,
      title: `Eliminar a ${member.displayName}`,
      message: `Se le quitará el acceso a la tienda de inmediato. Sus ventas pasadas se conservan.`,
      danger: true
    });
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || memberBusy === 'invite') return;
    const invite = await onInvite(inviteEmail.trim());
    if (invite) {
      setInviteSent(invite);
      setInviteEmail('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Modal de Confirmación para Acciones Sensibles */}
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

      {/* Lista de Miembros del Equipo */}
      <div className="bg-[var(--mg-bg-surface)] rounded-[24px] border border-[var(--mg-border)] overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-[var(--mg-border)] flex items-center justify-between bg-[var(--mg-bg-elevated)]">
          <div className="flex items-center gap-2">
            <AppIcon name="equipo" size={20} />
            <div>
              <p className="font-extrabold text-[var(--mg-text-primary)] text-sm">Equipo de Trabajo</p>
              <p className="text-[var(--mg-text-muted)] text-[11px]">Usuarios con acceso a la tienda</p>
            </div>
          </div>

          <span className={`text-xs font-black px-3 py-1 rounded-full border ${
            members.length >= MAX_MEMBERS
              ? 'bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] border-red-200'
              : 'bg-blue-50 text-blue-700 border-blue-100'
          }`}>
            {members.length}/{MAX_MEMBERS} usuarios
          </span>
        </div>

        {membersLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[var(--mg-accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-[var(--mg-separator)]">
            {members.map((m) => {
              const isCurrentUser = m.id === user?.uid;
              const isOwnerRole = m.role === 'owner';
              const isSuspended = m.status === 'suspended';
              const busy = roleUpdating === m.id || memberBusy === m.id;

              return (
                <div key={m.id} className={`flex items-center justify-between p-4 hover:bg-[var(--mg-bg-elevated)] transition-colors gap-3 ${isSuspended ? 'opacity-70' : ''}`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-slate-200 border border-[var(--mg-border)] overflow-hidden shrink-0 flex items-center justify-center font-bold text-slate-600">
                      {m.photoURL ? (
                        <img src={m.photoURL} alt={m.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span>{m.displayName?.charAt(0) || 'U'}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-extrabold text-[var(--mg-text-primary)] truncate">
                          {m.displayName}
                        </p>
                        {isCurrentUser && (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            (Tú)
                          </span>
                        )}
                        {isSuspended && (
                          <span className="text-[9px] font-black uppercase tracking-wide text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                            Suspendido
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--mg-text-muted)] truncate">{m.email || 'Sin correo registrado'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRoleClick(m)}
                      disabled={busy}
                      className={`px-3 py-1.5 rounded-xl font-black text-xs border transition-all active:scale-95 min-h-[38px] flex items-center gap-1 disabled:opacity-50 ${
                        isOwnerRole
                          ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                          : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                      }`}
                    >
                      {busy ? (
                        <span className="w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                      ) : isOwnerRole ? (
                        <>👑 Dueño</>
                      ) : (
                        <>🔑 Cajero</>
                      )}
                    </button>
                    {!isCurrentUser && (
                      <>
                        <button
                          type="button"
                          onClick={() => onToggleStatus(m)}
                          disabled={busy}
                          title={isSuspended ? 'Reactivar acceso' : 'Suspender acceso'}
                          className={`w-[38px] min-h-[38px] rounded-xl border font-black text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center ${
                            isSuspended
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-[var(--mg-border)] hover:bg-slate-200'
                          }`}
                        >
                          {isSuspended ? '✓' : '⏸'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveClick(m)}
                          disabled={busy}
                          title="Eliminar del equipo"
                          className="w-[38px] min-h-[38px] rounded-xl bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] border border-red-200 hover:bg-red-100 font-black transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center"
                        >
                          <AppIcon name="eliminar" size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invitar por correo */}
      <div className="bg-[var(--mg-bg-surface)] rounded-[24px] p-5 border border-[var(--mg-border)] space-y-3 shadow-xs">
        <div>
          <p className="text-xs font-extrabold text-[var(--mg-text-primary)] uppercase tracking-wider">
            Invitar cajero por correo
          </p>
          <p className="text-[var(--mg-text-muted)] text-xs mt-0.5">
            Se genera un código que solo funciona con esa cuenta. El cajero entra con su Google y lo escribe al unirse.
          </p>
        </div>
        <form onSubmit={handleInviteSubmit} className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="cajero@correo.com"
            className="mg-input text-xs font-semibold flex-1"
            maxLength={120}
          />
          <button
            type="submit"
            disabled={!inviteEmail.trim() || memberBusy === 'invite'}
            className="bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white font-bold px-4 rounded-xl text-xs active:scale-95 transition-all disabled:opacity-50 shrink-0 min-h-[42px]"
          >
            {memberBusy === 'invite' ? '...' : 'Invitar'}
          </button>
        </form>
        {inviteSent && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-xs">
            <p className="font-bold text-emerald-800">
              Código para {inviteSent.email}: <span className="font-mono font-black tracking-widest">{inviteSent.code}</span>
            </p>
            <p className="text-emerald-700 mt-0.5">Pásaselo por WhatsApp. Solo esa cuenta puede usarlo.</p>
          </div>
        )}
        {invites.filter((i) => i.email).length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--mg-text-muted)]">Invitaciones pendientes</p>
            {invites.filter((i) => i.email).map((i) => (
              <div key={i.code} className="flex items-center gap-2 bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-xl px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[var(--mg-text-primary)] truncate">{i.email}</p>
                  <p className="text-[11px] font-mono font-black tracking-widest text-[var(--mg-accent)]">{i.code}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRevokeInvite(i.code)}
                  title="Revocar invitación"
                  className="text-[11px] font-bold text-[var(--mg-danger)] hover:underline shrink-0"
                >
                  Revocar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Códigos de Invitación */}
      <div className="bg-[var(--mg-bg-surface)] rounded-[24px] p-5 border border-[var(--mg-border)] space-y-4 shadow-xs">
        <div>
          <p className="text-xs font-extrabold text-[var(--mg-text-primary)] uppercase tracking-wider">
            🔑 Códigos de Invitación
          </p>
          <p className="text-[var(--mg-text-muted)] text-xs mt-0.5">
            Comparte estos códigos con tu personal para vincular sus teléfonos a esta tienda
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Código Cajero */}
          <div className="bg-[var(--mg-bg-elevated)] p-4 rounded-2xl border border-[var(--mg-border)] space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[var(--mg-text-primary)]">🔑 Código para Cajeros</span>
              <span className="text-[10px] text-blue-700 bg-blue-50 font-bold px-2 py-0.5 rounded-md">Acceso básico</span>
            </div>

            {joinCode ? (
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-xl py-2.5 px-3 text-center shadow-2xs">
                  <span className="font-mono font-black text-lg tracking-widest text-[var(--mg-accent)]">{joinCode}</span>
                </div>
                <button
                  type="button"
                  onClick={onCopyCode}
                  aria-label="Copiar código de cajero"
                  className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs active:scale-95 transition-all min-h-[44px]"
                  title="Copiar código"
                >
                  {codeCopied ? '✓' : '📋'}
                </button>
                <button
                  type="button"
                  onClick={handleRegenerateJoinCodeClick}
                  disabled={codeLoading}
                  aria-label="Regenerar código de cajero"
                  className="px-3.5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs active:scale-95 transition-all min-h-[44px]"
                  title="Regenerar código"
                >
                  🔄
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleRegenerateJoinCodeClick}
                disabled={codeLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-all min-h-[44px]"
              >
                {codeLoading ? 'Generando...' : 'Generar Código Cajero'}
              </button>
            )}
          </div>

          {/* Código Dueño */}
          <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-amber-900">👑 Código para Dueños</span>
              <span className="text-[10px] text-amber-800 bg-amber-100 font-bold px-2 py-0.5 rounded-md">Acceso Total</span>
            </div>

            {ownerCode ? (
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 bg-[var(--mg-bg-surface)] border border-amber-200 rounded-xl py-2.5 px-3 text-center shadow-2xs">
                  <span className="font-mono font-black text-lg tracking-widest text-amber-800">{ownerCode}</span>
                </div>
                <button
                  type="button"
                  onClick={onCopyOwnerCode}
                  aria-label="Copiar código de dueño"
                  className="px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs active:scale-95 transition-all min-h-[44px]"
                  title="Copiar código"
                >
                  {ownerCopied ? '✓' : '📋'}
                </button>
                <button
                  type="button"
                  onClick={handleRegenerateOwnerCodeClick}
                  disabled={codeLoading}
                  aria-label="Regenerar código de dueño"
                  className="px-3.5 py-2.5 bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold rounded-xl text-xs active:scale-95 transition-all min-h-[44px]"
                  title="Regenerar código"
                >
                  🔄
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleRegenerateOwnerCodeClick}
                disabled={codeLoading}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-all min-h-[44px]"
              >
                {codeLoading ? 'Generando...' : 'Generar Código Dueño 👑'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
