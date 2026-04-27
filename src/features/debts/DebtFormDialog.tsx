import { useState } from 'react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useDebtMutations, type InsertDebtPayload } from '@/application/useDebtMutations';
import { todayISO } from './helpers';
import type { DebtFormState } from './types';

const defaultDebtForm = (): DebtFormState => ({
  name: '',
  description: '',
  initial_amount: '',
  currency: 'COP',
  disbursed_at: todayISO(),
});

interface DebtFormDialogProps {
  mode: 'create' | 'edit';
  debtId?: string;
  initial?: DebtFormState;
  householdId: string;
  userId: string;
  onDone: () => void;
  trigger: React.ReactNode;
}

export function DebtFormDialog({ mode, debtId, initial, householdId, userId, onDone, trigger }: DebtFormDialogProps) {
  const { t } = useI18n();
  const { insertDebt, updateDebt } = useDebtMutations(householdId, userId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<DebtFormState>(initial ?? defaultDebtForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof DebtFormState>(key: K, value: DebtFormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) setForm(initial ?? defaultDebtForm());
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amount = parseInt(form.initial_amount.replace(/\D/g, ''), 10);
    if (isNaN(amount) || amount <= 0) { setError(t.debts.validationAmount); return; }
    if (!form.name.trim()) { setError(t.debts.validationName); return; }
    if (!form.disbursed_at) { setError(t.debts.validationDate); return; }

    setSaving(true);
    try {
      if (mode === 'create') {
        const payload: Omit<InsertDebtPayload, 'household_id' | 'created_by'> = {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          initial_amount: amount,
          currency: form.currency,
          disbursed_at: form.disbursed_at,
        };
        await insertDebt(payload);
      } else if (mode === 'edit' && debtId) {
        await updateDebt(debtId, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          initial_amount: amount,
          currency: form.currency,
          disbursed_at: form.disbursed_at,
        });
      }
      setOpen(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.unexpectedError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t.debts.newDebt : t.debts.editDebt}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="d-name">{t.debts.nameLabel}</Label>
            <Input id="d-name" placeholder={t.debts.namePlaceholder} value={form.name}
              onChange={e => set('name', e.target.value)} autoFocus required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="d-desc">{t.debts.descriptionLabel}</Label>
            <Input id="d-desc" placeholder={t.debts.descriptionPlaceholder} value={form.description}
              onChange={e => set('description', e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="d-amount">{t.debts.originalAmount}</Label>
              <Input id="d-amount" inputMode="numeric" placeholder="0" value={form.initial_amount}
                onChange={e => set('initial_amount', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.debts.currencyLabel}</Label>
              <Select value={form.currency} onValueChange={v => set('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COP">COP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="d-date">{t.debts.disbursedAt}</Label>
            <Input id="d-date" type="date" value={form.disbursed_at}
              onChange={e => set('disbursed_at', e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-md px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? t.common.saving : mode === 'create' ? t.common.create : t.common.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
