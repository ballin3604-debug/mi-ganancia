import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import {
  regenerateJoinCode,
  regenerateOwnerCode,
  createOwnerCode,
  getBusinessMembers,
  updateMemberRole,
  createInviteCode,
  listInvites,
  revokeInvite,
  setMemberStatus,
  removeMember,
  updateMemberPermissions,
  updateMemberName,
  updateMemberBranches,
} from '../services/cashier';
import { TeamSection } from '../components/settings/TeamSection';
import PageHeader from '../components/ui/PageHeader';
import { usePlan } from '../hooks/usePlan';

export default function Team() {
  const { businessId, user, updateOwnRole } = useAuth();
  const { business } = useBusiness();
  const { planId, plan } = usePlan();

  const [joinCode, setJoinCode] = useState(business?.joinCode || '');
  const [ownerCode, setOwnerCode] = useState(business?.ownerCode || '');
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [ownerCopied, setOwnerCopied] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [invites, setInvites] = useState([]);
  const [memberBusy, setMemberBusy] = useState(null);
  const [roleUpdating, setRoleUpdating] = useState(null);

  useEffect(() => {
    if (business?.joinCode) setJoinCode(business.joinCode);
    if (business?.ownerCode) setOwnerCode(business.ownerCode);
  }, [business]);

  useEffect(() => {
    if (!businessId) return;
    setMembersLoading(true);
    getBusinessMembers(businessId)
      .then(setMembers)
      .catch(console.error)
      .finally(() => setMembersLoading(false));
    listInvites(businessId).then(setInvites).catch(() => setInvites([]));
  }, [businessId]);

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(joinCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      alert(`Código: ${joinCode}`);
    }
  }

  async function handleCopyOwnerCode() {
    try {
      await navigator.clipboard.writeText(ownerCode);
      setOwnerCopied(true);
      setTimeout(() => setOwnerCopied(false), 2000);
    } catch {
      alert(`Código dueño: ${ownerCode}`);
    }
  }

  async function handleRegenerateCode() {
    setCodeLoading(true);
    try {
      const newCode = await regenerateJoinCode(businessId, business?.name || '', joinCode);
      setJoinCode(newCode);
    } catch (err) {
      console.error(err);
      alert('Error al generar código. Intentá de nuevo.');
    } finally {
      setCodeLoading(false);
    }
  }

  async function handleOwnerCode() {
    setCodeLoading(true);
    try {
      const newCode = ownerCode
        ? await regenerateOwnerCode(businessId, business?.name || '', ownerCode)
        : await createOwnerCode(businessId, business?.name || '');
      setOwnerCode(newCode);
    } catch (err) {
      console.error(err);
      alert('Error al generar código. Intentá de nuevo.');
    } finally {
      setCodeLoading(false);
    }
  }

  async function handleToggleRole(member) {
    const newRole = member.role === 'owner' ? 'cashier' : 'owner';
    setRoleUpdating(member.id);
    try {
      await updateMemberRole(members, member.id, newRole);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m)));
      if (member.id === user?.uid) {
        updateOwnRole(newRole);
      }
    } catch (err) {
      alert(err.message || 'Error al actualizar rol.');
    } finally {
      setRoleUpdating(null);
    }
  }

  async function handleInvite(email, role) {
    setMemberBusy('invite');
    try {
      const invite = await createInviteCode(businessId, business?.name || '', email, role || 'cashier');
      setInvites((prev) => [...prev.filter((i) => i.code !== invite.code), { code: invite.code, email: invite.email, role: invite.role, expiresAt: invite.expiresAt }]);
      return invite;
    } catch (err) {
      alert(err.message || 'No se pudo crear la invitación.');
      return null;
    } finally {
      setMemberBusy(null);
    }
  }

  async function handleResendInvite(invite) {
    setMemberBusy('invite');
    try {
      try { await revokeInvite(invite.code); } catch { /* sigue igual */ }
      const fresh = await createInviteCode(businessId, business?.name || '', invite.email, invite.role || 'cashier');
      setInvites((prev) => [...prev.filter((i) => i.code !== invite.code), { code: fresh.code, email: fresh.email, role: fresh.role, expiresAt: fresh.expiresAt }]);
    } catch (err) {
      alert(err.message || 'No se pudo reenviar.');
    } finally {
      setMemberBusy(null);
    }
  }

  async function handleRevokeInvite(code) {
    try {
      await revokeInvite(code);
      setInvites((prev) => prev.filter((i) => i.code !== code));
    } catch (err) {
      alert(err.message || 'No se pudo revocar la invitación.');
    }
  }

  async function handleToggleStatus(member) {
    const next = member.status === 'suspended' ? 'active' : 'suspended';
    setMemberBusy(member.id);
    try {
      await setMemberStatus(member.id, next);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, status: next } : m)));
    } catch (err) {
      alert(err.message || 'No se pudo cambiar el estado.');
    } finally {
      setMemberBusy(null);
    }
  }

  async function handleRemoveMember(member) {
    setMemberBusy(member.id);
    try {
      await removeMember(member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err) {
      alert(err.message || 'No se pudo eliminar. Prueba suspendiéndolo.');
    } finally {
      setMemberBusy(null);
    }
  }

  async function handleSavePermissions(member, perms, branchIds) {
    setMemberBusy(member.id);
    try {
      const saved = await updateMemberPermissions(member.id, perms);
      let savedBranches = member.branchIds ?? null;
      if (member.role === 'cashier' && branchIds !== undefined) {
        savedBranches = await updateMemberBranches(member.id, branchIds);
      }
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, customPermissions: saved, branchIds: savedBranches } : m)));
    } catch (err) {
      alert(err.message || 'No se pudo guardar.');
      throw err;
    } finally {
      setMemberBusy(null);
    }
  }

  async function handleRenameMember(member, name) {
    setMemberBusy(member.id);
    try {
      const clean = await updateMemberName(member.id, name);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, displayName: clean } : m)));
    } catch (err) {
      alert(err.message || 'No se pudo guardar.');
      throw err;
    } finally {
      setMemberBusy(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 pb-28">
      <PageHeader
        icon="equipo"
        eyebrow="Administración"
        title="Equipo y accesos"
        subtitle="Cajeros, accesos, invitaciones y permisos del negocio."
      />
      <TeamSection
        members={members}
        membersLoading={membersLoading}
        roleUpdating={roleUpdating}
        memberBusy={memberBusy}
        user={user}
        joinCode={joinCode}
        ownerCode={ownerCode}
        codeLoading={codeLoading}
        codeCopied={codeCopied}
        ownerCopied={ownerCopied}
        onCopyCode={handleCopyCode}
        onCopyOwnerCode={handleCopyOwnerCode}
        onRegenerateCode={handleRegenerateCode}
        onRegenerateOwnerCode={handleOwnerCode}
        onToggleRole={handleToggleRole}
        invites={invites}
        onInvite={handleInvite}
        onRevokeInvite={handleRevokeInvite}
        onResendInvite={handleResendInvite}
        onToggleStatus={handleToggleStatus}
        onRemoveMember={handleRemoveMember}
        onSavePermissions={handleSavePermissions}
        onRenameMember={handleRenameMember}
        businessName={business?.name || ''}
        planId={planId}
        planName={plan.name}
        maxMembers={plan.maxUsers}
      />
    </div>
  );
}
