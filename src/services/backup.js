import { supabase } from './supabaseClient';
import { checkOnlineStatus } from './syncEngine';

// Respaldo completo del negocio: baja TODO desde el servidor (no solo la
// caché local, que puede tener historial parcial de ventas) y lo descarga
// como un archivo .json. Es una copia independiente de Supabase y del
// navegador — la red de seguridad que el dueño se lleva en la mano.
export async function exportFullBackup(businessId, businessName) {
  if (!businessId) throw new Error('No hay un negocio activo.');

  const online = await checkOnlineStatus();
  if (!online) {
    const err = new Error('Necesitás conexión a internet para un respaldo completo (baja todo tu historial desde el servidor).');
    err.code = 'OFFLINE';
    throw err;
  }

  // Todas las tablas del negocio, en paralelo.
  const [products, clientes, debts, expenses, replenishments, sales, settingsRes] = await Promise.all([
    supabase.from('products').select('*').eq('business_id', businessId),
    supabase.from('clientes').select('*').eq('business_id', businessId),
    supabase.from('debts').select('*').eq('business_id', businessId),
    supabase.from('expenses').select('*').eq('business_id', businessId),
    supabase.from('replenishments').select('*').eq('business_id', businessId),
    supabase.from('sales').select('*').eq('business_id', businessId),
    supabase.from('business_settings').select('*').eq('business_id', businessId).maybeSingle(),
  ]);

  const firstError = products.error || clientes.error || debts.error
    || expenses.error || replenishments.error || sales.error;
  if (firstError) throw firstError;

  const salesData = sales.data || [];

  // Los ítems de venta se piden por lotes de IDs para no exceder el largo
  // de la URL cuando hay mucho historial.
  let saleItems = [];
  if (salesData.length > 0) {
    const saleIds = salesData.map((s) => s.id);
    for (let i = 0; i < saleIds.length; i += 200) {
      const chunk = saleIds.slice(i, i + 200);
      const { data, error } = await supabase.from('sale_items').select('*').in('sale_id', chunk);
      if (error) throw error;
      saleItems = saleItems.concat(data || []);
    }
  }

  const counts = {
    productos: products.data?.length || 0,
    ventas: salesData.length,
    items_de_venta: saleItems.length,
    fiados: debts.data?.length || 0,
    egresos: expenses.data?.length || 0,
    compras: replenishments.data?.length || 0,
    clientes: clientes.data?.length || 0,
  };

  const backup = {
    app: 'Mi Ganancia',
    tipo: 'respaldo-completo',
    version: 1,
    business_id: businessId,
    business_name: businessName || '',
    exportado_el: new Date().toISOString(),
    resumen: counts,
    data: {
      products: products.data || [],
      sales: salesData,
      sale_items: saleItems,
      debts: debts.data || [],
      expenses: expenses.data || [],
      replenishments: replenishments.data || [],
      clientes: clientes.data || [],
      business_settings: settingsRes.data || null,
    },
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeName = (businessName || 'negocio').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'negocio';
  a.href = url;
  a.download = `respaldo-mi-ganancia-${safeName}-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Se libera en el próximo tick para no cortar la descarga en algunos navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return counts;
}
