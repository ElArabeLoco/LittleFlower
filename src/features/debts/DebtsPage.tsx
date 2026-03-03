/**
 * DebtsPage — /finances/debts
 *
 * Registra y hace seguimiento de deudas (pasivos).
 *
 * Cada deuda muestra:
 *   - Monto original + moneda
 *   - Saldo actual (initial + credits - debits)
 *   - Barra de progreso de cuánto se ha pagado
 *   - Lista de transacciones (colapsable)
 *
 * Transacciones:
 *   - Manual: ingresada directamente aquí
 *   - Desde gasto: auto-creada al registrar un gasto en un presupuesto vinculado
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@powersync/react';
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronUp, Link2, X,
} from 'lucide-react';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { cn } from '@/shared/ui/cn';
import { useAuth } from '@/features/auth/AuthContext';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { useI18n } from '@/shared/i18n/I18nContext';
import { computeDebtBalance } from '@/domain/debt/Debt';
import {
  insertDebt,
  updateDebt,
  softDeleteDebt,
  insertDebtTransaction,
  softDeleteDebtTransaction,
  type InsertDebtPayload,
  type InsertDebtTransactionPayload,
} from '@/infrastructure/powersync/mutationWrappers';

// ---------------------------------------------------------------------------
// Raw row types (snake_case from SQLite)
// ---------------------------------------------------------------------------

interface DebtRow {
  id: string;
  name: string;
  description: string | null;
  initial_amount: number;
  currency: string;
  disbursed_at: string;
}

interface DebtTransactionRow {
  id: string;
  debt_id: string;
  amount: number;
  original_amount: number | null;
  original_currency: string | null;
  exchange_rate: number | null;
  type: string;
  note: string | null;
  date: string;
  source: string;
  expense_id: string | null;
}

interface ExchangeRateRow {
  month: string;
  rate: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(d: string, monthLabels: Record<string, string>): string {
  const [, m, day] = d.split('-');
  const mm = m.padStart(2, '0');
  return `${parseInt(day)} ${monthLabels[mm] ?? m}`;
}

// ---------------------------------------------------------------------------
// DebtFormDialog — create or edit a debt
// ---------------------------------------------------------------------------

interface DebtFormState {
  name: string;
  description: string;
  initial_amount: string;
  currency: string;
  disbursed_at: string;
}

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

function DebtFormDialog({ mode, debtId, initial, householdId, userId, onDone, trigger }: DebtFormDialogProps) {
  const { t } = useI18n();
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
    if (isNaN(amount) || amount <= 0) {
      setError(t.debts.validationAmount);
      return;
    }
    if (!form.name.trim()) {
      setError(t.debts.validationName);
      return;
    }
    if (!form.disbursed_at) {
      setError(t.debts.validationDate);
      return;
    }

    setSaving(true);
    try {
      if (mode === 'create') {
        const payload: InsertDebtPayload = {
          household_id: householdId,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          initial_amount: amount,
          currency: form.currency,
          disbursed_at: form.disbursed_at,
          created_by: userId,
        };
        await insertDebt(payload, userId);
      } else if (mode === 'edit' && debtId) {
        await updateDebt(debtId, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          initial_amount: amount,
          currency: form.currency,
          disbursed_at: form.disbursed_at,
        }, userId);
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t.debts.newDebt : t.debts.editDebt}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="d-name">{t.debts.nameLabel}</Label>
            <Input
              id="d-name"
              placeholder={t.debts.namePlaceholder}
              value={form.name}
              onChange={e => set('name', e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="d-desc">{t.debts.descriptionLabel}</Label>
            <Input
              id="d-desc"
              placeholder={t.debts.descriptionPlaceholder}
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          {/* Amount + currency side by side */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="d-amount">{t.debts.originalAmount}</Label>
              <Input
                id="d-amount"
                inputMode="numeric"
                enterKeyHint="done"
                placeholder="0"
                value={form.initial_amount}
                onChange={e => set('initial_amount', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.debts.currencyLabel}</Label>
              <Select value={form.currency} onValueChange={v => set('currency', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COP">COP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="d-date">{t.debts.disbursedAt}</Label>
            <Input
              id="d-date"
              type="date"
              value={form.disbursed_at}
              onChange={e => set('disbursed_at', e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-md px-3 py-2">{error}</p>
          )}

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

// ---------------------------------------------------------------------------
// DebtTransactionDialog — add a manual transaction
// ---------------------------------------------------------------------------

interface TransactionFormState {
  type: 'debit' | 'credit';
  amount: string;
  currency: string;
  exchange_rate: string;
  date: string;
  note: string;
}

interface DebtTransactionDialogProps {
  debtId: string;
  debtCurrency: string;
  householdId: string;
  userId: string;
  currentMonthRate: number | null;
  trigger: React.ReactNode;
}

function DebtTransactionDialog({
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
    if (isNaN(rawAmount) || rawAmount <= 0) {
      setError(t.debts.validationTxAmount);
      return;
    }

    let amountCOP = rawAmount;
    let originalAmount: number | undefined;
    let originalCurrency: string | undefined;
    let exchangeRate: number | undefined;

    if (form.currency === 'USD') {
      const rate = parseFloat(form.exchange_rate);
      if (isNaN(rate) || rate <= 0) {
        setError(t.debts.validationTrmRequired);
        return;
      }
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
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.debts.registerTransaction}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Type selector */}
          <div className="space-y-1.5">
            <Label>{t.debts.typeLabel}</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => set('type', 'debit')}
                className={cn(
                  'rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  form.type === 'debit'
                    ? 'border-green-400 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                    : 'border-[var(--border-medium)] text-[var(--text-muted)] hover:border-[var(--border-subtle)]',
                )}
              >
                {t.debts.payment}
              </button>
              <button
                type="button"
                onClick={() => set('type', 'credit')}
                className={cn(
                  'rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  form.type === 'credit'
                    ? 'border-red-400 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                    : 'border-[var(--border-medium)] text-[var(--text-muted)] hover:border-[var(--border-subtle)]',
                )}
              >
                {t.debts.increase}
              </button>
            </div>
          </div>

          {/* Amount + currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="tx-amount">{t.debts.amountLabel}</Label>
              <Input
                id="tx-amount"
                inputMode="numeric"
                enterKeyHint="done"
                placeholder="0"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.debts.currencyLabel}</Label>
              <Select value={form.currency} onValueChange={v => set('currency', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COP">COP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* TRM — only when USD selected */}
          {form.currency === 'USD' && (
            <div className="space-y-1.5">
              <Label htmlFor="tx-trm">{t.debts.trmLabel}</Label>
              <Input
                id="tx-trm"
                inputMode="decimal"
                enterKeyHint="done"
                placeholder="4200"
                value={form.exchange_rate}
                onChange={e => set('exchange_rate', e.target.value)}
              />
              {form.amount && form.exchange_rate && !isNaN(parseFloat(form.exchange_rate)) && (
                <p className="text-xs text-[var(--text-muted)]">
                  ≈ {Math.round(parseInt(form.amount.replace(/\D/g, '') || '0') * parseFloat(form.exchange_rate)).toLocaleString('es-CO')} COP
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="tx-date">{t.debts.dateLabel}</Label>
            <Input
              id="tx-date"
              type="date"
              value={form.date}
              onChange={e => set('date', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-note">{t.debts.noteLabel}</Label>
            <Input
              id="tx-note"
              placeholder={t.debts.notePlaceholder}
              value={form.note}
              onChange={e => set('note', e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 rounded-md px-3 py-2">{error}</p>
          )}

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

// ---------------------------------------------------------------------------
// DebtCard — single debt with collapsible transactions
// ---------------------------------------------------------------------------

interface DebtCardProps {
  debt: DebtRow;
  transactions: DebtTransactionRow[];
  householdId: string;
  userId: string;
  currentMonthRate: number | null;
  formatCOP: (v: number) => string;
  onDelete: (id: string, name: string) => void;
}

function DebtCard({ debt, transactions, householdId, userId, currentMonthRate, formatCOP, onDelete }: DebtCardProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  // Compute initial amount in COP (convert if USD)
  const initialAmountCOP = useMemo(() => {
    if (debt.currency === 'COP') return debt.initial_amount;
    // Find the first credit transaction to get the exchange rate, or use current rate
    const firstCredit = transactions.find(tx => tx.source === 'expense' || tx.original_currency === 'USD');
    const rate = firstCredit?.exchange_rate ?? currentMonthRate ?? 0;
    return Math.round(debt.initial_amount * rate);
  }, [debt, transactions, currentMonthRate]);

  const balance = useMemo(() =>
    computeDebtBalance(initialAmountCOP, transactions.map(tx => ({ type: tx.type as 'debit' | 'credit', amount: tx.amount }))),
    [initialAmountCOP, transactions],
  );

  // Base = todo lo que se ha debido (inicial + aumentos)
  // Pagado = suma de abonos
  const { totalBase, totalPaid } = useMemo(() => {
    const credits = transactions.filter(tx => tx.type === 'credit').reduce((s, tx) => s + tx.amount, 0);
    const debits  = transactions.filter(tx => tx.type === 'debit').reduce((s, tx) => s + tx.amount, 0);
    return { totalBase: initialAmountCOP + credits, totalPaid: debits };
  }, [initialAmountCOP, transactions]);

  const pctPaid = totalBase > 0 ? Math.min(100, Math.max(0, Math.round((totalPaid / totalBase) * 100))) : 0;
  const isFullyPaid = balance <= 0;

  return (
    <div className={cn(
      'bg-[var(--bg-surface)] rounded-2xl border shadow-sm overflow-hidden transition-all',
      isFullyPaid ? 'border-green-200 dark:border-green-900/40' : 'border-[var(--border-subtle)]',
    )}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">{debt.name}</h3>
              <span className={cn(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                isFullyPaid
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                  : 'bg-[var(--bg-surface-2)] text-[var(--text-muted)]',
              )}>
                {debt.currency}
              </span>
              {isFullyPaid && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                  {t.debts.paidOff}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {t.debts.since(formatDate(debt.disbursed_at, t.months.shortLower))}
              {debt.description && ` · ${debt.description}`}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <DebtFormDialog
              mode="edit"
              debtId={debt.id}
              householdId={householdId}
              userId={userId}
              initial={{
                name: debt.name,
                description: debt.description ?? '',
                initial_amount: String(debt.initial_amount),
                currency: debt.currency,
                disbursed_at: debt.disbursed_at,
              }}
              onDone={() => {}}
              trigger={
                <Button variant="ghost" size="icon" className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <Pencil size={13} />
                </Button>
              }
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[var(--text-muted)] hover:text-red-500"
              onClick={() => onDelete(debt.id, debt.name)}
            >
              <Trash2 size={13} />
            </Button>
          </div>
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
          <div>
            <p className="text-[var(--text-muted)] mb-0.5">{t.debts.originalLabel}</p>
            <p className="font-semibold text-[var(--text-secondary)]">
              {debt.currency === 'COP'
                ? formatCOP(debt.initial_amount)
                : `${debt.initial_amount.toLocaleString('es-CO')} ${debt.currency}`}
            </p>
          </div>
          <div>
            <p className="text-[var(--text-muted)] mb-0.5">{t.debts.pendingBalance}</p>
            <p className={cn(
              'font-bold text-sm',
              isFullyPaid ? 'text-green-600 dark:text-green-400' : 'text-[var(--text-primary)]',
            )}>
              {formatCOP(Math.max(0, balance))}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
            <span>{t.debts.pctPaid(pctPaid)}</span>
            <span>{t.debts.paidOf(formatCOP(totalPaid), formatCOP(totalBase))}</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--border-medium)] overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                isFullyPaid ? 'bg-green-400' : 'bg-gradient-to-r from-pink-400 to-violet-400',
              )}
              style={{ width: `${pctPaid}%` }}
            />
          </div>
        </div>
      </div>

      {/* Transactions toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-2)] hover:bg-[var(--bg-hover)] transition-colors text-xs text-[var(--text-muted)]"
      >
        <span>{t.debts.transactions(transactions.length)}</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Transaction list */}
      {expanded && (
        <div className="border-t border-[var(--border-subtle)]">
          {/* Add transaction button */}
          <div className="px-4 py-2 border-b border-[var(--border-subtle)]">
            <DebtTransactionDialog
              debtId={debt.id}
              debtCurrency={debt.currency}
              householdId={householdId}
              userId={userId}
              currentMonthRate={currentMonthRate}
              trigger={
                <Button variant="outline" size="sm" className="w-full gap-1.5 h-8 text-xs">
                  <Plus size={12} /> {t.debts.addTransaction}
                </Button>
              }
            />
          </div>

          {transactions.length === 0 ? (
            <p className="text-center text-xs text-[var(--text-muted)] py-6">{t.debts.noTransactions}</p>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {transactions.map(tx => (
                <div
                  key={tx.id}
                  className="flex items-center gap-2 px-4 py-2.5 hover:bg-[var(--bg-hover)] group transition-colors"
                >
                  {/* Type indicator */}
                  <span className={cn(
                    'shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold',
                    tx.type === 'debit'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
                  )}>
                    {tx.type === 'debit' ? '↓' : '↑'}
                  </span>

                  {/* Date */}
                  <span className="shrink-0 text-[11px] text-[var(--text-muted)] w-12">
                    {formatDate(tx.date, t.months.shortLower)}
                  </span>

                  {/* Amount */}
                  <span className={cn(
                    'font-semibold text-xs tabular-nums shrink-0',
                    tx.type === 'debit' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400',
                  )}>
                    {tx.type === 'debit' ? '-' : '+'}{tx.amount.toLocaleString('es-CO')}
                  </span>

                  {/* Note */}
                  <span className="text-xs text-[var(--text-muted)] flex-1 truncate">
                    {tx.note ?? ''}
                  </span>

                  {/* Source badge */}
                  {tx.source === 'expense' && (
                    <span title={t.debts.fromExpense} className="shrink-0 text-[var(--text-muted)]">
                      <Link2 size={10} />
                    </span>
                  )}

                  {/* Delete (only manual) */}
                  {tx.source === 'manual' && (
                    <button
                      onClick={() => softDeleteDebtTransaction(tx.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DebtsPage
// ---------------------------------------------------------------------------

export function DebtsPage() {
  const { session } = useAuth();
  const householdId = session?.householdId ?? '';
  const userId = session?.userId ?? '';
  const { formatCOP } = useNumberFormat();
  const { t } = useI18n();

  // Fetch debts
  const { data: debts = [] } = useQuery<DebtRow>(
    `SELECT id, name, description, initial_amount, currency, disbursed_at
     FROM debts WHERE deleted_at IS NULL ORDER BY disbursed_at DESC`,
  );

  // Fetch all transactions
  const { data: allTransactions = [] } = useQuery<DebtTransactionRow>(
    `SELECT id, debt_id, amount, original_amount, original_currency, exchange_rate,
            type, note, date, source, expense_id
     FROM debt_transactions WHERE deleted_at IS NULL ORDER BY date DESC, created_at DESC`,
  );

  // Current month TRM (for USD transactions)
  const { data: rateRows = [] } = useQuery<ExchangeRateRow>(
    `SELECT month, rate FROM exchange_rates
     WHERE from_currency = 'USD' AND to_currency = 'COP'
     ORDER BY month DESC LIMIT 1`,
  );
  const currentMonthRate = rateRows[0]?.rate ?? null;

  // Group transactions by debt_id
  const txByDebt = useMemo(() => {
    const map = new Map<string, DebtTransactionRow[]>();
    for (const tx of allTransactions) {
      const list = map.get(tx.debt_id) ?? [];
      list.push(tx);
      map.set(tx.debt_id, list);
    }
    return map;
  }, [allTransactions]);

  // Compute total balance across all debts (in COP)
  const totalBalance = useMemo(() => {
    return debts.reduce((sum, debt) => {
      const txs = txByDebt.get(debt.id) ?? [];
      let initialCOP = debt.initial_amount;
      if (debt.currency === 'USD' && currentMonthRate) {
        initialCOP = Math.round(debt.initial_amount * currentMonthRate);
      }
      const bal = computeDebtBalance(initialCOP, txs.map(tx => ({ type: tx.type as 'debit' | 'credit', amount: tx.amount })));
      return sum + Math.max(0, bal);
    }, 0);
  }, [debts, txByDebt, currentMonthRate]);

  const activeDebts = debts.filter(d => {
    const txs = txByDebt.get(d.id) ?? [];
    let initialCOP = d.initial_amount;
    if (d.currency === 'USD' && currentMonthRate) {
      initialCOP = Math.round(d.initial_amount * currentMonthRate);
    }
    const bal = computeDebtBalance(initialCOP, txs.map(tx => ({ type: tx.type as 'debit' | 'credit', amount: tx.amount })));
    return bal > 0;
  });

  async function handleDelete(id: string, name: string) {
    if (!confirm(t.debts.confirmDelete(name))) return;
    await softDeleteDebt(id, userId);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <AppHeader
        emoji="💳"
        title={t.debts.title}
        subtitle={t.debts.subtitle}
        actions={
          <DebtFormDialog
            mode="create"
            householdId={householdId}
            userId={userId}
            onDone={() => {}}
            trigger={
              <Button size="sm" className="gap-1.5">
                <Plus size={14} /> {t.debts.newDebt}
              </Button>
            }
          />
        }
      />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* KPI strip */}
        {debts.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4">
              <p className="text-xs text-[var(--text-muted)] mb-1">{t.debts.totalOwed}</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">{formatCOP(totalBalance)}</p>
            </div>
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4">
              <p className="text-xs text-[var(--text-muted)] mb-1">{t.debts.activeDebts}</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">{activeDebts.length}</p>
              <p className="text-[10px] text-[var(--text-muted)]">{t.debts.ofTotal(debts.length)}</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {debts.length === 0 && (
          <div className="text-center py-20 text-[var(--text-muted)]">
            <p className="text-5xl mb-4">💳</p>
            <p className="text-sm font-medium text-[var(--text-secondary)]">{t.debts.noDebts}</p>
            <p className="text-xs mt-1">{t.debts.noDebtsHint}</p>
          </div>
        )}

        {/* Debt cards — 2-col on lg+ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {debts.map(debt => (
            <DebtCard
              key={debt.id}
              debt={debt}
              transactions={txByDebt.get(debt.id) ?? []}
              householdId={householdId}
              userId={userId}
              currentMonthRate={currentMonthRate}
              formatCOP={formatCOP}
              onDelete={handleDelete}
            />
          ))}
        </div>

      </main>

      <AppNav />
    </div>
  );
}
