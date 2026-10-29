import { db } from './localDb';

const LAST_USER_KEY = 'mg-last-auth-user';

export function isOfflineNow() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function saveLastAuthUser(user) {
  if (!user?.id) return;
  try {
    const snapshot = {
      id: user.id,
      email: user.email || '',
      phone: user.phone || '',
      user_metadata: {
        displayName: user.user_metadata?.displayName || user.displayName || '',
      },
    };
    localStorage.setItem(LAST_USER_KEY, JSON.stringify(snapshot));
  } catch {
    // localStorage puede estar deshabilitado (modo privado): no es crítico.
  }
}

export function getLastAuthUser() {
  try {
    const raw = localStorage.getItem(LAST_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.id === 'string' && parsed.id ? parsed : null;
  } catch {
    return null;
  }
}

export function clearLastAuthUser() {
  try {
    localStorage.removeItem(LAST_USER_KEY);
  } catch {
    // Ignorar.
  }
}

export async function getCachedProfile(userId) {
  if (!userId) return null;
  try {
    return (await db.profiles.get(userId)) || null;
  } catch {
    return null;
  }
}

export async function getOfflineAuthUser() {
  const cachedUser = getLastAuthUser();
  if (!cachedUser) return null;
  const profile = await getCachedProfile(cachedUser.id);
  return profile ? cachedUser : null;
}
