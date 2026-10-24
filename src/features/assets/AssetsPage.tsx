/**
 * AssetsPage — /assets
 *
 * Container: reads assets and members through application hooks, owns the
 * dialog state and wires the mutations. All markup lives in AssetsView and
 * AssetFormDialog.
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { useAssets, type AssetItem } from '@/application/useAssets';
import { useAssetMutations } from '@/application/useAssetMutations';
import { useHouseholdMembers } from '@/application/useHouseholdMembers';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppNav } from '@/shared/ui/AppNav';
import { Button } from '@/shared/ui/button';
import { useI18n } from '@/shared/i18n/I18nContext';
import { AssetFormDialog } from './AssetFormDialog';
import { AssetsView } from './AssetsView';

type DialogState = { kind: 'create' } | { kind: 'edit'; asset: AssetItem };

export function AssetsPage() {
  const { t } = useI18n();
  const { session } = useAuth();
  const householdId = session?.householdId ?? '';
  const userId = session?.userId ?? '';

  const { assets, totalCOP, hasMissingTrm } = useAssets();
  const { members, hasMembers } = useHouseholdMembers();
  const { createAsset, updateAsset, deleteAsset } = useAssetMutations(householdId, userId);

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const editing = dialog?.kind === 'edit' ? dialog.asset : null;

  async function handleDelete(asset: AssetItem) {
    if (!confirm(t.assets.confirmDelete(asset.name))) return;
    await deleteAsset(asset.id);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-app)]">
      <AppHeader
        title={t.assets.title}
        subtitle={t.assets.subtitle}
        maxWidth="max-w-5xl"
        actions={
          <Button size="sm" className="h-9 gap-1.5 sm:h-8" onClick={() => setDialog({ kind: 'create' })}>
            <Plus size={14} aria-hidden="true" />
            <span className="sm:hidden">{t.assets.addShort}</span>
            <span className="hidden sm:inline">{t.assets.addLong}</span>
          </Button>
        }
      />

      <AssetsView
        assets={assets}
        totalCOP={totalCOP}
        hasMissingTrm={hasMissingTrm}
        hasMembers={hasMembers}
        onAdd={() => setDialog({ kind: 'create' })}
        onEdit={asset => setDialog({ kind: 'edit', asset })}
        onDelete={asset => void handleDelete(asset)}
      />

      <AssetFormDialog
        open={dialog !== null}
        onOpenChange={open => { if (!open) setDialog(null); }}
        mode={editing ? 'edit' : 'create'}
        asset={editing ?? undefined}
        members={members}
        onSubmit={async ({ fields, holderIds }) => {
          if (editing) await updateAsset(editing.id, fields, holderIds);
          else await createAsset(fields, holderIds);
        }}
      />

      <AppNav />
    </div>
  );
}
