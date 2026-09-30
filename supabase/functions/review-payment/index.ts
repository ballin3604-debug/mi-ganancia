// ─────────────────────────────────────────────────────────────
// Edge Function: review-payment (cobro manual Fase 1)
// El admin aprueba un comprobante y se extiende la suscripción,
// o lo rechaza. Escribe auditoría. Solo ADMIN_UID.
// Desplegar con: npx supabase functions deploy review-payment
// ─────────────────────────────────────────────────────────────
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const adminUid = Deno.env.get('ADMIN_UID') ?? '';
    if (!supabaseUrl || !serviceKey || !adminUid) {
      throw new Error('Faltan secrets (SUPABASE_URL / SERVICE_ROLE / ADMIN_UID).');
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const jwtClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await jwtClient.auth.getUser();
    if (userErr || !user || user.id !== adminUid) {
      return new Response(JSON.stringify({ error: 'No autorizado.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { paymentId, action, adminNote = '' } = await req.json();
    if (!paymentId || !['approve', 'reject'].includes(action)) {
      return new Response(JSON.stringify({ error: 'paymentId y action approve|reject requeridos.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: pay, error: payErr } = await admin
      .from('payments').select('*').eq('id', paymentId).single();
    if (payErr || !pay) throw new Error('Pago no encontrado.');
    if (pay.status !== 'pending') {
      return new Response(JSON.stringify({ error: `Ya fue revisado (${pay.status}).` }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reject') {
      const { error } = await admin.from('payments').update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        admin_note: adminNote,
      }).eq('id', paymentId);
      if (error) throw error;
    } else {
      // Extender desde el vencimiento vigente (o desde hoy si ya venció)
      const { data: sub } = await admin
        .from('subscriptions').select('*').eq('business_id', pay.business_id).maybeSingle();
      const base = sub?.current_period_end && new Date(sub.current_period_end) > new Date()
        ? new Date(sub.current_period_end)
        : new Date();
      const days = pay.billing_cycle === 'yearly' ? 365 : 30;
      const nextEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

      const { error: subErr } = await admin.from('subscriptions').upsert({
        business_id: pay.business_id,
        plan_id: pay.plan_id,
        status: 'active',
        current_period_end: nextEnd.toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'business_id' });
      if (subErr) throw subErr;

      const { error: payErr2 } = await admin.from('payments').update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        admin_note: adminNote,
      }).eq('id', paymentId);
      if (payErr2) throw payErr2;
    }

    try {
      await admin.from('admin_audit_log').insert({
        admin_id: user.id,
        admin_email: user.email,
        action: action === 'approve' ? 'approve_payment' : 'reject_payment',
        business_id: pay.business_id,
        details: { payment_id: paymentId, plan: pay.plan_id, amount: pay.amount, note: adminNote },
        result: 'ok',
      });
    } catch (auditErr) {
      console.warn('review-payment: no se pudo auditar:', auditErr);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('review-payment:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
