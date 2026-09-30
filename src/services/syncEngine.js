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

// ── Capacidades del servidor (migraciones SQL pendientes o no) ─────────
// Si el usuario aún no corrió una migración (barcode, presentaciones), las
// columnas no existen y el insert/update fallaría para SIEMPRE dejando la
// cola trabada. Probamos una vez por sesión y, si faltan, se recortan esas
// claves del payload: la app sigue sincronizando lo demás y gana fidelidad
// total en cuanto se corre el SQL.
let serverCaps = null;

async function getServerCaps() {
  if (serverCaps) return serverCaps;
  serverCaps = { productPres: true, productBarcode: true, itemPres: true, salesBranch: true };
  try {
    const { error } = await supabase.from('products').select('unit_label').limit(0);
    if (error) serverCaps.productPres = false;
  } catch {
    serverCaps.productPres = false;
  }
  try {
    const { error } = await supabase.from('products').select('barcode').limit(0);
    if (error) serverCaps.productBarcode = false;
  } catch {
    serverCaps.productBarcode = false;
  }
  try {
    const { error } = await supabase.from('sale_items').select('presentation').limit(0);
    if (error) serverCaps.itemPres = false;
  } catch {
    serverCaps.itemPres = false;
  }
  try {
    const { error } = await supabase.from('sales').select('branch_id').limit(0);
    if (error) serverCaps.salesBranch = false;
  } catch {
    serverCaps.salesBranch = false;
  }
  if (!serverCaps.productPres || !serverCaps.productBarcode || !serverCaps.itemPres || !serverCaps.salesBranch) {
    console.warn('syncEngine: columnas nuevas ausentes en el servidor, se sincroniza sin ellas. Corre el SQL de migración para fidelidad total.', serverCaps);
  }
  return serverCaps;
}

const NEW_PRES_KEYS = ['unit_label', 'pack_label', 'pack_price', 'pack_price_hot'];

async function stripUnknownProductKeys(obj) {
  const caps = await getServerCaps();
  if (!obj || typeof obj !== 'object') return obj;
  if (caps.productPres && caps.productBarcode) return obj;
  const copy = { ...obj };
  if (!caps.productPres) NEW_PRES_KEYS.forEach((k) => { delete copy[k]; });
  if (!caps.productBarcode) delete copy.barcode;
  return copy;
}

function isMissingColumnError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return err?.code === 'PGRST204' || msg.includes('column') || msg.includes('columna');
}

