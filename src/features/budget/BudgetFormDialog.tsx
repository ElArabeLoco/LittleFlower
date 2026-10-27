import { useState } from 'react';
import { CreditCard, Banknote, ArrowLeftRight } from 'lucide-react';
import { useI18n } from '@/shared/i18n/useI18n';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { cn } from '@/shared/ui/cn';
import { CATEGORIES } from '@/domain/budget/categories';
import type { PaymentMode } from '@/domain/budget/Budget';
import { rangeViolation } from '@/domain/budget/budgetLifecycle';
import { useBudgetMutations, BudgetExpenseRangeError, type BackfillSummary } from '@/application/useBudgetMutations';
import { formatMonthLabel, rangeErrorMessage, type BudgetFormState, type DebtOption, type ExpenseSpan } from './types';

const defaultForm = (): BudgetFormState => ({
  name: '',
  description: '',
  category_id: 'other',
  start_month: new Date().toISOString().slice(0, 7),
  end_month: '',
  default_amount: '0',
  payment_mode: 'credit_card',
  debt_id: '',
});

interface BudgetFormDialogProps {
  mode: 'create' | 'edit';
  initial?: BudgetFormState;
  budgetId?: string;
  householdId: string;
  userId: string;
  debts: DebtOption[];
  /** Months with expenses (edit mode); the start/end fields cannot cross it. */
  expenseSpan?: ExpenseSpan | null;
  onDone: () => void;
  trigger: React.ReactNode;
}

const PAYMENT_MODES: { value: PaymentMode; icon: React.ElementType; labelKey: 'cashMethod' | 'cardMethod' | 'bothMethod' }[] = [
  { value: 'cash', icon: Banknote, labelKey: 'cashMethod' },
  { value: 'both', icon: ArrowLeftRight, labelKey: 'bothMethod' },
  { value: 'credit_card', icon: CreditCard, labelKey: 'cardMethod' },
];

const MODE_STYLES: Record<PaymentMode, { active: string; inactive: string }> = {
  cash: {
    active: 'border-green-400 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 dark:border-green-600',
    inactive: 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400',
  },
  both: {
    active: 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-600',
    inactive: 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400',
  },
  credit_card: {
    active: 'border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-600',
    inactive: 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400',
  },
};

interface BackfillPanelProps {
  summary: BackfillSummary;
  debtName: string;
  busy: boolean;
  onConfirm: () => void;
  onSkip: () => void;
  onBack: () => void;
}

