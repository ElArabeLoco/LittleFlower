import { useMemo } from 'react';
import { useMemberHoldingsQuery } from '@/infrastructure/powersync/queries/useMemberQueries';
import { useHoldersBySubject } from './useHolders';

export interface Holding {
  id: string;
  name: string;
  /** Names of the other active holders of the same income / debt / asset. */
  coHolders: string[];
}

export interface MemberHoldings {
  incomes: Holding[];
  debts: Holding[];
  assets: Holding[];
}

/** What one member is holder of, with who shares it. Empty when `memberId` is null. */
export function useMemberHoldings(memberId: string | null): MemberHoldings {
  const { data: rows = [] } = useMemberHoldingsQuery(memberId ?? '');
  const incomeHolders = useHoldersBySubject('income');
  const debtHolders = useHoldersBySubject('debt');
  const assetHolders = useHoldersBySubject('asset');

  return useMemo(() => {
    const toHolding = (holders: Map<string, { id: string; name: string }[]>, subjectId: string, name: string): Holding => ({
      id: subjectId,
      name,
      coHolders: (holders.get(subjectId) ?? []).filter(holder => holder.id !== memberId).map(holder => holder.name),
    });

    return {
      incomes: rows
        .filter(row => row.subject_type === 'income')
        .map(row => toHolding(incomeHolders, row.subject_id, row.name)),
      debts: rows
        .filter(row => row.subject_type === 'debt')
        .map(row => toHolding(debtHolders, row.subject_id, row.name)),
      assets: rows
        .filter(row => row.subject_type === 'asset')
        .map(row => toHolding(assetHolders, row.subject_id, row.name)),
    };
  }, [rows, incomeHolders, debtHolders, assetHolders, memberId]);
}
