import { supabase } from './supabaseClient';
import { db, generateUUID } from './localDb';

let online = navigator.onLine;
let pendingCount = 0;
let errorCount = 0;
let isSyncing = false;
const listeners = new Set();

export async function checkOnlineStatus() {
  if (!navigator.onLine) return false;
  try {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return false;

    // Fast ping using HEAD method on a lightweight table (fully CORS enabled)
    const pingUrl = `${url}/rest/v1/products?select=id&limit=1`;
    const response = await fetch(pingUrl, {
      method: 'HEAD',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      },
      cache: 'no-store'
    });
    return response.ok || response.status === 200 || response.status === 206;
  } catch (err) {
    console.error('checkOnlineStatus: Ping failed with exception:', err);
    return false;
  }
}

// Ops sin business_id son de antes de este fix (quedan huérfanas de otro modo);
// se cuentan/procesan igual para no perderlas, pero nunca se filtra la cola de
// UN negocio con datos de otro negocio conocido.
function belongsToBusiness(op, businessId) {
  return !op.business_id || op.business_id === businessId;
}

async function updatePendingCount(businessId) {
  const allOps = await db.pending_operations.toArray();
  const scoped = businessId ? allOps.filter((op) => belongsToBusiness(op, businessId)) : allOps;
  pendingCount = scoped.filter((op) => op.status === 'pending').length;
  errorCount = scoped.filter((op) => op.status === 'error').length;
  notifyListeners();
}

function notifyListeners() {
  listeners.forEach((callback) => callback({ online, pendingCount, errorCount }));
}

export function subscribeSyncStatus(callback) {
  listeners.add(callback);
  callback({ online, pendingCount, errorCount });
  return () => listeners.delete(callback);
}

// Periodically monitor connection with ping check
export async function initializeSyncEngine(businessId) {
  await updatePendingCount(businessId);

  const handleConnectivityChange = async () => {
    online = await checkOnlineStatus();
    notifyListeners();
    if (online) {
      triggerSync(businessId);
    }
  };

  window.addEventListener('online', handleConnectivityChange);
  window.addEventListener('offline', handleConnectivityChange);

  // Periodic ping interval
  const intervalId = setInterval(async () => {
    const prevOnline = online;
    online = await checkOnlineStatus();
    if (online !== prevOnline) {
      notifyListeners();
    }
    if (online) {
      triggerSync(businessId);
    }
  }, 15000);

  // Initial check
  handleConnectivityChange();

  return () => {
    window.removeEventListener('online', handleConnectivityChange);
    window.removeEventListener('offline', handleConnectivityChange);
    clearInterval(intervalId);
  };
}

// Construye el registro del outbox sin escribirlo — para que un caller con
// múltiples escrituras relacionadas (p.ej. registrar una venta: venta + items
// + stock) pueda incluirlo en su propia transacción Dexie y así o se guarda
// todo junto, o no se guarda nada. Ver refreshOutboxState/enqueueOperation.
export function buildOutboxOp(operationType, payload, businessId) {
  return {
    id: generateUUID(),
    operation_type: operationType,
    payload,
    business_id: businessId,
    status: 'pending',
    created_at: new Date().toISOString(),
    retry_count: 0,
    last_attempt_at: null,
  };
}

// Refresca el contador visible y dispara un intento de sync — para usar
// después de agregar una op al outbox por fuera de enqueueOperation (dentro
// de una transacción propia).
export async function refreshOutboxState(businessId) {
  await updatePendingCount(businessId);
  triggerSync(businessId);
}

export async function enqueueOperation(operationType, payload, businessId) {
  const op = buildOutboxOp(operationType, payload, businessId);
  await db.pending_operations.add(op);
  await refreshOutboxState(businessId);
}

