import { getCategoryEmoji } from '@/domain/budget/categories';
import { cn } from '@/shared/ui/cn';
import type { BudgetRow } from '@/application/useYearViewData';
import type { BudgetMonthRow } from '@/infrastructure/powersync/queries/types';
import { BudgetCell, type BudgetCellHandle } from './BudgetCell';
import { TotalsRow, type MonthMetrics } from './TotalsRow';

interface BudgetTableSectionProps {
  budgets: BudgetRow[];
  metricsMap: Map<string, MonthMetrics>;
  startIdx: number;
  months: string[];
  currentMonth: string;
  bmMap: Map<string, BudgetMonthRow>;
  expenseMap: Map<string, number>;
  nameColCollapsed: boolean;
  getCellRef: (globalBudgetIdx: number, monthIdx: number) => React.RefObject<BudgetCellHandle | null>;
  onCellTabNext: (globalBudgetIdx: number, monthIdx: number) => void;
  onCellTabPrev: (globalBudgetIdx: number, monthIdx: number) => void;
  onCellEnterDown: (globalBudgetIdx: number, monthIdx: number) => void;
  onCellContextMenu: (pos: import('./yearViewTypes').ContextMenuPos, data: import('./yearViewTypes').CellContextData) => void;
  onCellForwardRequest: (globalBudgetIdx: number, monthIdx: number, amount: number) => void;
  onCellSave: (budgetId: string, budgetMonthId: string | null, month: string, amount: number, isExecuted: boolean, newAmount: number) => Promise<void>;
  onOpenExpenses: (params: {
    budgetId: string; budgetName: string; budgetMonthId: string | null;
    budgetMonthAmount: number; month: string; debtId: string | null; paymentMode: string;
  }) => void;
}

export function BudgetTableSection({
  budgets, metricsMap, startIdx, months, currentMonth,
  bmMap, expenseMap, nameColCollapsed, getCellRef,
  onCellTabNext, onCellTabPrev, onCellEnterDown,
  onCellContextMenu, onCellForwardRequest, onCellSave, onOpenExpenses,
}: BudgetTableSectionProps) {
  return (
    <>
      {budgets.map((budget, bIdx) => {
        const globalIdx = startIdx + bIdx;
        return (
          <tr
            key={budget.id}
            className={cn(
              'border-b border-[var(--border-cell)] hover:bg-[var(--bg-hover)] transition-colors group',
              bIdx % 2 === 0 ? 'bg-[var(--row-zebra-1)]' : 'bg-[var(--row-zebra-2)]',
            )}
          >
            <td
              className={cn(
                'sticky left-0 z-10 py-1.5 text-xs text-[var(--text-primary)] whitespace-nowrap font-medium border-r border-l border-[var(--border-cell)] group-hover:bg-[var(--bg-hover-solid)] transition-all duration-200',
                bIdx % 2 === 0 ? 'bg-[var(--row-zebra-1-solid)]' : 'bg-[var(--row-zebra-2-solid)]',
                nameColCollapsed ? 'px-1 w-9 text-center' : 'px-3 max-w-[160px] truncate',
              )}
              title={budget.name}
            >
              {nameColCollapsed
                ? <span>{getCategoryEmoji(budget.category_id)}</span>
                : (
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0">{getCategoryEmoji(budget.category_id)}</span>
                    <span className="truncate">{budget.name}</span>
                    {budget.payment_mode === 'both' && (
                      <span className="shrink-0 text-[9px] font-bold leading-none px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                        dual
                      </span>
                    )}
                  </span>
                )
              }
            </td>
            {months.map((month, mIdx) => {
              const bm         = bmMap.get(`${budget.id}|${month}`);
              const spentAmount = bm ? (expenseMap.get(bm.id) ?? 0) : 0;
              const hasStarted  =
                month >= budget.start_month &&
                (budget.end_month == null || month <= budget.end_month);
              return (
                <BudgetCell
                  key={month}
                  ref={getCellRef(globalIdx, mIdx)}
                  budgetId={budget.id}
                  budgetName={budget.name}
                  budgetMonthId={bm?.id ?? null}
                  month={month}
                  amount={bm?.amount ?? budget.default_amount}
                  spentAmount={spentAmount}
                  isExecuted={bm?.is_executed === 1}
                  isCurrent={month === currentMonth}
                  isFuture={month > currentMonth}
                  hasStarted={hasStarted}
                  debtId={budget.debt_id ?? null}
                  paymentMode={budget.payment_mode}
                  onTabNext={() => onCellTabNext(globalIdx, mIdx)}
                  onTabPrev={() => onCellTabPrev(globalIdx, mIdx)}
                  onEnterDown={() => onCellEnterDown(globalIdx, mIdx)}
                  onContextMenu={onCellContextMenu}
                  onForwardRequest={amount => onCellForwardRequest(globalIdx, mIdx, amount)}
                  onSave={(bmId, m, amt, exec, newAmt) =>
                    onCellSave(budget.id, bmId, m, amt, exec, newAmt)
                  }
                  onOpenExpenses={() => onOpenExpenses({
                    budgetId: budget.id,
                    budgetName: budget.name,
                    budgetMonthId: bm?.id ?? null,
                    budgetMonthAmount: bm?.amount ?? budget.default_amount,
                    month,
                    debtId: budget.debt_id ?? null,
                    paymentMode: budget.payment_mode,
                  })}
                />
              );
            })}
          </tr>
        );
      })}
      <TotalsRow months={months} metricsMap={metricsMap} nameColCollapsed={nameColCollapsed} />
    </>
  );
}