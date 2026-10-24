/**
 * DeleteMemberDialog — confirms removing a member and says what changes.
 *
 * Deleting a member never deletes incomes, debts or assets: they only stop showing
 * the member as holder.
 */

import { useState } from 'react';
import type { MemberRef } from '@/domain/member/HouseholdMember';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { useI18n } from '@/shared/i18n/I18nContext';
import { MemberAvatar } from './components/MemberAvatar';
import { formatList } from './formatList';

export interface DeleteHolding {
  id: string;
  name: string;
  /** Names of the other active holders of the same income / debt / asset. */
  coHolders: string[];
}

export interface DeleteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: MemberRef | null;
  holdings: { incomes: DeleteHolding[]; debts: DeleteHolding[]; assets: DeleteHolding[] };
  onConfirm: () => Promise<void>;
}

export function DeleteMemberDialog({ open, onOpenChange, member, holdings, onConfirm }: DeleteMemberDialogProps) {
  const { t, locale } = useI18n();
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (!member) return null;

  const hasHoldings = holdings.incomes.length > 0 || holdings.debts.length > 0 || holdings.assets.length > 0;

  function describe(items: DeleteHolding[], shared: (others: string) => string): string {
    return items
      .map(item =>
        item.coHolders.length > 0
          ? `${item.name} ${shared(formatList(locale, item.coHolders))}`
          : item.name,
      )
      .join(' · ');
  }

  async function handleConfirm() {
    setDeleting(true);
    setFailure(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : t.common.unexpectedError);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <MemberAvatar name={member.name} tone={member.tone} size={44} className="mb-1" />
          <DialogTitle>{t.members.delete.title(member.name)}</DialogTitle>
        </DialogHeader>

        {hasHoldings ? (
          <>
            <div className="space-y-3 rounded-xl bg-[var(--bg-surface-2)] p-4 text-sm">
              <p className="font-semibold text-[var(--text-primary)]">
                {t.members.delete.holderOfHeading(member.name)}
              </p>
              {holdings.incomes.length > 0 && (
                <p className="leading-relaxed text-[var(--text-secondary)]">
                  <strong className="font-semibold text-[var(--text-primary)]">
                    {t.members.incomeCount(holdings.incomes.length)}
                  </strong>
                  {': '}
                  {describe(holdings.incomes, t.members.delete.sharedIncome)}
                </p>
              )}
              {holdings.debts.length > 0 && (
                <p className="leading-relaxed text-[var(--text-secondary)]">
                  <strong className="font-semibold text-[var(--text-primary)]">
                    {t.members.debtCount(holdings.debts.length)}
                  </strong>
                  {': '}
                  {describe(holdings.debts, t.members.delete.sharedDebt)}
                </p>
              )}
              {holdings.assets.length > 0 && (
                <p className="leading-relaxed text-[var(--text-secondary)]">
                  <strong className="font-semibold text-[var(--text-primary)]">
                    {t.members.assetCount(holdings.assets.length)}
                  </strong>
                  {': '}
                  {describe(holdings.assets, t.members.delete.sharedAsset)}
                </p>
              )}
            </div>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              {t.members.delete.consequence(member.name)}
            </p>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {t.members.delete.noHoldings(member.name)}
          </p>
        )}

        {failure && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {failure}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" className="h-11 w-full sm:h-10 sm:flex-1" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button
            className="h-11 w-full bg-red-600 text-white hover:bg-red-700 sm:h-10 sm:flex-1"
            disabled={deleting}
            onClick={handleConfirm}
          >
            {t.members.delete.confirm(member.name)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
