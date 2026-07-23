import { supabase } from './supabaseClient';
import { getCategoryById, DEFAULT_CATEGORY_ID } from '../config/businessCategories';
import { db } from './localDb';

export async function signUp(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
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
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getUserData(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

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
    console.warn('getUserData: Fetch from Supabase failed, checking local IndexedDB cache...', err);
    try {
      const cachedProfile = await db.profiles.get(userId);
      if (cachedProfile) {
        return cachedProfile;
      }
    } catch (dbErr) {
      console.error('getUserData: Failed to read from IndexedDB profiles cache:', dbErr);
    }
    throw err;
  }
}

export async function createUserAndBusiness(user, businessName, businessCategory = DEFAULT_CATEGORY_ID) {
  const category = getCategoryById(businessCategory);
  const userName = user.user_metadata?.displayName || user.email || '';

  const { data: businessId, error } = await supabase.rpc('crear_negocio', {
    p_business_name: businessName,
    p_business_nit: '',
    p_user_name: userName,
    p_business_category: businessCategory,
    p_default_categories: category.defaultCategories
  });

  if (error) throw error;
  return businessId;
}
