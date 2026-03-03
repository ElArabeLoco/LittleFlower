import { useState } from 'react';
import { CreditCard, Banknote } from 'lucide-react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { cn } from '@/shared/ui/cn';
import { CATEGORIES } from '@/domain/budget/categories';
import { insertBudget, updateBudget } from '@/infrastructure/powersync/mutationWrappers';
import type { BudgetFormState, DebtOption } from './types';

const defaultForm = (): BudgetFormState => ({
  name: '',
  description: '',
  category_id: 'other',
  start_month: new Date().toISOString().slice(0, 7),
  end_month: '',
  default_amount: '0',
  paid_with_credit_card: false,
  debt_id: '',
});

interface BudgetFormDialogProps {
  mode: 'create' | 'edit';
  initial?: BudgetFormState;
  budgetId?: string;
  householdId: string;
  userId: string;
  debts: DebtOption[];
  onDone: () => void;
  trigger: React.ReactNode;
}

export function BudgetFormDialog({ mode, initial, budgetId, householdId, userId, debts, onDone, trigger }: BudgetFormDialogProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BudgetFormState>(initial ?? defaultForm());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof BudgetFormState>(key: K, value: BudgetFormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) setForm(initial ?? defaultForm());
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amount = parseInt(form.default_amount.replace(/\D/g, ''), 10);
    if (isNaN(amount) || amount < 0) { setError(t.budgets.validationAmount); return; }
    if (!form.name.trim()) { setError(t.budgets.validationName); return; }
    if (form.end_month && form.end_month < form.start_month) { setError(t.budgets.validationEndMonth); return; }

    setIsLoading(true);
    try {
      if (mode === 'create') {
        await insertBudget({
          household_id: householdId,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          category_id: form.category_id,
          start_month: form.start_month,
          end_month: form.end_month || undefined,
          default_amount: amount,
          paid_with_credit_card: form.paid_with_credit_card,
          debt_id: form.debt_id || null,
          created_by: userId,
        }, userId);
      } else if (mode === 'edit' && budgetId) {
        await updateBudget(budgetId, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          category_id: form.category_id,
          default_amount: amount,
          end_month: form.end_month || null,
          debt_id: form.debt_id || null,
        }, userId);
      }
      setOpen(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.unexpectedError);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t.budgets.newBudget : t.budgets.editBudget}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="b-name">{t.budgets.nameLabel}</Label>
            <Input id="b-name" placeholder={t.budgets.namePlaceholder} value={form.name}
              onChange={e => set('name', e.target.value)} autoFocus required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="b-desc">{t.budgets.descriptionLabel}</Label>
            <Input id="b-desc" placeholder={t.budgets.descriptionPlaceholder} value={form.description}
              onChange={e => set('description', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>{t.budgets.categoryLabel}</Label>
            <Select value={form.category_id} onValueChange={v => set('category_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder={t.budgets.categoryPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <span className="flex items-center gap-2">
                      <span>{cat.emoji}</span>
                      <span>{cat.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="b-amount">{t.budgets.amountLabel}</Label>
            <Input id="b-amount" inputMode="numeric" placeholder="0" value={form.default_amount}
              onChange={e => set('default_amount', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-start">{t.budgets.startMonth}</Label>
              <Input id="b-start" type="month" value={form.start_month}
                onChange={e => set('start_month', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-end">{t.budgets.endMonth} <span className="text-gray-400 font-normal">{t.common.optional}</span></Label>
              <Input id="b-end" type="month" value={form.end_month} min={form.start_month}
                onChange={e => set('end_month', e.target.value)} />
              {form.end_month && (
                <button type="button" className="text-xs text-gray-400 hover:text-gray-600"
                  onClick={() => set('end_month', '')}>
                  {t.budgets.removeEndDate}
                </button>
              )}
            </div>
          </div>

          {mode === 'create' && (
            <div className="space-y-1.5">
              <Label>{t.budgets.paymentMethod}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => set('paid_with_credit_card', false)}
                  className={cn('flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors',
                    !form.paid_with_credit_card
                      ? 'border-green-400 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300')}>
                  <Banknote size={16} /> {t.budgets.cashMethod}
                </button>
                <button type="button" onClick={() => set('paid_with_credit_card', true)}
                  className={cn('flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors',
                    form.paid_with_credit_card
                      ? 'border-violet-400 bg-violet-50 text-violet-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300')}>
                  <CreditCard size={16} /> {t.budgets.cardMethod}
                </button>
              </div>
            </div>
          )}

          {(form.category_id === 'debt' || form.debt_id) && debts.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t.budgets.linkDebt}</Label>
              <Select value={form.debt_id || '__none__'} onValueChange={v => set('debt_id', v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t.budgets.noLink} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t.budgets.noLink}</SelectItem>
                  {debts.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-[var(--text-muted)]">{t.budgets.debtLinkHint}</p>
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? t.common.saving : mode === 'create' ? t.common.create : t.common.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
