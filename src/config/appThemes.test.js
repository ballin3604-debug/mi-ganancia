import { describe, it, expect, beforeEach } from 'vitest';
import {
  APP_THEMES,
  BLACKGOLD_THEME_ID,
  DEFAULT_THEME_ID,
  getThemeMeta,
  applyThemeToDocument,
} from './appThemes';

// jsdom no carga index.html: replicamos la etiqueta meta del navegador.
function ensureThemeColorMeta() {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  return meta;
}

describe('appThemes', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    ensureThemeColorMeta().setAttribute('content', '#0B2D20');
  });

  it('define el tema Black Gold como tema oscuro dorado', () => {
    const theme = getThemeMeta('blackgold');

    expect(theme.id).toBe('blackgold');
    expect(theme.dark).toBe(true);
    expect(theme.themeColor).toBe('#0A0908');
    expect(theme.preview.accent).toBe('#D4AF37');
    expect(APP_THEMES.some((t) => t.id === 'blackgold')).toBe(true);
    expect(BLACKGOLD_THEME_ID).toBe('blackgold');
  });

  it('aplica el atributo data-theme y el color de barra del sistema', () => {
    applyThemeToDocument('blackgold');

    expect(document.documentElement.getAttribute('data-theme')).toBe('blackgold');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0A0908');
  });

  it('vuelve al tema clásico si el id guardado no es válido', () => {
    expect(getThemeMeta('no-existe').id).toBe(DEFAULT_THEME_ID);
  });
});
