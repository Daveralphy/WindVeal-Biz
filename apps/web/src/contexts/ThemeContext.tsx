import { createContext, useContext, useEffect, useState } from 'react';

// Extend Theme type to include rainbow themes
export type Theme =
  | 'light'
  | 'dark'
  | 'system'
  | 'midnight'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'royal'
  | 'crimson'
  | 'slate';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (theme: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  resolvedTheme: 'dark',
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('vealbiz-theme') as Theme | null;
    return stored || 'dark';
  });

  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;

  const setTheme = (t: string) => {
    setThemeState(t as Theme);
    localStorage.setItem('vealbiz-theme', t);
  };

  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme classes
    root.classList.remove('dark', 'light', 'midnight', 'ocean', 'forest', 'sunset', 'royal', 'crimson', 'slate');
    // Set theme class
    root.classList.add(resolvedTheme);
    // Set CSS variables for custom themes
    const themeVars: Record<string, Record<string, string>> = {
      midnight: {
        '--vb-bg': '#1f2937', '--vb-surface': '#111827', '--vb-card': '#1f2937', '--vb-border': '#374151', '--vb-muted': '#3A3A3A', '--vb-sidebar': '#111827', '--vb-header': '#111827', '--vb-text': '#FFFFFF', '--vb-text-secondary': '#9CA3AF', '--vb-text-muted': '#6B7280', '--vb-text-faint': '#4B5563', '--vb-icon': '#9CA3AF', '--vb-scrollbar': '#3A3A3A',
      },
      ocean: {
        '--vb-bg': '#172554', '--vb-surface': '#1e1b4b', '--vb-card': '#172554', '--vb-border': '#2563eb', '--vb-muted': '#3A3A3A', '--vb-sidebar': '#1e1b4b', '--vb-header': '#1e1b4b', '--vb-text': '#FFFFFF', '--vb-text-secondary': '#60a5fa', '--vb-text-muted': '#6B7280', '--vb-text-faint': '#4B5563', '--vb-icon': '#60a5fa', '--vb-scrollbar': '#3A3A3A',
      },
      forest: {
        '--vb-bg': '#022c22', '--vb-surface': '#042f2e', '--vb-card': '#022c22', '--vb-border': '#10b981', '--vb-muted': '#3A3A3A', '--vb-sidebar': '#042f2e', '--vb-header': '#042f2e', '--vb-text': '#FFFFFF', '--vb-text-secondary': '#34d399', '--vb-text-muted': '#6B7280', '--vb-text-faint': '#4B5563', '--vb-icon': '#34d399', '--vb-scrollbar': '#3A3A3A',
      },
      sunset: {
        '--vb-bg': '#431407', '--vb-surface': '#4c0519', '--vb-card': '#431407', '--vb-border': '#fb923c', '--vb-muted': '#3A3A3A', '--vb-sidebar': '#4c0519', '--vb-header': '#4c0519', '--vb-text': '#FFFFFF', '--vb-text-secondary': '#fb923c', '--vb-text-muted': '#6B7280', '--vb-text-faint': '#4B5563', '--vb-icon': '#fb923c', '--vb-scrollbar': '#3A3A3A',
      },
      royal: {
        '--vb-bg': '#3b0764', '--vb-surface': '#1e1b4b', '--vb-card': '#3b0764', '--vb-border': '#a78bfa', '--vb-muted': '#3A3A3A', '--vb-sidebar': '#1e1b4b', '--vb-header': '#1e1b4b', '--vb-text': '#FFFFFF', '--vb-text-secondary': '#a78bfa', '--vb-text-muted': '#6B7280', '--vb-text-faint': '#4B5563', '--vb-icon': '#a78bfa', '--vb-scrollbar': '#3A3A3A',
      },
      crimson: {
        '--vb-bg': '#450a0a', '--vb-surface': '#4c0519', '--vb-card': '#450a0a', '--vb-border': '#f87171', '--vb-muted': '#3A3A3A', '--vb-sidebar': '#4c0519', '--vb-header': '#4c0519', '--vb-text': '#FFFFFF', '--vb-text-secondary': '#f87171', '--vb-text-muted': '#6B7280', '--vb-text-faint': '#4B5563', '--vb-icon': '#f87171', '--vb-scrollbar': '#3A3A3A',
      },
      slate: {
        '--vb-bg': '#0f172a', '--vb-surface': '#18181b', '--vb-card': '#0f172a', '--vb-border': '#64748b', '--vb-muted': '#3A3A3A', '--vb-sidebar': '#18181b', '--vb-header': '#18181b', '--vb-text': '#FFFFFF', '--vb-text-secondary': '#64748b', '--vb-text-muted': '#6B7280', '--vb-text-faint': '#4B5563', '--vb-icon': '#64748b', '--vb-scrollbar': '#3A3A3A',
      },
    };
    // Reset all theme variables
    Object.keys(themeVars.midnight).forEach((key) => root.style.removeProperty(key));
    // Set variables for custom theme
    if (themeVars[resolvedTheme]) {
      Object.entries(themeVars[resolvedTheme]).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    }
  }, [resolvedTheme]);

  // Listen for system theme changes when using 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setThemeState((prev) => prev); // force re-render
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
