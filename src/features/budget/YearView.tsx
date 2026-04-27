/**
 * YearView — spreadsheet view of the annual budget.
 *
 * Interactions:
 *   Double-click / double-tap  → enter inline edit mode
 *   Tab / Shift+Tab in edit    → save + open next/prev month also in edit mode
 *   Enter in edit              → save this month only, move down
 *   Shift+Enter in edit        → open "apply forward" confirmation
 *   Escape in edit             → cancel
 *   Right-click (desktop)      → context menu at cursor
 *   Long press ≥500ms (mobile) → bottom-sheet context menu
 *
 * Context menu / action sheet options:
 *   • Marcar como pagado / Desmarcar
 *   • Registrar pago total y marcar como pagado
 *   • De aquí en adelante… (current/future months only)
 *   • Ver transacciones
 */

import React, {
  useState, useRef, useEffect, useImperativeHandle, useMemo,
} from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Search, X, RotateCcw } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';
import { ExpenseFormDialog } from '@/features/expenses/ExpenseFormDialog';
import { getCategoryEmoji, getCategoryName } from '@/domain/budget/categories';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useYearViewData, type BudgetRow } from '@/application/useYearViewData';
import { useBudgetMutations } from '@/application/useBudgetMutations';
import { getCurrentMonth } from '@/shared/helpers';
import type { PaymentMode } from '@/domain/budget/Budget';
import type { BudgetMonthRow } from '@/infrastructure/powersync/queries/types';
import { YearViewContextMenu } from './YearViewContextMenu';
import { YearViewForwardConfirmDialog } from './YearViewForwardConfirmDialog';
import type { CellContextData, ContextMenuPos, CtxMenuState, ForwardConfirmState } from './yearViewTypes';

// ---------------------------------------------------------------------------
// Sort constants & utility (exported — used by sortYearBudgets.test.ts)
// ---------------------------------------------------------------------------

export type YearSortKey =
  | 'name-asc' | 'name-desc'
  | 'category-asc' | 'category-desc'
  | 'value-asc' | 'value-desc';

const YEAR_DEFAULT_SORT: YearSortKey = 'name-asc';

const YEAR_SORT_CHIPS: {
  dimension: 'value' | 'name' | 'category';
  ascKey: YearSortKey;
  descKey: YearSortKey;
  defaultDir: 'asc' | 'desc';
}[] = [
  { dimension: 'name',     ascKey: 'name-asc',     descKey: 'name-desc',     defaultDir: 'asc'  },
  { dimension: 'value',    ascKey: 'value-asc',    descKey: 'value-desc',    defaultDir: 'desc' },
  { dimension: 'category', ascKey: 'category-asc', descKey: 'category-desc', defaultDir: 'asc'  },
];

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function yearMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

function getCurrentYear(): number  { return new Date().getFullYear(); }

// ---------------------------------------------------------------------------
// BudgetCell types
// ---------------------------------------------------------------------------

/** Imperative handle exposed via forwardRef so parent can trigger edit. */
export interface BudgetCellHandle {
  startEdit(): void;
  cancelEdit(): void;
}

interface BudgetCellProps {
  budgetId: string;
  budgetName: string;
  budgetMonthId: string | null;
  month: string;
  amount: number;
  spentAmount: number;
  isExecuted: boolean;
  householdId: string;
  userId: string;
  isCurrent: boolean;
  isFuture: boolean;
  hasStarted: boolean;
  debtId: string | null;
  paymentMode: string;
  onTabNext: () => void;
  onTabPrev: () => void;
  onEnterDown: () => void;
  onOpenExpenses: () => void;
  onContextMenu: (pos: ContextMenuPos, data: CellContextData) => void;
  onForwardRequest: (amount: number) => void;
  onSave: (budgetMonthId: string | null, month: string, amount: number, isExecuted: boolean, newAmount: number) => Promise<void>;
}

// ---------------------------------------------------------------------------
// BudgetCell
// ---------------------------------------------------------------------------

