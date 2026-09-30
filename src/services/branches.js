import { supabase } from './supabaseClient';

function mapBranch(b) {
  if (!b) return b;
  return {
    ...b,
    businessId: b.business_id,
    isMain: !!b.is_main,
    createdAt: b.created_at ? { toDate: () => new Date(b.created_at) } : null,
  };
}

export async function getBranches(businessId) {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('business_id', businessId)
    .order('is_main', { ascending: false })
    .order('name');
  if (error) throw error;
  return (data || []).map(mapBranch);
}

export async function addBranch(businessId, { name, type = 'sucursal', address = '', phone = '' }) {
  const clean = (name || '').trim();
  if (!clean) throw new Error('Ponle un nombre a la sede.');
  const { data, error } = await supabase
    .from('branches')
    .insert({
      business_id: businessId,
      name: clean,
      type,
      address: address.trim(),
      phone: phone.trim(),
      is_main: false,
    })
    .select()
    .single();
  if (error) throw error;
  return mapBranch(data);
}

export async function updateBranch(id, patch) {
  const body = {};
  if (patch.name !== undefined) body.name = patch.name.trim();
  if (patch.type !== undefined) body.type = patch.type;
  if (patch.address !== undefined) body.address = patch.address;
  if (patch.phone !== undefined) body.phone = patch.phone;
  const { error } = await supabase.from('branches').update(body).eq('id', id);
  if (error) throw error;
}

export async function setMainBranch(businessId, id) {
  const { data: all } = await supabase.from('branches').select('id').eq('business_id', businessId);
  for (const b of all || []) {
    await supabase.from('branches').update({ is_main: b.id === id }).eq('id', b.id);
  }
}

export async function deleteBranch(businessId, branch) {
  if (branch.isMain || branch.is_main) {
    throw new Error('La casa matriz no se puede eliminar. Marca otra como principal primero.');
  }
  // Seguridad: no borrar sedes con ventas o gastos registrados
  const { data: sales } = await supabase.from('sales').select('id').eq('branch_id', branch.id).limit(1);
  if (sales && sales.length > 0) {
    throw new Error('Esta sede tiene ventas registradas y no se puede eliminar.');
  }
  const { data: exps } = await supabase.from('expenses').select('id').eq('branch_id', branch.id).limit(1);
  if (exps && exps.length > 0) {
    throw new Error('Esta sede tiene gastos registrados y no se puede eliminar.');
  }
  const { error } = await supabase.from('branches').delete().eq('id', branch.id);
  if (error) throw error;
}
