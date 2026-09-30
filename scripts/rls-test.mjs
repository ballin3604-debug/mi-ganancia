// ─────────────────────────────────────────────────────────────
// Test de aislamiento entre negocios (RLS) — Paso 1 del plan SaaS.
//
// Uso:
//   1. Crea 2 cuentas de prueba en la app y apruébalas (2 negocios distintos).
//   2. Saca el ID del negocio B desde el Panel Admin.
//   3. Corre:
//      node scripts/rls-test.mjs usuarioA@prueba.com claveA <business-id-B>
//
// Resultado esperado (SaaS seguro):
//   ✓ lee lo propio
//   ✓ NO lee nada del otro negocio en NINGUNA tabla
//   ✓ NO puede insertar/escribir en el otro negocio
// Si alguna línea dice LEAK, el RLS está abierto y hay que cerrarlo
// antes de cobrar suscripciones.
// ─────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

function loadEnv() {
  const env = {};
  try {
    const raw = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');
    raw.split('\n').forEach((line) => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim();
    });
  } catch { /* sin .env */ }
  return env;
}

const [email, password, otherBiz] = process.argv.slice(2);
if (!email || !password || !otherBiz) {
  console.error('Uso: node scripts/rls-test.mjs <email-A> <password-A> <business-id-B>');
  process.exit(1);
}

const env = loadEnv();
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗ LEAK'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
if (signErr) {
  console.error('No pude entrar con ese usuario:', signErr.message);
  process.exit(1);
}
const { data: { user } } = await supabase.auth.getUser();
console.log(`Logueado como: ${user.email} (${user.id})`);
console.log(`Intentando leer/escribir el negocio B: ${otherBiz}\n`);

// 1. Debe leer lo propio (sanity: el test sirve)
const { data: me } = await supabase.from('profiles').select('business_id').eq('id', user.id).single();
const myBiz = me?.business_id || null;
check('lee su propio profile', !!me, myBiz ? `negocio propio ${String(myBiz).slice(0, 8)}…` : '');

// 2. Lecturas cruzadas: deben venir VACÍAS
for (const t of ['products', 'sales', 'sale_items', 'clientes', 'debts', 'expenses', 'replenishments']) {
  const { data, error } = await supabase.from(t).select('id').eq('business_id', otherBiz).limit(3);
  check(`NO lee ${t} del otro negocio`, !error && (!data || data.length === 0), error ? `error: ${error.message}` : `${data?.length || 0} filas`);
}
// business_settings usa business_id como clave (no id)
{
  const { data, error } = await supabase.from('business_settings').select('business_id').eq('business_id', otherBiz).limit(1);
  check('NO lee business_settings del otro negocio', !error && (!data || data.length === 0), error ? `error: ${error.message}` : `${data?.length || 0} filas`);
}

// 3. Negocios y solicitudes: no debe ver los ajenos
const { data: biz } = await supabase.from('businesses').select('id').eq('id', otherBiz).limit(1);
check('NO lee el negocio ajeno', !biz || biz.length === 0, `${biz?.length || 0} filas`);
const { data: reqs } = await supabase.from('subscription_requests').select('id').limit(3);
const ajenas = (reqs || []).length;
console.log(`   (subscription_requests visibles: ${ajenas} — deben ser solo las propias o 0)`);

// 4. Escrituras cruzadas: deben FALLAR
const { error: insErr } = await supabase.from('products').insert({
  business_id: otherBiz, name: 'RLS-TEST-BORRAR', price: 1, stock: 1,
});
check('NO puede crear producto en el otro negocio', !!insErr, insErr ? 'bloqueado' : '¡INSERTÓ!');

const { error: updErr } = await supabase.from('businesses').update({ name: 'RLS-TEST' }).eq('id', otherBiz);
let updRows = 0;
if (!updErr) {
  const res = await supabase.from('businesses').select('name').eq('id', otherBiz).limit(1);
  updRows = res.data?.length || 0;
}
// Ojo: PostgREST NO da error cuando RLS bloquea un update (afecta 0 filas en
// silencio). Solo hay modificación real si el readback devuelve filas.
const modified = !updErr && updRows > 0;
check('NO puede modificar el negocio ajeno', !modified, updErr ? 'bloqueado con error' : (updRows === 0 ? 'bloqueado (0 filas afectadas)' : '¡MODIFICÓ DE VERDAD!'));

// 5. Limpieza por si el insert coló (no debería)
if (!insErr) {
  await supabase.from('products').delete().eq('business_id', otherBiz).eq('name', 'RLS-TEST-BORRAR');
  console.log('   (limpié la fila de prueba que logró colar — ¡LEAK confirmado!)');
}

console.log(failures === 0 ? '\n✅ AISLAMIENTO OK — puedes seguir al paso 2.' : `\n❌ ${failures} FUGA(S) — hay que cerrar el RLS antes de seguir.`);
process.exit(failures === 0 ? 0 : 2);
