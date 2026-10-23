import { House } from 'lucide-react';
import type { MemberRef } from '@/domain/member/HouseholdMember';
import { cn } from '@/shared/ui/cn';
import { useI18n } from '@/shared/i18n/I18nContext';
import { MemberAvatar } from './MemberAvatar';

interface HolderChipProps {
  member: Pick<MemberRef, 'name' | 'tone'>;
  className?: string;
}

/** One holder: small pill with its avatar and name. */
export function HolderChip({ member, className }: HolderChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 max-w-full items-center gap-1.5 rounded-full bg-[var(--bg-surface-2)] py-0.5 pl-[3px] pr-2.5',
        'text-xs font-semibold text-[var(--text-primary)]',
        className,
      )}
    >
      <MemberAvatar name={member.name} tone={member.tone} size={18} />
      <span className="truncate">{member.name}</span>
    </span>
  );
}

interface HolderChipsProps {
  holders: MemberRef[];
  /** Whether the household has any active member. */
  hasMembers: boolean;
  subject: 'income' | 'debt';
  className?: string;
}

/**
 * Holders of an income or a debt, for its card.
 *
 *   holders             → one chip each, "shared" after them when there are 2+
 *   none, with members  → muted "Del hogar" (the record belongs to everyone)
 *   none, no members    → nothing (the household never set holders up)
 */
export function HolderChips({ holders, hasMembers, subject, className }: HolderChipsProps) {
  const { t } = useI18n();

  if (holders.length === 0) {
    if (!hasMembers) return null;
    return (
      <p
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]',
          className,
        )}
      >
        <House size={13} aria-hidden="true" />
        {t.holders.household}
      </p>
    );
  }

  return (
    <ul className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {holders.map(holder => (
        <li key={holder.id} className="min-w-0 max-w-full">
          <HolderChip member={holder} />
        </li>
      ))}
      {holders.length > 1 && (
        <li className="text-xs font-medium text-[var(--text-muted)]">
          {subject === 'income' ? t.holders.sharedIncome : t.holders.sharedDebt}
        </li>
      )}
    </ul>
  );
}