export async function triggerSync(businessId) {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const isOnline = await checkOnlineStatus();
    if (!isOnline) {
      isSyncing = false;
      return;
    }

    const allOps = await db.pending_operations.orderBy('created_at').toArray();
    const ops = allOps.filter((op) => belongsToBusiness(op, businessId));

    for (const op of ops) {
      if (op.status === 'error') continue; // Skip permanently failed operations

      // Simple exponential backoff check
      if (op.retry_count > 0 && op.last_attempt_at) {
        const backoffSeconds = Math.min(Math.pow(2, op.retry_count) * 10, 300); // max 5 min
        const msSinceAttempt = Date.now() - new Date(op.last_attempt_at).getTime();
        if (msSinceAttempt < backoffSeconds * 1000) {
          continue; // Skip this cycle for this operation
        }
      }

      try {
        await processOperation(op, businessId);
        await db.pending_operations.delete(op.id);
      } catch (err) {
        const errorMessage = err?.message || err?.details || err?.hint || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Error de sincronización.';
        console.error(`[SyncEngine Error] Operation ${op.id} (${op.operation_type}) - Attempt ${(op.retry_count || 0) + 1}:`, errorMessage, err);
        
        const nextRetry = (op.retry_count || 0) + 1;
        const nowStr = new Date().toISOString();

        if (nextRetry >= 5) {
          // Permanent failure
          await db.pending_operations.update(op.id, {
            status: 'error',
            retry_count: nextRetry,
            last_attempt_at: nowStr,
            error_details: errorMessage
          });
        } else {
          // Incremental retry queue
          await db.pending_operations.update(op.id, {
            status: 'pending',
            retry_count: nextRetry,
            last_attempt_at: nowStr,
            error_details: errorMessage
          });
        }
      }
      await updatePendingCount(businessId);
    }

    // Antes esto solo corría si processedAny era true, es decir, solo si
    // ESTE dispositivo tenía algo propio para enviar. Eso significa que un
    // dispositivo sin cambios pendientes (el caso normal) nunca volvía a
    // bajar cambios hechos en OTRO dispositivo hasta recargar la página.
    // Ahora se sincroniza siempre que haya conexión, haya o no ops propias.
    await syncCacheFromServer(businessId);
  } catch (err) {
    console.error('Error during synchronization run:', err);
  } finally {
    isSyncing = false;
  }
}

export async function retryOperation(opId, businessId) {
  await db.pending_operations.update(opId, {
    status: 'pending',
    retry_count: 0,
    last_attempt_at: null,
    error_details: null
  });
  await updatePendingCount(businessId);
  triggerSync(businessId);
}

export async function discardOperation(opId, businessId) {
  await db.pending_operations.delete(opId);
  await updatePendingCount(businessId);
}

async function processOperation(op, businessId) {
  const { operation_type, payload } = op;

  switch (operation_type) {
    case 'ADD_PRODUCT': {
      const { error } = await supabase.from('products').insert(payload);
      if (error) throw error;
      break;
    }
    case 'UPDATE_PRODUCT': {
      const { id, ...updateData } = payload;
      const { error } = await supabase.from('products').update(updateData).eq('id', id);
      if (error) throw error;
      break;
    }
    case 'DELETE_PRODUCT': {
      const { error } = await supabase.from('products').delete().eq('id', payload.id);
      if (error) throw error;
      break;
    }
    case 'REGISTER_SALE': {
      // 1. Idempotency Check using the client generated ID
      const { data: existing } = await supabase
        .from('sales')
        .select('id')
        .eq('id', payload.client_generated_id)
        .maybeSingle();

      if (existing) {
        console.log(`Sale ${payload.client_generated_id} already synced.`);
        break;
      }

      // 2. Call the server side RPC transaction
      const { data: saleId, error } = await supabase.rpc('registrar_venta', {
        p_client_generated_id: payload.client_generated_id,
        p_business_id: payload.business_id,
        p_client_name: payload.client_name,
        p_client_nit: payload.client_nit,
        p_payment_method: payload.payment_method,
        p_total: Number(payload.total),
        p_item_count: Number(payload.item_count || 0),
        p_seller_name: payload.seller_name || '',
        p_created_by: payload.created_by || null,
        p_items: payload.p_items
      });
      if (error) throw error;

      // 3. Write extra mixed payment fields if applicable
      if (payload.extraFields && Object.keys(payload.extraFields).length > 0) {
        const updateData = {};
        if (payload.extraFields.montoEfectivo !== undefined) updateData.monto_efectivo = Number(payload.extraFields.montoEfectivo);
        if (payload.extraFields.montoQR !== undefined) updateData.monto_qr = Number(payload.extraFields.montoQR);
        
        const { error: updErr } = await supabase
          .from('sales')
          .update(updateData)
          .eq('id', payload.client_generated_id);
        if (updErr) throw updErr;
      }

      // 4. Verify stock levels to raise negative stock alerts
      for (const item of payload.p_items) {
        const { data: prod } = await supabase
          .from('products')
          .select('name, stock')
          .eq('id', item.product_id)
          .single();

        if (prod && prod.stock < 0) {
          // Record the stock alert
          await supabase.from('stock_alerts').insert({
            business_id: payload.business_id,
            product_id: item.product_id,
            product_name: prod.name,
            current_stock: prod.stock,
            sale_id: saleId,
            message: `Stock negativo detected para ${prod.name} (Cantidad: ${prod.stock}) tras sincronización offline.`
          });
        }
      }
      break;
    }
    case 'ADD_EXPENSE': {
      const { error } = await supabase.from('expenses').insert(payload);
      if (error) throw error;
      break;
    }
    case 'DELETE_EXPENSE': {
      const { error } = await supabase.from('expenses').delete().eq('id', payload.id);
      if (error) throw error;
      break;
    }
    case 'ADD_REPLENISHMENT': {
      const { error } = await supabase.from('replenishments').insert(payload);
      if (error) throw error;
      break;
    }
    case 'UPDATE_REPLENISHMENT': {
      const { id, ...updateData } = payload;
      const { error } = await supabase.from('replenishments').update(updateData).eq('id', id);
      if (error) throw error;
      break;
    }
    case 'ADD_DEBT': {
      const { error } = await supabase.from('debts').insert(payload);
      if (error) throw error;
      break;
    }
    case 'PAY_DEBT': {
      const { error: dErr } = await supabase
        .from('debts')
        .update({
          status: 'paid',
          paid_at: payload.paid_at,
          payment_method_received: payload.payment_method_received,
        })
        .eq('id', payload.debtId);
      if (dErr) throw dErr;
      // La venta original no se toca — ver nota en debts.js/payDebt.
      break;
    }
    case 'DELETE_DEBT': {
      const { error } = await supabase.from('debts').delete().eq('id', payload.id);
      if (error) throw error;
      break;
    }
    case 'ADD_CUSTOMER': {
      const { error } = await supabase.from('clientes').insert(payload);
      if (error) throw error;
      break;
    }
    case 'UPDATE_CUSTOMER': {
      const { id, ...updateData } = payload;
      const { error } = await supabase.from('clientes').update(updateData).eq('id', id);
      if (error) throw error;
      break;
    }
    case 'DELETE_CUSTOMER': {
      const { error } = await supabase.from('clientes').delete().eq('id', payload.id);
      if (error) throw error;
      break;
    }
    case 'SAVE_BUSINESS_SETTINGS': {
      const { business_id, ...data } = payload;
      const { error } = await supabase
        .from('business_settings')
        .upsert({ business_id, ...data });
      if (error) throw error;
      break;
    }
    default:
      console.warn(`Unhandled operation type: ${operation_type}`);
  }
}

