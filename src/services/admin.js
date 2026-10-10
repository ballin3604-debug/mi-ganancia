import { supabase } from './supabaseClient';
import { createJoinCode } from './cashier';
import { getCategoryById, DEFAULT_CATEGORY_ID } from '../config/businessCategories';

export const ADMIN_UID = import.meta.env.VITE_ADMIN_UID;

export function isAdmin(uid) {
  return uid === ADMIN_UID;
}

// ── Planes por negocio (solo admin, 3 botones: free/pro/premium) ──
export async function getBusinessPlans() {
  const { data, error } = await supabase.from('subscriptions').select('business_id,plan_id,status');
  if (error) throw error;
  const map = {};
  (data || []).forEach((s) => { map[s.business_id] = s.plan_id || 'free'; });
  return map;
}

export async function setBusinessPlan(businessId, planId) {
  if (!['free', 'pro', 'premium'].includes(planId)) throw new Error('Plan inválido.');
  const { error } = await supabase.from('subscriptions').upsert({
    business_id: businessId,
    plan_id: planId,
    status: 'active',
    trial_ends_at: null,
    current_period_end: null,
  }, { onConflict: 'business_id' });
  if (error) throw error;
}

function mapRequest(req) {
  if (!req) return req;
  return {
    ...req,
    userId: req.user_id,
    displayName: req.display_name,
    photoURL: req.photo_url,
    businessName: req.business_name,
    businessCategory: req.business_category,
    reviewedAt: req.reviewed_at ? { toDate: () => new Date(req.reviewed_at) } : null,
    createdAt: req.created_at ? { toDate: () => new Date(req.created_at) } : null,
  };
}

export async function submitRequest(user, businessName, businessCategory = DEFAULT_CATEGORY_ID) {
  const { data: req, error: reqErr } = await supabase
    .from('subscription_requests')
    .insert({
      user_id: user.uid || user.id,
      email: user.email,
      display_name: user.displayName || user.email,
      photo_url: user.photoURL || '',
      business_name: businessName.trim(),
      business_category: businessCategory,
      status: 'pending',
    })
    .select()
    .single();

  if (reqErr) throw reqErr;

  const { error: profErr } = await supabase
    .from('profiles')
    .insert({
      id: user.uid || user.id,
      name: user.displayName || user.email,
      status: 'pending',
      role: 'owner',
    });

  if (profErr) throw profErr;

  return req.id;
}

export async function getAllRequests() {
  const { data, error } = await supabase
    .from('subscription_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(mapRequest);
}

export async function getAllBusinesses() {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  const businesses = (data || []).map((b) => ({
    ...b,
    createdAt: b.created_at ? { toDate: () => new Date(b.created_at) } : null,
  }));

  // Enriquecer con correo/nombre del dueño para mostrarlo en el panel.
  // Fuente 1: profiles (por owner_id). Fuente 2 (fallback): subscription_requests
  // (tiene el email aunque el profile no lo tenga).
  try {
    const ownerIds = [...new Set(businesses.map((b) => b.owner_id).filter(Boolean))];
    const bizIds = businesses.map((b) => b.id).filter(Boolean);
    let profilesById = {};
    let reqByUserId = {};
    let reqByBizId = {};

    if (ownerIds.length > 0) {
      const { data: profs, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .in('id', ownerIds);
      if (!profErr && profs) {
        profs.forEach((p) => { profilesById[p.id] = p; });
      }
    }

    if (bizIds.length > 0) {
      const { data: reqs } = await supabase
        .from('subscription_requests')
        .select('email,user_id,business_id,display_name')
        .in('business_id', bizIds);
      (reqs || []).forEach((r) => {
        if (r.business_id) reqByBizId[r.business_id] = r;
        if (r.user_id) reqByUserId[r.user_id] = r;
      });
    }

    // Fallback extra: requests por user_id para negocios viejos sin business_id
    if (ownerIds.length > 0) {
      const missingOwners = ownerIds.filter((id) => !reqByUserId[id]);
      if (missingOwners.length > 0) {
        const { data: reqs2 } = await supabase
          .from('subscription_requests')
          .select('email,user_id,business_id,display_name')
          .in('user_id', missingOwners);
        (reqs2 || []).forEach((r) => {
          if (r.user_id && !reqByUserId[r.user_id]) reqByUserId[r.user_id] = r;
        });
      }
    }

    return businesses.map((b) => {
      const prof = profilesById[b.owner_id] || {};
      const req = reqByBizId[b.id] || reqByUserId[b.owner_id] || {};
      return {
        ...b,
        ownerEmail: prof.email || req.email || '',
        ownerName: prof.name || req.display_name || '',
      };
    });
  } catch (enrichErr) {
    console.error('getAllBusinesses: no se pudo enriquecer dueños:', enrichErr);
    return businesses;
  }
}

export async function approveRequest(request, adminNote = '') {
  const { data: biz, error: bizErr } = await supabase
    .from('businesses')
    .insert({
      name: request.businessName || request.business_name,
      owner_id: request.userId || request.user_id,
      status: 'active',
    })
    .select()
    .single();

  if (bizErr) throw bizErr;

  const businessId = biz.id;

  const { error: profErr } = await supabase
    .from('profiles')
    .update({
      business_id: businessId,
      status: 'active',
      role: 'owner',
    })
    .eq('id', request.userId || request.user_id);

  if (profErr) throw profErr;

  const { error: reqErr } = await supabase
    .from('subscription_requests')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      admin_note: adminNote,
      business_id: businessId,
    })
    .eq('id', request.id);

  if (reqErr) throw reqErr;

  const category = getCategoryById(request.businessCategory || request.business_category || DEFAULT_CATEGORY_ID);
  try {
    await supabase
      .from('business_settings')
      .upsert({
        business_id: businessId,
        business_category: category.id,
        categories: category.defaultCategories,
      });
  } catch (err) {
    console.error('Error saving business settings:', err);
  }

  try {
    await createJoinCode(businessId, request.businessName || request.business_name);
  } catch (err) {
    console.error('Error generating cashier join code:', err);
  }
}

