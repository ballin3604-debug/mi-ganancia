import { db } from './localDb';

const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h — pasado esto, se descarta sin restaurar

function draftId(businessId, userId) {
  return `${businessId}_${userId}`;
}

export async function getCartDraft(businessId, userId) {
  if (!businessId || !userId) return null;
  const draft = await db.cart_drafts.get(draftId(businessId, userId));
  if (!draft) return null;

  const ageMs = Date.now() - new Date(draft.updated_at).getTime();
  if (ageMs > DRAFT_MAX_AGE_MS) {
    await db.cart_drafts.delete(draftId(businessId, userId));
    return null;
  }
  return draft;
}

export async function saveCartDraft(businessId, userId, data) {
  if (!businessId || !userId) return;
  await db.cart_drafts.put({
    id: draftId(businessId, userId),
    business_id: businessId,
    user_id: userId,
    ...data,
    updated_at: new Date().toISOString(),
  });
}

export async function clearCartDraft(businessId, userId) {
  if (!businessId || !userId) return;
  await db.cart_drafts.delete(draftId(businessId, userId));
}
