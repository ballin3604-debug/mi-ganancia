// ─────────────────────────────────────────────────────────────
// Edge Function: delete-business (Paso 3 del plan SaaS)
// Borrado en cascada de un negocio con service_role + auditoría.
// Solo el ADMIN_UID puede llamarla (se verifica el JWT del llamador).
// Desplegar con: npx supabase functions deploy delete-business
// Requiere secret: ADMIN_UID  (npx supabase secrets set ADMIN_UID=xxx)
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

    // 1. Verificar que quien llama es el admin (JWT del Authorization header)
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

    const { businessId } = await req.json();
    if (!businessId) {
      return new Response(JSON.stringify({ error: 'Falta businessId.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Cliente privilegiado (bypasea RLS)
    const admin = createClient(supabaseUrl, serviceKey);
    const warnings: string[] = [];

    async function tryDelete(label: string, fn: () => Promise<{ error: unknown }>) {
      try {
        const { error } = await fn();
        if (error) throw error;
      } catch (err) {
        console.error(`delete-business [${label}]:`, err);
        warnings.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const bizName: string = (await admin.from('businesses').select('name').eq('id', businessId).single()).data?.name ?? '';

    // Ítems de ventas primero (FK lógica hacia sales)
    const { data: salesRows } = await admin.from('sales').select('id').eq('business_id', businessId);
    const saleIds: string[] = (salesRows || []).map((s: { id: string }) => s.id);
    for (let i = 0; i < saleIds.length; i += 100) {
      const chunk = saleIds.slice(i, i + 100);
      await tryDelete(`sale_items (${i / 100 + 1})`, () =>
        admin.from('sale_items').delete().in('sale_id', chunk).then((r) => ({ error: r.error })));
    }

    for (const table of ['sales', 'products', 'clientes', 'debts', 'expenses', 'replenishments', 'stock_alerts', 'business_settings', 'business_join_codes']) {
      await tryDelete(table, () =>
        admin.from(table).delete().eq('business_id', businessId).then((r) => ({ error: r.error })));
    }

    // Perfiles liberados (vuelven a Setup como usuarios nuevos)
    await tryDelete('profiles', () =>
      admin.from('profiles').delete().eq('business_id', businessId).then((r) => ({ error: r.error })));

    const { error: bizErr } = await admin.from('businesses').delete().eq('id', businessId);
    if (bizErr) throw bizErr;

    // 3. Auditoría (best-effort: si la tabla aún no existe, no falla el borrado)
    try {
      await admin.from('admin_audit_log').insert({
        admin_id: user.id,
        admin_email: user.email,
        action: 'delete_business',
        business_id: businessId,
        business_name: bizName,
        details: { saleIds: saleIds.length, warnings },
        result: 'ok',
      });
    } catch (auditErr) {
      console.warn('delete-business: no se pudo auditar:', auditErr);
    }

    return new Response(JSON.stringify({ ok: true, businessName: bizName, warnings }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('delete-business:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
