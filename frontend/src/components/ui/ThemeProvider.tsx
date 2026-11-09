import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeContext, THEME_STORAGE_KEY, type Theme, type ThemeContextValue } from './theme-context';

function readInitial(): Theme {
  const fromDom = document.documentElement.dataset.theme;
  return fromDom === 'light' ? 'light' : 'dark';
}

/** Giao diện tối (mặc định) hoặc sáng. Lưu ở localStorage và áp dụng qua <html data-theme>. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitial);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#fafafa' : '#050505');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // bỏ qua: chỉ mất ghi nhớ lựa chọn
    }
  }, [theme]);

  // Đồng bộ khi đổi giao diện ở tab khác
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) setThemeState(event.newValue === 'light' ? 'light' : 'dark');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggle = useCallback(() => setThemeState((current) => (current === 'dark' ? 'light' : 'dark')), []);
  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
