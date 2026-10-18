import { ChevronDown } from 'lucide-react';
import { getCategoryEmoji } from '@/domain/budget/categories';
import { cn } from '@/shared/ui/cn';
import { useI18n } from '@/shared/i18n/I18nContext';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import {
  budgetRowValues, sumColumns, sumKnown, plannedAmount, hasStarted, selectionBounds,
  type YearLens, type YearGroupId, type CellSelection,
} from '@/application/yearViewLens';
import type { BudgetRow } from '@/application/useYearViewData';
import type { BudgetMonthRow } from '@/infrastructure/powersync/queries/types';
import { BudgetCell, type BudgetCellHandle } from './BudgetCell';

const NAME_COL = 'w-[8.5rem] min-w-[8.5rem] sm:w-60 sm:min-w-60 max-w-[8.5rem] sm:max-w-60';

const GROUP_DOT: Record<YearGroupId, string> = {
  cc: 'bg-violet-500',
  dual: 'bg-gradient-to-r from-violet-500 from-50% to-green-500 to-50%',
  cash: 'bg-green-500',
};

interface BudgetTableSectionProps {
  groupId: YearGroupId;
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  lens: YearLens;
  selection: CellSelection | null;
  budgets: BudgetRow[];
  startIdx: number;
  months: string[];
  currentMonth: string;
  bmMap: Map<string, BudgetMonthRow>;
  expenseMap: Map<string, number>;
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

/** Signed total cell shared by group subtotals and the per-row total column. */
function TotalValue({ value, lens }: { value: number | null; lens: YearLens }) {
  if (value === null) return null;
  if (value === 0) return <span className="text-[var(--text-muted)]">–</span>;
  return (
    <span className={cn(lens === 'diff' && (value > 0 ? 'text-[var(--text-positive)]' : 'text-[var(--text-negative)]'))}>
      {lens === 'diff' && value > 0 && '+'}
      <AbbreviatedAmount value={value} />
    </span>
  );
}

export function BudgetTableSection({
  groupId, label, collapsed, onToggle, lens, selection,
  budgets, startIdx, months, currentMonth, bmMap, expenseMap, getCellRef,
  onCellTabNext, onCellTabPrev, onCellEnterDown,
  onCellContextMenu, onCellForwardRequest, onCellSave, onOpenExpenses,
}: BudgetTableSectionProps) {
  const { t } = useI18n();
  const rowValues = budgets.map(b => budgetRowValues(lens, b, months, currentMonth, bmMap, expenseMap));
  const subtotals = sumColumns(rowValues, months.length);
  const bounds = selection ? selectionBounds(selection) : null;

  return (
    <>
      <tr className="bg-[var(--bg-surface-2)]">
        <th
          scope="row"
          className={cn(
            'sticky left-0 z-10 h-8 border-b border-r border-[var(--border-medium)] bg-[var(--bg-surface-2)] p-0 text-left text-[13px] font-semibold text-[var(--text-primary)]',
            NAME_COL,
          )}
        >
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            title={t.yearView.toggleGroup}
            className="flex h-8 w-full items-center gap-2 px-3 text-left hover:bg-[var(--bg-hover)] transition-colors"
          >
            <ChevronDown size={13} aria-hidden="true" className={cn('shrink-0 text-[var(--text-muted)] transition-transform', collapsed && '-rotate-90')} />
            <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-sm', GROUP_DOT[groupId])} />
            <span className="truncate">{label}</span>
            <span className="ml-auto shrink-0 text-xs font-normal text-[var(--text-muted)]">{budgets.length}</span>
          </button>
        </th>
        {subtotals.map((v, i) => (
          <td
            key={months[i]}
            className={cn(
              'h-8 min-w-[var(--yv-col)] border-b border-r border-[var(--border-medium)] px-2.5 text-right text-[13px] font-semibold tabular-nums',
              months[i] === currentMonth && 'bg-[var(--color-now)]/[0.07]',
            )}
          >
            <TotalValue value={v} lens={lens} />
          </td>
        ))}
        <td className="h-8 min-w-[var(--yv-col)] border-b border-l border-[var(--border-medium)] px-2.5 text-right text-[13px] font-semibold tabular-nums">
          <TotalValue value={sumKnown(subtotals)} lens={lens} />
        </td>
      </tr>

      {!collapsed && budgets.map((budget, bIdx) => {
        const globalIdx = startIdx + bIdx;
        const rowSelected = !!bounds && globalIdx >= bounds.r1 && globalIdx <= bounds.r2;
        return (
          <tr key={budget.id} className="group bg-[var(--bg-surface)]">
            <th
              scope="row"
              data-r={globalIdx}
              data-c={-1}
              className={cn(
                'sticky left-0 z-10 h-8 cursor-pointer border-b border-r border-[var(--border-medium)] bg-[var(--bg-surface)] group-hover:bg-[var(--row-hover-solid)] pl-7 pr-3 text-left text-[13px] font-normal text-[var(--text-primary)] whitespace-nowrap transition-colors',
                NAME_COL,
              )}
              title={budget.name}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span aria-hidden="true" className="shrink-0">{getCategoryEmoji(budget.category_id)}</span>
                <span className="truncate">{budget.name}</span>
              </span>
            </th>
            {months.map((month, mIdx) => {
              const bm = bmMap.get(`${budget.id}|${month}`);
              const spentAmount = bm ? (expenseMap.get(bm.id) ?? 0) : 0;
              return (
                <BudgetCell
                  key={month}
                  ref={getCellRef(globalIdx, mIdx)}
                  budgetId={budget.id}
                  budgetName={budget.name}
                  budgetMonthId={bm?.id ?? null}
                  month={month}
                  amount={plannedAmount(budget, bm)}
                  spentAmount={spentAmount}
                  lens={lens}
                  value={rowValues[bIdx][mIdx]}
                  editable={lens === 'plan'}
                  rowIdx={globalIdx}
                  colIdx={mIdx}
                  selected={!!bounds && rowSelected && mIdx >= bounds.c1 && mIdx <= bounds.c2}
                  active={!!selection && selection.fr === globalIdx && selection.fc === mIdx}
                  isExecuted={bm?.is_executed === 1}
                  isCurrent={month === currentMonth}
                  isFuture={month > currentMonth}
                  hasStarted={hasStarted(budget, month)}
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
                    budgetMonthAmount: plannedAmount(budget, bm),
                    month,
                    debtId: budget.debt_id ?? null,
                    paymentMode: budget.payment_mode,
                  })}
                />
              );
            })}
            <td className="h-8 min-w-[var(--yv-col)] border-b border-l border-[var(--border-medium)] px-2.5 text-right text-[13px] font-semibold tabular-nums">
              <TotalValue value={sumKnown(rowValues[bIdx])} lens={lens} />
            </td>
          </tr>
        );
      })}
    </>
  );
}
