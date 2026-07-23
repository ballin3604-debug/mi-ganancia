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

export async function joinBusinessWithCode(user, rawCode, cashierName = '') {
  const biz = await lookupJoinCode(rawCode);
  if (!biz) throw new Error('Código inválido. Verifica y vuelve a intentar.');

  const role = biz.role || 'cashier';
  const displayName = cashierName || user.user_metadata?.displayName || user.email;

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
