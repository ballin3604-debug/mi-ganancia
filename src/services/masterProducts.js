import { supabase } from './supabaseClient';
import { generateUUID } from './localDb';

function mapMasterProduct(p) {
  if (!p) return p;
  return {
    ...p,
    suggestedPrice: p.suggested_price,
    suggestedCost: p.suggested_cost,
    imageData: p.image_url,
    isActive: p.is_active,
    createdAt: p.created_at ? { toDate: () => new Date(p.created_at) } : null,
    updatedAt: p.updated_at ? { toDate: () => new Date(p.updated_at) } : null,
  };
}

export function masterImagePath(masterProductId) {
  return `master/${masterProductId}.jpg`;
}

export async function getMasterProducts() {
  const { data, error } = await supabase
    .from('master_products')
    .select('*')
    .order('name');
  if (error) throw error;
  return data.map(mapMasterProduct);
}

export async function addMasterProduct(data) {
  const id = data.id || generateUUID();
  const now = new Date().toISOString();

  const row = {
    id,
    name: data.name.trim(),
    brand: (data.brand || '').trim(),
    category: data.category || 'Otros',
    unit: data.unit || 'Unidad',
    suggested_price: Number(data.suggestedPrice) || 0,
    suggested_cost: data.suggestedCost !== '' && data.suggestedCost !== undefined && data.suggestedCost !== null
      ? Number(data.suggestedCost)
      : null,
    image_url: data.imageData || '',
    description: (data.description || '').trim(),
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  const { error } = await supabase.from('master_products').insert(row);
  if (error) throw error;
  return mapMasterProduct(row);
}

export async function updateMasterProduct(id, data) {
  const now = new Date().toISOString();
  const updateData = {
    name: data.name.trim(),
    brand: (data.brand || '').trim(),
    category: data.category || 'Otros',
    unit: data.unit || 'Unidad',
    suggested_price: Number(data.suggestedPrice) || 0,
    suggested_cost: data.suggestedCost !== '' && data.suggestedCost !== undefined && data.suggestedCost !== null
      ? Number(data.suggestedCost)
      : null,
    image_url: data.imageData || '',
    description: (data.description || '').trim(),
    updated_at: now,
  };
  if (data.isActive !== undefined) updateData.is_active = data.isActive;

  const { error } = await supabase.from('master_products').update(updateData).eq('id', id);
  if (error) throw error;
  return mapMasterProduct({ id, ...updateData });
}

export async function deleteMasterProduct(id) {
  const { error } = await supabase.from('master_products').delete().eq('id', id);
  if (error) throw error;
}

// items: [{ id: masterProductId, stock, salePrice, supplierPrice, expiryDate }]
export async function importCatalogToBusiness(businessId, items) {
  const { data, error } = await supabase.rpc('importar_productos_catalogo', {
    p_business_id: businessId,
    p_items: items.map((it) => ({
      master_id: it.id,
      stock: Number(it.stock) || 0,
      sale_price: it.salePrice !== '' && it.salePrice != null ? Number(it.salePrice) : null,
      supplier_price: it.supplierPrice !== '' && it.supplierPrice != null ? Number(it.supplierPrice) : null,
      expiry_date: it.expiryDate || null,
    })),
  });
  if (error) throw error;
  return data;
}
