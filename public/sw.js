// ── Cache version: bump this string on every deploy to force update ──
const CACHE_NAME = 'mi-ganancia-v6';
const STATIC_ASSETS = ['/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  // Do NOT skipWaiting automatically. We wait for user instruction.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  // Claim all open clients so the new SW controls them right away
  self.clients.claim();
});

// Handle update messages from the app
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Never cache Firebase or Google API calls
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebase') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    url.includes('accounts.google.com')
  ) return;

  // Never cache Supabase API/auth/realtime — data must always be fresh.
  // NOTE: Storage object URLs (/storage/v1/object/public/...) intentionally
  // fall through to the cache-first branch below, same as static assets —
  // that's what lets product photos work offline after first load.
  if (
    url.includes('/rest/v1/') ||
    url.includes('/auth/v1/') ||
    url.includes('/realtime/v1/')
  ) return;

  // ── Navigation requests (HTML) → Network first ──
  // This ensures users always load the latest index.html with updated JS/CSS hashes.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the fresh HTML
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() =>
          // Offline fallback: serve cached HTML
          caches.match('/index.html').then((r) => r || caches.match('/'))
        )
    );
    return;
  }

  // ── Static assets (JS/CSS/images with content hashes) → Cache first ──
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Las imágenes de Supabase Storage son cross-origin y se piden sin
          // 'crossorigin', así que el navegador las trae en modo no-cors —
          // la respuesta es 'opaque' (no se puede leer su status). Antes se
          // excluían del cache por eso, lo que en la práctica dejaba nunca
          // cacheadas las fotos de producto pese a que el comentario de
          // arriba decía que sí. Se aceptan también las opacas: es el
          // trade-off estándar para cachear imágenes cross-origin offline.
          if (response.status === 200 || response.type === 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => null);
    })
  );
});
