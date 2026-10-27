import { supabase, assertSupabase } from './supabaseClient';
import { db } from './localDb';

function mapBranch(b) {
  if (!b) return b;
  return {
    ...b,
    businessId: b.business_id,
    isMain: !!b.is_main,
    createdAt: b.created_at ? { toDate: () => new Date(b.created_at) } : null,
  };
}

function sortBranches(rows) {
  return [...rows].sort((a, b) => {
    if (!!a.is_main !== !!b.is_main) return a.is_main ? -1 : 1;
    return String(a.name || '').localeCompare(String(b.name || ''), 'es');
  });
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

async function readCachedBranches(businessId) {
  if (!businessId) return [];
  try {
    const rows = await db.branches.where('business_id').equals(businessId).toArray();
    return sortBranches(rows);
  } catch (err) {
    console.warn('getBranches: no se pudo leer la caché local:', err?.message || err);
    return [];
  }
}

async function writeCachedBranches(businessId, rows) {
  if (!businessId) return;
  try {
    await db.transaction('rw', db.branches, async () => {
      const ids = new Set(rows.map((row) => row.id));
      const cached = await db.branches.where('business_id').equals(businessId).toArray();
      const stale = cached.filter((row) => !ids.has(row.id)).map((row) => row.id);
      if (stale.length > 0) await db.branches.bulkDelete(stale);
      if (rows.length > 0) await db.branches.bulkPut(rows);
    });
  } catch (err) {
    console.warn('getBranches: no se pudo guardar la caché local:', err?.message || err);
  }
}

export async function getBranches(businessId) {
  if (!businessId) return [];
  const cached = await readCachedBranches(businessId);

  if (isOffline()) {
    return cached.map(mapBranch);
  }

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 5000) : null;
    try {
      let query = assertSupabase()
        .from('branches')
        .select('*')
        .eq('business_id', businessId)
        .order('is_main', { ascending: false })
        .order('name');
      if (controller && typeof query.abortSignal === 'function') {
        query = query.abortSignal(controller.signal);
      }
      const { data, error } = await query;
      if (error) throw error;
      const rows = data || [];
      await writeCachedBranches(businessId, rows);
      return rows.map(mapBranch);
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (err) {
    if (cached.length > 0) {
      console.warn('getBranches: sin conexión, usando sedes guardadas:', err?.message || err);
      return cached.map(mapBranch);
    }
    throw err;
  }
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
    .maybeSingle();
  if (error) {
    // INSERT ok pero SELECT denegado por RLS: PostgREST devuelve PGRST116/0 filas.
    // Reintentarlo crearía un duplicado, así que se pide recargar en vez de reintentar.
    if (error.code === 'PGRST116' || /0 filas|0 rows|permission|policy|rls|recurs/i.test(error.message || '')) {
      console.error('addBranch: INSERT ok pero SELECT denegado por RLS:', error);
      throw new Error('Sede creada, pero no se pudo leer por permisos. Recargá la lista en lugar de crearla de nuevo para no duplicarla.');
    }
    console.error('addBranch:', error);
    throw error;
  }
  if (!data) {
    // maybeSingle devuelve null sin error cuando RLS filtra la fila recién creada.
    console.error('addBranch: INSERT ok pero SELECT devolvió 0 filas (RLS). Posible duplicado si se reintenta.');
    throw new Error('Sede creada. Recargá la lista para verla (no la crees de nuevo).');
  }
  try {
    await db.branches.put(data);
  } catch (cacheErr) {
    console.warn('addBranch: no se pudo guardar la sede en caché local:', cacheErr?.message || cacheErr);
  }
  return mapBranch(data);
}

export async function updateBranch(id, patch) {
  const body = {};
  if (patch.name !== undefined) body.name = patch.name.trim();
  if (patch.type !== undefined) body.type = patch.type;
  if (patch.address !== undefined) body.address = patch.address;
  if (patch.phone !== undefined) body.phone = patch.phone;
  const { error } = await assertSupabase().from('branches').update(body).eq('id', id);
  if (error) throw error;
  try {
    await db.branches.update(id, body);
  } catch (cacheErr) {
    console.warn('updateBranch: no se pudo actualizar la caché local:', cacheErr?.message || cacheErr);
  }
}

export async function setMainBranch(businessId, id) {
  const { data: all, error: listErr } = await assertSupabase().from('branches').select('id').eq('business_id', businessId);
  if (listErr) {
    console.error('setMainBranch: no se pudo listar sedes:', listErr);
    throw listErr;
  }
  for (const b of all || []) {
    const { error: updErr } = await assertSupabase().from('branches').update({ is_main: b.id === id }).eq('id', b.id);
    if (updErr) {
      console.error('setMainBranch: no se pudo actualizar sede:', b?.id, updErr);
      throw updErr;
    }
  }
  try {
    await db.branches.where('business_id').equals(businessId).modify({ is_main: false });
    await db.branches.update(id, { is_main: true });
  } catch (cacheErr) {
    console.warn('setMainBranch: no se pudo actualizar la caché local:', cacheErr?.message || cacheErr);
  }
}

export async function deleteBranch(businessId, branch) {
  if (branch.isMain || branch.is_main) {
    throw new Error('La casa matriz no se puede eliminar. Marca otra como principal primero.');
  }
  // Seguridad: no borrar sedes con ventas o gastos registrados.
  // Si el SELECT de verificación falla (RLS/red), NO se borra nada por seguridad.
  const { data: sales, error: salesErr } = await assertSupabase().from('sales').select('id').eq('branch_id', branch.id).limit(1);
  if (salesErr) {
    console.error('deleteBranch: no se pudo verificar ventas, no se elimina por seguridad:', salesErr);
    throw new Error('No se pudo verificar si la sede tiene ventas (error de lectura). No se eliminó nada por seguridad. Recargá e intentá de nuevo.');
  }
  if (sales && sales.length > 0) {
    throw new Error('Esta sede tiene ventas registradas y no se puede eliminar.');
  }
  const { data: exps, error: expsErr } = await assertSupabase().from('expenses').select('id').eq('branch_id', branch.id).limit(1);
  if (expsErr) {
    console.error('deleteBranch: no se pudo verificar gastos, no se elimina por seguridad:', expsErr);
    throw new Error('No se pudo verificar si la sede tiene gastos (error de lectura). No se eliminó nada por seguridad. Recargá e intentá de nuevo.');
  }
  if (exps && exps.length > 0) {
    throw new Error('Esta sede tiene gastos registrados y no se puede eliminar.');
  }
  const { error } = await assertSupabase().from('branches').delete().eq('id', branch.id);
  if (error) {
    console.error('deleteBranch: no se pudo eliminar sede:', error);
    throw error;
  }
  try {
    await db.branches.delete(branch.id);
  } catch (cacheErr) {
    console.warn('deleteBranch: no se pudo borrar la sede de la caché local:', cacheErr?.message || cacheErr);
  }
}
