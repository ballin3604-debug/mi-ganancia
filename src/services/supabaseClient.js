import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  IS_STAGING,
  IS_SUPABASE_ENV_VALID,
  ENVIRONMENT_ERROR,
} from '../config/environment';

const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;

// El cliente solo se crea si el entorno es válido. En staging esto exige que
// VITE_SUPABASE_PROJECT_REF coincida con el ref de VITE_SUPABASE_URL. Si algo
// no coincide, supabase queda en null y no se hace ninguna petición.
export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && IS_SUPABASE_ENV_VALID
);

export const supabaseConfigError = !IS_SUPABASE_ENV_VALID
  ? ENVIRONMENT_ERROR
  : !supabaseUrl
    ? 'Falta VITE_SUPABASE_URL. Crea un archivo .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example).'
    : !supabaseAnonKey
      ? 'Falta VITE_SUPABASE_ANON_KEY. Crea un archivo .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example).'
      : '';

if (!isSupabaseConfigured) {
  const scope = IS_STAGING ? '[staging]' : '[supabase]';
  console.error(
    `${scope} ${supabaseConfigError || 'Configuración de Supabase incompleta.'} ` +
    'No se creó el cliente y no se harán peticiones.'
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
