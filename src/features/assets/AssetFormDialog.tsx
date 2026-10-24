/**
 * AssetFormDialog — create an asset (type, name, value, holders) or edit
 * its type, name and holders. An existing asset's value changes through
 * AssetValueDialog, so every change stays in its history.
 *
 * Controlled and presentational: the container decides when it opens and
 * what happens on submit. The form lives inside the dialog content, so it
 * starts fresh every time the dialog opens.
 */

import { useId, useState } from 'react';
import {
  ASSET_CURRENCIES,
  ASSET_KINDS,
  type AssetCurrency,
  type AssetKind,
} from '@/domain/asset/Asset';
import type { MemberRef } from '@/domain/member/HouseholdMember';
import type { AssetItem } from '@/application/useAssets';
import type { AssetFields } from '@/application/useAssetMutations';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { cn } from '@/shared/ui/cn';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useI18n } from '@/shared/i18n/I18nContext';
import { HolderPicker } from '@/features/members/components/HolderPicker';
import { ASSET_KIND_STYLES } from './assetKinds';
import { parseInteger, useValuationFormat } from './valuationFormat';

export interface AssetFormValues {
  fields: AssetFields;
  holderIds: string[];
}

export interface AssetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  /** The asset being edited. */
  asset?: AssetItem;
  members: MemberRef[];
  onSubmit: (values: AssetFormValues) => Promise<void>;
}

export function AssetFormDialog({ open, onOpenChange, mode, asset, members, onSubmit }: AssetFormDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t.assets.form.createTitle : t.assets.form.editTitle}</DialogTitle>
        </DialogHeader>
        <AssetForm
          mode={mode}
          asset={asset}
          members={members}
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

interface AssetFormProps {
  mode: 'create' | 'edit';
  asset?: AssetItem;
  members: MemberRef[];
  onCancel: () => void;
  onSubmit: (values: AssetFormValues) => Promise<void>;
}

function AssetForm({ mode, asset, members, onCancel, onSubmit }: AssetFormProps) {
  const { t } = useI18n();
  const { money } = useValuationFormat();
  const id = useId();
  const [kind, setKind] = useState<AssetKind>(asset?.kind ?? 'savings');
  const [name, setName] = useState(asset?.name ?? '');
  const [value, setValue] = useState(asset ? String(asset.value) : '');
  const [currency, setCurrency] = useState<AssetCurrency>(asset?.currency ?? 'COP');
  const [holderIds, setHolderIds] = useState<string[]>(asset?.holders.map(holder => holder.id) ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseInteger(value);
    if (!name.trim()) { setError(t.assets.form.nameRequired); return; }
    if (mode === 'create' && amount === null) { setError(t.assets.form.valueRequired); return; }

    setError(null);
    setSaving(true);
    try {
      await onSubmit({ fields: { name: name.trim(), kind, value: amount ?? 0, currency }, holderIds });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.unexpectedError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-5" noValidate>
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-medium text-[var(--text-primary)]">{t.assets.form.kindLabel}</legend>
        <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
          {ASSET_KINDS.map(option => {
            const style = ASSET_KIND_STYLES[option];
            const Icon = style.icon;
            const selected = option === kind;
            return (
              <label
                key={option}
                className={cn(
                  'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-colors',
                  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)] has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-[var(--bg-surface)]',
                  selected
                    ? 'border-[1.5px] border-[var(--text-brand)] bg-[var(--bg-hover)]'
                    : 'border-[var(--border-medium)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]',
                )}
              >
                <input
                  type="radio"
                  name={`${id}-kind`}
                  value={option}
                  checked={selected}
                  onChange={() => setKind(option)}
                  className="sr-only"
                />
                <span aria-hidden="true" className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', style.soft)}>
                  <Icon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--text-primary)]">{t.assets.kinds[option]}</span>
                  <span className="block text-xs text-[var(--text-secondary)]">{t.assets.kindHints[option]}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-name`}>{t.assets.form.nameLabel}</Label>
        <Input
          id={`${id}-name`}
          placeholder={t.assets.form.namePlaceholder}
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
      </div>

      {mode === 'edit' && asset ? (
        <div className="space-y-1 rounded-xl bg-[var(--bg-surface-2)] px-3 py-2.5">
          <p className="text-sm text-[var(--text-secondary)]">
            {t.assets.form.currentValueLabel}:{' '}
            <span className="font-semibold tabular-nums text-[var(--text-primary)]">{money(asset.value, asset.currency)}</span>
          </p>
          <p className="text-xs text-[var(--text-secondary)]">{t.assets.form.editValueHint}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor={`${id}-value`}>{t.assets.form.valueLabel}</Label>
              <Input
                id={`${id}-value`}
                inputMode="numeric"
                placeholder="0"
                value={value}
                onChange={e => setValue(e.target.value)}
                aria-describedby={`${id}-value-hint`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-currency`}>{t.assets.form.currencyLabel}</Label>
              <Select value={currency} onValueChange={v => setCurrency(v as AssetCurrency)}>
                <SelectTrigger id={`${id}-currency`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSET_CURRENCIES.map(code => <SelectItem key={code} value={code}>{code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p id={`${id}-value-hint`} className="text-xs text-[var(--text-secondary)]">{t.assets.form.valueHint}</p>
        </div>
      )}

      <HolderPicker members={members} value={holderIds} onChange={setHolderIds} subject="asset" />

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button type="button" variant="outline" className="h-11 w-full sm:h-10 sm:flex-1" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button type="submit" className="h-11 w-full sm:h-10 sm:flex-1" disabled={saving}>
          {saving ? t.common.saving : mode === 'create' ? t.common.create : t.common.save}
        </Button>
      </div>
    </form>
  );
}
