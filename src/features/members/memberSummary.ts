import type { Translations } from '@/shared/i18n/translations/es';
import type { MemberHoldingCounts } from '@/application/useHouseholdMembers';

/**
 * One-line summary of what a member holds:
 * "Titular de 2 ingresos, 1 deuda y 1 activo", "Titular de 1 deuda" or
 * "Sin ingresos, deudas ni activos a su nombre".
 */
export function memberSummary(t: Translations, counts: MemberHoldingCounts | undefined): string {
  const parts: string[] = [];
  if (counts && counts.incomes > 0) parts.push(t.members.incomeCount(counts.incomes));
  if (counts && counts.debts > 0) parts.push(t.members.debtCount(counts.debts));
  if (counts && counts.assets > 0) parts.push(t.members.assetCount(counts.assets));
  if (parts.length === 0) return t.members.noHoldings;
  const last = parts.pop()!;
  return t.members.holderOf(parts.length > 0 ? `${parts.join(', ')} ${t.members.and} ${last}` : last);
}
