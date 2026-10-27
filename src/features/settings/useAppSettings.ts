import { createContext, useContext } from 'react';

export type Theme = 'light' | 'dark' | 'auto';
export type NumberFormat = 'abbreviated' | 'full';

export interface AppSettings {
  theme: Theme;
  numberFormat: NumberFormat;
  setTheme: (t: Theme) => void;
  setNumberFormat: (f: NumberFormat) => void;
  /** The actual resolved theme taking 'auto' into account */
  resolvedTheme: 'light' | 'dark';
}

export const AppSettingsContext = createContext<AppSettings | null>(null);

export function useAppSettings(): AppSettings {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used inside AppSettingsProvider');
  return ctx;
}
