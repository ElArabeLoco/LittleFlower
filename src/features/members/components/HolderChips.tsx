import type { MemberRef } from '@/domain/member/HouseholdMember';
import { cn } from '@/shared/ui/cn';
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
