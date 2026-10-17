import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseConfigError = !supabaseUrl
  ? 'Falta VITE_SUPABASE_URL. Crea un archivo .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example).'
  : !supabaseAnonKey
    ? 'Falta VITE_SUPABASE_ANON_KEY. Crea un archivo .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example).'
    : '';

if (!isSupabaseConfigured) {
  console.error(
    `Falta VITE_SUPABASE_URL${!supabaseAnonKey ? ' y VITE_SUPABASE_ANON_KEY' : ''}. ` +
    'La app no puede conectar a Supabase. Crea un .env (ver .env.example) y reinicia. ' +
    'Supabase queda deshabilitado (supabase = null) para evitar pantalla blanca.'
  );
}

// NO llamar createClient('', ''): con env vacíos exportamos null para que
// la UI muestre un error controlado en vez de crashear.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper para services: lanza un error claro (atrapable por la UI) en vez
// del TypeError "Cannot read properties of null".
export function assertSupabase() {
  if (!supabase) {
    throw new Error(
      supabaseConfigError ||
      'Falta VITE_SUPABASE_URL. Configura tu .env para conectar a Supabase.'
    );
  }
  return supabase;
}
