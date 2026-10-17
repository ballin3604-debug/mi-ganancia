# AGENTS.md — Mi Ganancia (TugananciA)

## Instrucción permanente del dueño
**Al terminar cualquier cambio, subir TODO a producción sin preguntar:**
1. `npm run build` (debe pasar sin errores)
2. `git add -A && git commit -m "<mensaje en español>"` (nunca commitear secretos)
3. `git push origin main`
4. `npx firebase deploy --only hosting`

Si hay migraciones nuevas en `supabase/migrations/`, aplicar antes con `npx supabase db push`.

## Stack
- Frontend: React 18 + Vite + Tailwind, PWA (service worker en `public/sw.js`).
- Datos: Supabase (Postgres + Auth + Storage + Realtime) como backend único.
- Offline-first: Dexie (IndexedDB) en `src/services/localDb.js` + cola de sync en `src/services/syncEngine.js`.
- Hosting: Firebase Hosting, sitio `tugananciaa` (`firebase.json`, `public: dist`).
  Firebase/Firestore YA NO se usa (removido); `firebase.json` solo queda para Hosting.

## Comandos
- Dev: `npm run dev`
- Build: `npm run build`
- Migraciones: `npx supabase db push` / `npx supabase migration list`
- Deploy web: `npx firebase deploy --only hosting`

## Secretos (NUNCA commitear; están en `.gitignore`)
- `.env` (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_ADMIN_UID)
- `signing.keystore`, `signing-key-info.txt` (firma Android)
- `serviceAccountKey.json` (Firebase Admin — eliminado localmente; rotar en consola si aplica)

## Convenciones
- Mensajes de commit en español, cortos y descriptivos.
- No agregar comentarios al código salvo que se pida.
- UID admin: fuente única `src/config/admin.js` (frontend) y `public.admin_uid()` (SQL, migración `20261016000001`).
