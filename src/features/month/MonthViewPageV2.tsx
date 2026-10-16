/**
 * MonthViewPageV2 — refactored version using modular components
 */

import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CreditCard, Banknote, X } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { getCategoryName } from '@/domain/budget/categories';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useMonthViewData, type BudgetRow, type BudgetMonthRow } from '@/application/useMonthViewData';
import { useBudgetMutations } from '@/application/useBudgetMutations';
import { getCurrentMonth, prevMonth, nextMonth } from '@/shared/helpers';
import { BalanceCard } from '@/features/month/components/BalanceCard';
import { GroupSection } from '@/features/month/components/GroupSection';
import { IncomeSection } from '@/features/month/components/IncomeSection';
import { FilterSortBar, type SortKey } from '@/features/month/components/FilterSortBar';

export function sortAndFilterBudgets(
  budgets: BudgetRow[],
  sortKey: SortKey,
  filterText: string,
  bmMap: Map<string, BudgetMonthRow>,
  month: string,
): BudgetRow[] {
  const q = filterText.toLowerCase().trim();
  const filtered = q ? budgets.filter(b => b.name.toLowerCase().includes(q)) : budgets;

  return [...filtered].sort((a, b) => {
    switch (sortKey) {
      case 'pending-desc': {
        const bmA = bmMap.get(`${a.id}|${month}`);
        const bmB = bmMap.get(`${b.id}|${month}`);
        const execA = bmA?.is_executed === 1 ? 1 : 0;
        const execB = bmB?.is_executed === 1 ? 1 : 0;
        if (execA !== execB) return execA - execB;
        if (execA === 0) {
          const amtA = bmA?.amount ?? a.default_amount;
          const amtB = bmB?.amount ?? b.default_amount;
          if (amtB !== amtA) return amtB - amtA;
        }
        return a.name.localeCompare(b.name);
      }
      case 'value-desc': {
        const amtA = bmMap.get(`${a.id}|${month}`)?.amount ?? a.default_amount;
        const amtB = bmMap.get(`${b.id}|${month}`)?.amount ?? b.default_amount;
        return amtB - amtA;
      }
      case 'value-asc': {
        const amtA = bmMap.get(`${a.id}|${month}`)?.amount ?? a.default_amount;
        const amtB = bmMap.get(`${b.id}|${month}`)?.amount ?? b.default_amount;
        return amtA - amtB;
      }
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'category-asc': {
        const cmp = getCategoryName(a.category_id).localeCompare(getCategoryName(b.category_id));
        return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
      }
      case 'category-desc': {
        const cmp = getCategoryName(b.category_id).localeCompare(getCategoryName(a.category_id));
        return cmp !== 0 ? cmp : b.name.localeCompare(a.name);
      }
      default:
        return 0;
    }
  });
}

