import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { I18nProvider } from './I18nContext';
import { useI18n } from './I18nContext';

describe('I18nProvider and useI18n', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'navigator', {
      value: { language: 'es-CO' },
      writable: true,
    });
  });

  it('useI18n() throws when used outside I18nProvider', () => {
    expect(() => renderHook(() => useI18n())).toThrow('useI18n must be used inside I18nProvider');
  });

  it('default locale is "es" when localStorage is empty and browser lang is es', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <I18nProvider>{children}</I18nProvider>
    );
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe('es');
  });

  it('t object contains Spanish translations when locale is "es"', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <I18nProvider>{children}</I18nProvider>
    );
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe('es');
    // Spanish common translations
    expect(result.current.t.common.cancel).toBe('Cancelar');
  });

  it('setLocale("en") switches the locale to English', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <I18nProvider>{children}</I18nProvider>
    );
    const { result } = renderHook(() => useI18n(), { wrapper });

    act(() => {
      result.current.setLocale('en');
    });

    expect(result.current.locale).toBe('en');
  });

  it('setLocale("en") persists to localStorage key "lf:language"', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <I18nProvider>{children}</I18nProvider>
    );
    const { result } = renderHook(() => useI18n(), { wrapper });

    act(() => {
      result.current.setLocale('en');
    });

    expect(localStorage.getItem('lf:language')).toBe('en');
  });

  it('when localStorage has "lf:language" = "en", initializes to English', () => {
    localStorage.setItem('lf:language', 'en');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <I18nProvider>{children}</I18nProvider>
    );
    const { result } = renderHook(() => useI18n(), { wrapper });

    expect(result.current.locale).toBe('en');
    // English common translations
    expect(result.current.t.common.cancel).toBe('Cancel');
  });
});
