import { supabase } from './supabaseClient';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode() {
  return Array.from(
    { length: 6 },
    () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join('');
}

export const MAX_MEMBERS = 5;

export async function getBusinessMembers(businessId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('business_id', businessId);
  if (error) throw error;
  return data.map((m) => ({
    id: m.id,
    businessId: m.business_id,
    displayName: m.name,
    email: m.email || null,
    photoURL: m.photo_url || null,
    role: m.role,
    status: m.status,
  }));
}

export async function getMemberCount(businessId) {
  const members = await getBusinessMembers(businessId);
  return members.length;
}

export async function lookupJoinCode(rawCode) {
  const code = rawCode.toUpperCase().trim();
  const { data, error } = await supabase
    .from('business_join_codes')
    .select('*')
    .eq('code', code)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return {
    businessId: data.business_id,
    businessName: data.business_name,
    role: data.role || 'cashier',
    email: (data.email || '').toLowerCase() || null,
  };
}

export async function createJoinCode(businessId, businessName) {
  const code = generateCode();
  const { error: insErr } = await supabase
    .from('business_join_codes')
    .insert({
      code,
      business_id: businessId,
      business_name: businessName,
      role: 'cashier',
    });
  if (insErr) throw insErr;

  const { error: updErr } = await supabase
    .from('businesses')
    .update({ join_code: code })
    .eq('id', businessId);
  if (updErr) throw updErr;

  return code;
}

export async function createOwnerCode(businessId, businessName) {
  const code = generateCode();
  const { error: insErr } = await supabase
    .from('business_join_codes')
    .insert({
      code,
      business_id: businessId,
      business_name: businessName,
      role: 'owner',
    });
  if (insErr) throw insErr;

  const { error: updErr } = await supabase
    .from('businesses')
    .update({ owner_code: code })
    .eq('id', businessId);
  if (updErr) throw updErr;

  return code;
}

export async function joinBusinessWithCode(user, rawCode, cashierName = '', extra = {}) {
  const biz = await lookupJoinCode(rawCode);
  if (!biz) throw new Error('Código inválido. Verifica y vuelve a intentar.');

  const role = biz.role || 'cashier';
  // Código atado a un correo: solo esa cuenta puede usarlo.
  if (biz.email) {
    const userEmail = (user.email || '').toLowerCase();
    if (userEmail !== biz.email) {
      throw new Error(`Este código es para ${biz.email}. Entra con esa cuenta.`);
    }
  }
  const displayName = cashierName || user.user_metadata?.displayName || user.email;
  const birthdate = (extra.birthdate || '').trim() || null;

  // La identidad es la cuenta logueada (Google/correo): el perfil se crea
  // o actualiza con el MISMO id de auth, nunca se duplica por nombre.
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id || user.uid,
      business_id: biz.businessId,
      name: displayName,
      role,
      status: 'active',
    });

  if (error) throw error;

  // Nombre + cumpleaños en los metadatos de auth (sin migración de BD).
  try {
    await supabase.auth.updateUser({
      data: { displayName, ...(birthdate ? { birthdate } : {}) },
    });
  } catch { /* el perfil ya quedó; el saludo usa el nombre igual */ }

  // Correo visible para el dueño (best-effort: si la columna no existe, se ignora).
  if (user.email) {
    try {
      await supabase.from('profiles').update({ email: user.email }).eq('id', user.id || user.uid);
    } catch { /* columna ausente: no bloquea el ingreso */ }
  }

  return { businessId: biz.businessId, role, displayName };
}

export async function regenerateJoinCode(businessId, businessName, oldCode) {
  if (oldCode) {
    try {
      await supabase
        .from('business_join_codes')
        .delete()
        .eq('code', oldCode);
    } catch (_) {}
  }
  return createJoinCode(businessId, businessName);
}

export async function regenerateOwnerCode(businessId, businessName, oldCode) {
  if (oldCode) {
    try {
      await supabase
        .from('business_join_codes')
        .delete()
        .eq('code', oldCode);
    } catch (_) {}
  }
  return createOwnerCode(businessId, businessName);
}

// ── Invitaciones por correo ──────────────────────────────────
// Crea un código atado a un correo: solo esa cuenta puede usarlo.
export async function createInviteCode(businessId, businessName, email, role = 'cashier') {
  const clean = (email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) {
    throw new Error('Escribe un correo válido.');
  }
  const code = generateCode();
  const row = {
    code,
    business_id: businessId,
    business_name: businessName,
    role,
    email: clean,
  };
  const { error: insErr } = await supabase.from('business_join_codes').insert(row);
  if (insErr) {
    // Servidor sin la columna email (migración pendiente): invita sin atar.
    if (/column|PGRST204|does not exist/i.test(insErr.message || '')) {
      const { email: _drop, ...fallback } = row;
      const { error: retryErr } = await supabase.from('business_join_codes').insert(fallback);
      if (retryErr) throw retryErr;
    } else throw insErr;
  }
  return { code, email: clean };
}

export async function listInvites(businessId) {
  const { data, error } = await supabase
    .from('business_join_codes')
    .select('*')
    .eq('business_id', businessId)
    .order('code');
  if (error) throw error;
  return (data || []).map((r) => ({
    code: r.code,
    email: r.email || null,
    role: r.role || 'cashier',
  }));
}

export async function revokeInvite(code) {
  const { error } = await supabase.from('business_join_codes').delete().eq('code', code);
  if (error) throw error;
}

// ── Suspender / reactivar / eliminar miembros ─────────────────
export async function setMemberStatus(memberId, status) {
  if (!['active', 'suspended'].includes(status)) throw new Error('Estado inválido.');
  const { error } = await supabase.from('profiles').update({ status }).eq('id', memberId);
  if (error) throw error;
}

export async function removeMember(memberId) {
  const { error } = await supabase.from('profiles').delete().eq('id', memberId);
  if (error) throw error;
}

export async function updateMemberRole(members, targetUserId, newRole) {
  if (newRole === 'cashier') {
    const owners = members.filter((m) => m.role === 'owner');
    if (owners.length <= 1 && owners[0]?.id === targetUserId) {
      throw new Error('No puedes quitar el rol al único dueño del negocio.');
    }
  }
  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', targetUserId);
  if (error) throw error;
}
