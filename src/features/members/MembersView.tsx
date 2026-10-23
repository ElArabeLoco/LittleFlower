/**
 * MembersView — the body of the members page (presentational).
 *
 * Props only, no hooks beyond i18n: the container (MembersPage) owns data and
 * dialog state, and previews can render this with fixture props.
 */

import { Info, Pencil, Plus, Trash2, Users } from 'lucide-react';
import type { MemberRef } from '@/domain/member/HouseholdMember';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';
import { useI18n } from '@/shared/i18n/I18nContext';
import { MemberAvatar } from './components/MemberAvatar';
import { memberSummary } from './memberSummary';

export interface MembersViewProps {
  members: MemberRef[];
  /** Active incomes and debts each member holds, by member id. */
  countsByMember: Map<string, { incomes: number; debts: number }>;
  /** Account names offered as one-tap members (empty state only). */
  suggestions: string[];
  onAdd: () => void;
  onEdit: (member: MemberRef) => void;
  onDelete: (member: MemberRef) => void;
  onAddSuggestion: (name: string) => void;
}

export function MembersView({
  members,
  countsByMember,
  suggestions,
  onAdd,
  onEdit,
  onDelete,
  onAddSuggestion,
}: MembersViewProps) {
  const { t } = useI18n();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-6">
      <p className="max-w-prose text-[15px] leading-relaxed text-[var(--text-secondary)]">
        {t.members.intro}
      </p>

      {members.length === 0 ? (
        <EmptyState suggestions={suggestions} onAdd={onAdd} onAddSuggestion={onAddSuggestion} />
      ) : (
        <section aria-labelledby="members-count">
          <h2
            id="members-count"
            className="mb-3 px-1 text-sm font-semibold text-[var(--text-secondary)]"
          >
            {t.members.count(members.length)}
          </h2>
          <ul className="space-y-3">
            {members.map(member => (
              <li
                key={member.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
              >
                <MemberAvatar name={member.name} tone={member.tone} size={44} />
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate text-base font-semibold text-[var(--text-primary)]">
                    {member.name}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {memberSummary(t, countsByMember.get(member.id))}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 gap-1.5 sm:h-9"
                    aria-label={t.members.editAria(member.name)}
                    onClick={() => onEdit(member)}
                  >
                    <Pencil size={14} aria-hidden="true" />
                    {t.members.editAction}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-11 gap-1.5 sm:h-9',
                      'border-red-300 text-red-700 hover:border-red-400 hover:bg-red-50',
                      'dark:border-red-900 dark:text-red-300 dark:hover:border-red-700 dark:hover:bg-red-950/40',
                    )}
                    aria-label={t.members.deleteAria(member.name)}
                    onClick={() => onDelete(member)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {t.members.deleteAction}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <aside className="flex gap-3 rounded-xl bg-[var(--bg-surface-2)] p-4">
        <Info size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          <strong className="font-semibold text-[var(--text-primary)]">{t.members.noteTitle}</strong>{' '}
          {t.members.noteBody}
        </p>
      </aside>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  suggestions,
  onAdd,
  onAddSuggestion,
}: Pick<MembersViewProps, 'suggestions' | 'onAdd' | 'onAddSuggestion'>) {
  const { t } = useI18n();

  return (
    <>
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-center">
        <span
          aria-hidden="true"
          className="mx-auto flex size-14 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
        >
          <Users size={26} strokeWidth={1.75} />
        </span>
        <h2 className="mt-4 text-lg font-[650] text-[var(--text-primary)]">{t.members.emptyTitle}</h2>
        <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-[var(--text-secondary)]">
          {t.members.emptyBody}
        </p>
        <Button size="lg" className="mt-5 w-full gap-2" onClick={onAdd}>
          <Plus size={16} aria-hidden="true" />
          {t.members.addLong}
        </Button>
      </section>

      {suggestions.length > 0 && (
        <section aria-labelledby="members-suggestions">
          <h2
            id="members-suggestions"
            className="mb-3 px-1 text-sm font-semibold text-[var(--text-secondary)]"
          >
            {t.members.suggestionsTitle}
          </h2>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(name => (
              <Button
                key={name}
                variant="outline"
                className="h-11 gap-1.5 rounded-full sm:h-10"
                onClick={() => onAddSuggestion(name)}
              >
                <Plus size={14} aria-hidden="true" />
                {t.members.suggestionAdd(name)}
              </Button>
            ))}
          </div>
          <p className="mt-2 px-1 text-sm text-[var(--text-muted)]">{t.members.suggestionsHint}</p>
        </section>
      )}
    </>
  );
}
