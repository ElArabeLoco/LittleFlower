/**
 * AppSettingsContext — global user preferences.
 *
 * Settings persisted in localStorage:
 *   theme:        'light' | 'dark' | 'auto'
 *   numberFormat: 'abbreviated' | 'full'
 *
 * Theme logic:
 *   'light' → always light
 *   'dark'  → always dark
 *   'auto'  → follows system prefers-color-scheme
 *
 * The provider applies/removes the 'dark' class on <html> whenever
 * the effective theme changes.
 */

import { useEffect, useState, useCallback } from 'react';
import { AppSettingsContext, type Theme, type NumberFormat } from './useAppSettings';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY_THEME = 'lf:theme';
const STORAGE_KEY_NUMBER_FORMAT = 'lf:numberFormat';

function readTheme(): Theme {
  const v = localStorage.getItem(STORAGE_KEY_THEME);
  if (v === 'light' || v === 'dark' || v === 'auto') return v;
  return 'auto';
}

function readNumberFormat(): NumberFormat {
  const v = localStorage.getItem(STORAGE_KEY_NUMBER_FORMAT);
  if (v === 'abbreviated' || v === 'full') return v;
  return 'abbreviated';
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeClass(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme);
  const [numberFormat, setNumberFormatState] = useState<NumberFormat>(readNumberFormat);

  // Compute resolved theme
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme);

  // Listen to system preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolvedTheme: 'light' | 'dark' = theme === 'auto' ? systemTheme : theme;

  // Apply dark class to <html> whenever resolved theme changes
  useEffect(() => {
    applyThemeClass(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY_THEME, t);
  }, []);

  const setNumberFormat = useCallback((f: NumberFormat) => {
    setNumberFormatState(f);
    localStorage.setItem(STORAGE_KEY_NUMBER_FORMAT, f);
  }, []);

  return (
    <AppSettingsContext.Provider value={{ theme, numberFormat, setTheme, setNumberFormat, resolvedTheme }}>
      {children}
    </AppSettingsContext.Provider>
  );
}