export async function rejectRequest(requestId, userId, adminNote = '') {
  const { error: reqErr } = await supabase
    .from('subscription_requests')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      admin_note: adminNote,
    })
    .eq('id', requestId);

  if (reqErr) throw reqErr;

  const { error: profErr } = await supabase
    .from('profiles')
    .update({
      status: 'rejected',
    })
    .eq('id', userId);

  if (profErr) throw profErr;
}

export async function suspendBusiness(businessId, userId) {
  const { error: bizErr } = await supabase
    .from('businesses')
    .update({ status: 'suspended' })
    .eq('id', businessId);

  if (bizErr) throw bizErr;

  // Suspender a TODOS los miembros del negocio (dueño + cajeros).
  // Antes solo se suspendía al owner y los cajeros seguían entrando.
  const { error: membersErr } = await supabase
    .from('profiles')
    .update({ status: 'suspended' })
    .eq('business_id', businessId);

  if (membersErr) console.error('suspendBusiness: no se pudo suspender miembros:', membersErr);

  // Compat: si se pasó el userId del dueño, asegurar su suspensión aunque
  // su profile no tenga business_id seteado.
  if (userId) {
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ status: 'suspended' })
      .eq('id', userId);

    if (profErr) console.error('suspendBusiness: no se pudo suspender owner:', profErr);
  }
}

export async function reactivateBusiness(businessId, userId) {
  const { error: bizErr } = await supabase
    .from('businesses')
    .update({ status: 'active' })
    .eq('id', businessId);

  if (bizErr) throw bizErr;

  const { error: membersErr } = await supabase
    .from('profiles')
    .update({ status: 'active' })
    .eq('business_id', businessId);

  if (membersErr) console.error('reactivateBusiness: no se pudo reactivar miembros:', membersErr);

  if (userId) {
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', userId);

    if (profErr) console.error('reactivateBusiness: no se pudo reactivar owner:', profErr);
  }
}

// ── Eliminación total de un negocio ──────────────────────────────────────
// Vía Edge Function `delete-business` (service_role + auditoría). Si la
// función aún no está desplegada, usa el borrado local como respaldo.
export async function deleteBusiness(businessId) {
  if (!businessId) throw new Error('Falta el ID del negocio.');
  try {
    const { data, error } = await supabase.functions.invoke('delete-business', {
      body: { businessId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return { saleIds: 0, warnings: data?.warnings || [], via: 'edge-function' };
  } catch (fnErr) {
    console.warn('deleteBusiness: Edge Function no disponible, usando borrado local:', fnErr);
    return deleteBusinessLocal(businessId);
  }
}

async function deleteBusinessLocal(businessId) {
  if (!businessId) throw new Error('Falta el ID del negocio.');

  const errors = [];
  async function tryDelete(label, fn) {
    try {
      await fn();
    } catch (err) {
      console.error(`deleteBusiness [${label}]:`, err);
      errors.push(`${label}: ${err?.message || err}`);
    }
  }

  // 1. Items de ventas (necesitan los sale_ids primero)
  let saleIds = [];
  try {
    const { data, error } = await supabase
      .from('sales')
      .select('id')
      .eq('business_id', businessId);
    if (error) throw error;
    saleIds = (data || []).map((s) => s.id);
  } catch (err) {
    console.error('deleteBusiness [fetch sales]:', err);
    errors.push(`ventas (listar): ${err?.message || err}`);
  }

  if (saleIds.length > 0) {
    // Borrar en lotes de 100 porque .in() tiene límite práctico
    for (let i = 0; i < saleIds.length; i += 100) {
      const chunk = saleIds.slice(i, i + 100);
      await tryDelete(`sale_items (${i / 100 + 1})`, async () => {
        const { error } = await supabase.from('sale_items').delete().in('sale_id', chunk);
        if (error) throw error;
      });
    }
  }

  // 2. Tablas operativas con business_id directo
  const tables = [
    'sales',
    'products',
    'clientes',
    'debts',
    'expenses',
    'replenishments',
    'stock_alerts',
    'business_settings',
    'business_join_codes',
  ];
  for (const table of tables) {
    await tryDelete(table, async () => {
      const { error } = await supabase.from(table).delete().eq('business_id', businessId);
      if (error) throw error;
    });
  }

  // 3. Perfiles: eliminarlos para liberar a los usuarios (dueño + cajeros).
  // Al no tener profile, AuthContext los manda a Setup como usuario nuevo.
  await tryDelete('profiles', async () => {
    const { error } = await supabase.from('profiles').delete().eq('business_id', businessId);
    if (error) throw error;
  });

  // 4. Finalmente el negocio
  const { error: bizErr } = await supabase
    .from('businesses')
    .delete()
    .eq('id', businessId);

  if (bizErr) {
    throw new Error(
      `No se pudo eliminar el negocio (${bizErr.message}). ` +
      (errors.length ? `Limpieza parcial: ${errors.join(' · ')}` : '') +
      ' Revisa las políticas RLS de DELETE para el rol admin.'
    );
  }

  if (errors.length > 0) {
    console.warn('deleteBusiness completado con advertencias:', errors);
  }

  return { saleIds: saleIds.length, warnings: errors };
}
