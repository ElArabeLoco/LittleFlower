/**
 * ExpenseFormDialog
 *
 * Modal con dos secciones:
 *   1. Lista de gastos registrados para este rubro × mes (con opción de eliminar)
 *   2. Formulario para registrar un nuevo gasto
 *
 * Se abre desde cualquier BudgetCell, usando el mes de esa celda.
 */

import { useState, useRef } from 'react';
import { Receipt, Plus, Trash2, X, Zap } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { cn } from '@/shared/ui/cn';
import {
  upsertBudgetMonth,
  recordExpense,
  softDeleteExpense,
  updateBudgetMonthExecution,
} from '@/infrastructure/powersync/mutationWrappers';
import { useQuery } from '@powersync/react';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { useI18n } from '@/shared/i18n/I18nContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExpenseRow {
  id: string;
  amount: number;
  note: string | null;
  timestamp: string;
}

export interface ExpenseFormDialogProps {
  budgetId: string;
  budgetName: string;
  budgetMonthId: string | null;
  budgetMonthAmount: number;
  month: string; // 'YYYY-MM'
  householdId: string;
  userId: string;
  /** If set, expenses on this budget auto-create a debit transaction on this debt */
  debtId?: string | null;
  trigger: React.ReactNode;
  defaultOpen?: boolean;   // open immediately (controlled from parent)
  onClose?: () => void;    // called when dialog closes (controlled mode)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// ExpenseFormDialog
// ---------------------------------------------------------------------------

export function ExpenseFormDialog({
  budgetId,
  budgetName,
  budgetMonthId: initialBudgetMonthId,
  budgetMonthAmount,
  month,
  householdId,
  userId,
  debtId,
  trigger,
  defaultOpen = false,
  onClose,
}: ExpenseFormDialogProps) {
  const { formatCOP } = useNumberFormat();
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);

  // Form state
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set to true when the user submits with Ctrl+Enter — keeps modal open after save
  const keepOpenRef = useRef(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Track the budgetMonthId — may be created on first expense
  const [resolvedBmId, setResolvedBmId] = useState<string | null>(initialBudgetMonthId);

  // Reactive expense list for this budget_month
  const { data: expenses = [] } = useQuery<ExpenseRow>(
    resolvedBmId
      ? `SELECT id, amount, note, timestamp
         FROM expenses
         WHERE budget_month_id = ? AND deleted_at IS NULL
         ORDER BY timestamp DESC, created_at DESC`
      : `SELECT id, amount, note, timestamp FROM expenses WHERE 1=0`,
    resolvedBmId ? [resolvedBmId] : [],
  );

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = budgetMonthAmount - totalSpent;
  const pct = budgetMonthAmount > 0
    ? Math.min(100, Math.round((totalSpent / budgetMonthAmount) * 100))
    : 0;
  const overBudget = totalSpent > budgetMonthAmount;

  const fmtMonth = (m: string) => {
    const [y, mo] = m.split('-');
    return `${t.months.short[mo] ?? mo} ${y}`;
  };

  const fmtDate = (iso: string) => {
    const [, m, d] = iso.split('T')[0].split('-');
    return `${parseInt(d)} ${t.months.shortLower[m] ?? m}`;
  };

  function resetForm() {
    setAmount('');
    setDate(todayISO());
    setNote('');
    setError(null);
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) {
      resetForm();
      setResolvedBmId(initialBudgetMonthId);
    } else {
      onClose?.();
    }
  }

  // Core save logic — shared by form submit and quick-pay button
  // Returns the resolved budgetMonthId (created on-demand if needed)
  async function saveExpense(expenseAmount: number, expenseDate: string, expenseNote: string): Promise<string> {
    let bmId = resolvedBmId;
    if (!bmId) {
      bmId = await upsertBudgetMonth(
        { household_id: householdId, budget_id: budgetId, month, amount: budgetMonthAmount, is_executed: false },
        userId,
      );
      setResolvedBmId(bmId);
    }
    await recordExpense({
      household_id: householdId,
      budget_id: budgetId,
      budget_month_id: bmId,
      amount: expenseAmount,
      note: expenseNote || undefined,
      recorded_by: userId,
      timestamp: new Date(expenseDate + 'T12:00:00').toISOString(),
      debt_id: debtId ?? undefined,
    });
    return bmId;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parseInt(amount.replace(/\D/g, ''), 10);
    if (isNaN(parsed) || parsed <= 0) {
      setError(t.expenses.validationAmount);
      return;
    }
    const shouldKeepOpen = keepOpenRef.current;
    keepOpenRef.current = false;
    setSaving(true);
    try {
      await saveExpense(parsed, date, note.trim());
      resetForm();
      if (!shouldKeepOpen) {
        handleOpenChange(false);
      } else {
        // Re-focus amount field for the next entry
        setTimeout(() => amountInputRef.current?.focus(), 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.unexpectedError);
    } finally {
      setSaving(false);
    }
  }

  const [quickPaying, setQuickPaying] = useState(false);
  const pendingAmount = budgetMonthAmount - totalSpent;

  async function handleQuickPay() {
    if (pendingAmount <= 0) return;
    setQuickPaying(true);
    try {
      const bmId = await saveExpense(pendingAmount, todayISO(), '');
      await updateBudgetMonthExecution(bmId, true, userId);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.unexpectedError);
    } finally {
      setQuickPaying(false);
    }
  }

