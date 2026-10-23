import type { Translations } from '@/shared/i18n/translations/es';

/**
 * One-line summary of what a member holds:
 * "Titular de 2 ingresos y 2 deudas", "Titular de 1 deuda" or
 * "Sin ingresos ni deudas a su nombre".
 */
export function memberSummary(
  t: Translations,
  counts: { incomes: number; debts: number } | undefined,
): string {
  const parts: string[] = [];
  if (counts && counts.incomes > 0) parts.push(t.members.incomeCount(counts.incomes));
  if (counts && counts.debts > 0) parts.push(t.members.debtCount(counts.debts));
  if (parts.length === 0) return t.members.noHoldings;
  return t.members.holderOf(parts.join(` ${t.members.and} `));
}
