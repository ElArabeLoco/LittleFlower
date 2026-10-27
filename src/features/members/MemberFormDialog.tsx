/**
 * MemberFormDialog — create or edit a member (name + color).
 *
 * Controlled and presentational: the container decides when it opens and
 * what happens on submit. The form lives inside the dialog content, so it
 * starts fresh every time the dialog opens.
 */

import { useId, useState } from 'react';
import {
  MEMBER_TONES,
  isDuplicateMemberName,
  type MemberRef,
  type MemberTone,
} from '@/domain/member/HouseholdMember';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { cn } from '@/shared/ui/cn';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { useI18n } from '@/shared/i18n/useI18n';
import { HolderChip } from './components/HolderChips';
import { MemberAvatar } from './components/MemberAvatar';
import { memberInitial } from './memberInitial';
import { MEMBER_TONE_CLASSES } from './memberTones';

export interface MemberFormValues {
  name: string;
  tone: MemberTone;
}

export interface MemberFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  /** The member being edited. */
  member?: MemberRef;
  /** Names of the OTHER active members, to flag duplicates. */
  otherNames: string[];
  /** Tone preselected when creating. */
  suggestedTone: MemberTone;
  onSubmit: (values: MemberFormValues) => Promise<void>;
}

export function MemberFormDialog({
  open,
  onOpenChange,
  mode,
  member,
  otherNames,
  suggestedTone,
  onSubmit,
}: MemberFormDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t.members.form.createTitle : t.members.form.editTitle}</DialogTitle>
        </DialogHeader>
        <MemberForm
          mode={mode}
          initialName={member?.name ?? ''}
          initialTone={member?.tone ?? suggestedTone}
          otherNames={otherNames}
          onCancel={() => onOpenChange(false)}
          onSubmit={async values => {
            await onSubmit(values);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

interface MemberFormProps {
  mode: 'create' | 'edit';
  initialName: string;
  initialTone: MemberTone;
  otherNames: string[];
  onCancel: () => void;
  onSubmit: (values: MemberFormValues) => Promise<void>;
}

function MemberForm({ mode, initialName, initialTone, otherNames, onCancel, onSubmit }: MemberFormProps) {
  const { t } = useI18n();
  const ids = useId();
  const nameId = `${ids}-name`;
  const errorId = `${ids}-error`;

  const [name, setName] = useState(initialName);
  const [tone, setTone] = useState<MemberTone>(initialTone);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const trimmed = name.trim();
  const duplicate = trimmed !== '' && isDuplicateMemberName(trimmed, otherNames);
  const emptyError = submitted && trimmed === '';
  const nameError = duplicate ? t.members.form.duplicate(trimmed) : emptyError ? t.members.form.nameRequired : null;
  const previewName = trimmed || t.members.form.previewFallback;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (trimmed === '' || duplicate) return;
    setSaving(true);
    setFailure(null);
    try {
      await onSubmit({ name: trimmed, tone });
    } catch (err) {
      setFailure(err instanceof Error ? err.message : t.common.unexpectedError);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor={nameId}>{t.members.form.nameLabel}</Label>
        <Input
          id={nameId}
          value={name}
          placeholder={t.members.form.namePlaceholder}
          autoFocus
          autoComplete="off"
          maxLength={60}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? errorId : undefined}
          className={cn(nameError && 'border-red-600 dark:border-red-400')}
          onChange={e => setName(e.target.value)}
        />
        {nameError && (
          <p id={errorId} role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
            {nameError}
          </p>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-[13px] font-semibold leading-none text-[var(--text-secondary)]">
          {t.members.form.colorLabel}
        </legend>
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
          {MEMBER_TONES.map(option => {
            const selected = option === tone;
            const classes = MEMBER_TONE_CLASSES[option];
            return (
              <label
                key={option}
                className="flex min-h-11 cursor-pointer flex-col items-center gap-1 rounded-lg py-1.5"
              >
                <input
                  type="radio"
                  name={`${ids}-tone`}
                  value={option}
                  checked={selected}
                  onChange={() => setTone(option)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-9 items-center justify-center rounded-full text-sm font-semibold',
                    'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[var(--focus-ring)]',
                    classes.soft,
                    selected && cn('ring-2 ring-offset-2 ring-offset-[var(--bg-surface)]', classes.strongRing),
                  )}
                >
                  {memberInitial(previewName)}
                </span>
                <span
                  className={cn(
                    'text-xs',
                    selected ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]',
                  )}
                >
                  {t.members.tones[option]}
                </span>
              </label>
            );
          })}
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          {mode === 'create' ? t.members.form.colorHintCreate : t.members.form.colorHintEdit}
        </p>
      </fieldset>

      <div className="rounded-xl bg-[var(--bg-surface-2)] p-3">
        <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">{t.members.form.previewLabel}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex min-w-0 items-center gap-2.5">
            <MemberAvatar name={previewName} tone={tone} size={32} />
            <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{previewName}</span>
          </span>
          <HolderChip member={{ name: previewName, tone }} />
        </div>
      </div>

      {failure && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {failure}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="h-11 flex-1 sm:h-10" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button
          type="submit"
          className="h-11 flex-1 sm:h-10"
          disabled={saving || trimmed === '' || duplicate}
        >
          {saving ? t.common.saving : mode === 'create' ? t.common.create : t.common.save}
        </Button>
      </div>
    </form>
  );
}
