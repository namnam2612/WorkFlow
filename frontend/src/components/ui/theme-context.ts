import { createContext } from 'react';

export type Theme = 'dark' | 'light';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

export const THEME_STORAGE_KEY = 'taskflow.theme';

export const ThemeContext = createContext<ThemeContextValue | null>(null);
