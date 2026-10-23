import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Link2, X, CalendarRange } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';
import { computeDebtBalance } from '@/domain/debt/Debt';
import { useDebtMutations } from '@/application/useDebtMutations';
import { isFinancialDebt, projectDebt, ratePercents } from '@/application/debtPlan';
import { getCurrentMonth } from '@/shared/helpers/dateHelpers';
import { DebtFormDialog } from './DebtFormDialog';
import { DebtTransactionDialog } from './DebtTransactionDialog';
import { debtFormFromRow, formatDate } from './helpers';
import type { DebtRow, DebtTransactionRow } from './types';

interface DebtCardProps {
  debt: DebtRow;
  transactions: DebtTransactionRow[];
  householdId: string;
  userId: string;
  currentMonthRate: number | null;
  formatCOP: (v: number) => string;
  onDelete: (id: string, name: string) => void;
}

export function DebtCard({ debt, transactions, householdId, userId, currentMonthRate, formatCOP, onDelete }: DebtCardProps) {
  const { t } = useI18n();
  const { formatNumber } = useNumberFormat();
  const { softDeleteDebtTransaction } = useDebtMutations(householdId, userId);
  const [expanded, setExpanded] = useState(false);

  const initialAmountCOP = useMemo(() => {
    if (debt.currency === 'COP') return debt.initial_amount;
    const firstCredit = transactions.find(tx => tx.source === 'expense' || tx.original_currency === 'USD');
    const rate = firstCredit?.exchange_rate ?? currentMonthRate ?? 0;
    return Math.round(debt.initial_amount * rate);
  }, [debt, transactions, currentMonthRate]);

  const balance = useMemo(() =>
    computeDebtBalance(initialAmountCOP, transactions.map(tx => ({ type: tx.type as 'debit' | 'credit', amount: tx.amount }))),
    [initialAmountCOP, transactions],
  );

  const { totalBase, totalPaid } = useMemo(() => {
    const credits = transactions.filter(tx => tx.type === 'credit').reduce((s, tx) => s + tx.amount, 0);
    const debits  = transactions.filter(tx => tx.type === 'debit').reduce((s, tx) => s + tx.amount, 0);
    return { totalBase: initialAmountCOP + credits, totalPaid: debits };
  }, [initialAmountCOP, transactions]);

  const financial = isFinancialDebt(debt.kind);
  const projection = useMemo(
    () => financial ? projectDebt(debt, initialAmountCOP, balance, transactions, getCurrentMonth()) : null,
    [financial, debt, initialAmountCOP, balance, transactions],
  );
  const nextRow = projection?.rows[0];

  const pctPaid = totalBase > 0 ? Math.min(100, Math.max(0, Math.round((totalPaid / totalBase) * 100))) : 0;
  const isFullyPaid = balance <= 0;

  return (
    <div className={cn(
      'bg-[var(--bg-surface)] rounded-2xl border shadow-sm overflow-hidden transition-all',
      isFullyPaid ? 'border-green-200 dark:border-green-900/40' : 'border-[var(--border-subtle)]',
    )}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">{debt.name}</h3>
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
                isFullyPaid
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                  : 'bg-[var(--bg-surface-2)] text-[var(--text-muted)]')}>
                {financial ? t.debts.kinds[debt.kind as keyof typeof t.debts.kinds] : debt.currency}
              </span>
              {isFullyPaid && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                  {t.debts.paidOff}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {debt.lender && `${debt.lender} · `}
              {t.debts.since(formatDate(debt.disbursed_at, t.months.shortLower))}
              {debt.description && ` · ${debt.description}`}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <DebtFormDialog
              mode="edit"
              debtId={debt.id}
              householdId={householdId}
              userId={userId}
              initial={debtFormFromRow(debt)}
              onDone={() => {}}
              trigger={
                <Button variant="ghost" size="icon" className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <Pencil size={13} />
                </Button>
              }
            />
            <Button variant="ghost" size="icon" className="h-7 w-7 text-[var(--text-muted)] hover:text-red-500"
              onClick={() => onDelete(debt.id, debt.name)}>
              <Trash2 size={13} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
          <div>
            <p className="text-[var(--text-muted)] mb-0.5">{t.debts.originalLabel}</p>
            <p className="font-semibold text-[var(--text-secondary)]">
              {debt.currency === 'COP'
                ? formatCOP(debt.initial_amount)
                : `${formatNumber(debt.initial_amount)} ${debt.currency}`}
            </p>
          </div>
          <div>
            <p className="text-[var(--text-muted)] mb-0.5">{t.debts.pendingBalance}</p>
            <p className={cn('font-bold text-sm',
              isFullyPaid ? 'text-green-600 dark:text-green-400' : 'text-[var(--text-primary)]')}>
              {formatCOP(Math.max(0, balance))}
            </p>
          </div>
        </div>

        {financial && !isFullyPaid && (
          <div className="grid grid-cols-3 gap-3 mb-3 text-xs rounded-xl bg-[var(--bg-surface-2)] px-3 py-2">
            <div>
              <p className="text-[var(--text-muted)] mb-0.5">{t.debts.rateShortLabel}</p>
              <p className="font-semibold text-[var(--text-secondary)]">
                {t.debts.rateShort(ratePercents(debt.interest_rate).ea.toLocaleString('es-CO', { maximumFractionDigits: 2 }))}
              </p>
            </div>
            {projection?.status === 'never_pays_off' ? (
              <p className="col-span-2 self-center text-red-600 dark:text-red-400">{t.debts.neverPaysOff}</p>
            ) : nextRow ? (
              <>
                <div>
                  <p className="text-[var(--text-muted)] mb-0.5">{t.debts.nextInstallment}</p>
                  <p className="font-semibold text-[var(--text-secondary)]">{formatCOP(nextRow.payment)}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)] mb-0.5">{t.debts.installmentsLeft}</p>
                  <p className="font-semibold text-[var(--text-secondary)]">{projection.rows.length}</p>
                </div>
              </>
            ) : null}
          </div>
        )}

        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
            <span>{t.debts.pctPaid(pctPaid)}</span>
            <span>{t.debts.paidOf(formatCOP(totalPaid), formatCOP(totalBase))}</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--border-medium)] overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500',
                isFullyPaid ? 'bg-green-400' : 'bg-gradient-to-r from-pink-400 to-violet-400')}
              style={{ width: `${pctPaid}%` }}
            />
          </div>
        </div>

        <Button asChild variant="outline" size="sm" className="mt-3 w-full gap-1.5 h-8 text-xs">
          <Link to="/debts/$debtId" params={{ debtId: debt.id }}>
            <CalendarRange size={12} /> {t.debts.viewProjection}
          </Link>
        </Button>
      </div>

      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-2)] hover:bg-[var(--bg-hover)] transition-colors text-xs text-[var(--text-muted)]"
      >
        <span>{t.debts.transactions(transactions.length)}</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-subtle)]">
          <div className="px-4 py-2 border-b border-[var(--border-subtle)]">
            <DebtTransactionDialog
              debtId={debt.id}
              debtCurrency={debt.currency}
              householdId={householdId}
              userId={userId}
              currentMonthRate={currentMonthRate}
              financial={financial}
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
              {transactions.map(tx => {
                const extras = tx.interest_amount + tx.fees_amount;
                const shown = tx.type === 'debit' ? tx.amount + extras : tx.amount;
                return (
                <div key={tx.id}
                  className="flex items-center gap-2 px-4 py-2.5 hover:bg-[var(--bg-hover)] group transition-colors">
                  <span className={cn('shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold',
                    tx.type === 'debit'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400')}>
                    {tx.type === 'debit' ? '↓' : '↑'}
                  </span>
                  <span className="shrink-0 text-[11px] text-[var(--text-muted)] w-12">
                    {formatDate(tx.date, t.months.shortLower)}
                  </span>
                  <span className={cn('font-semibold text-xs tabular-nums shrink-0',
                    tx.type === 'debit' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400')}>
                    {tx.type === 'debit' ? '-' : '+'}{shown.toLocaleString('es-CO')}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] flex-1 truncate">
                    {extras > 0 && (
                      <span className="text-[11px]">
                        {t.debts.principalShort} {tx.amount.toLocaleString('es-CO')}
                        {tx.interest_amount > 0 && ` · ${t.debts.interestShort} ${tx.interest_amount.toLocaleString('es-CO')}`}
                        {tx.fees_amount > 0 && ` · ${t.debts.feesShort} ${tx.fees_amount.toLocaleString('es-CO')}`}
                        {tx.note && ' · '}
                      </span>
                    )}
                    {tx.note ?? ''}
                  </span>
                  {tx.source === 'expense' && (
                    <span title={t.debts.fromExpense} className="shrink-0 text-[var(--text-muted)]">
                      <Link2 size={10} />
                    </span>
                  )}
                  {tx.source === 'manual' && (
                    <button
                      onClick={() => softDeleteDebtTransaction(tx.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
