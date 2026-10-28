export const APP_THEMES = [
  {
    id: 'clasico',
    name: 'Clásico / Mi Ganancia',
    description: 'Fondo claro, paneles limpios y detalles en verde esmeralda.',
    swatches: ['#064E3B', '#10B981', '#F4F6FA'],
    dark: false,
    themeColor: '#0B2D20',
  },
  {
    id: 'gourmet',
    name: 'Gourmet Dark / Foobar',
    description: 'Fondo carbón, tarjetas oscuras y acentos ámbar.',
    swatches: ['#E65100', '#FF9800', '#0E0E0E'],
    dark: true,
    themeColor: '#0E0E0E',
  },
];

export const DEFAULT_THEME_ID = 'clasico';
export const THEME_STORAGE_KEY = 'mg-theme';

export function getThemeMeta(id) {
  return APP_THEMES.find((theme) => theme.id === id) || APP_THEMES[0];
}

export function readStoredThemeId() {
  if (typeof window === 'undefined') return DEFAULT_THEME_ID;
  try {
    return getThemeMeta(window.localStorage.getItem(THEME_STORAGE_KEY)).id;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function applyThemeToDocument(id) {
  if (typeof document === 'undefined') return;
  const meta = getThemeMeta(id);
  document.documentElement.setAttribute('data-theme', meta.id);
  document.documentElement.style.colorScheme = meta.dark ? 'dark' : 'light';
  const metaTag = document.querySelector('meta[name="theme-color"]');
  if (metaTag) metaTag.setAttribute('content', meta.themeColor);
}

export function persistThemeId(id) {
  const meta = getThemeMeta(id);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, meta.id);
  } catch {
    // El tema igual se aplica en esta sesión.
  }
  applyThemeToDocument(meta.id);
  return meta.id;
}