async function processOperation(op, businessId) {
  const { operation_type, payload } = op;

  switch (operation_type) {
    case 'ADD_PRODUCT': {
      const body = await stripUnknownProductKeys(payload);
      const { error } = await supabase.from('products').insert(body);
      if (error) throw error;
      break;
    }
    case 'UPDATE_PRODUCT': {
      const { id, ...updateData } = payload;
      const body = await stripUnknownProductKeys(updateData);
      const { error } = await supabase.from('products').update(body).eq('id', id);
      if (error) throw error;
      break;
    }
    case 'DELETE_PRODUCT': {
      const { error } = await supabase.from('products').delete().eq('id', payload.id);
      if (error) throw error;
      break;
    }
    case 'SET_BRANCH_STOCK': {
      // Upsert tolerante del stock de una sede (Fase 2)
      try {
        const { error } = await supabase.from('branch_stock').upsert({
          branch_id: payload.branch_id,
          product_id: payload.product_id,
          business_id: businessId,
          stock: Number(payload.stock || 0),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'branch_id,product_id' });
        if (error) throw error;
      } catch (err) {
        if (isMissingColumnError(err) || String(err?.message || '').includes('branch_stock')) {
          const caps = await getServerCaps();
          caps.branchTables = false;
        } else throw err;
      }
      break;
    }
    case 'TRANSFER_STOCK': {
      // Traspaso en el servidor: idempotente por transfer_id
      try {
        const { data: done } = await supabase
          .from('transfers')
          .select('id')
          .eq('id', payload.transfer_id)
          .maybeSingle();
        if (!done) {
          const qty = Number(payload.quantity || 0);
          const fromRow = await supabase.from('branch_stock')
            .select('stock').eq('branch_id', payload.from_branch_id).eq('product_id', payload.product_id)
            .maybeSingle();
          const toRow = await supabase.from('branch_stock')
            .select('stock').eq('branch_id', payload.to_branch_id).eq('product_id', payload.product_id)
            .maybeSingle();
          const fromStock = Math.max(0, Number(fromRow?.data?.stock || 0) - qty);
          const toStock = Number(toRow?.data?.stock || 0) + qty;
          await supabase.from('branch_stock').upsert([
            { branch_id: payload.from_branch_id, product_id: payload.product_id, business_id: businessId, stock: fromStock, updated_at: new Date().toISOString() },
            { branch_id: payload.to_branch_id, product_id: payload.product_id, business_id: businessId, stock: toStock, updated_at: new Date().toISOString() },
          ], { onConflict: 'branch_id,product_id' });
          const { error: tErr } = await supabase.from('transfers').insert({
            id: payload.transfer_id,
            business_id: businessId,
            product_id: payload.product_id,
            from_branch_id: payload.from_branch_id,
            to_branch_id: payload.to_branch_id,
            quantity: qty,
            created_by: payload.created_by || null,
          });
          if (tErr) throw tErr;
        }
      } catch (err) {
        if (isMissingColumnError(err) || String(err?.message || '').includes('branch_stock') || String(err?.message || '').includes('transfers')) {
          const caps = await getServerCaps();
          caps.branchTables = false;
        } else throw err;
      }
      break;
    }
    case 'REGISTER_SALE': {
      // 1. Idempotency Check using the client generated ID
      const { data: existing } = await supabase
        .from('sales')
        .select('id')
        .eq('id', payload.client_generated_id)
        .maybeSingle();

      // Solo se compensa stock si el RPC realmente creó la venta ahora.
      // En reintentos (ya sincronizada) se omite para no descontar doble.
      let didCreate = false;

      if (!existing) {
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
        didCreate = true;
      } else {
        console.log(`Sale ${payload.client_generated_id} already synced.`);
      }

      // 3. Write extra mixed payment fields if applicable (idempotente)
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

      // 3b. Compensación de stock por paquetes (solo si se creó ahora).      // El RPC descuenta `quantity` por ítem; en paquetes eso son paquetes,
      // no unidades base. Se descuenta la diferencia qty×(factor−1) y se
      // estampan los datos de presentación en los ítems del servidor
      // (tolerante si aún no corrieron la migración SQL).
      if (didCreate && Array.isArray(payload.p_factors)) {
        const caps = await getServerCaps();
        for (const f of payload.p_factors) {
          const factor = Number(f.factor || 1);
          const qty = Number(f.quantity || 0);
          if (factor > 1 && qty > 0) {
            try {
              const { data: srv } = await supabase
                .from('products')
                .select('stock')
                .eq('id', f.product_id)
                .single();
              if (srv) {
                const extra = qty * (factor - 1);
                await supabase
                  .from('products')
                  .update({ stock: Math.max(0, Number(srv.stock || 0) - extra) })
                  .eq('id', f.product_id);
              }
            } catch (compErr) {
              console.error('syncEngine: compensación de stock por paquete falló:', compErr);
            }
          }
        }
        if (caps.itemPres) {
          for (const f of payload.p_factors || []) {
            const factor = Number(f?.factor || 1);
            if (factor <= 1) continue;
            try {
              const { error: presErr } = await supabase
                .from('sale_items')
                .update({
                  presentation: f.presentation || '',
                  presentation_factor: factor,
                  variant: f.variant || '',
                })
                .eq('sale_id', payload.client_generated_id)
                .eq('product_id', f.product_id)
                .eq('quantity', Number(f.quantity))
                .eq('price', Number(f.price));
              if (presErr) {
                if (isMissingColumnError(presErr)) {
                  serverCaps.itemPres = false;
                  break;
                }
                throw presErr;
              }
            } catch (presErr) {
              if (isMissingColumnError(presErr)) {
                serverCaps.itemPres = false;
                break;
              }
              throw presErr;
            }
          }
        }
      }

      // 3c. Stock por sede en el servidor (Fase 2): descuenta las unidades
      // base de la sede de la venta. Tolerante si faltan las tablas.
      if (didCreate && payload.extraFields?.branchId && (await getServerCaps()).branchTables !== false) {
        try {
          const byProduct = {};
          for (const f of payload.p_factors || []) {
            const pid = f.product_id;
            byProduct[pid] = (byProduct[pid] || 0) + Number(f.quantity || 0) * Number(f.factor || 1);
          }
          for (const [pid, baseQty] of Object.entries(byProduct)) {
            const { data: row } = await supabase.from('branch_stock')
              .select('stock').eq('branch_id', payload.extraFields.branchId).eq('product_id', pid)
              .maybeSingle();
            const cur = Number(row?.stock || 0);
            const { error: bsErr } = await supabase.from('branch_stock').upsert({
              branch_id: payload.extraFields.branchId,
              product_id: pid,
              business_id: payload.business_id,
              stock: Math.max(0, cur - baseQty),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'branch_id,product_id' });
            if (bsErr) throw bsErr;
          }
        } catch (bsErr) {
          if (isMissingColumnError(bsErr) || String(bsErr?.message || '').includes('branch_stock')) {
            (await getServerCaps()).branchTables = false;
          } else throw bsErr;
        }
      }

      // 3d. Sello de sucursal en la venta del servidor (tolerante a migración:
      // sin columna, la venta queda sin sede en la nube pero local sí la tiene).
      if (didCreate && payload.extraFields?.branchId && (await getServerCaps()).salesBranch) {
        try {
          const { error: brErr } = await supabase
            .from('sales')
            .update({ branch_id: payload.extraFields.branchId })
            .eq('id', payload.client_generated_id);
          if (brErr) {
            if (isMissingColumnError(brErr)) serverCaps.salesBranch = false;
            else throw brErr;
          }
        } catch (brErr) {
          if (isMissingColumnError(brErr)) serverCaps.salesBranch = false;
          else throw brErr;
        }
      }

      // 4. Verify stock levels to raise negative stock alerts (solo al crear)
      if (didCreate) for (const item of payload.p_items) {
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
            sale_id: payload.client_generated_id,
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
          // Proteger también las filas de stock por sede tocadas por la venta
          if (op.payload.extraFields?.branchId && Array.isArray(op.payload.p_factors)) {
            op.payload.p_factors.forEach(f => {
              if (f.product_id) pendingIds.add(`${op.payload.extraFields.branchId}:${f.product_id}`);
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
        case 'SET_BRANCH_STOCK':
          if (op.payload.branch_id && op.payload.product_id) {
            pendingIds.add(`${op.payload.branch_id}:${op.payload.product_id}`);
          }
          break;
        case 'TRANSFER_STOCK':
          if (op.payload.from_branch_id && op.payload.product_id) {
            pendingIds.add(`${op.payload.from_branch_id}:${op.payload.product_id}`);
          }
          if (op.payload.to_branch_id && op.payload.product_id) {
            pendingIds.add(`${op.payload.to_branch_id}:${op.payload.product_id}`);
          }
          if (op.payload.transfer_id) pendingIds.add(op.payload.transfer_id);
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

    // Fase 2: stock por sede + traspasos (tolerante si faltan las tablas).
    // branch_stock usa PK compuesta: se normaliza con id local antes de comparar.
    try {
      const { data: bs } = await supabase.from('branch_stock').select('*').eq('business_id', businessId);
      if (bs) {
        const norm = bs.map((r) => ({ ...r, id: `${r.branch_id}:${r.product_id}` }));
        await safeSyncTable(db.branch_stock, norm, (item) => pendingIds.has(item.id), belongsToBiz);
      }
      const { data: trs } = await supabase.from('transfers').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(200);
      if (trs) {
        await safeSyncTable(db.transfers, trs, (item) => pendingIds.has(item.id), belongsToBiz);
      }
    } catch (e) {
      console.warn('syncEngine: sin tablas de Fase 2 en el servidor (corre la migración):', e?.message || e);
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
