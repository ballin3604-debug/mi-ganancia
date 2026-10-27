import { supabase, assertSupabase, isSupabaseConfigured } from './supabaseClient';
import { getCategoryById, DEFAULT_CATEGORY_ID } from '../config/businessCategories';
import { db } from './localDb';
import { clearLastAuthUser, isOfflineNow } from './offlineSession';
import { withTimeout } from '../utils/withTimeout';

export async function signUp(email, password, displayName) {
  const { data, error } = await assertSupabase().auth.signUp({
    email,
    password,
    options: {
      data: {
        displayName: displayName || email,
      }
    }
  });
  if (error) throw error;
  return data.user;
}

export async function signInWithPassword(email, password) {
  const { data, error } = await assertSupabase().auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data.user;
}

// Login con Google (OAuth). redirectTo apunta al origen actual para que, tras
// autenticarse, el usuario vuelva a esta misma app — funciona igual en local
// (localhost) que en producción sin cambios.
// IMPORTANTE: el proveedor debe estar habilitado y configurado en el panel
// de Supabase (Authentication → Providers) para que esto funcione.
export async function signInWithGoogle() {
  const { data, error } = await assertSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const client = assertSupabase();
  clearLastAuthUser();

  // Cerrar sesión global (revoca refresh tokens). Si no hay red o el servidor
  // falla, se cierra al menos la sesión local para que el dispositivo quede
  // bloqueado sin obligar a esperar conexión.
  if (!isOfflineNow()) {
    try {
      const { error } = await withTimeout(client.auth.signOut(), 5000, 'signOut timeout');
      if (!error) return;
    } catch {
      // Sin red o timeout: se cierra la sesión local.
    }
  }

  const { error: localError } = await client.auth.signOut({ scope: 'local' });
  if (localError) throw localError;
}

export async function getUserData(userId) {
  if (!userId) return null;

  let lastError = null;
  if (!isOfflineNow()) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 5000) : null;
    try {
      let query = assertSupabase()
        .from('profiles')
        .select('*')
        .eq('id', userId);
      if (controller && typeof query.abortSignal === 'function') {
        query = query.abortSignal(controller.signal);
      }
      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          try {
            await db.profiles.delete(userId);
          } catch (dbErr) {
            console.error('getUserData: Failed to delete stale cached profile:', dbErr);
          }
          return null; // No row found
        }
        throw error;
      }

      if (data) {
        try {
          await db.profiles.put(data);
        } catch (dbErr) {
          console.error('getUserData: Failed to cache profile in IndexedDB:', dbErr);
        }
      }

      return data;
    } catch (err) {
      lastError = err;
      console.warn('getUserData: Fetch from Supabase failed, checking local IndexedDB cache...', err);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  try {
    const cachedProfile = await db.profiles.get(userId);
    if (cachedProfile) {
      return cachedProfile;
    }
  } catch (dbErr) {
    console.error('getUserData: Failed to read from IndexedDB profiles cache:', dbErr);
  }

  if (isOfflineNow()) {
    throw new Error('Sin conexión y sin perfil guardado en este dispositivo.');
  }
  if (lastError) throw lastError;
  return null;
}

export async function createUserAndBusiness(user, businessName, businessCategory = DEFAULT_CATEGORY_ID) {
  const category = getCategoryById(businessCategory);
  const userName = user.user_metadata?.displayName || user.email || '';

  const { data: businessId, error } = await assertSupabase().rpc('crear_negocio', {
    p_business_name: businessName,
    p_business_nit: '',
    p_user_name: userName,
    p_business_category: businessCategory,
    p_default_categories: category.defaultCategories
  });

  if (error) throw error;
  return businessId;
}
