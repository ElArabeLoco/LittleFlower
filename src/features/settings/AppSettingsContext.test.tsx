import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppSettingsProvider, useAppSettings } from './AppSettingsContext';

describe('AppSettingsProvider and useAppSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it('useAppSettings() throws when used outside AppSettingsProvider', () => {
    expect(() => renderHook(() => useAppSettings())).toThrow(
      'useAppSettings must be used inside AppSettingsProvider',
    );
  });

  it('default numberFormat is "abbreviated" when localStorage is empty', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppSettingsProvider>{children}</AppSettingsProvider>
    );
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    expect(result.current.numberFormat).toBe('abbreviated');
  });

  it('default theme is "auto" when localStorage is empty', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppSettingsProvider>{children}</AppSettingsProvider>
    );
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    expect(result.current.theme).toBe('auto');
  });

  it('setNumberFormat("full") changes the numberFormat value', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppSettingsProvider>{children}</AppSettingsProvider>
    );
    const { result } = renderHook(() => useAppSettings(), { wrapper });

    act(() => {
      result.current.setNumberFormat('full');
    });

    expect(result.current.numberFormat).toBe('full');
  });

  it('setNumberFormat("full") persists to localStorage key "lf:numberFormat"', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppSettingsProvider>{children}</AppSettingsProvider>
    );
    const { result } = renderHook(() => useAppSettings(), { wrapper });

    act(() => {
      result.current.setNumberFormat('full');
    });

    expect(localStorage.getItem('lf:numberFormat')).toBe('full');
  });

  it('setTheme("dark") changes the theme value', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppSettingsProvider>{children}</AppSettingsProvider>
    );
    const { result } = renderHook(() => useAppSettings(), { wrapper });

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
  });

  it('setTheme("dark") persists to localStorage key "lf:theme"', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppSettingsProvider>{children}</AppSettingsProvider>
    );
    const { result } = renderHook(() => useAppSettings(), { wrapper });

    act(() => {
      result.current.setTheme('dark');
    });

    expect(localStorage.getItem('lf:theme')).toBe('dark');
  });

  it('when localStorage has "lf:theme" = "light", initializes to light theme', () => {
    localStorage.setItem('lf:theme', 'light');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppSettingsProvider>{children}</AppSettingsProvider>
    );
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    expect(result.current.theme).toBe('light');
  });

  it('resolvedTheme is "light" when theme is "light"', () => {
    localStorage.setItem('lf:theme', 'light');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppSettingsProvider>{children}</AppSettingsProvider>
    );
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    expect(result.current.resolvedTheme).toBe('light');
  });

  it('resolvedTheme is "dark" when theme is "dark"', () => {
    localStorage.setItem('lf:theme', 'dark');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppSettingsProvider>{children}</AppSettingsProvider>
    );
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('resolvedTheme follows system when theme is "auto"', () => {
    // matchMedia returns matches: false (light system)
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppSettingsProvider>{children}</AppSettingsProvider>
    );
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    expect(result.current.theme).toBe('auto');
    expect(result.current.resolvedTheme).toBe('light'); // matches: false → light
  });
});
