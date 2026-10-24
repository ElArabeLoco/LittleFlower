/**
 * MembersPage — /members
 *
 * Container: reads members through application hooks, owns the dialog state
 * and wires the mutations. All markup lives in MembersView and the dialogs.
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { MemberRef } from '@/domain/member/HouseholdMember';
import { useAuth } from '@/features/auth/AuthContext';
import { useHouseholdMembers } from '@/application/useHouseholdMembers';
import { useMemberHoldings } from '@/application/useMemberHoldings';
import { useMemberMutations } from '@/application/useMemberMutations';
import { useMemberSuggestions } from '@/application/useMemberSuggestions';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppNav } from '@/shared/ui/AppNav';
import { Button } from '@/shared/ui/button';
import { useI18n } from '@/shared/i18n/I18nContext';
import { DeleteMemberDialog } from './DeleteMemberDialog';
import { MemberFormDialog } from './MemberFormDialog';
import { MembersView } from './MembersView';

type DialogState =
  | { kind: 'create' }
  | { kind: 'edit'; member: MemberRef }
  | { kind: 'delete'; member: MemberRef };

export function MembersPage() {
  const { t } = useI18n();
  const { session } = useAuth();
  const householdId = session?.householdId ?? '';
  const userId = session?.userId ?? '';

  const { members, countsByMember, suggestedTone } = useHouseholdMembers();
  const suggestions = useMemberSuggestions();
  const { createMember, updateMember, deleteMember } = useMemberMutations(householdId, userId);

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const close = () => setDialog(null);

  const deleting = dialog?.kind === 'delete' ? dialog.member : null;
  const holdings = useMemberHoldings(deleting?.id ?? null);

  const editing = dialog?.kind === 'edit' ? dialog.member : null;
  const otherNames = members.filter(member => member.id !== editing?.id).map(member => member.name);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-app)]">
      <AppHeader
        title={t.members.title}
        subtitle={t.members.subtitle}
        maxWidth="max-w-3xl"
        actions={
          <Button size="sm" className="h-9 gap-1.5 sm:h-8" onClick={() => setDialog({ kind: 'create' })}>
            <Plus size={14} aria-hidden="true" />
            <span className="sm:hidden">{t.members.addShort}</span>
            <span className="hidden sm:inline">{t.members.addLong}</span>
          </Button>
        }
      />

      <MembersView
        members={members}
        countsByMember={countsByMember}
        suggestions={suggestions}
        onAdd={() => setDialog({ kind: 'create' })}
        onEdit={member => setDialog({ kind: 'edit', member })}
        onDelete={member => setDialog({ kind: 'delete', member })}
        onAddSuggestion={name => void createMember(name)}
      />

      <MemberFormDialog
        open={dialog?.kind === 'create' || dialog?.kind === 'edit'}
        onOpenChange={open => { if (!open) close(); }}
        mode={dialog?.kind === 'edit' ? 'edit' : 'create'}
        member={editing ?? undefined}
        otherNames={otherNames}
        suggestedTone={suggestedTone}
        onSubmit={async ({ name, tone }) => {
          if (editing) await updateMember(editing.id, { name, tone });
          else await createMember(name, tone);
        }}
      />

      <DeleteMemberDialog
        open={deleting !== null}
        onOpenChange={open => { if (!open) close(); }}
        member={deleting}
        holdings={holdings}
        onConfirm={async () => { if (deleting) await deleteMember(deleting.id); }}
      />

      <AppNav />
    </div>
  );
}
