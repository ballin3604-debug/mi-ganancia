import { createContext, useContext } from 'react';
import { useBusiness } from './BusinessContext';
import { getTheme } from '../config/businessCategories';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { settings } = useBusiness();
  const theme = getTheme(settings?.businessCategory);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
