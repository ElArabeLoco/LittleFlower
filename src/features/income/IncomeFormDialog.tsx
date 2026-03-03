import { useState } from 'react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { cn } from '@/shared/ui/cn';
import { insertIncome, updateIncome } from '@/infrastructure/powersync/mutationWrappers';
import { getCurrentMonth } from './helpers';
import type { IncomeFormState } from './types';

const INCOME_CATEGORIES = ['Salario', 'Renta', 'Otro'] as const;
const CURRENCIES = ['COP', 'USD'] as const;

const defaultIncomeForm = (): IncomeFormState => ({
  name: '',
  category: 'Salario',
  default_amount: '0',
  currency: 'COP',
  is_fixed: true,
  start_month: getCurrentMonth(),
  end_month: '',
});

interface IncomeFormDialogProps {
  mode: 'create' | 'edit';
  initial?: IncomeFormState;
  incomeId?: string;
  householdId: string;
  userId: string;
  onDone: () => void;
  trigger: React.ReactNode;
  defaultOpen?: boolean;
}

export function IncomeFormDialog({ mode, initial, incomeId, householdId, userId, onDone, trigger, defaultOpen = false }: IncomeFormDialogProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const [form, setForm] = useState<IncomeFormState>(initial ?? defaultIncomeForm());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof IncomeFormState>(key: K, value: IncomeFormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) setForm(initial ?? defaultIncomeForm());
    else onDone();
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError(t.income.validationName); return; }
    const amount = parseInt(form.default_amount.replace(/\D/g, ''), 10);
    if (isNaN(amount) || amount < 0) { setError(t.income.validationAmount); return; }

    setIsLoading(true);
    try {
      if (mode === 'create') {
        await insertIncome({
          household_id: householdId,
          name: form.name.trim(),
          person: userId,
          is_fixed: form.is_fixed,
          category: form.category,
          default_amount: amount,
          currency: form.currency,
          start_month: form.start_month,
          end_month: form.end_month || null,
          created_by: userId,
        });
      } else if (mode === 'edit' && incomeId) {
        await updateIncome(incomeId, {
          name: form.name.trim(),
          default_amount: amount,
          currency: form.currency,
          is_fixed: form.is_fixed,
          category: form.category,
          end_month: form.end_month || null,
        });
      }
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.unexpectedError);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t.income.newIncome : t.income.editIncome}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div className="space-y-1.5">
            <Label htmlFor="inc-name">{t.income.nameLabel}</Label>
            <Input id="inc-name" placeholder={t.income.namePlaceholder} value={form.name}
              onChange={e => set('name', e.target.value)} autoFocus required />
          </div>

          <div className="space-y-1.5">
            <Label>{t.income.categoryLabel}</Label>
            <Select value={form.category} onValueChange={v => set('category', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INCOME_CATEGORIES.map(c => <SelectItem key={c} value={c}>{t.income.categories[c] ?? c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inc-amount">{t.income.defaultAmount}</Label>
              <Input id="inc-amount" inputMode="numeric" enterKeyHint="done" placeholder="0"
                value={form.default_amount} onChange={e => set('default_amount', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.income.currencyLabel}</Label>
              <Select value={form.currency} onValueChange={v => set('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {mode === 'create' && (
            <div className="space-y-1.5">
              <Label htmlFor="inc-start">{t.income.startMonth}</Label>
              <Input id="inc-start" type="month" value={form.start_month}
                onChange={e => set('start_month', e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="inc-end">{t.income.endMonth} <span className="text-gray-400 font-normal">{t.common.optional}</span></Label>
            <Input id="inc-end" type="month" value={form.end_month}
              min={form.start_month || undefined}
              onChange={e => set('end_month', e.target.value)} />
            {form.end_month && (
              <button type="button" className="text-xs text-gray-400 hover:text-gray-600"
                onClick={() => set('end_month', '')}>
                {t.income.removeEndDate}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">{t.income.typeLabel}</span>
            <button type="button" onClick={() => set('is_fixed', true)}
              className={cn('px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                form.is_fixed ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-200 text-gray-400 hover:border-gray-300'
              )}>{t.income.fixed}</button>
            <button type="button" onClick={() => set('is_fixed', false)}
              className={cn('px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                !form.is_fixed ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-400 hover:border-gray-300'
              )}>{t.income.variable}</button>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? t.common.saving : mode === 'create' ? t.common.create : t.common.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
