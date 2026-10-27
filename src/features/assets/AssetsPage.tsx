/**
 * AssetsPage — /assets
 *
 * Container: reads assets and members through application hooks, owns the
 * dialog state and wires the mutations. All markup lives in AssetsView,
 * AssetFormDialog, AssetValueDialog and AssetHistoryDialog.
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { useAssets, type AssetHistoryEntry, type AssetItem } from '@/application/useAssets';
import { useAssetMutations } from '@/application/useAssetMutations';
import { useHouseholdMembers } from '@/application/useHouseholdMembers';
import { AppHeader } from '@/shared/ui/AppHeader';
import { AppNav } from '@/shared/ui/AppNav';
import { Button } from '@/shared/ui/button';
import { useI18n } from '@/shared/i18n/useI18n';
import { AssetFormDialog } from './AssetFormDialog';
import { AssetHistoryDialog } from './AssetHistoryDialog';
import { AssetValueDialog } from './AssetValueDialog';
import { AssetsView } from './AssetsView';
import { useValuationFormat } from './valuationFormat';

type DialogState = { kind: 'create' } | { kind: 'edit'; asset: AssetItem };

export function AssetsPage() {
  const { t } = useI18n();
  const { session } = useAuth();
  const householdId = session?.householdId ?? '';
  const userId = session?.userId ?? '';

  const { assets, totalCOP, hasMissingTrm, changedAssets, totalChangeCOP } = useAssets();
  const { members, hasMembers } = useHouseholdMembers();
  const { createAsset, updateAsset, deleteAsset, addValuation, deleteValuation } =
    useAssetMutations(householdId, userId);
  const { money, date } = useValuationFormat();

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const editing = dialog?.kind === 'edit' ? dialog.asset : null;
  // Ids, not items: the dialogs always show the asset as it is now.
  const [valueAssetId, setValueAssetId] = useState<string | null>(null);
  const [historyAssetId, setHistoryAssetId] = useState<string | null>(null);
  const valueAsset = assets.find(asset => asset.id === valueAssetId) ?? null;
  const historyAsset = assets.find(asset => asset.id === historyAssetId) ?? null;

  async function handleDelete(asset: AssetItem) {
    if (!confirm(t.assets.confirmDelete(asset.name))) return;
    await deleteAsset(asset.id);
  }

  async function handleDeleteValue(entry: AssetHistoryEntry) {
    if (!confirm(t.assets.history.confirmDelete(money(entry.value, entry.currency), date(entry.valuedOn)))) return;
    await deleteValuation(entry.id);
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
        changedAssets={changedAssets}
        totalChangeCOP={totalChangeCOP}
        hasMembers={hasMembers}
        onAdd={() => setDialog({ kind: 'create' })}
        onEdit={asset => setDialog({ kind: 'edit', asset })}
        onDelete={asset => void handleDelete(asset)}
        onUpdateValue={asset => setValueAssetId(asset.id)}
        onShowHistory={asset => setHistoryAssetId(asset.id)}
      />

      <AssetFormDialog
        open={dialog !== null}
        onOpenChange={open => { if (!open) setDialog(null); }}
        mode={editing ? 'edit' : 'create'}
        asset={editing ?? undefined}
        members={members}
        onSubmit={async ({ fields, holderIds }) => {
          if (editing) await updateAsset(editing.id, { name: fields.name, kind: fields.kind }, holderIds);
          else await createAsset(fields, holderIds);
        }}
      />

      <AssetHistoryDialog
        asset={historyAsset}
        onClose={() => setHistoryAssetId(null)}
        onUpdateValue={asset => {
          setHistoryAssetId(null);
          setValueAssetId(asset.id);
        }}
        onDeleteValue={(_, entry) => void handleDeleteValue(entry)}
      />

      <AssetValueDialog
        asset={valueAsset}
        onClose={() => setValueAssetId(null)}
        onSubmit={async entry => {
          if (valueAsset) await addValuation(valueAsset.id, entry);
        }}
      />

      <AppNav />
    </div>
  );
}
