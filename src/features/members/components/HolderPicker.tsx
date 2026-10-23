/**
 * HolderPicker — choose the holders (titulares) of an income or a debt.
 *
 * One toggle per active member; none selected means the whole household.
 * Presentational: the form owns the selected ids.
 */

import { Check, Users } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import type { MemberRef } from '@/domain/member/HouseholdMember';
import { describeHolders } from '@/domain/member/holders';
import { cn } from '@/shared/ui/cn';
import { useI18n } from '@/shared/i18n/I18nContext';
import { formatList } from '../formatList';
import { MEMBER_TONE_CLASSES } from '../memberTones';
import { MemberAvatar } from './MemberAvatar';

interface HolderPickerProps {
  members: MemberRef[];
  /** Selected member ids. */
  value: string[];
  onChange: (memberIds: string[]) => void;
  subject: 'income' | 'debt';
}

export function HolderPicker({ members, value, onChange, subject }: HolderPickerProps) {
  const { t, locale } = useI18n();

  function toggle(memberId: string) {
    onChange(value.includes(memberId) ? value.filter(id => id !== memberId) : [...value, memberId]);
  }

  const selectedNames = members.filter(member => value.includes(member.id)).map(member => member.name);
  const { kind, names } = describeHolders(selectedNames);
  const summary =
    kind === 'household'
      ? t.holders.summaryNone[subject]
      : kind === 'single'
        ? t.holders.summarySingle(names[0])
        : t.holders.summaryShared[subject](formatList(locale, names));

  return (
    <fieldset className="min-w-0 border-t border-[var(--border-subtle)] pt-3">
      <legend className="float-left mb-2 w-full p-0 text-[13px] font-semibold leading-none text-[var(--text-secondary)]">
        {t.holders.legend}
      </legend>

      {members.length === 0 ? (
        <div className="clear-both flex gap-3 rounded-xl bg-[var(--bg-surface-2)] p-3">
          <Users size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-sky-700 dark:text-sky-300" />
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {t.holders.noMembers}{' '}
            <Link
              to="/members"
              className="font-semibold text-[var(--text-brand)] underline underline-offset-2 hover:no-underline"
            >
              {t.holders.noMembersLink}
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="clear-both space-y-2">
          <div className="flex flex-wrap gap-2">
            {members.map(member => {
              const selected = value.includes(member.id);
              const classes = MEMBER_TONE_CLASSES[member.tone];
              return (
                <button
                  key={member.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle(member.id)}
                  className={cn(
                    'inline-flex h-11 max-w-full items-center gap-2 rounded-full border py-0 pl-2 pr-3.5 text-sm font-semibold transition-colors sm:h-10',
                    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]',
                    selected
                      ? cn('border-[1.5px]', classes.soft, classes.strongBorder, classes.strongText)
                      : 'border-[var(--border-medium)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--border-strong)]',
                  )}
                >
                  {selected ? (
                    <span
                      aria-hidden="true"
                      className={cn('flex size-6 shrink-0 items-center justify-center rounded-full', classes.solid)}
                    >
                      <Check size={14} strokeWidth={3} />
                    </span>
                  ) : (
                    <MemberAvatar name={member.name} tone={member.tone} size={24} />
                  )}
                  <span className="truncate">{member.name}</span>
                </button>
              );
            })}
          </div>
          <p aria-live="polite" className="text-sm text-[var(--text-secondary)]">
            {summary}
          </p>
        </div>
      )}
    </fieldset>
  );
}
