/**
 * Formatting shared by the asset dialogs, the asset card and the value
 * changes report.
 */

import type { AssetCurrency } from '@/domain/asset/Asset';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';

/** Money in its own currency and dates like "12 Ene 2026". */
export function useValuationFormat() {
  const { t } = useI18n();
  const { formatCOP, formatUSD } = useNumberFormat();

  const money = (value: number, currency: AssetCurrency) =>
    currency === 'USD' ? formatUSD(value) : formatCOP(value);

  /** Always signed: "+$20M" / "−$8M". */
  const signedMoney = (value: number, currency: AssetCurrency) =>
    `${value > 0 ? '+' : value < 0 ? '−' : ''}${money(Math.abs(value), currency)}`;

  /** "2026-01-12" → "12 Ene 2026". */
  const date = (valuedOn: string) => {
    const [year, month, day] = valuedOn.split('-');
    return `${parseInt(day, 10)} ${t.months.short[month] ?? month} ${year}`;
  };

  return { money, signedMoney, date };
}

/** Digits only: "450.000.000" → 450000000. Null when nothing numeric was typed. */
export function parseInteger(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : null;
}

/** "−13,3%" style percentage, signed. */
export function signedPercent(percent: number): string {
  const text = Math.abs(percent).toLocaleString('es-CO', { maximumFractionDigits: 1 });
  return `${percent > 0 ? '+' : percent < 0 ? '−' : ''}${text}%`;
}
