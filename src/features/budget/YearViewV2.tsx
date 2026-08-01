/**
 * YearViewV2 — refactored version using modular components
 */

import React, {
  useState, useRef, useEffect, useMemo,
} from 'react';
import { ChevronRight, ChevronDown, X } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { cn } from '@/shared/ui/cn';
import { ExpenseFormDialog } from '@/features/expenses/ExpenseFormDialog';
import { getCategoryName } from '@/domain/budget/categories';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useYearViewData, type BudgetRow } from '@/application/useYearViewData';
import { useBudgetMutations } from '@/application/useBudgetMutations';
import { getCurrentMonth } from '@/shared/helpers';
import type { PaymentMode } from '@/domain/budget/Budget';
import type { BudgetMonthRow } from '@/infrastructure/powersync/queries/types';
import { YearViewContextMenu } from '@/features/budget/YearViewContextMenu';
import { YearViewForwardConfirmDialog } from '@/features/budget/YearViewForwardConfirmDialog';
import type { BudgetCellHandle } from '@/features/budget/components/BudgetCell';
import { BudgetTableSection } from '@/features/budget/components/BudgetTableSection';
import { YearViewHeader } from '@/features/budget/components/YearViewHeader';
import type { CellContextData, ContextMenuPos, CtxMenuState, ForwardConfirmState } from '@/features/budget/components/yearViewTypes';

export type YearSortKey =
  | 'name-asc' | 'name-desc'
  | 'category-asc' | 'category-desc'
  | 'value-asc' | 'value-desc';

const YEAR_DEFAULT_SORT: YearSortKey = 'name-asc';

export function sortYearBudgets(budgets: BudgetRow[], sortKey: YearSortKey): BudgetRow[] {
  return [...budgets].sort((a, b) => {
    switch (sortKey) {
      case 'name-asc':  return a.name.localeCompare(b.name);
      case 'name-desc': return b.name.localeCompare(a.name);
      case 'category-asc': {
        const cmp = getCategoryName(a.category_id).localeCompare(getCategoryName(b.category_id));
        return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
      }
      case 'category-desc': {
        const cmp = getCategoryName(b.category_id).localeCompare(getCategoryName(a.category_id));
        return cmp !== 0 ? cmp : b.name.localeCompare(a.name);
      }
      case 'value-asc':  return a.default_amount - b.default_amount;
      case 'value-desc': return b.default_amount - a.default_amount;
      default: return 0;
    }
  });
}

function yearMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

function getCurrentYear(): number  { return new Date().getFullYear(); }

interface ExpenseModalState {
  budgetId: string;
  budgetName: string;
  budgetMonthId: string | null;
  budgetMonthAmount: number;
  month: string;
  debtId: string | null;
  paymentMode: string;
  openKey: number;
}