/** Asks whether the budget's earlier payments should be recorded on the debt it gets linked to. */
function BackfillPanel({ summary, debtName, busy, onConfirm, onSkip, onBack }: BackfillPanelProps) {
  const { t } = useI18n();
  // Full figures whatever the number format: these become records on the debt
  const { formatNumber } = useNumberFormat();
  const formatCOP = (amount: number) => `$${formatNumber(amount)}`;
  const [y, m, d] = (summary.firstDate ?? '').split('-');
  const from = `${parseInt(d)} ${t.months.shortLower[m] ?? m} ${y}`;
  const rows = [
    { label: t.debts.colPrincipal, value: summary.principal },
    { label: t.debts.colInterest, value: summary.interest },
    ...(summary.fees > 0 ? [{ label: t.debts.splitFees, value: summary.fees }] : []),
  ];

  return (
    <section aria-labelledby="b-backfill-title"
      className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-4">
      <h3 id="b-backfill-title" className="text-sm font-semibold text-[var(--text-primary)]">{t.budgets.backfillTitle}</h3>
      <p className="text-sm text-[var(--text-secondary)]">{t.budgets.backfillBody(summary.count, debtName, from)}</p>
      <dl className="space-y-1 text-sm tabular-nums">
        {rows.map(row => (
          <div key={row.label} className="flex justify-between gap-4 text-[var(--text-secondary)]">
            <dt>{row.label}</dt>
            <dd>{formatCOP(row.value)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-[var(--border-subtle)] pt-1 font-semibold text-[var(--text-primary)]">
          <dt>{t.budgets.backfillTotal}</dt>
          <dd>{formatCOP(summary.total)}</dd>
        </div>
      </dl>
      <p className="text-[11px] text-[var(--text-muted)]">{t.budgets.backfillEstimate}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" className="flex-1" onClick={onConfirm} disabled={busy}>
          {busy ? t.common.saving : t.budgets.backfillConfirm}
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={onSkip} disabled={busy}>
          {t.budgets.backfillSkip}
        </Button>
      </div>
      <button type="button" className="text-xs text-[var(--text-muted)] hover:underline" onClick={onBack} disabled={busy}>
        {t.common.back}
      </button>
    </section>
  );
}

export function BudgetFormDialog({ mode, initial, budgetId, householdId, userId, debts, expenseSpan = null, onDone, trigger }: BudgetFormDialogProps) {
  const { t } = useI18n();
  const { insertBudget, updateBudget, previewDebtBackfill, applyDebtBackfill } = useBudgetMutations(householdId, userId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BudgetFormState>(initial ?? defaultForm());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Earlier payments found when the budget gets linked to a debt; shown before saving. */
  const [backfill, setBackfill] = useState<BackfillSummary | null>(null);

  function set<K extends keyof BudgetFormState>(key: K, value: BudgetFormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setBackfill(null);
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) setForm(initial ?? defaultForm());
    setError(null);
    setBackfill(null);
  }

  /** Parsed default amount, or null after showing the validation error. */
  function validate(): number | null {
    const amount = parseInt(form.default_amount.replace(/\D/g, ''), 10);
    if (isNaN(amount) || amount < 0) { setError(t.budgets.validationAmount); return null; }
    if (!form.name.trim()) { setError(t.budgets.validationName); return null; }
    if (form.end_month && form.end_month < form.start_month) { setError(t.budgets.validationEndMonth); return null; }
    const violation = rangeViolation(form.start_month, form.end_month || null, expenseSpan);
    if (violation) {
      const label = formatMonthLabel(violation.limit, t.months, 'short');
      setError(violation.field === 'start' ? t.budgets.rangeStartError(label) : t.budgets.rangeEndError(label));
      return null;
    }
    return amount;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amount = validate();
    if (amount === null) return;

    const linksNewDebt = mode === 'edit' && budgetId && form.debt_id && form.debt_id !== initial?.debt_id;
    if (linksNewDebt) {
      setIsLoading(true);
      try {
        const summary = await previewDebtBackfill(budgetId, form.debt_id);
        if (summary.count > 0) { setBackfill(summary); return; }
      } catch (err) {
        setError(err instanceof Error ? err.message : t.common.unexpectedError);
        return;
      } finally {
        setIsLoading(false);
      }
    }
    await save(amount, false);
  }

  function saveFromPanel(recordPayments: boolean) {
    setError(null);
    const amount = validate();
    if (amount !== null) void save(amount, recordPayments);
  }

  async function save(amount: number, recordPayments: boolean) {
    setIsLoading(true);
    try {
      if (mode === 'create') {
        await insertBudget({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          category_id: form.category_id,
          start_month: form.start_month,
          end_month: form.end_month || undefined,
          default_amount: amount,
          payment_mode: form.payment_mode,
          debt_id: form.debt_id || null,
        });
      } else if (mode === 'edit' && budgetId) {
        // Payments first: if saving the link fails, a retry finds them already recorded
        if (recordPayments && form.debt_id) await applyDebtBackfill(budgetId, form.debt_id);
        await updateBudget(budgetId, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          category_id: form.category_id,
          default_amount: amount,
          start_month: form.start_month,
          end_month: form.end_month || null,
          debt_id: form.debt_id || null,
          payment_mode: form.payment_mode,
        });
      }
      setOpen(false);
      onDone();
    } catch (err) {
      setError(err instanceof BudgetExpenseRangeError ? rangeErrorMessage(err, t) : err instanceof Error ? err.message : t.common.unexpectedError);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
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
              <Input id="b-start" type="month" value={form.start_month} max={expenseSpan?.first}
                onChange={e => set('start_month', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-end">{t.budgets.endMonth} <span className="text-gray-400 font-normal">{t.common.optional}</span></Label>
              <Input id="b-end" type="month" value={form.end_month}
                min={expenseSpan && expenseSpan.last > form.start_month ? expenseSpan.last : form.start_month}
                onChange={e => set('end_month', e.target.value)} />
              {form.end_month && (
                <button type="button" className="text-xs text-gray-400 hover:text-gray-600"
                  onClick={() => set('end_month', '')}>
                  {t.budgets.removeEndDate}
                </button>
              )}
            </div>
          </div>

          {mode === 'edit' && expenseSpan && (
            <p className="text-xs text-[var(--text-muted)]">
              {expenseSpan.first === expenseSpan.last
                ? t.budgets.hasExpensesOne(formatMonthLabel(expenseSpan.first, t.months, 'short'))
                : t.budgets.hasExpensesRange(
                    formatMonthLabel(expenseSpan.first, t.months, 'short'),
                    formatMonthLabel(expenseSpan.last, t.months, 'short'),
                  )}
            </p>
          )}

          {/* Payment mode — tri-state, visible in both create and edit */}
          <div className="space-y-1.5">
            <Label>{t.budgets.paymentMethod}</Label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_MODES.map(({ value, icon: Icon, labelKey }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set('payment_mode', value)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-2.5 text-xs font-medium transition-colors',
                    form.payment_mode === value
                      ? MODE_STYLES[value].active
                      : MODE_STYLES[value].inactive,
                  )}
                >
                  <Icon size={15} />
                  {t.budgets[labelKey]}
                </button>
              ))}
            </div>
          </div>

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

          {backfill ? (
            <BackfillPanel
              summary={backfill}
              debtName={debts.find(d => d.id === form.debt_id)?.name ?? ''}
              busy={isLoading}
              onConfirm={() => saveFromPanel(true)}
              onSkip={() => saveFromPanel(false)}
              onBack={() => setBackfill(null)}
            />
          ) : (
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? t.common.saving : mode === 'create' ? t.common.create : t.common.save}
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
