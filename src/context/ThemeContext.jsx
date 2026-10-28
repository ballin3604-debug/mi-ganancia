import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  APP_THEMES,
  DEFAULT_THEME_ID,
  applyThemeToDocument,
  getThemeMeta,
  persistThemeId,
  readStoredThemeId,
} from '../config/appThemes';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeId, setThemeIdState] = useState(() => readStoredThemeId());

  useEffect(() => {
    applyThemeToDocument(themeId);
  }, [themeId]);

  const setThemeId = useCallback((id) => {
    setThemeIdState(persistThemeId(id));
  }, []);

  const value = useMemo(() => ({
    themeId,
    setThemeId,
    theme: getThemeMeta(themeId),
    themes: APP_THEMES,
  }), [themeId, setThemeId]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  return {
    themeId: DEFAULT_THEME_ID,
    setThemeId: () => {},
    theme: getThemeMeta(DEFAULT_THEME_ID),
    themes: APP_THEMES,
  };
}

export function useTheme() {
  return useAppTheme().theme;
}
