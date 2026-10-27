/**
 * HomePage — /home, where signed-in people land (container).
 *
 * Reads the month through useHomeData (which reuses the month view's data so
 * both screens agree), owns the mutations and the dialogs, and hands display
 * strings to HomeView. Recording an expense picks the budget item first, then
 * opens the regular ExpenseFormDialog.
 */

import { useState } from 'react';
import { useHomeData } from '@/application/useHomeData';
import { useBudgetMutations } from '@/application/useBudgetMutations';
import { daysLeftInMonth, greetingPeriod, type MonthBudget } from '@/application/homeSummary';
import { useAuth } from '@/features/auth/useAuth';
import { ExpenseFormDialog } from '@/features/expenses/ExpenseFormDialog';
import { getCurrentMonth } from '@/shared/helpers';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { useI18n } from '@/shared/i18n/useI18n';
import { BudgetPickerDialog } from './components/BudgetPickerDialog';
import { HomeView } from './HomeView';

export function HomePage() {
  const { session } = useAuth();
  const { t, locale } = useI18n();
  const { formatCOP, formatNumber } = useNumberFormat();

  const householdId = session?.householdId ?? '';
  const userId = session?.userId ?? '';
  const [now] = useState(() => new Date());
  const month = getCurrentMonth();
  const [year, monthNumber] = month.split('-');
  const monthName = t.months.full[monthNumber] ?? monthNumber;

  const data = useHomeData(month, userId);
  const { upsertBudgetMonth, updateBudgetMonthExecution } = useBudgetMutations(householdId, userId);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [expenseFor, setExpenseFor] = useState<{ budget: MonthBudget; openKey: number } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const greeting = {
    morning: t.home.greetingMorning,
    afternoon: t.home.greetingAfternoon,
    evening: t.home.greetingEvening,
  }[greetingPeriod(now.getHours())](data.userName);
  const weekdayDate = now.toLocaleDateString(locale === 'es' ? 'es-CO' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const dateLine = `${weekdayDate.charAt(0).toLocaleUpperCase()}${weekdayDate.slice(1)}. ${t.home.daysLeft(daysLeftInMonth(now))}`;

  function handlePick(budget: MonthBudget) {
    setPickerOpen(false);
    setExpenseFor({ budget, openKey: Date.now() });
  }

  async function handleMarkExecuted(item: MonthBudget) {
    setBusyId(item.id);
    setMutationError(null);
    try {
      if (item.budgetMonth) {
        await updateBudgetMonthExecution(item.budgetMonth.id, true);
      } else {
        await upsertBudgetMonth({ budget_id: item.id, month, amount: item.amount, is_executed: true });
      }
    } catch (err) {
      console.error('[HomePage] handleMarkExecuted failed:', err);
      setMutationError(err instanceof Error ? err.message : t.common.unexpectedError);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <HomeView
      greeting={greeting}
      dateLine={dateLine}
      monthLabel={`${monthName} ${year}`}
      data={data}
      trmText={data.trm ? t.home.trmOf(monthName.toLocaleLowerCase(), `$${formatNumber(data.trm)}`) : null}
      sectionLines={{
        month: t.home.monthLine(data.budgets.executedCount, data.budgets.totalCount),
        income: t.home.incomeLine(data.incomeCount, data.hasForeignIncome),
        budgets: t.home.budgetsLine(data.budgets.totalCount),
        debts: t.home.debtsLine(data.activeDebtCount > 0 ? formatCOP(data.debtBalance) : null),
      }}
      pendingTotalText={t.home.pendingTotal(formatCOP(data.budgets.pendingTotal))}
      busyId={busyId}
      mutationError={mutationError}
      onRecordExpense={() => setPickerOpen(true)}
      onMarkExecuted={handleMarkExecuted}
    >
      <BudgetPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        budgets={data.budgets.all}
        onPick={handlePick}
      />

      {expenseFor && (
        <ExpenseFormDialog
          key={`${expenseFor.budget.id}|${expenseFor.openKey}`}
          budgetId={expenseFor.budget.id}
          budgetName={expenseFor.budget.name}
          budgetMonthId={expenseFor.budget.budgetMonth?.id ?? null}
          budgetMonthAmount={expenseFor.budget.amount}
          month={month}
          householdId={householdId}
          userId={userId}
          debtId={expenseFor.budget.debtId}
          budgetPaymentMode={expenseFor.budget.paymentMode}
          trigger={<span />}
          defaultOpen
          onClose={() => setExpenseFor(null)}
        />
      )}
    </HomeView>
  );
}
