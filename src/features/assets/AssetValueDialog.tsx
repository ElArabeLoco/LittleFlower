/**
 * AssetValueDialog — record a new value of an asset (value, currency, the
 * day it was known and an optional note). The previous value stays in the
 * history.
 *
 * Controlled and presentational, like AssetFormDialog: the form lives in
 * the dialog content, so it starts fresh every time the dialog opens.
 */

import { useId, useState } from 'react';
import { ASSET_CURRENCIES, type AssetCurrency } from '@/domain/asset/Asset';
import type { AssetItem } from '@/application/useAssets';
import type { AssetValueEntry } from '@/application/useAssetMutations';
import { getToday } from '@/shared/helpers';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useI18n } from '@/shared/i18n/useI18n';
import { parseInteger, useValuationFormat } from './valuationFormat';

export interface AssetValueDialogProps {
  /** The asset whose value is updated; null = closed. */
  asset: AssetItem | null;
  onClose: () => void;
  onSubmit: (entry: AssetValueEntry) => Promise<void>;
}

export function AssetValueDialog({ asset, onClose, onSubmit }: AssetValueDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={asset !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {asset && (
          <>
            <DialogHeader>
              <DialogTitle>{t.assets.valueForm.title}</DialogTitle>
              <p className="text-base font-semibold text-[var(--text-primary)]">{asset.name}</p>
            </DialogHeader>
            <AssetValueForm
              asset={asset}
              onCancel={onClose}
              onSubmit={async entry => {
                await onSubmit(entry);
                onClose();
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface AssetValueFormProps {
  asset: AssetItem;
  onCancel: () => void;
  onSubmit: (entry: AssetValueEntry) => Promise<void>;
}

function AssetValueForm({ asset, onCancel, onSubmit }: AssetValueFormProps) {
  const { t } = useI18n();
  const { money, date } = useValuationFormat();
  const id = useId();
  const today = getToday();
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState<AssetCurrency>(asset.currency);
  const [valuedOn, setValuedOn] = useState(today);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const current = asset.history.at(-1);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseInteger(value);
    if (amount === null) { setError(t.assets.form.valueRequired); return; }
    if (!valuedOn) { setError(t.assets.valueForm.dateRequired); return; }
    if (valuedOn > today) { setError(t.assets.valueForm.futureDate); return; }

    setError(null);
    setSaving(true);
    try {
      await onSubmit({ value: amount, currency, valuedOn, note: note.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.unexpectedError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-5" noValidate>
      <div className="space-y-1 rounded-xl bg-[var(--bg-surface-2)] px-3 py-2.5 text-sm text-[var(--text-secondary)]">
        <p className="font-semibold text-[var(--text-primary)]">
          {current
            ? t.assets.valueForm.currentValue(money(current.value, current.currency), date(current.valuedOn))
            : `${t.assets.form.currentValueLabel}: ${money(asset.value, asset.currency)}`}
        </p>
        <p>{t.assets.valueForm.intro}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor={`${id}-value`}>{t.assets.valueForm.valueLabel}</Label>
          <Input
            id={`${id}-value`}
            inputMode="numeric"
            placeholder="0"
            value={value}
            onChange={e => setValue(e.target.value)}
            autoFocus
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

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-date`}>{t.assets.valueForm.dateLabel}</Label>
        <Input
          id={`${id}-date`}
          type="date"
          max={today}
          value={valuedOn}
          onChange={e => setValuedOn(e.target.value)}
          aria-describedby={`${id}-date-hint`}
        />
        <p id={`${id}-date-hint`} className="text-xs text-[var(--text-secondary)]">{t.assets.valueForm.dateHint}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-note`}>{t.assets.valueForm.noteLabel}</Label>
        <Input
          id={`${id}-note`}
          placeholder={t.assets.valueForm.notePlaceholder}
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </div>

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
          {saving ? t.common.saving : t.assets.valueForm.submit}
        </Button>
      </div>
    </form>
  );
}
