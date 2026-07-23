# Mi Ganancia — Rediseño Dark Premium 🌑

Rediseño completo de la app **Mi Ganancia** con estética dark premium inspirada en apps financieras modernas (Revolut, Wise, Mercury). Enfoque: **transmitir confianza y seguridad** al usuario.

---

## 📁 Archivos incluidos

### Hechos a mano (atención especial al diseño)
- `src/index.css` — **⚠ REEMPLAZAR** — Nuevo sistema de diseño con variables CSS
- `src/components/Layout.jsx` — Sidebar + navegación móvil con badges de seguridad
- `src/pages/Login.jsx` — Dark elegante con glow verde sutil
- `src/pages/Dashboard.jsx` — Hero card del día + stats + resumen mensual
- `src/pages/Sales.jsx` — Grid de productos + carrito fijo

### Convertidos con el mismo sistema
- `src/pages/Inventory.jsx`
- `src/pages/Expenses.jsx`
- `src/pages/Settings.jsx`
- `src/pages/Debts.jsx`
- `src/pages/AdminPanel.jsx`
- `src/pages/Setup.jsx`
- `src/pages/PendingApproval.jsx`
- `src/components/SplashScreen.jsx`
- `src/components/LoadingSpinner.jsx`
- `src/components/SwipeableCard.jsx`
- `src/components/Receipt.jsx` (sin cambios — es HTML para impresora térmica)

---

## 🚀 Instalación — 3 pasos

### 1. Haz backup de tu carpeta `src/` actual

```bash
# Desde la raíz de tu proyecto Mi Ganancia
cp -r src src_backup
# O si usas git:
git add . && git commit -m "Backup antes de rediseño"
```

### 2. Reemplaza los archivos

Descomprime este ZIP y **copia toda la carpeta `src/`** encima de la tuya, sobrescribiendo los archivos existentes.

**IMPORTANTE:** Solo se reemplazan estos archivos. Los siguientes se MANTIENEN sin tocar (porque son lógica, no diseño):
- `src/App.jsx` ✓ intacto
- `src/main.jsx` ✓ intacto
- `src/config/` ✓ intacto (businessCategories.js)
- `src/context/` ✓ intacto (AuthContext, BusinessContext, ThemeContext)
- `src/hooks/` ✓ intacto
- `src/services/` ✓ intacto (firebase, sales, products, etc.)

### 3. Prueba

```bash
npm run dev
```

Abre http://localhost:5173 y verás el nuevo diseño.

---

## 🎨 Sistema de diseño

El archivo `index.css` define variables CSS que puedes usar en todo el proyecto:

### Fondos
| Variable | Uso |
|----------|-----|
| `--mg-bg-base` | Fondo principal de la app |
| `--mg-bg-surface` | Cards, paneles |
| `--mg-bg-elevated` | Elementos elevados, hover states |
| `--mg-bg-input` | Inputs y selects |

### Texto
| Variable | Uso |
|----------|-----|
| `--mg-text-primary` | Títulos, datos importantes |
| `--mg-text-secondary` | Texto normal |
| `--mg-text-muted` | Metadata, helper text |
| `--mg-text-faint` | Placeholders, timestamps |

### Marca (verde esmeralda)
| Variable | Uso |
|----------|-----|
| `--mg-accent` | Verde principal (#10b981) |
| `--mg-accent-hover` | Verde hover |
| `--mg-accent-bg` | Fondo sólido verde oscuro |
| `--mg-accent-bg-soft` | Fondo verde translúcido |
| `--mg-accent-text` | Texto verde claro legible en dark |

### Clases utilitarias
```jsx
<div className="mg-surface">...</div>           // Card estándar
<div className="mg-surface-elevated">...</div>  // Card elevada
<input className="mg-input" />                  // Input estilizado
<button className="mg-btn-primary">...</button> // Botón primario verde
<button className="mg-btn-secondary">...</button> // Botón secundario
<span className="mg-badge">...</span>           // Badge pequeño
<div className="mg-fade-in">...</div>           // Animación entrada
```

---

## ⚠️ Notas importantes

### 1. El sistema de temas por categoría quedó pausado
Tu `ThemeContext.jsx` seguirá funcionando pero los nuevos componentes NO usan `theme.sidebar`, `theme.primaryBtn`, etc. (usan las variables CSS directamente). Esto significa que **todas las categorías de negocio** (tienda, panadería, licorera, etc.) se verán con el **mismo verde esmeralda** en lugar de sus colores propios.

Si después quieres que cada categoría tenga su propio acento dark (amber para panadería, morado para licorera), dímelo y lo configuramos.

### 2. Las páginas convertidas automáticamente
Inventory, Expenses, Settings, Debts, AdminPanel, Setup fueron transformadas con reemplazo sistemático de clases. Pueden tener detalles visuales menores que requieran ajuste fino. Si ves algo que no te convence, dime **qué página y qué parte** y lo corrijo a mano.

### 3. Receipt.jsx queda igual
El recibo es HTML plano que se imprime en impresoras térmicas (papel blanco). Mantener el diseño original es correcto aquí.

### 4. PWA y Android
Tu `public/manifest.json` define el color del splash como verde. Si quieres que coincida con el nuevo dark base, cambia:
```json
"background_color": "#0b0f14",
"theme_color": "#10b981"
```

---

## 🎯 Filosofía del diseño

- **Seguridad visual**: Dark sobrio tipo banca digital, sin efectos neón "gamer"
- **Jerarquía clara**: Los datos financieros (totales) son los más grandes y visibles
- **Espacios amplios**: No amontonado, cada elemento respira
- **Micro-indicadores de confianza**: Badge "Datos protegidos · SSL", pulso verde en vivo
- **Verde esmeralda institucional**: Respeta la marca Mi Ganancia pero ajustado a dark
- **Bordes 1px con baja opacidad**: Feel premium sin ser ostentoso

---

## 🤔 ¿Algo no se ve bien?

Si después de probarlo quieres ajustar algo:
- **Colores**: modifica las variables en `index.css`
- **Páginas específicas**: dime cuál y qué te gustaría cambiar
- **Volver al diseño anterior**: tu backup en `src_backup/` (o git)

¡Disfruta del nuevo look! 🚀
