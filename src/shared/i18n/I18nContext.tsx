/**
 * I18nContext — runtime language switching with 2 locales (es, en).
 *
 * Follows the same pattern as AppSettingsContext:
 *   - Persisted in localStorage under `lf:language`
 *   - Auto-detects from `navigator.language` on first visit
 *   - Provider + hook: `useI18n()` → `{ t, locale, setLocale }`
 */

import { createContext, useContext, useState, useCallback } from 'react';
import { es, type Translations } from './translations/es';
import { en } from './translations/en';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Locale = 'es' | 'en';

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translations;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'lf:language';

const TRANSLATIONS: Record<Locale, Translations> = { es, en };

function detectLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'es' || stored === 'en') return stored;
  // Auto-detect from browser language
  const browserLang = navigator.language.slice(0, 2).toLowerCase();
  return browserLang === 'en' ? 'en' : 'es';
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = TRANSLATIONS[locale];

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
