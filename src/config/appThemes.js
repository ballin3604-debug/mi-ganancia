export const APP_THEMES = [
  {
    id: 'clasico',
    name: 'Clásico / Mi Ganancia',
    description: 'Fondo claro, paneles limpios y detalles en verde esmeralda.',
    swatches: ['#064E3B', '#10B981', '#F4F6FA'],
    dark: false,
    themeColor: '#0B2D20',
    preview: {
      bg: '#F4F6FA',
      surface: '#FFFFFF',
      line: '#E4EAF1',
      soft: '#D8E0E8',
      accent: '#10B981',
      brand: '#064E3B',
    },
  },
  {
    id: 'gourmet',
    name: 'Gourmet Dark / Foobar',
    description: 'Fondo carbón, tarjetas oscuras y acentos ámbar.',
    swatches: ['#E65100', '#FF9800', '#0E0E0E'],
    dark: true,
    themeColor: '#0E0E0E',
    preview: {
      bg: '#0E0E0E',
      surface: '#161616',
      line: '#2E2E2E',
      soft: '#3A3A3A',
      accent: '#FF9800',
      brand: '#E65100',
    },
  },
  {
    id: 'yuzen',
    name: 'YUZEN / Azul tecnológico',
    description: 'Fondo azul noche, tarjetas grafito y acentos eléctricos.',
    swatches: ['#070B19', '#0055FF', '#00A2FF'],
    dark: true,
    themeColor: '#070B19',
    preview: {
      bg: '#070B19',
      surface: '#0F1626',
      line: '#1E2A4A',
      soft: '#2B3A61',
      accent: '#00A2FF',
      brand: '#0055FF',
    },
  },
  {
    id: 'pastel',
    name: 'PASTEL / Rosa amigable',
    description: 'Fondo claro, tarjetas blancas y detalles en rosa.',
    swatches: ['#FFC0CB', '#FF69B4', '#FAFAFA'],
    dark: false,
    themeColor: '#FAFAFA',
    preview: {
      bg: '#FAFAFA',
      surface: '#FFFFFF',
      line: '#F0E4E9',
      soft: '#FFC0CB',
      accent: '#E91E63',
      brand: '#FFC0CB',
      dot: '#7A3E48',
    },
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
