# 🥖 Panadería Don Freddy · Edición Oficial

**"Solo Dios hace al Hombre Feliz"** — *Desde 1994*

Rediseño completo de la aplicación adaptado a la identidad visual exacta de **Panadería Don Freddy**. Paleta rojo granate + dorado extraída directamente del logo, tipografía cursiva elegante, y referencias constantes a la marca.

---

## 🎨 Identidad visual

| Elemento | Valor | Origen |
|----------|-------|--------|
| Rojo granate | `#c9302c` | Color del fondo del logo |
| Rojo oscuro | `#5a1410` | Sombras y fondos profundos |
| Dorado espiga | `#f4c430` | Espigas de trigo del logo |
| Dorado claro | `#ffd966` | Textos dorados |
| Crema fondo | `#fff8e7` | Texto sobre oscuro |
| Marrón base | `#1a0f0c` | Fondo de la app (cálido) |

### Tipografías
- **Dancing Script** (cursiva) → "Don Freddy" en logos y encabezados
- **Playfair Display** (serif itálica) → Slogan "Solo Dios hace al Hombre Feliz"
- **Inter** (sans-serif) → Todo el texto de interfaz

---

## 🎯 Personalizaciones específicas

- **Login**: Logo SVG con espigas + círculo rojo + texto cursiva "Don Freddy" + slogan
- **Splash Screen**: Gradiente radial rojo granate + logo animado + teléfono 781-85513
- **Sidebar/Header**: Nombre "Don Freddy" en cursiva + badge "Desde 1994"
- **Saludo Dashboard**: "Buenos días, {nombre} 🥖"
- **Fecha**: "🥖 Horneado del día"
- **Manifest PWA**: Color rojo (#c9302c) para notificaciones del móvil
- **Meta tags**: Descripción con "Santa Cruz, Bolivia · Desde 1994"

---

## 📦 Archivos incluidos

### Raíz del proyecto (2 archivos)
- `index.html` — Título "Panadería Don Freddy · Desde 1994", theme-color rojo
- `public/manifest.json` — PWA con colores de la marca

### src/ (16 archivos)
**CSS (1):**
- `index.css` — Sistema completo de variables + import de Google Fonts

**Componentes (5):**
- `components/Layout.jsx` — Sidebar y header con "Don Freddy" en cursiva
- `components/SplashScreen.jsx` — Logo animado + slogan
- `components/LoadingSpinner.jsx`
- `components/SwipeableCard.jsx`
- `components/Receipt.jsx` (sin cambios — impresora térmica)

**Páginas (10):**
- `pages/Login.jsx` — Logo SVG con espigas, slogan, teléfono
- `pages/Dashboard.jsx` — Saludo "Buenos días", hero en rojo granate
- `pages/Sales.jsx` — Banner de éxito en tonos rojos
- `pages/Inventory.jsx`, `pages/Expenses.jsx`, `pages/Settings.jsx`
- `pages/Debts.jsx`, `pages/AdminPanel.jsx`, `pages/Setup.jsx`, `pages/PendingApproval.jsx`

---

## 🚀 Instalación — 4 pasos

### 1. Backup (¡muy importante!)
```bash
cd /ruta/a/tu/proyecto
cp -r src src_backup
cp public/manifest.json public/manifest.json.backup
cp index.html index.html.backup
```
O si usas git: `git add . && git commit -m "Backup antes de Don Freddy"`

### 2. Descomprime el ZIP y copia
Copia los archivos del ZIP encima de los tuyos:
- `src/` → reemplaza `src/` de tu proyecto
- `public/manifest.json` → reemplaza el tuyo
- `index.html` → reemplaza el tuyo

### 3. Instala fuentes (automático)
El `index.css` ya importa Google Fonts (Dancing Script, Playfair Display, Inter) — se cargan automáticamente sin instalación.

### 4. Prueba
```bash
npm run dev
```

Abre http://localhost:5173 y verás todo con la identidad Don Freddy.

---

## 🖼️ Recomendaciones extra para tu clienta

### Icono de la app (192x192 y 512x512)
Reemplaza `public/icon-192.png` y `public/icon-512.png` con el logo circular rojo de Don Freddy que ya tiene. Esto hará que el icono de la app (al instalarla como PWA) sea su logo real.

**Cómo exportar el logo:**
1. Toma el logo redondo original (el rojo con "Panadería Don Freddy · Desde 1994")
2. Exportarlo en dos tamaños: 192×192px y 512×512px en PNG
3. Renombrarlos a `icon-192.png` y `icon-512.png`
4. Copiar a `public/`

### Configurar los datos del negocio
En el primer uso, tu clienta debe entrar a **Ajustes** y:
1. Subir el logo real (el rojo con "Desde 1994")
2. Nombre: `Panadería Don Freddy`
3. Slogan: `Solo Dios hace al Hombre Feliz`
4. Teléfono: `781-85513`
5. Dirección: `Calle Tarbo 2205, Santa Cruz de la Sierra`
6. Subir su QR de cobro

### Categorías de productos sugeridas
- 🥖 **Pan clásico**: Marraqueta, Pan Bola, Nudito
- 🥛 **Masa de leche**: Pan bola de leche, Pan con queso
- 🥐 **Repostería**: Empanadas, Pastelitos, Tortas
- 🍞 **Pan artesanal**: Pan casero, Pan integral
- ☕ **Bebidas**: Café, té, jugos
- 🎂 **Especiales**: Tortas por encargo

---

## 🔧 Personalización futura

### Cambiar el tono de rojo
En `src/index.css` líneas 27-32:
```css
--mg-accent: #c9302c;        /* rojo principal */
--mg-accent-hover: #a52521;  /* hover */
--mg-accent-bg: #5a1410;     /* fondo oscuro */
--mg-accent-border: #8b1f1b; /* bordes */
```

### Cambiar el dorado
Líneas 35-39:
```css
--mg-gold: #f4c430;          /* dorado principal */
--mg-gold-text: #ffd966;     /* dorado para texto */
```

### Cambiar el slogan
Buscar en los archivos:
- `"Solo Dios hace al Hombre Feliz"` en `Login.jsx` y `SplashScreen.jsx`

### Cambiar el teléfono
- `"781-85513"` en `Login.jsx` y `SplashScreen.jsx`

---

## ⚠️ Notas

1. **El archivo `Receipt.jsx`** (recibo impreso) queda con el diseño anterior — está diseñado para imprimirse en papel blanco en impresoras térmicas.
2. **Las Google Fonts** requieren conexión a internet la primera vez. Después quedan cacheadas.
3. **El sistema de temas por categoría** queda deshabilitado — todo usa la identidad Don Freddy.

---

¡Disfrute de su nueva app, Don Freddy! 🥖☕

*Desde 1994, con la bendición de Dios.*