const BudgetCell = React.forwardRef<BudgetCellHandle, BudgetCellProps>(
  function BudgetCell({
    budgetId, budgetName, budgetMonthId, month, amount, spentAmount,
    isExecuted, isCurrent, isFuture, hasStarted, debtId, paymentMode,
    onTabNext, onTabPrev, onEnterDown, onOpenExpenses, onContextMenu, onForwardRequest, onSave,
  }, ref) {
    const { t } = useI18n();
    const [editing,   setEditing]   = useState(false);
    const [draft,     setDraft]     = useState('');
    const [saveError, setSaveError] = useState<string | null>(null);
    const inputRef                  = useRef<HTMLInputElement>(null);
    const longPressTimer            = useRef<ReturnType<typeof setTimeout> | null>(null);
    const touchOrigin               = useRef<{ x: number; y: number } | null>(null);

    useImperativeHandle(ref, () => ({
      startEdit() {
        if (!hasStarted || isExecuted) return;
        setDraft(String(amount));
        setEditing(true);
      },
      cancelEdit() { setEditing(false); },
    }), [hasStarted, isExecuted, amount]);

    useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

    const isPast = !isCurrent && !isFuture && hasStarted;
    const canForward = !isPast;

    const ctxData: CellContextData = {
      budgetId, budgetName, budgetMonthId, month, amount, spentAmount,
      isExecuted, isPast, debtId, paymentMode,
    };

    async function save(value: string) {
      const parsed = parseInt(value.replace(/\D/g, ''), 10);
      if (!isNaN(parsed) && parsed !== amount) {
        await onSave(budgetMonthId, month, amount, isExecuted, parsed);
      }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === 'Tab') {
        e.preventDefault();
        const val  = draft;
        const next = e.shiftKey ? onTabPrev : onTabNext;
        setEditing(false);
        save(val).then(next).catch(err => {
          console.error('[BudgetCell] save failed:', err);
          setSaveError(err instanceof Error ? err.message : t.common.unexpectedError);
        });
      } else if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        const parsed = parseInt(draft.replace(/\D/g, ''), 10);
        setEditing(false);
        if (!isNaN(parsed)) onForwardRequest(parsed);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const val = draft;
        setEditing(false);
        save(val).then(onEnterDown).catch(err => {
          console.error('[BudgetCell] save failed:', err);
          setSaveError(err instanceof Error ? err.message : t.common.unexpectedError);
        });
      } else if (e.key === 'Escape') {
        setEditing(false);
      }
    }

    function handleTouchStart(e: React.TouchEvent<HTMLTableCellElement>) {
      const touch = e.touches[0];
      touchOrigin.current = { x: touch.clientX, y: touch.clientY };
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        if (navigator.vibrate) navigator.vibrate(10);
        onContextMenu({ x: touch.clientX, y: touch.clientY, source: 'touch' }, ctxData);
      }, 500);
    }
    function handleTouchMove(e: React.TouchEvent<HTMLTableCellElement>) {
      if (!longPressTimer.current || !touchOrigin.current) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchOrigin.current.x);
      const dy = Math.abs(touch.clientY - touchOrigin.current.y);
      if (dx > 10 || dy > 10) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    }
    function handleTouchEnd() {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    }

    function handleNativeContextMenu(e: React.MouseEvent<HTMLTableCellElement>) {
      e.preventDefault();
      onContextMenu({ x: e.clientX, y: e.clientY, source: 'mouse' }, ctxData);
    }

    if (!hasStarted) {
      return (
        <td className="border-r border-[var(--border-subtle)] px-2 py-1.5 text-center text-[var(--text-muted)] text-xs w-20">
          —
        </td>
      );
    }

    if (editing) {
      const monthLabels = t.months?.short;
      const monthIdx  = parseInt(month.slice(5)) - 1;
      const yearLabel = month.slice(0, 4);
      const endLabel  = `${yearLabel}-12`;
      const fromLabel = monthLabels
        ? monthLabels[String(monthIdx + 1).padStart(2, '0')]
        : month;
      const toLabel   = monthLabels ? monthLabels['12'] : endLabel;
      const rangeCount = 12 - monthIdx;

      return (
        <td
          className="border-r border-[var(--border-subtle)] px-1 py-1 w-20 relative overflow-visible"
          style={{ zIndex: 40 }}
        >
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={handleKeyDown}
            className="w-full text-right text-xs px-1 py-0.5 border border-violet-400 rounded focus:outline-none bg-violet-50 dark:bg-[var(--bg-surface-2)] dark:text-[var(--text-primary)] dark:border-violet-700"
          />
          <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-[var(--bg-surface)] border border-[var(--border-medium)] rounded-xl shadow-lg min-w-[210px] overflow-hidden">
            <button
              className="flex items-center gap-2 px-3 py-2.5 w-full text-left hover:bg-[var(--bg-hover)] transition-colors border-none bg-transparent"
              onMouseDown={e => {
                e.preventDefault();
                const val = draft;
                setEditing(false);
                save(val).then(onEnterDown).catch(err => {
                  console.error('[BudgetCell] save failed:', err);
                  setSaveError(err instanceof Error ? err.message : t.common.unexpectedError);
                });
              }}
            >
              <span className="w-6 h-6 rounded-md bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-xs flex-shrink-0">✓</span>
              <span className="flex-1">
                <span className="block text-xs font-medium text-[var(--text-primary)]">{t.yearView.editOnlyThisMonth}</span>
                <span className="block text-[10px] text-[var(--text-muted)]">Enter</span>
              </span>
            </button>
            <button
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 w-full text-left transition-colors border-none bg-transparent border-t border-[var(--border-subtle)]',
                canForward
                  ? 'hover:bg-[var(--bg-hover)]'
                  : 'opacity-40 cursor-not-allowed',
              )}
              disabled={!canForward}
              onMouseDown={e => {
                e.preventDefault();
                if (!canForward) return;
                const parsed = parseInt(draft.replace(/\D/g, ''), 10);
                setEditing(false);
                if (!isNaN(parsed)) onForwardRequest(parsed);
              }}
            >
              <span className="w-6 h-6 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-xs flex-shrink-0">→</span>
              <span className="flex-1">
                <span className="block text-xs font-medium text-[var(--text-primary)]">{t.yearView.ctxForwardAmount}</span>
                <span className="block text-[10px] text-[var(--text-muted)]">
                  {canForward
                    ? t.yearView.editForwardMonths(`${fromLabel}–${toLabel}`, rangeCount)
                    : t.yearView.ctxForwardPastNotAvailable}
                </span>
              </span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono bg-[var(--bg-app)] px-1 rounded flex-shrink-0">⇧ Enter</span>
            </button>
          </div>
        </td>
      );
    }

    const hasExpenses = spentAmount > 0;
    const overBudget  = hasExpenses && spentAmount > amount;
    const pct         = amount > 0 ? Math.min(100, Math.round((spentAmount / amount) * 100)) : 0;

    return (
      <td
        className={cn(
          'border-r border-[var(--border-subtle)] px-2 py-1 text-right text-xs tabular-nums select-none w-20 transition-colors group/cell relative',
          isExecuted ? 'bg-green-50/60 dark:bg-green-950/30' : '',
          isCurrent && !isExecuted && 'bg-pink-50/60 dark:bg-pink-950/20',
          'hover:bg-[var(--bg-hover)]',
        )}
        onContextMenu={handleNativeContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'manipulation' }}
      >
        <div
          className={cn(
            'font-medium leading-tight cursor-pointer',
            isExecuted
              ? 'text-green-700 dark:text-green-400'
              : isFuture ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]',
            isCurrent && !isExecuted && 'font-semibold',
          )}
          onDoubleClick={() => {
            if (isExecuted) return;
            setDraft(String(amount));
            setEditing(true);
          }}
          title={isExecuted ? t.yearView.executedHint : t.yearView.editHint}
        >
          <AbbreviatedAmount value={amount} />
          {isExecuted && <span className="ml-1 text-green-600">✓</span>}
        </div>

        {hasExpenses && (
          <div
            className={cn(
              'leading-tight text-[10px] tabular-nums cursor-pointer flex items-center justify-end gap-0.5',
              overBudget
                ? 'text-red-500 dark:text-red-400 font-semibold'
                : 'text-violet-600 dark:text-violet-400',
            )}
            onClick={onOpenExpenses}
            title={t.yearView.viewExpenses}
          >
            <AbbreviatedAmount value={spentAmount} />{overBudget && ' ⚠'}
          </div>
        )}

        {hasExpenses && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--border-subtle)]">
            <div
              className={cn('h-full transition-all', overBudget ? 'bg-red-400' : 'bg-violet-400')}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {saveError && (
          <div
            className="absolute bottom-full right-0 mb-1 z-50 bg-red-600 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg"
            onClick={() => setSaveError(null)}
            title={saveError}
          >
            ⚠ {saveError}
          </div>
        )}
      </td>
    );
  },
);

