import {
   createContext,
   useCallback,
   useContext,
   useEffect,
   useMemo,
   useState,
   type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'techgen.theme';

interface ThemeContextValue {
   theme: Theme;
   setTheme(theme: Theme): void;
   toggleTheme(): void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readInitialTheme(): Theme {
   if (typeof window === 'undefined') return 'light';
   try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
   } catch {
      // localStorage indisponível (ex.: modo privado) — segue pro fallback.
   }
   // matchMedia pode estar ausente (jsdom em alguns testes) — assume claro
   // como default seguro.
   if (typeof window.matchMedia !== 'function') return 'light';
   const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)',
   ).matches;
   return prefersDark ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
   if (typeof document === 'undefined') return;
   document.documentElement.dataset.theme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
   const [theme, setThemeState] = useState<Theme>(() => readInitialTheme());

   // Aplica imediatamente no <html> (evita flash) e persiste a escolha.
   useEffect(() => {
      applyTheme(theme);
      try {
         window.localStorage.setItem(STORAGE_KEY, theme);
      } catch {
         // ignora — preferência fica só para a sessão.
      }
   }, [theme]);

   const setTheme = useCallback((next: Theme) => {
      setThemeState(next);
   }, []);

   const toggleTheme = useCallback(() => {
      setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
   }, []);

   const value = useMemo<ThemeContextValue>(
      () => ({ theme, setTheme, toggleTheme }),
      [theme, setTheme, toggleTheme],
   );

   return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
   const ctx = useContext(ThemeContext);
   if (!ctx) {
      throw new Error('useTheme deve ser usado dentro de <ThemeProvider>');
   }
   return ctx;
}