export function MonthViewPageV2() {
  const { session } = useAuth();
  const { t } = useI18n();
  const [month, setMonth] = useState(getCurrentMonth());
  const [sortKey, setSortKey] = useState<SortKey>('pending-desc');
  const [filterText, setFilterText] = useState('');

  const householdId = session?.householdId ?? '';
  const userId = session?.userId ?? '';
  const [mutationError, setMutationError] = useState<string | null>(null);

  const formatMonthLabel = useCallback((m: string) => {
    const [y, mo] = m.split('-');
    return `${t.months.full[mo] ?? mo} ${y}`;
  }, [t]);

  const { upsertBudgetMonth, updateBudgetMonthExecution } = useBudgetMutations(householdId, userId);

  async function handleToggleExecution(
    bm: BudgetMonthRow | null,
    budget: BudgetRow,
    month: string,
    amount: number,
    isExecuted: boolean,
  ) {
    try {
      if (bm) {
        await updateBudgetMonthExecution(bm.id, !isExecuted);
      } else {
        await upsertBudgetMonth({ budget_id: budget.id, month, amount, is_executed: true });
      }
    } catch (err) {
      console.error('[MonthViewPageV2] handleToggleExecution failed:', err);
      setMutationError(err instanceof Error ? err.message : t.common.unexpectedError);
    }
  }

  const {
    creditCardBudgets,
    cashBudgets,
    bmMap,
    expenseMap,
    cashExpenseMap,
    activeIncomes,
    imMap,
    trm,
    totalAvailable,
    hasMissingTrm,
    ccTotals,
    cashTotals,
  } = useMonthViewData(month);

  const sortedCCBudgets = useMemo(
    () => sortAndFilterBudgets(creditCardBudgets, sortKey, filterText, bmMap, month),
    [creditCardBudgets, sortKey, filterText, bmMap, month],
  );
  const sortedCashBudgets = useMemo(
    () => sortAndFilterBudgets(cashBudgets, sortKey, filterText, bmMap, month),
    [cashBudgets, sortKey, filterText, bmMap, month],
  );

  const totalMatchCount = sortedCCBudgets.length + sortedCashBudgets.length;

  const totalBudgeted = cashTotals.budgeted;
  const totalSpent = cashTotals.spent;
  const totalRealSpent = useMemo(
    () => Array.from(cashExpenseMap.values()).reduce((s, v) => s + v, 0),
    [cashExpenseMap],
  );

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">
      <AppHeader
        title={t.monthView.title}
        subtitle={formatMonthLabel(month)}
        maxWidth="max-w-5xl"
      />

      <div className="max-w-5xl mx-auto w-full px-4 py-2.5 flex items-center gap-3">
        <button
          onClick={() => setMonth(m => prevMonth(m))}
          className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          aria-label={t.monthView.prevMonth}
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="flex-1 text-center text-sm font-semibold text-[var(--text-primary)]">
          {formatMonthLabel(month)}
        </h2>
        <button
          onClick={() => setMonth(m => nextMonth(m))}
          className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          aria-label={t.monthView.nextMonth}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {mutationError && (
        <div
          className="flex items-center justify-between gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300"
          role="alert"
        >
          <span>⚠ {mutationError}</span>
          <button
            className="text-red-500 hover:text-red-700 transition-colors"
            onClick={() => setMutationError(null)}
          >
            <X size={13} />
          </button>
        </div>
      )}

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 pb-6 space-y-4">
          <BalanceCard
            available={totalAvailable}
            totalBudgeted={totalBudgeted}
            totalSpent={totalSpent}
            totalRealSpent={totalRealSpent}
            month={month}
            hasMissingTrm={hasMissingTrm}
            formatMonthLabel={formatMonthLabel}
          />

          {(creditCardBudgets.length > 0 || cashBudgets.length > 0) && (
            <FilterSortBar
              sortKey={sortKey}
              filterText={filterText}
              onSortChange={setSortKey}
              onFilterChange={setFilterText}
              matchCount={totalMatchCount}
            />
          )}

          {creditCardBudgets.length === 0 && cashBudgets.length === 0 && (
            <div className="text-center py-16 text-[var(--text-muted)]">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-sm font-medium text-[var(--text-secondary)]">{t.monthView.noBudgets}</p>
              <p className="text-xs mt-1">{t.monthView.addBudgetsHint}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <GroupSection
              label={t.monthView.creditCard}
              icon={<CreditCard size={15} />}
              accent="violet"
              budgets={sortedCCBudgets}
              bmMap={bmMap}
              expenseMap={expenseMap}
              month={month}
              householdId={householdId}
              userId={userId}
              totalBudgeted={ccTotals.budgeted}
              totalSpent={ccTotals.spent}
              sortKey={sortKey}
              filterText={filterText}
              onToggleExecution={handleToggleExecution}
            />

            <GroupSection
              label={t.monthView.cashLabel}
              icon={<Banknote size={15} />}
              accent="green"
              budgets={sortedCashBudgets}
              bmMap={bmMap}
              expenseMap={expenseMap}
              month={month}
              householdId={householdId}
              userId={userId}
              totalBudgeted={cashTotals.budgeted}
              totalSpent={cashTotals.spent}
              sortKey={sortKey}
              filterText={filterText}
              onToggleExecution={handleToggleExecution}
            />
          </div>

          {activeIncomes.length > 0 && (
            <IncomeSection
              incomes={activeIncomes}
              imMap={imMap}
              trm={trm}
              totalAvailable={totalAvailable}
              hasMissingTrm={hasMissingTrm}
            />
          )}
        </div>
      </main>

      <AppNav />
    </div>
  );
}