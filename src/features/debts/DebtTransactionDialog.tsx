import { useState } from 'react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { cn } from '@/shared/ui/cn';
import {
  insertDebtTransaction,
  type InsertDebtTransactionPayload,
} from '@/infrastructure/powersync/mutationWrappers';
import { todayISO } from './helpers';
import type { TransactionFormState } from './types';

interface DebtTransactionDialogProps {
  debtId: string;
  debtCurrency: string;
  householdId: string;
  userId: string;
  currentMonthRate: number | null;
  trigger: React.ReactNode;
}

export function DebtTransactionDialog({
  debtId, debtCurrency, householdId, userId, currentMonthRate, trigger,
}: DebtTransactionDialogProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TransactionFormState>({
    type: 'debit',
    amount: '',
    currency: debtCurrency,
    exchange_rate: currentMonthRate ? String(currentMonthRate) : '',
    date: todayISO(),
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof TransactionFormState>(key: K, value: TransactionFormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) {
      setForm({
        type: 'debit',
        amount: '',
        currency: debtCurrency,
        exchange_rate: currentMonthRate ? String(currentMonthRate) : '',
        date: todayISO(),
        note: '',
      });
    }
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const rawAmount = parseInt(form.amount.replace(/\D/g, ''), 10);
    if (isNaN(rawAmount) || rawAmount <= 0) { setError(t.debts.validationTxAmount); return; }

    let amountCOP = rawAmount;
    let originalAmount: number | undefined;
    let originalCurrency: string | undefined;
    let exchangeRate: number | undefined;

    if (form.currency === 'USD') {
      const rate = parseFloat(form.exchange_rate);
      if (isNaN(rate) || rate <= 0) { setError(t.debts.validationTrmRequired); return; }
      originalAmount = rawAmount;
      originalCurrency = 'USD';
      exchangeRate = rate;
      amountCOP = Math.round(rawAmount * rate);
    }

    setSaving(true);
    try {
      const payload: InsertDebtTransactionPayload = {
        household_id: householdId,
        debt_id: debtId,
        amount: amountCOP,
        original_amount: originalAmount,
        original_currency: originalCurrency,
        exchange_rate: exchangeRate,
        type: form.type,
        note: form.note.trim() || undefined,
        date: form.date,
        source: 'manual',
      };
      await insertDebtTransaction(payload, userId);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.unexpectedError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.debts.registerTransaction}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>{t.debts.typeLabel}</Label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => set('type', 'debit')}
                className={cn('rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  form.type === 'debit'
                    ? 'border-green-400 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                    : 'border-[var(--border-medium)] text-[var(--text-muted)] hover:border-[var(--border-subtle)]')}>
                {t.debts.payment}
              </button>
              <button type="button" onClick={() => set('type', 'credit')}
                className={cn('rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  form.type === 'credit'
                    ? 'border-red-400 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                    : 'border-[var(--border-medium)] text-[var(--text-muted)] hover:border-[var(--border-subtle)]')}>
                {t.debts.increase}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="tx-amount">{t.debts.amountLabel}</Label>
              <Input id="tx-amount" inputMode="numeric" placeholder="0" value={form.amount}
                onChange={e => set('amount', e.target.value)} autoFocus />
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

          {form.currency === 'USD' && (
            <div className="space-y-1.5">
              <Label htmlFor="tx-trm">{t.debts.trmLabel}</Label>
              <Input id="tx-trm" inputMode="decimal" placeholder="4200" value={form.exchange_rate}
                onChange={e => set('exchange_rate', e.target.value)} />
              {form.amount && form.exchange_rate && !isNaN(parseFloat(form.exchange_rate)) && (
                <p className="text-xs text-[var(--text-muted)]">
                  ≈ {Math.round(parseInt(form.amount.replace(/\D/g, '') || '0') * parseFloat(form.exchange_rate)).toLocaleString('es-CO')} COP
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="tx-date">{t.debts.dateLabel}</Label>
            <Input id="tx-date" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-note">{t.debts.noteLabel}</Label>
            <Input id="tx-note" placeholder={t.debts.notePlaceholder} value={form.note}
              onChange={e => set('note', e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-md px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? t.common.saving : t.common.register}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