export function YearViewV2() {
  const { session }   = useAuth();
  const { t }         = useI18n();
  const { formatCOP: fmt } = useNumberFormat();
  const [year, setYear]               = useState(getCurrentYear);
  const [yearFilter, setYearFilter]   = useState('');
  const [yearSortKey, setYearSortKey] = useState<YearSortKey>(YEAR_DEFAULT_SORT);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [nameColCollapsed, setNameColCollapsed] = useState(false);
  useEffect(() => {
    if (window.innerWidth < 640) setNameColCollapsed(true);
  }, []);

  const [ccCollapsed,   setCcCollapsed]   = useState(false);
  const [cashCollapsed, setCashCollapsed] = useState(false);

  const months       = useMemo(() => yearMonths(year), [year]);
  const currentMonth = useMemo(getCurrentMonth, []);

  const householdId = session?.householdId ?? '';
  const userId      = session?.userId      ?? '';

  const {
    upsertBudgetMonth,
    updateBudgetMonthExecution,
    registerFullPaymentAndExecute,
    applyBudgetMonthAmountForward,
  } = useBudgetMutations(householdId, userId);

  const {
    budgets, creditCardBudgets, cashBudgets, bmMap, expenseMap,
    availableMap, ccMetricsMap, cashMetricsMap, cashExpenseByMonth,
  } = useYearViewData(year, months);

  const displayCCBudgets = useMemo(() => {
    const q = yearFilter.toLowerCase().trim();
    const filtered = q ? creditCardBudgets.filter(b => b.name.toLowerCase().includes(q)) : creditCardBudgets;
    return sortYearBudgets(filtered, yearSortKey);
  }, [creditCardBudgets, yearFilter, yearSortKey]);

  const displayCashBudgets = useMemo(() => {
    const q = yearFilter.toLowerCase().trim();
    const filtered = q ? cashBudgets.filter(b => b.name.toLowerCase().includes(q)) : cashBudgets;
    return sortYearBudgets(filtered, yearSortKey);
  }, [cashBudgets, yearFilter, yearSortKey]);

  const yearMatchCount = displayCCBudgets.length + displayCashBudgets.length;

  const allVisibleBudgets = useMemo(
    () => [...displayCCBudgets, ...displayCashBudgets],
    [displayCCBudgets, displayCashBudgets],
  );

  const cellHandleRefs = useRef<Map<string, React.RefObject<BudgetCellHandle | null>>>(new Map());
  const activeEditRef  = useRef<React.RefObject<BudgetCellHandle | null> | null>(null);

  useEffect(() => { cellHandleRefs.current = new Map(); }, [year, yearFilter, yearSortKey]);

  function getCellRef(globalIdx: number, mIdx: number): React.RefObject<BudgetCellHandle | null> {
    const key = `${globalIdx}-${mIdx}`;
    if (!cellHandleRefs.current.has(key)) {
      cellHandleRefs.current.set(key, { current: null });
    }
    return cellHandleRefs.current.get(key)!;
  }

  function openCellForEdit(globalIdx: number, mIdx: number) {
    activeEditRef.current?.current?.cancelEdit();
    const ref = getCellRef(globalIdx, mIdx);
    activeEditRef.current = ref;
    setTimeout(() => ref.current?.startEdit(), 0);
  }

  async function handleCellSave(
    budgetId: string,
    budgetMonthId: string | null,
    month: string,
    _currentAmount: number,
    isExecuted: boolean,
    newAmount: number,
  ) {
    await upsertBudgetMonth({
      id: budgetMonthId ?? undefined,
      budget_id: budgetId,
      month,
      amount: newAmount,
      is_executed: isExecuted,
    });
  }

  const [expenseModal, setExpenseModal] = useState<ExpenseModalState | null>(null);
  const expenseModalKeyRef = useRef(0);

  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);

  function handleCellContextMenu(pos: ContextMenuPos, data: CellContextData) {
    activeEditRef.current?.current?.cancelEdit();
    activeEditRef.current = null;
    const menuW = 240, menuH = 220;
    const x = Math.min(pos.x, window.innerWidth  - menuW - 8);
    const y = Math.min(pos.y, window.innerHeight - menuH - 8);
    setCtxMenu({ pos: { ...pos, x, y }, data });
  }

  async function handleMarkExecuted(data: CellContextData) {
    setCtxMenu(null);
    try {
      if (data.budgetMonthId) {
        await updateBudgetMonthExecution(data.budgetMonthId, !data.isExecuted);
      } else if (!data.isExecuted) {
        await upsertBudgetMonth({
          budget_id: data.budgetId,
          month: data.month,
          amount: data.amount,
          is_executed: true,
        });
      }
    } catch (err) {
      console.error('[YearViewV2] handleMarkExecuted failed:', err);
      setMutationError(err instanceof Error ? err.message : t.common.unexpectedError);
    }
  }

  async function handleRegisterFullPayment(data: CellContextData) {
    setCtxMenu(null);
    try {
      await registerFullPaymentAndExecute({
        budgetId: data.budgetId,
        budgetMonthId: data.budgetMonthId,
        month: data.month,
        amount: data.amount,
        spentAmount: data.spentAmount,
        debtId: data.debtId,
        paidWithCreditCard: data.paymentMode !== 'cash',
      });
    } catch (err) {
      console.error('[YearViewV2] handleRegisterFullPayment failed:', err);
      setMutationError(err instanceof Error ? err.message : t.common.unexpectedError);
    }
  }

  function handleViewExpenses(data: CellContextData) {
    setCtxMenu(null);
    expenseModalKeyRef.current += 1;
    setExpenseModal({
      budgetId: data.budgetId, budgetName: data.budgetName,
      budgetMonthId: data.budgetMonthId, budgetMonthAmount: data.amount,
      month: data.month, debtId: data.debtId, paymentMode: data.paymentMode,
      openKey: expenseModalKeyRef.current,
    });
  }

  const [forwardConfirm, setForwardConfirm] = useState<ForwardConfirmState | null>(null);
  const [isApplying,    setIsApplying]     = useState(false);

  function handleCellForwardRequest(globalIdx: number, mIdx: number, amount: number) {
    const budget = allVisibleBudgets[globalIdx];
    if (!budget) return;
    const fromMonth = months[mIdx];
    const toMonth   = `${year}-12`;
    setForwardConfirm({ budgetId: budget.id, budgetName: budget.name, fromMonth, toMonth, amount });
  }

  function handleCtxForwardRequest(data: CellContextData) {
    setCtxMenu(null);
    const toMonth = `${year}-12`;
    setForwardConfirm({
      budgetId: data.budgetId, budgetName: data.budgetName,
      fromMonth: data.month, toMonth, amount: data.amount,
    });
  }

  async function applyForward() {
    if (!forwardConfirm || isApplying) return;
    const { budgetId, fromMonth, toMonth, amount } = forwardConfirm;
    const existingMonths = months
      .filter(m => m >= fromMonth && m <= toMonth)
      .map(m => bmMap.get(`${budgetId}|${m}`))
      .filter((bm): bm is BudgetMonthRow => bm != null);
    setIsApplying(true);
    try {
      await applyBudgetMonthAmountForward({
        budgetId, fromMonth, toMonth, amount, existingMonths,
      });
      setForwardConfirm(null);
    } catch (err) {
      console.error('[YearViewV2] applyForward failed:', err);
      setMutationError(err instanceof Error ? err.message : t.common.unexpectedError);
    } finally {
      setIsApplying(false);
    }
  }

  function onCellTabNext(globalIdx: number, mIdx: number) {
    if (mIdx < months.length - 1) {
      openCellForEdit(globalIdx, mIdx + 1);
    } else if (globalIdx < allVisibleBudgets.length - 1) {
      openCellForEdit(globalIdx + 1, 0);
    }
  }
  function onCellTabPrev(globalIdx: number, mIdx: number) {
    if (mIdx > 0) {
      openCellForEdit(globalIdx, mIdx - 1);
    } else if (globalIdx > 0) {
      openCellForEdit(globalIdx - 1, months.length - 1);
    }
  }
  function onCellEnterDown(globalIdx: number, mIdx: number) {
    if (globalIdx < allVisibleBudgets.length - 1) {
      openCellForEdit(globalIdx + 1, mIdx);
    }
  }

  function monthLabel(month: string): string {
    const idx = String(parseInt(month.slice(5))).padStart(2, '0');
    return t.months?.short?.[idx] ?? month;
  }

  return (
    <div className="h-screen bg-[var(--bg-app)] flex flex-col">
      <AppHeader
        emoji="📅"
        title={t.yearView.title}
        subtitle={t.yearView.budgetYear(year)}
        maxWidth="max-w-full"
        compact
      />

      <YearViewHeader
        year={year}
        budgets={budgets}
        yearFilter={yearFilter}
        yearSortKey={yearSortKey}
        matchCount={yearMatchCount}
        onYearChange={setYear}
        onFilterChange={setYearFilter}
        onSortChange={setYearSortKey}
      />

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

      <div className="flex-1 overflow-auto">
        <table className="border-separate border-spacing-0 text-sm bg-[var(--bg-surface)] min-w-max w-full">
          <thead className="bg-[var(--bg-surface)] shadow-sm">
            <tr className="border-b-2 border-[var(--border-medium)]">
              <th className={cn(
                'sticky top-0 left-0 z-30 bg-[var(--bg-surface)] px-2 py-2 border-r border-[var(--border-cell)] transition-all duration-200',
                nameColCollapsed ? 'w-9' : 'w-40',
              )}>
                <button
                  onClick={() => setNameColCollapsed(v => !v)}
                  className="flex items-center gap-1 w-full text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  title={nameColCollapsed ? 'Expandir nombres' : 'Colapsar nombres'}
                >
                  {!nameColCollapsed && <span className="flex-1 text-left">{t.yearView.itemHeader}</span>}
                  <ChevronRight size={12} className={cn('shrink-0 transition-transform duration-200', !nameColCollapsed && 'rotate-180')} />
                </button>
              </th>
              {months.map((month, i) => (
                <th
                  key={month}
                  className={cn(
                    'sticky top-0 z-10 px-2 py-2 text-center text-xs font-semibold w-20 border-r border-[var(--border-cell)]',
                    month === currentMonth
                      ? 'text-[var(--text-brand)] bg-[var(--group-available-bg)]'
                      : 'text-[var(--text-secondary)] bg-[var(--bg-surface)]',
                  )}
                >
                  {t.months.short[String(i + 1).padStart(2, '0')]}
                  {month === currentMonth && (
                    <span className="block w-1.5 h-1.5 rounded-full bg-[var(--text-brand)] mx-auto mt-0.5" />
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {displayCCBudgets.length > 0 && (
              <>
                <tr className="bg-[var(--group-cc-bg)] border-t border-[var(--group-cc-border)]">
                  <td className={cn(
                    'sticky left-0 z-10 bg-[var(--group-cc-bg)] py-1.5 text-xs font-bold text-[var(--group-cc-text)] uppercase tracking-wide transition-all duration-200',
                    nameColCollapsed ? 'px-1 w-9 text-center' : 'px-3',
                  )}>
                    <button
                      onClick={() => setCcCollapsed(v => !v)}
                      className="flex items-center gap-1.5 w-full text-left hover:opacity-70 transition-opacity"
                    >
                      {nameColCollapsed ? (
                        <span>💳</span>
                      ) : (
                        <>
                          <span>{`💳 ${t.yearView.creditCardGroup}`}</span>
                          <ChevronDown size={12} className={cn('shrink-0 transition-transform duration-200 ml-auto', ccCollapsed && '-rotate-90')} />
                        </>
                      )}
                    </button>
                  </td>
                  <td colSpan={months.length} className="bg-[var(--group-cc-bg)]" />
                </tr>
                {!ccCollapsed && (
                  <BudgetTableSection
                    budgets={displayCCBudgets}
                    metricsMap={ccMetricsMap}
                    startIdx={0}
                    months={months}
                    currentMonth={currentMonth}
                    bmMap={bmMap}
                    expenseMap={expenseMap}
                    nameColCollapsed={nameColCollapsed}
                    getCellRef={getCellRef}
                    onCellTabNext={onCellTabNext}
                    onCellTabPrev={onCellTabPrev}
                    onCellEnterDown={onCellEnterDown}
                    onCellContextMenu={handleCellContextMenu}
                    onCellForwardRequest={handleCellForwardRequest}
                    onCellSave={handleCellSave}
                    onOpenExpenses={(params) => {
                      expenseModalKeyRef.current += 1;
                      setExpenseModal({ ...params, openKey: expenseModalKeyRef.current });
                    }}
                  />
                )}
              </>
            )}

            {displayCashBudgets.length > 0 && (
              <>
                <tr className="bg-[var(--group-cash-bg)] border-t border-[var(--group-cash-border)]">
                  <td className={cn(
                    'sticky left-0 z-10 bg-[var(--group-cash-bg)] py-1.5 text-xs font-bold text-[var(--group-cash-text)] uppercase tracking-wide transition-all duration-200',
                    nameColCollapsed ? 'px-1 w-9 text-center' : 'px-3',
                  )}>
                    <button
                      onClick={() => setCashCollapsed(v => !v)}
                      className="flex items-center gap-1.5 w-full text-left hover:opacity-70 transition-opacity"
                    >
                      {nameColCollapsed ? (
                        <span>💵</span>
                      ) : (
                        <>
                          <span>{`💵 ${t.yearView.cashGroup}`}</span>
                          <ChevronDown size={12} className={cn('shrink-0 transition-transform duration-200 ml-auto', cashCollapsed && '-rotate-90')} />
                        </>
                      )}
                    </button>
                  </td>
                  <td colSpan={months.length} className="bg-[var(--group-cash-bg)]" />
                </tr>
                {!cashCollapsed && (
                  <BudgetTableSection
                    budgets={displayCashBudgets}
                    metricsMap={cashMetricsMap}
                    startIdx={displayCCBudgets.length}
                    months={months}
                    currentMonth={currentMonth}
                    bmMap={bmMap}
                    expenseMap={expenseMap}
                    nameColCollapsed={nameColCollapsed}
                    getCellRef={getCellRef}
                    onCellTabNext={onCellTabNext}
                    onCellTabPrev={onCellTabPrev}
                    onCellEnterDown={onCellEnterDown}
                    onCellContextMenu={handleCellContextMenu}
                    onCellForwardRequest={handleCellForwardRequest}
                    onCellSave={handleCellSave}
                    onOpenExpenses={(params) => {
                      expenseModalKeyRef.current += 1;
                      setExpenseModal({ ...params, openKey: expenseModalKeyRef.current });
                    }}
                  />
                )}
              </>
            )}

            <tr className="bg-[var(--group-available-bg)] border-t-2 border-[var(--border-medium)]">
              <td className={cn(
                'sticky left-0 z-10 bg-[var(--group-available-sticky)] py-1.5 text-xs font-bold text-[var(--group-available-text)] whitespace-nowrap border-r border-[var(--border-medium)] transition-all duration-200',
                nameColCollapsed ? 'px-1 w-9 text-center' : 'px-3',
              )}>
                {nameColCollapsed ? '💰' : `💰 ${t.yearView.availableRow}`}
              </td>
              {months.map(month => (
                <td key={month} className="border-r border-[var(--border-subtle)] px-2 py-1.5 text-right text-xs tabular-nums font-bold text-[var(--group-available-text)]">
                  {fmt(availableMap.get(month) ?? 0)}
                </td>
              ))}
            </tr>

            <tr className="bg-[var(--group-total-bg)] border-b border-[var(--border-subtle)]">
              <td className={cn(
                'sticky left-0 z-10 bg-[var(--group-total-sticky)] py-1.5 text-xs font-bold text-[var(--group-total-text)] whitespace-nowrap border-r border-[var(--border-medium)] transition-all duration-200',
                nameColCollapsed ? 'px-1 w-9 text-center' : 'px-3',
              )}>
                {nameColCollapsed ? '📋' : `📋 ${t.yearView.totalBudgetedRow}`}
              </td>
              {months.map(month => (
                <td key={month} className="border-r border-[var(--border-subtle)] px-2 py-1.5 text-right text-xs tabular-nums font-semibold text-[var(--group-total-text)]">
                  {fmt(cashMetricsMap.get(month)?.budgeted ?? 0)}
                </td>
              ))}
            </tr>

            <tr className="bg-[var(--group-balance-bg)]">
              <td className={cn(
                'sticky left-0 z-10 bg-[var(--group-balance-bg)] py-1.5 text-xs font-bold text-[var(--group-balance-text)] whitespace-nowrap border-r border-[var(--border-medium)] transition-all duration-200',
                nameColCollapsed ? 'px-1 w-9 text-center' : 'px-3',
              )}>
                {nameColCollapsed ? '⚖️' : `⚖️ ${t.yearView.realBalanceRow}`}
              </td>
              {months.map(month => {
                const available    = availableMap.get(month) ?? 0;
                const cashBudgeted = cashMetricsMap.get(month)?.budgeted ?? 0;
                const balance      = available - cashBudgeted;
                return (
                  <td
                    key={month}
                    className={cn(
                      'border-r border-[var(--border-subtle)] px-2 py-2 text-right text-xs tabular-nums font-bold',
                      balance > 0 ? 'text-green-600 dark:text-green-400'
                        : balance < 0 ? 'text-red-600 dark:text-red-400'
                        : 'text-[var(--text-muted)]',
                    )}
                  >
                    {balance > 0 && '+'}{fmt(balance)}
                  </td>
                );
              })}
            </tr>

            <tr className="bg-[var(--group-balance-bg)] border-b-2 border-[var(--border-subtle)]">
              <td className={cn(
                'sticky left-0 z-10 bg-[var(--group-balance-bg)] py-1.5 text-xs font-bold text-[var(--group-balance-text)] whitespace-nowrap border-r border-[var(--border-medium)] transition-all duration-200',
                nameColCollapsed ? 'px-1 w-9 text-center' : 'px-3',
              )}>
                {nameColCollapsed ? '💸' : `💸 ${t.yearView.trueRealBalanceRow}`}
              </td>
              {months.map(month => {
                const available   = availableMap.get(month) ?? 0;
                const cashSpent   = cashExpenseByMonth.get(month) ?? 0;
                const realBalance = available - cashSpent;
                return (
                  <td
                    key={month}
                    className={cn(
                      'border-r border-[var(--border-subtle)] px-2 py-2 text-right text-xs tabular-nums font-bold',
                      realBalance > 0 ? 'text-green-600 dark:text-green-400'
                        : realBalance < 0 ? 'text-red-600 dark:text-red-400'
                        : 'text-[var(--text-muted)]',
                    )}
                  >
                    {realBalance > 0 && '+'}{fmt(realBalance)}
                  </td>
                );
              })}
            </tr>

            {budgets.length === 0 && (
              <tr>
                <td colSpan={13} className="py-20 text-center text-gray-400">
                  <p className="text-3xl mb-2">📋</p>
                  <p className="text-sm">{t.yearView.noItems}</p>
                  <p className="text-xs mt-1">{t.yearView.addFromSettings}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {expenseModal && (
        <ExpenseFormDialog
          key={`${expenseModal.budgetId}|${expenseModal.month}|${expenseModal.openKey}`}
          budgetId={expenseModal.budgetId}
          budgetName={expenseModal.budgetName}
          budgetMonthId={expenseModal.budgetMonthId}
          budgetMonthAmount={expenseModal.budgetMonthAmount}
          month={expenseModal.month}
          householdId={householdId}
          userId={userId}
          debtId={expenseModal.debtId}
          budgetPaymentMode={expenseModal.paymentMode as PaymentMode}
          trigger={<span />}
          defaultOpen
          onClose={() => setExpenseModal(null)}
        />
      )}

      {ctxMenu && (
        <YearViewContextMenu
          ctxMenu={ctxMenu}
          year={year}
          monthLabel={monthLabel}
          onClose={() => setCtxMenu(null)}
          onMarkExecuted={handleMarkExecuted}
          onRegisterFullPayment={handleRegisterFullPayment}
          onViewExpenses={handleViewExpenses}
          onForwardRequest={handleCtxForwardRequest}
        />
      )}

      {forwardConfirm && (
        <YearViewForwardConfirmDialog
          forwardConfirm={forwardConfirm}
          isApplying={isApplying}
          months={months}
          monthLabel={monthLabel}
          onApply={applyForward}
          onClose={() => setForwardConfirm(null)}
        />
      )}

      <AppNav />
    </div>
  );
}