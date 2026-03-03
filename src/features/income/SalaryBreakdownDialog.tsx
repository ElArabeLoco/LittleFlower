import { useState } from 'react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { cn } from '@/shared/ui/cn';
import { upsertIncomeMonth } from '@/infrastructure/powersync/mutationWrappers';
import { computeSalaryTotal } from './helpers';
import type { IncomeRow, IncomeMonthRow } from './types';

const CURRENCIES = ['COP', 'USD'] as const;

interface SalaryBreakdownDialogProps {
  open: boolean;
  onClose: () => void;
  income: IncomeRow;
  incomeMonth: IncomeMonthRow | null;
  month: string;
  householdId: string;
  userId: string;
  trm: number | null;
}

export function SalaryBreakdownDialog({
  open, onClose, income, incomeMonth, month, householdId, userId, trm,
}: SalaryBreakdownDialogProps) {
  const { t } = useI18n();
  const { formatCOP, formatNumber } = useNumberFormat();
  const [currency, setCurrency] = useState<string>('COP');
  const [baseSalary, setBaseSalary] = useState('');
  const [deductions, setDeductions] = useState('');
  const [extraDays, setExtraDays] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUSD = currency === 'USD';

  const fmtMonth = (m: string) => {
    const [y, mo] = m.split('-');
    return `${t.months.full[mo] ?? mo} ${y}`;
  };

  function handleOpenChange(v: boolean) {
    if (v) {
      const initCurrency = incomeMonth?.currency ?? income.currency;
      setCurrency(initCurrency);
      setBaseSalary(String(incomeMonth?.base_salary ?? income.default_amount));
      setDeductions(String(incomeMonth?.deductions ?? 0));
      setExtraDays(String(incomeMonth?.extra_days ?? 0));
      setError(null);
    } else {
      onClose();
    }
  }

  const parsedBase = parseInt(baseSalary.replace(/\D/g, ''), 10) || 0;
  const parsedDed = parseInt(deductions.replace(/\D/g, ''), 10) || 0;
  const parsedExtra = parseInt(extraDays.replace(/\D/g, ''), 10) || 0;
  const total = computeSalaryTotal(parsedBase, parsedDed, parsedExtra);
  const extraDaysAmount = Math.round(parsedExtra * parsedBase * 12 / 260);
  const totalCOP = isUSD && trm ? Math.round(total * trm) : null;

  function fmtNative(amount: number): string {
    return isUSD ? formatNumber(amount) : formatCOP(amount);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (parsedBase <= 0) { setError(t.income.validationBaseSalary); return; }
    if (isUSD && !trm) { setError(t.income.validationTrmRequired); return; }
    setSaving(true);
    setError(null);
    try {
      await upsertIncomeMonth({
        id: incomeMonth?.id,
        household_id: householdId,
        income_id: income.id,
        month,
        real_amount: total,
        currency,
        base_salary: parsedBase,
        deductions: parsedDed,
        extra_days: parsedExtra,
      }, userId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.unexpectedError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.income.salaryBreakdown(income.name)}</DialogTitle>
          <p className="text-xs text-gray-400 mt-0.5">{fmtMonth(month)}</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div className="space-y-1.5">
            <Label>{t.income.currencyLabel}</Label>
            <div className="flex gap-2">
              {CURRENCIES.map(c => (
                <button key={c} type="button" onClick={() => setCurrency(c)}
                  className={cn('px-4 py-1.5 rounded-lg border text-xs font-semibold transition-colors',
                    currency === c
                      ? 'border-violet-400 bg-violet-50 text-violet-700'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300')}>
                  {c}
                </button>
              ))}
            </div>
            {isUSD && !trm && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {t.income.noTrmForMonth(fmtMonth(month))}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sb-base">{t.income.baseSalary}</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-violet-500 shrink-0 w-8 text-right">{currency}</span>
              <Input id="sb-base" inputMode="numeric" placeholder="0" value={baseSalary}
                onChange={e => setBaseSalary(e.target.value)} autoFocus />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sb-ded">{t.income.deductions}</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-red-400 shrink-0 w-8 text-right">−{currency}</span>
              <Input id="sb-ded" inputMode="numeric" placeholder="0" value={deductions}
                onChange={e => setDeductions(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sb-extra">{t.income.extraDays}</Label>
            <div className="flex items-center gap-2">
              <Input id="sb-extra" inputMode="numeric" placeholder="0" value={extraDays}
                onChange={e => setExtraDays(e.target.value)} className="w-24" />
              <span className="text-xs text-gray-400">
                {parsedExtra > 0 ? `= +${currency} ${fmtNative(extraDaysAmount)}` : t.income.extraDaysFormula}
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-pink-50 border border-pink-200 px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-pink-700">{t.income.monthTotal}</span>
              <span className="text-lg font-bold text-pink-900 tabular-nums">
                {isUSD && <span className="text-sm font-medium text-violet-500 mr-1">USD</span>}
                {fmtNative(total)}
              </span>
            </div>
            {isUSD && (
              totalCOP !== null ? (
                <p className="text-xs text-right text-gray-500">
                  ≈ <span className="font-semibold text-gray-700">{formatCOP(totalCOP)}</span>
                </p>
              ) : (
                <p className="text-xs text-right text-amber-500">{t.income.noTrmConversion}</p>
              )
            )}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>{t.common.cancel}</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? t.common.saving : t.common.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