  async function handleDelete(expenseId: string) {
    await softDeleteExpense(expenseId);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="max-w-2xl p-0 gap-0">

        {/* ── Header ── */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[var(--border-subtle)] shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Receipt size={16} className="text-[var(--text-brand)] shrink-0" />
            <span className="truncate">{budgetName}</span>
            <span className="text-xs font-normal text-[var(--text-muted)] shrink-0">· {fmtMonth(month)}</span>
          </DialogTitle>
        </DialogHeader>

        {/* ── Summary bar ── */}
        <div className="px-5 py-3 bg-[var(--group-totals-bg)] border-b border-[var(--border-subtle)] shrink-0">
          <div className="grid grid-cols-3 gap-3 text-center text-xs mb-2">
            <div>
              <p className="text-[var(--text-muted)] mb-0.5">{t.expenses.budgetLabel}</p>
              <p className="font-semibold text-[var(--text-secondary)]">{formatCOP(budgetMonthAmount)}</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)] mb-0.5">{t.expenses.spentLabel}</p>
              <p className={cn('font-semibold', overBudget ? 'text-red-500 dark:text-red-400' : 'text-violet-600 dark:text-violet-400')}>
                {formatCOP(totalSpent)}
              </p>
            </div>
            <div>
              <p className="text-[var(--text-muted)] mb-0.5">{t.expenses.remainingLabel}</p>
              <p className={cn('font-semibold', remaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400')}>
                {formatCOP(remaining)}
              </p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--border-medium)] overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', overBudget ? 'bg-red-400' : 'bg-violet-400')}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* ── Two-column body ── */}
        <div className="flex flex-col sm:flex-row min-h-0">

          {/* Left: expense list — scrollable */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 border-b sm:border-b-0 sm:border-r border-[var(--border-subtle)]">
            <p className="px-5 pt-4 pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide shrink-0">
              {t.expenses.recordedExpenses}
            </p>

            <div className="overflow-y-auto overflow-x-hidden px-5 pb-4" style={{ maxHeight: '280px' }}>
              {expenses.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  <p className="text-2xl mb-1">🧾</p>
                  <p className="text-xs">{t.expenses.noExpensesThisMonth}</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)] overflow-hidden">
                  {expenses.map(exp => (
                    <div
                      key={exp.id}
                      className="flex items-center gap-2 px-3 py-2.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] group transition-colors min-w-0"
                    >
                      <span className="shrink-0 text-[11px] text-[var(--text-muted)] w-11 text-center bg-[var(--bg-surface-2)] rounded px-1 py-0.5">
                        {fmtDate(exp.timestamp)}
                      </span>
                      <span className="font-semibold text-sm text-[var(--text-primary)] tabular-nums shrink-0">
                        {formatCOP(exp.amount)}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] flex-1 truncate">
                        {exp.note ?? ''}
                      </span>
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                        title={t.expenses.deleteExpense}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: form — fixed, never scrolls */}
          <div className="w-full sm:w-72 shrink-0 flex flex-col">
            <form
              onSubmit={handleSubmit}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  e.preventDefault();
                  keepOpenRef.current = true;
                  e.currentTarget.requestSubmit();
                }
              }}
              className="flex flex-col gap-3 px-5 pt-4 pb-5 h-full"
            >

              {/* Quick-pay button */}
              {pendingAmount > 0 && (
                <button
                  type="button"
                  onClick={handleQuickPay}
                  disabled={quickPaying}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border-2 transition-all text-left cursor-pointer',
                    'border-violet-300 bg-violet-50 hover:bg-violet-100 hover:border-violet-400',
                    'dark:border-violet-700 dark:bg-violet-950/40 dark:hover:bg-violet-900/50 dark:hover:border-violet-600',
                    quickPaying && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold text-violet-800 dark:text-violet-300 leading-tight">
                      {quickPaying ? t.common.registering : t.expenses.quickPayFull}
                    </p>
                    <p className="text-xs text-violet-500 dark:text-violet-400 mt-0.5">
                      {formatCOP(pendingAmount)} · {t.expenses.today}
                    </p>
                  </div>
                  <Zap size={16} className="text-violet-400 shrink-0" />
                </button>
              )}

              <div className="h-px bg-[var(--border-subtle)]" />

              {/* Amount + date */}
              <div className="space-y-1.5">
                <Label htmlFor="exp-amount">{t.expenses.amountLabel}</Label>
                <Input
                  ref={amountInputRef}
                  id="exp-amount"
                  inputMode="numeric"
                  placeholder="0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="exp-date">{t.expenses.dateLabel}</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="exp-note">{t.expenses.noteLabel}</Label>
                <Input
                  id="exp-note"
                  placeholder={t.expenses.notePlaceholder}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-md px-3 py-2">{error}</p>
              )}

              {/* Push buttons to bottom */}
              <div className="flex gap-2 mt-auto pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleOpenChange(false)}
                >
                  <X size={13} className="mr-1" />
                  {t.expenses.closeButton}
                </Button>
                <Button type="submit" size="sm" className="flex-1 gap-1 flex-col h-auto py-1.5" disabled={saving}>
                  <span className="flex items-center gap-1">
                    <Plus size={13} />
                    {saving ? '...' : t.expenses.submitButton}
                  </span>
                  <span className="text-[9px] font-normal opacity-60 leading-none">
                    {t.expenses.ctrlEnterHint}
                  </span>
                </Button>
              </div>
            </form>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
