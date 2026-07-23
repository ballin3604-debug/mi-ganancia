import { supabase } from './supabaseClient';
import { createJoinCode } from './cashier';
import { getCategoryById, DEFAULT_CATEGORY_ID } from '../config/businessCategories';

export const ADMIN_UID = import.meta.env.VITE_ADMIN_UID;

export function isAdmin(uid) {
  return uid === ADMIN_UID;
}

function mapRequest(req) {
  if (!req) return req;
  return {
    ...req,
    userId: req.user_id,
    displayName: req.display_name,
    photoURL: req.photo_url,
    businessName: req.business_name,
    businessCategory: req.business_category,
    reviewedAt: req.reviewed_at ? { toDate: () => new Date(req.reviewed_at) } : null,
    createdAt: req.created_at ? { toDate: () => new Date(req.created_at) } : null,
  };
}

export async function submitRequest(user, businessName, businessCategory = DEFAULT_CATEGORY_ID) {
  const { data: req, error: reqErr } = await supabase
    .from('subscription_requests')
    .insert({
      user_id: user.uid || user.id,
      email: user.email,
      display_name: user.displayName || user.email,
      photo_url: user.photoURL || '',
      business_name: businessName.trim(),
      business_category: businessCategory,
      status: 'pending',
    })
    .select()
    .single();

  if (reqErr) throw reqErr;

  const { error: profErr } = await supabase
    .from('profiles')
    .insert({
      id: user.uid || user.id,
      name: user.displayName || user.email,
      status: 'pending',
      role: 'owner',
    });

  if (profErr) throw profErr;

  return req.id;
}

export async function getAllRequests() {
  const { data, error } = await supabase
    .from('subscription_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(mapRequest);
}

export async function getAllBusinesses() {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map((b) => ({
    ...b,
    createdAt: b.created_at ? { toDate: () => new Date(b.created_at) } : null,
  }));
}

export async function approveRequest(request, adminNote = '') {
  const { data: biz, error: bizErr } = await supabase
    .from('businesses')
    .insert({
      name: request.businessName || request.business_name,
      owner_id: request.userId || request.user_id,
      status: 'active',
    })
    .select()
    .single();

  if (bizErr) throw bizErr;

  const businessId = biz.id;

  const { error: profErr } = await supabase
    .from('profiles')
    .update({
      business_id: businessId,
      status: 'active',
      role: 'owner',
    })
    .eq('id', request.userId || request.user_id);

  if (profErr) throw profErr;

  const { error: reqErr } = await supabase
    .from('subscription_requests')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      admin_note: adminNote,
      business_id: businessId,
    })
    .eq('id', request.id);

  if (reqErr) throw reqErr;

  const category = getCategoryById(request.businessCategory || request.business_category || DEFAULT_CATEGORY_ID);
  try {
    await supabase
      .from('business_settings')
      .upsert({
        business_id: businessId,
        business_category: category.id,
        categories: category.defaultCategories,
      });
  } catch (err) {
    console.error('Error saving business settings:', err);
  }

  try {
    await createJoinCode(businessId, request.businessName || request.business_name);
  } catch (err) {
    console.error('Error generating cashier join code:', err);
  }
}

export async function rejectRequest(requestId, userId, adminNote = '') {
  const { error: reqErr } = await supabase
    .from('subscription_requests')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      admin_note: adminNote,
    })
    .eq('id', requestId);

  if (reqErr) throw reqErr;

  const { error: profErr } = await supabase
    .from('profiles')
    .update({
      status: 'rejected',
    })
    .eq('id', userId);

  if (profErr) throw profErr;
}

export async function suspendBusiness(businessId, userId) {
  const { error: bizErr } = await supabase
    .from('businesses')
    .update({ status: 'suspended' })
    .eq('id', businessId);

  if (bizErr) throw bizErr;

  const { error: profErr } = await supabase
    .from('profiles')
    .update({ status: 'suspended' })
    .eq('id', userId);

  if (profErr) throw profErr;
}

export async function reactivateBusiness(businessId, userId) {
  const { error: bizErr } = await supabase
    .from('businesses')
    .update({ status: 'active' })
    .eq('id', businessId);

  if (bizErr) throw bizErr;

  const { error: profErr } = await supabase
    .from('profiles')
    .update({ status: 'active' })
    .eq('id', userId);

  if (profErr) throw profErr;
}
