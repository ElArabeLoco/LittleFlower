import type { MemberTone } from '@/domain/member/HouseholdMember';
import { cn } from '@/shared/ui/cn';
import { memberInitial } from '../memberInitial';
import { MEMBER_TONE_CLASSES } from '../memberTones';

interface MemberAvatarProps {
  name: string;
  tone: MemberTone;
  /** Diameter in px. */
  size?: number;
  className?: string;
}

/** Round avatar with the member's initial. Decorative: the name is always next to it. */
export function MemberAvatar({ name, tone, size = 44, className }: MemberAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold',
        MEMBER_TONE_CLASSES[tone].soft,
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {memberInitial(name)}
    </span>
  );
}
