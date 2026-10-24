import { useMemo } from 'react';
import type { MemberRef } from '@/domain/member/HouseholdMember';
import { computeNetWorth, type WorthGroup, type WorthItem } from '@/domain/netWorth/netWorth';
import { useAssets } from './useAssets';
import { useDebtManagementSummary } from './useDebtSummary';
import { useHoldersBySubject } from './useHolders';
import { useHouseholdMembers } from './useHouseholdMembers';

export type { WorthGroup, WorthLine, WorthTotals } from '@/domain/netWorth/netWorth';

export interface MemberWorth {
  member: MemberRef;
  group: WorthGroup;
}

export interface NetWorthData {
  household: WorthGroup;
  /** Every active member, alphabetical. */
  members: MemberWorth[];
  /** Records without holders: they belong to the household as a whole. */
  shared: WorthGroup;
  /** Some USD asset or debt has no TRM and is left out. */
  hasMissingTrm: boolean;
}

/**
 * Net worth of the household and of each member: assets at their current
 * value against the outstanding balance of every debt.
 *
 * Debt balances come from useDebtManagementSummary, so "Deudas" here is the
 * same figure as "Total adeudado" on the debts page.
 */
export function useNetWorth(): NetWorthData {
  const { assets, hasMissingTrm: assetsMissingTrm } = useAssets();
  const { debts, balanceByDebt, currentMonthRate } = useDebtManagementSummary();
  const holdersByDebt = useHoldersBySubject('debt');
  const { members } = useHouseholdMembers();

  return useMemo(() => {
    const assetItems: WorthItem[] = assets.map(asset => ({
      id: asset.id,
      name: asset.name,
      kind: asset.kind,
      amount: asset.valueCOP,
      holderIds: asset.holders.map(holder => holder.id),
    }));

    const debtItems: WorthItem[] = debts
      .filter(debt => (balanceByDebt.get(debt.id) ?? 0) > 0)
      .map(debt => ({
        id: debt.id,
        name: debt.name,
        kind: debt.kind,
        amount: balanceByDebt.get(debt.id) ?? 0,
        holderIds: (holdersByDebt.get(debt.id) ?? []).map(holder => holder.id),
      }));

    const worth = computeNetWorth(assetItems, debtItems, members.map(member => member.id));
    const debtsMissingTrm = currentMonthRate === null && debts.some(debt => debt.currency !== 'COP');

    return {
      household: worth.household,
      members: members.map(member => ({ member, group: worth.byMember.get(member.id)! })),
      shared: worth.shared,
      hasMissingTrm: assetsMissingTrm || debtsMissingTrm,
    };
  }, [assets, assetsMissingTrm, debts, balanceByDebt, currentMonthRate, holdersByDebt, members]);
}