// isEligibleFn decides which LOCAL records are even candidates for deletion.
// This matters because some server fetches below are partial (e.g. sales are
// only fetched from today onward, to keep the sync payload small) — without
// restricting deletion to that same window, every local record outside it
// looks "missing from the server" and gets wiped, silently collapsing local
// history down to whatever the last fetch window covered. It also guards
// against deleting another business's cached rows on a shared device.
async function safeSyncTable(table, serverData, isPendingFn, isEligibleFn = () => true) {
  await db.transaction('rw', table, async () => {
    const localRecords = await table.toArray();
    const serverKeys = new Set(serverData.map((item) => item.id));
    const eligibleLocalCount = localRecords.filter(isEligibleFn).length;

    // Red de seguridad: si el servidor "no devolvió nada" pero localmente sí
    // había registros elegibles, NO se borra nada. Con RLS, una consulta que
    // debería traer filas puede devolver 0 filas sin ningún error (sesión a
    // punto de expirar, una policy mal aplicada, etc. — ya pasó en este
    // proyecto). Sin esta protección, ese 0 silencioso se interpretaba como
    // "el servidor los borró todos" y se vaciaba la caché local completa
    // (clientes, deudas, productos...) aunque los datos siguieran intactos
    // en la base de datos real. El único costo es que, si alguna vez borrás
    // TODOS los registros de una tabla hasta dejarla en cero, la caché local
    // tarda hasta el próximo registro nuevo en reflejarlo — un precio bajo
    // comparado con perder de vista datos de clientes por un glitch.
    if (serverData.length === 0 && eligibleLocalCount > 0) {
      console.warn('[SyncEngine] Sincronización de caché omitida: el servidor devolvió 0 registros pero había datos locales. Se preservó la caché local por seguridad.');
      return;
    }

    // Delete local records that are not on the server and are not pending sync
    const recordsToDelete = localRecords.filter(
      (item) => isEligibleFn(item) && !serverKeys.has(item.id) && !isPendingFn(item)
    );
    if (recordsToDelete.length > 0) {
      await table.bulkDelete(recordsToDelete.map((r) => r.id));
    }

    // Upsert server records that are not pending sync
    const recordsToPut = serverData.filter((item) => !isPendingFn(item));
    if (recordsToPut.length > 0) {
      await table.bulkPut(recordsToPut);
    }
  });
}

