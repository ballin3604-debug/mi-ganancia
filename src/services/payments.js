import { supabase } from './supabaseClient';

function mapPayment(p) {
  if (!p) return p;
  return {
    ...p,
    businessId: p.business_id,
    planId: p.plan_id,
    billingCycle: p.billing_cycle,
    receiptUrl: p.receipt_url,
    reviewedAt: p.reviewed_at ? { toDate: () => new Date(p.reviewed_at) } : null,
    createdAt: p.created_at ? { toDate: () => new Date(p.created_at) } : null,
  };
}

// Sube el comprobante al bucket privado: <businessId>/<uuid>.jpg
export async function uploadReceipt(businessId, dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  const ext = blob.type.includes('png') ? 'png' : 'jpg';
  const path = `${businessId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('payment-receipts')
    .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

export async function createPayment(businessId, { planId, billingCycle, amount, method = 'qr', reference = '', receiptPath = '' }) {
  const { data, error } = await supabase
    .from('payments')
    .insert({
      business_id: businessId,
      plan_id: planId,
      billing_cycle: billingCycle,
      amount,
      method,
      reference: reference.trim(),
      receipt_url: receiptPath,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return mapPayment(data);
}

export async function getMyPayments(businessId) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data || []).map(mapPayment);
}

// ── Admin ──
export async function getAllPayments(status = null) {
  let q = supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(100);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(mapPayment);
}

export async function getReceiptUrl(path) {
  if (!path) return '';
  // Firmada 1h (bucket privado). El admin la ve; expira sola.
  const { data, error } = await supabase.storage
    .from('payment-receipts')
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data?.signedUrl || '';
}

// Vía Edge Function (service_role + auditoría); respaldo directo si no desplegada.
export async function reviewPayment(paymentId, action, adminNote = '') {
  try {
    const { data, error } = await supabase.functions.invoke('review-payment', {
      body: { paymentId, action, adminNote },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  } catch (fnErr) {
    console.warn('reviewPayment: función no disponible, vía directa:', fnErr);
    const patch = action === 'approve'
      ? { status: 'approved', reviewed_at: new Date().toISOString(), admin_note: adminNote }
      : { status: 'rejected', reviewed_at: new Date().toISOString(), admin_note: adminNote };
    const { error } = await supabase.from('payments').update(patch).eq('id', paymentId);
    if (error) throw error;
    if (action === 'approve') {
      // El fallback directo NO extiende la suscripción (lo hace la función).
      // El admin debe extenderla desde SQL o desplegar la función.
      console.warn('reviewPayment fallback: extiende la suscripción manualmente.');
    }
    return { ok: true, fallback: true };
  }
}