// ---------------------------------------------------------------------------
// TotalsRow
// ---------------------------------------------------------------------------

interface MonthMetrics {
  available: number;
  budgeted: number;
  executed: number;
  pending: number;
}

function TotalsRow({ months, metricsMap, nameColCollapsed }: {
  months: string[];
  metricsMap: Map<string, MonthMetrics>;
  nameColCollapsed: boolean;
}) {
  const { t } = useI18n();
  const metrics = [
    { key: 'budgeted' as const, label: t.yearView.budgetedRow, color: 'text-[var(--text-secondary)]' },
    { key: 'executed' as const, label: t.yearView.executedRow, color: 'text-violet-700 dark:text-violet-400' },
    { key: 'pending'  as const, label: t.yearView.toExecuteRow, color: 'text-amber-600 dark:text-amber-400' },
  ];
  return (
    <>
      {metrics.map(m => (
        <tr key={m.key} className="bg-[var(--group-totals-bg)] border-t border-[var(--border-subtle)]">
          <td className={cn(
            'sticky left-0 z-10 bg-[var(--group-totals-sticky)] py-1 text-xs text-[var(--text-secondary)] font-medium whitespace-nowrap border-r border-[var(--border-subtle)] transition-all duration-200',
            nameColCollapsed ? 'px-1 w-9 text-center' : 'px-3',
          )}>
            {nameColCollapsed ? '' : m.label}
          </td>
          {months.map(month => {
            const v = metricsMap.get(month)?.[m.key] ?? 0;
            return (
              <td key={month} className={cn('border-r border-[var(--border-subtle)] px-2 py-1 text-right text-xs tabular-nums font-medium', m.color)}>
                <AbbreviatedAmount value={v} />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// BudgetTableSection (outside YearView to prevent unnecessary remounts)
// ---------------------------------------------------------------------------

interface BudgetTableSectionProps {
  budgets: BudgetRow[];
  metricsMap: Map<string, MonthMetrics>;
  startIdx: number;
  months: string[];
  currentMonth: string;
  bmMap: Map<string, BudgetMonthRow>;
  expenseMap: Map<string, number>;
  householdId: string;
  userId: string;
  nameColCollapsed: boolean;
  getCellRef: (globalBudgetIdx: number, monthIdx: number) => React.RefObject<BudgetCellHandle | null>;
  onCellTabNext: (globalBudgetIdx: number, monthIdx: number) => void;
  onCellTabPrev: (globalBudgetIdx: number, monthIdx: number) => void;
  onCellEnterDown: (globalBudgetIdx: number, monthIdx: number) => void;
  onCellContextMenu: (pos: ContextMenuPos, data: CellContextData) => void;
  onCellForwardRequest: (globalBudgetIdx: number, monthIdx: number, amount: number) => void;
  onCellSave: (budgetId: string, householdId: string, budgetMonthId: string | null, month: string, amount: number, isExecuted: boolean, newAmount: number) => Promise<void>;
  onOpenExpenses: (params: {
    budgetId: string; budgetName: string; budgetMonthId: string | null;
    budgetMonthAmount: number; month: string; debtId: string | null; paymentMode: string;
  }) => void;
}

function BudgetTableSection({
  budgets, metricsMap, startIdx, months, currentMonth,
  bmMap, expenseMap, householdId, userId, nameColCollapsed, getCellRef,
  onCellTabNext, onCellTabPrev, onCellEnterDown,
  onCellContextMenu, onCellForwardRequest, onCellSave, onOpenExpenses,
}: BudgetTableSectionProps) {
  return (
    <>
      {budgets.map((budget, bIdx) => {
        const globalIdx = startIdx + bIdx;
        return (
          <tr key={budget.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors group">
            <td
              className={cn(
                'sticky left-0 z-10 bg-[var(--bg-surface)] group-hover:bg-[var(--bg-hover-solid)] py-1.5 text-xs text-[var(--text-primary)] whitespace-nowrap font-medium border-r border-[var(--border-subtle)] transition-all duration-200',
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
                  householdId={householdId}
                  userId={userId}
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
                    onCellSave(budget.id, householdId, bmId, m, amt, exec, newAmt)
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

// ---------------------------------------------------------------------------
// YearView
// ---------------------------------------------------------------------------

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

export function YearView() {
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

  // ── Mutations ─────────────────────────────────────────────────────────────

  const {
    upsertBudgetMonth,
    updateBudgetMonthExecution,
    registerFullPaymentAndExecute,
    applyBudgetMonthAmountForward,
  } = useBudgetMutations(householdId, userId);

  // ── Data ──────────────────────────────────────────────────────────────────

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

  // ── Cell handle refs ──────────────────────────────────────────────────────

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

  // ── Cell save handler ─────────────────────────────────────────────────────

  async function handleCellSave(
    budgetId: string,
    hId: string,
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
    void hId; // householdId injected by hook
  }

  // ── Expense modal ─────────────────────────────────────────────────────────

  const [expenseModal, setExpenseModal] = useState<ExpenseModalState | null>(null);
  const expenseModalKeyRef = useRef(0);

  // ── Context menu ──────────────────────────────────────────────────────────

  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);

  function handleCellContextMenu(pos: ContextMenuPos, data: CellContextData) {
    activeEditRef.current?.current?.cancelEdit();
    activeEditRef.current = null;
    const menuW = 240, menuH = 220;
    const x = Math.min(pos.x, window.innerWidth  - menuW - 8);
    const y = Math.min(pos.y, window.innerHeight - menuH - 8);
    setCtxMenu({ pos: { ...pos, x, y }, data });
  }

  // ── Context menu actions ──────────────────────────────────────────────────

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
      console.error('[YearView] handleMarkExecuted failed:', err);
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
      console.error('[YearView] handleRegisterFullPayment failed:', err);
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

  // ── Apply-forward confirm ─────────────────────────────────────────────────

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
      console.error('[YearView] applyForward failed:', err);
      setMutationError(err instanceof Error ? err.message : t.common.unexpectedError);
    } finally {
      setIsApplying(false);
    }
  }

  // ── Tab navigation handlers ───────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-[var(--bg-app)] flex flex-col">
      <AppHeader
        emoji="📅"
        title={t.yearView.title}
        subtitle={t.yearView.budgetYear(year)}
        maxWidth="max-w-full"
      />

      {/* Year navigator */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
        <Button variant="outline" size="icon" onClick={() => setYear(y => y - 1)}>
          <ChevronLeft size={16} />
        </Button>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">{year}</h2>
        <Button variant="outline" size="icon" onClick={() => setYear(y => y + 1)}>
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Mutation error banner */}
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

      {/* Sort & filter bar */}
      {budgets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
          <div className={cn(
            'flex items-center gap-2 flex-1 bg-[var(--bg-app)] border rounded-lg px-3',
            yearFilter ? 'border-violet-400 dark:border-violet-600' : 'border-[var(--border-medium)]',
          )}>
            <Search size={13} className="text-[var(--text-muted)] shrink-0" />
            <input
              type="text"
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              placeholder={t.yearView.searchPlaceholder}
              className="flex-1 bg-transparent py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            />
            {yearFilter && (
              <button onClick={() => setYearFilter('')} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X size={13} />
              </button>
            )}
          </div>

          {YEAR_SORT_CHIPS.map(chip => {
            const isActive = yearSortKey === chip.ascKey || yearSortKey === chip.descKey;
            const isAsc    = yearSortKey === chip.ascKey;
            const chipLabel = (() => {
              if (!isActive) {
                if (chip.dimension === 'name')  return t.yearView.sortName;
                if (chip.dimension === 'value') return t.yearView.sortValue;
                return t.yearView.sortCategory;
              }
              if (chip.dimension === 'value') return isAsc ? `↑ ${t.yearView.sortValue}` : `↓ ${t.yearView.sortValue}`;
              if (chip.dimension === 'name')  return isAsc ? `A→Z ${t.yearView.sortName}` : `Z→A ${t.yearView.sortName}`;
              return isAsc ? `${t.yearView.sortCategory} A→Z` : `${t.yearView.sortCategory} Z→A`;
            })();
            return (
              <button
                key={chip.dimension}
                onClick={() => {
                  if (yearSortKey === chip.ascKey)       setYearSortKey(chip.descKey);
                  else if (yearSortKey === chip.descKey) setYearSortKey(chip.ascKey);
                  else setYearSortKey(chip.defaultDir === 'desc' ? chip.descKey : chip.ascKey);
                }}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all duration-150 whitespace-nowrap shrink-0',
                  isActive
                    ? 'bg-violet-600 dark:bg-violet-500 text-white border-violet-600'
                    : 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 hover:bg-violet-100',
                )}
              >
                {chipLabel}
              </button>
            );
          })}

          {yearSortKey !== YEAR_DEFAULT_SORT && (
            <button
              onClick={() => setYearSortKey(YEAR_DEFAULT_SORT)}
              className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-violet-600 transition-colors shrink-0"
            >
              <RotateCcw size={10} /><span>{t.yearView.sortReset}</span>
            </button>
          )}

          {yearFilter && (
            <span className="text-[10px] text-[var(--text-muted)] shrink-0 ml-auto">
              {t.yearView.matchCount(yearMatchCount)}
            </span>
          )}
        </div>
      )}

      {/* Spreadsheet */}
      <div className="flex-1 overflow-auto">
        <table className="border-separate border-spacing-0 text-sm bg-[var(--bg-surface)] min-w-max w-full">
          <thead className="bg-[var(--bg-surface)] shadow-sm">
            <tr className="border-b-2 border-[var(--border-medium)]">
              <th className={cn(
                'sticky top-0 left-0 z-30 bg-[var(--bg-surface)] px-2 py-2 border-r border-[var(--border-subtle)] transition-all duration-200',
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
                    'sticky top-0 z-10 px-2 py-2 text-center text-xs font-semibold w-20 border-r border-[var(--border-subtle)]',
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
                      title={ccCollapsed ? 'Expandir Tarjeta de Crédito' : 'Colapsar Tarjeta de Crédito'}
                    >
                      {nameColCollapsed ? (
                        <span>💳</span>
                      ) : (
                        <>
                          <span>{`💳 ${t.yearView.creditCardGroup}`}</span>
                          <ChevronDown
                            size={12}
                            className={cn('shrink-0 transition-transform duration-200 ml-auto', ccCollapsed && '-rotate-90')}
                          />
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
                    householdId={householdId}
                    userId={userId}
                    nameColCollapsed={nameColCollapsed}
                    getCellRef={getCellRef}
                    onCellTabNext={onCellTabNext}
                    onCellTabPrev={onCellTabPrev}
                    onCellEnterDown={onCellEnterDown}
                    onCellContextMenu={handleCellContextMenu}
                    onCellForwardRequest={handleCellForwardRequest}
                    onCellSave={handleCellSave}
                    onOpenExpenses={params => {
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
                      title={cashCollapsed ? 'Expandir Efectivo' : 'Colapsar Efectivo'}
                    >
                      {nameColCollapsed ? (
                        <span>💵</span>
                      ) : (
                        <>
                          <span>{`💵 ${t.yearView.cashGroup}`}</span>
                          <ChevronDown
                            size={12}
                            className={cn('shrink-0 transition-transform duration-200 ml-auto', cashCollapsed && '-rotate-90')}
                          />
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
                    householdId={householdId}
                    userId={userId}
                    nameColCollapsed={nameColCollapsed}
                    getCellRef={getCellRef}
                    onCellTabNext={onCellTabNext}
                    onCellTabPrev={onCellTabPrev}
                    onCellEnterDown={onCellEnterDown}
                    onCellContextMenu={handleCellContextMenu}
                    onCellForwardRequest={handleCellForwardRequest}
                    onCellSave={handleCellSave}
                    onOpenExpenses={params => {
                      expenseModalKeyRef.current += 1;
                      setExpenseModal({ ...params, openKey: expenseModalKeyRef.current });
                    }}
                  />
                )}
              </>
            )}

            {/* Available income row */}
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

            {/* Total presupuestado efectivo */}
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

            {/* Balance ideal = Disponible − Presupuestado efectivo */}
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

            {/* Balance real = Disponible − Gasto total real */}
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

            {/* Empty state */}
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

      {/* ── Expense modal ──────────────────────────────────────────────────── */}
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

      {/* ── Context menu ──────────────────────────────────────────────────── */}
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

      {/* ── Apply-forward confirm dialog ───────────────────────────────────── */}
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