export async function syncCacheFromServer(businessId) {
  if (!businessId) return;
  const isOnline = await checkOnlineStatus();
  if (!isOnline) return;

  try {
    const pendingOps = await db.pending_operations.toArray();
    const pendingIds = new Set();
    pendingOps.forEach((op) => {
      if (!op.payload) return;
      
      // Protect primary ID if present
      if (op.payload.id) pendingIds.add(op.payload.id);

      // Handle rules based on operation type
      switch (op.operation_type) {
        case 'ADD_PRODUCT':
        case 'UPDATE_PRODUCT':
        case 'DELETE_PRODUCT':
          if (op.payload.id) pendingIds.add(op.payload.id);
          break;
        case 'REGISTER_SALE':
          if (op.payload.client_generated_id) pendingIds.add(op.payload.client_generated_id);
          if (Array.isArray(op.payload.p_items)) {
            op.payload.p_items.forEach(item => {
              if (item.product_id) pendingIds.add(item.product_id);
            });
          }
          break;
        case 'ADD_REPLENISHMENT':
        case 'UPDATE_REPLENISHMENT':
          if (op.payload.id) pendingIds.add(op.payload.id);
          if (op.payload.product_id) pendingIds.add(op.payload.product_id);
          break;
        case 'ADD_DEBT':
        case 'DELETE_DEBT':
          if (op.payload.id) pendingIds.add(op.payload.id);
          if (op.payload.sale_id) pendingIds.add(op.payload.sale_id);
          if (op.payload.saleId) pendingIds.add(op.payload.saleId);
          break;
        case 'PAY_DEBT':
          if (op.payload.debtId) pendingIds.add(op.payload.debtId);
          if (op.payload.saleId) pendingIds.add(op.payload.saleId);
          break;
        case 'ADD_CUSTOMER':
        case 'UPDATE_CUSTOMER':
        case 'DELETE_CUSTOMER':
          if (op.payload.id) pendingIds.add(op.payload.id);
          break;
        case 'ADD_EXPENSE':
        case 'DELETE_EXPENSE':
          if (op.payload.id) pendingIds.add(op.payload.id);
          break;
      }
    });

    // Elegibilidad para borrado: siempre restringida al negocio activo, para
    // no tocar la caché de otro negocio en un dispositivo compartido.
    const belongsToBiz = (item) => item.business_id === businessId;

    const { data: prods } = await supabase.from('products').select('*').eq('business_id', businessId);
    if (prods) {
      await safeSyncTable(db.products, prods, (item) => pendingIds.has(item.id), belongsToBiz);
    }

    const { data: clis } = await supabase.from('clientes').select('*').eq('business_id', businessId);
    if (clis) {
      await safeSyncTable(db.clientes, clis, (item) => pendingIds.has(item.id), belongsToBiz);
    }

    const { data: debts } = await supabase.from('debts').select('*').eq('business_id', businessId);
    if (debts) {
      await safeSyncTable(db.debts, debts, (item) => pendingIds.has(item.id), belongsToBiz);
    }

    const { data: exps } = await supabase.from('expenses').select('*').eq('business_id', businessId);
    if (exps) {
      await safeSyncTable(db.expenses, exps, (item) => pendingIds.has(item.id), belongsToBiz);
    }

    const { data: reps } = await supabase.from('replenishments').select('*').eq('business_id', businessId);
    if (reps) {
      await safeSyncTable(db.replenishments, reps, (item) => pendingIds.has(item.id), belongsToBiz);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: sales } = await supabase
      .from('sales')
      .select('*')
      .eq('business_id', businessId)
      .gte('created_at', today.toISOString());

    if (sales) {
      // Solo se pidió al servidor "de hoy en adelante" — restringimos el
      // borrado local a ese mismo rango, si no cualquier venta local de un
      // día anterior "no está en el servidor" (porque no se la pidió) y se
      // borraba igual, dejando el historial local recortado a "solo hoy"
      // en cada ciclo de sync.
      const isTodaysSale = (item) => {
        if (item.business_id !== businessId) return false;
        const d = item.created_at ? new Date(item.created_at) : null;
        return !!d && d >= today;
      };
      await safeSyncTable(db.sales, sales, (item) => pendingIds.has(item.id), isTodaysSale);

      const saleIds = sales.map((s) => s.id);
      if (saleIds.length > 0) {
        const { data: items } = await supabase.from('sale_items').select('*').in('sale_id', saleIds);
        if (items) {
          const todaySaleIdSet = new Set(saleIds);
          await safeSyncTable(db.sale_items, items, (item) => pendingIds.has(item.sale_id), (item) => todaySaleIdSet.has(item.sale_id));
        }
      }
    }

    // Sync business settings
    const { data: settingsData } = await supabase
      .from('business_settings')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();

    if (settingsData) {
      const isSettingsPending = pendingOps.some(op => op.operation_type === 'SAVE_BUSINESS_SETTINGS');
      if (!isSettingsPending) {
        await db.business_settings.put({
          ...settingsData,
          _fullySynced: true
        });
      }
    }

    // Broadcast cache sync event to refresh local service views without circular imports
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tuganancia-cache-synced', { detail: { businessId } }));
    }
  } catch (err) {
    console.error('Error synchronizing local cache from server:', err);
  }
}
