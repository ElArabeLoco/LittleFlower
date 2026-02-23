/**
 * useNumberFormat — centralized number formatting respecting the user's
 * numberFormat preference ('abbreviated' | 'full').
 *
 * Returns formatting functions to use in display code.
 * Never use in inputs/forms — only in read-only display.
 *
 * abbreviated:
 *   $1.200.000  → $1.2M
 *   $150.000    → $150K
 *   $900        → $900
 *
 * full:
 *   $1.200.000  → $1.200.000
 *   $150.000    → $150.000
 *   $900        → $900
 */

import { useAppSettings } from '@/features/settings/AppSettingsContext';

// ---------------------------------------------------------------------------
// Pure helpers — read format from localStorage directly.
// Use these ONLY in non-hook contexts (e.g. standalone components that can't
// use hooks but still need reactive-ish formatting).
// For normal React components always prefer useNumberFormat().
// ---------------------------------------------------------------------------

export function formatCOPStatic(amount: number): string {
  const fmt = localStorage.getItem('lf:numberFormat') ?? 'abbreviated';
  if (fmt === 'abbreviated') {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    if (abs >= 1_000_000) {
      const v = abs / 1_000_000;
      return `${sign}$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')}M`;
    }
    if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
    return `${sign}$${abs}`;
  }
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
}

export function useNumberFormat() {
  const { numberFormat } = useAppSettings();

  /** Format a COP integer amount */
  function formatCOP(amount: number): string {
    if (numberFormat === 'abbreviated') {
      const abs = Math.abs(amount);
      const sign = amount < 0 ? '-' : '';
      if (abs >= 1_000_000) {
        const v = abs / 1_000_000;
        return `${sign}$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')}M`;
      }
      if (abs >= 1_000) {
        return `${sign}$${Math.round(abs / 1_000)}K`;
      }
      return `${sign}$${abs}`;
    }
    // full
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /** Format a generic number (no currency symbol) */
  function formatNumber(n: number): string {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n);
  }

  /** Format a USD amount */
  function formatUSD(amount: number): string {
    if (numberFormat === 'abbreviated') {
      const abs = Math.abs(amount);
      const sign = amount < 0 ? '-' : '';
      if (abs >= 1_000_000) {
        return `${sign}USD ${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
      }
      if (abs >= 1_000) {
        return `${sign}USD ${Math.round(abs / 1_000)}K`;
      }
      return `${sign}USD ${abs.toLocaleString('es-CO')}`;
    }
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(amount);
  }

  return { formatCOP, formatNumber, formatUSD };
}
