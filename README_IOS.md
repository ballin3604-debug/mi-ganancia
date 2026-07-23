# Mi Ganancia · Edición iOS 🍎

Rediseño completo con **estética Apple/iOS** — minimalista, claro, universal. Sin temas por categoría de negocio, sin paletas específicas. Una sola identidad pulida que funciona para cualquier tipo de negocio.

Incluye **flujo completo de bienvenida**: Splash → Onboarding → Login → Welcome → Setup → Tutorial.

---

## 🎨 Identidad visual

| Elemento | Valor | Estilo |
|----------|-------|--------|
| Color principal | `#007aff` | iOS System Blue |
| Fondo de página | `#f2f2f7` | iOS systemGroupedBackground |
| Cards | `#ffffff` | Blanco puro con sombra sutil |
| Texto principal | `#000000` | Negro puro |
| Verde éxito | `#34c759` | iOS green |
| Rojo peligro | `#ff3b30` | iOS red |
| Naranja warning | `#ff9500` | iOS orange |
| Tipografía | SF Pro / Inter | Sistema Apple |
| Bordes | 16-24px | Generosos, estilo iOS |

---

## 🆕 Nuevos flujos incluidos

### 1. SplashScreen (`components/SplashScreen.jsx`)
Logo cuadrado azul con icono de tienda + título "Mi Ganancia" + slogan "Tu negocio, simple". Duración 2.7s.

### 2. Onboarding (`components/Onboarding.jsx`)
3 slides animados que se muestran **solo la primera vez** en el navegador:
- Slide 1: "Vende en segundos" (azul)
- Slide 2: "Controla tu inventario" (verde)
- Slide 3: "Mira cuánto ganas" (naranja)

Indicadores de página estilo iOS, botón "Saltar" arriba derecha, botón "Continuar/Empezar" abajo. Se guarda en `localStorage` con la clave `mg_onboarding_done`.

### 3. WelcomeScreen (`components/WelcomeScreen.jsx`)
Pantalla con confetti animado que se muestra **una sola vez después del primer login**, antes del Setup. Saluda al usuario por su nombre y le anticipa qué viene. Clave: `mg_welcome_done`.

### 4. Tutorial (`components/Tutorial.jsx`)
Tour interactivo dentro de la app (después del Setup), 5 pasos con tooltips animados que iluminan cada sección de la navegación con un anillo azul brillante. Clave: `mg_tutorial_done`.

### 5. App.jsx orquestado
Maneja toda la secuencia automáticamente. Si quieres reiniciar el flujo para probar, abre la consola del navegador y ejecuta:
```js
localStorage.removeItem('mg_onboarding_done');
localStorage.removeItem('mg_welcome_done');
localStorage.removeItem('mg_tutorial_done');
location.reload();
```

---

## 📁 Archivos incluidos

### Raíz (2)
- `index.html` — theme-color iOS azul
- `public/manifest.json` — PWA con colores iOS

### src/ (20)
**CSS (1):**
- `index.css` — Sistema de diseño iOS completo

**App (1):**
- `App.jsx` — Orquestador de flujo (Splash → Onboarding → Login → Welcome → Setup → Tutorial)

**Componentes (8):**
- `components/SplashScreen.jsx` ⭐ NUEVO
- `components/Onboarding.jsx` ⭐ NUEVO
- `components/WelcomeScreen.jsx` ⭐ NUEVO
- `components/Tutorial.jsx` ⭐ NUEVO
- `components/Layout.jsx` — Tab bar iOS, sidebar limpio
- `components/LoadingSpinner.jsx`
- `components/SwipeableCard.jsx`
- `components/Receipt.jsx` (sin cambios)

**Páginas (10):**
- `pages/Login.jsx` ⭐ Rediseñado
- `pages/Dashboard.jsx`, `pages/Sales.jsx`, `pages/Inventory.jsx`
- `pages/Expenses.jsx`, `pages/Settings.jsx`, `pages/Setup.jsx`
- `pages/Debts.jsx`, `pages/AdminPanel.jsx`, `pages/PendingApproval.jsx`

---

## 🚀 Instalación

### 1. Backup
```bash
cp -r src src_backup
cp -r public public_backup
cp index.html index.html.backup
```

### 2. Reemplaza
Descomprime el ZIP y copia:
- `src/` → reemplaza tu carpeta `src/`
- `public/manifest.json` → reemplaza el tuyo
- `index.html` → reemplaza el tuyo

### 3. Prueba
```bash
npm run dev
```

La primera vez verás:
1. **Splash** azul con logo
2. **Onboarding** con 3 slides
3. **Login** con Google
4. **Welcome** con confetti
5. **Setup** del negocio
6. **Tutorial** interactivo dentro de la app
7. App lista

---

## ⚠️ Notas

1. **Sin temas por categoría**: El sistema `ThemeContext` y `businessCategories.js` siguen existiendo (no los borré para no romper la lógica), pero los componentes ya NO los usan. Todas las categorías se ven con el mismo azul iOS. Si quieres puedes eliminar `ThemeContext.jsx` y limpiar `businessCategories.js`.

2. **Universal**: El diseño funciona para cualquier negocio — tienda, restaurante, papelería, taller, etc. Sin imágenes específicas.

3. **Receipt.jsx queda igual**: el recibo impreso usa diseño minimalista para impresoras térmicas.

4. **Dark mode futuro**: Las variables CSS están listas para soportar dark mode iOS si lo quieres después. Solo agregar un `@media (prefers-color-scheme: dark)` con los valores invertidos.

---

## 🔄 Resetear flujos durante desarrollo

```js
// En la consola del navegador
localStorage.clear();
location.reload();
```

¡Listo! 🎉
