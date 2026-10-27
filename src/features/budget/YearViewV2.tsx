/**
 * YearViewV2 — refactored version using modular components
 */

import React, {
  useState, useRef, useEffect, useMemo,
} from 'react';
import { LayoutList, X } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { cn } from '@/shared/ui/cn';
import { ExpenseFormDialog } from '@/features/expenses/ExpenseFormDialog';
import { sortYearBudgets, type YearSortKey } from '@/features/budget/sortYearBudgets';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { SpendingViewSwitch } from '@/shared/ui/SpendingViewSwitch';
import { useI18n } from '@/shared/i18n/useI18n';
import { useYearViewData } from '@/application/useYearViewData';
import {
  groupIdOf, sumKnown, budgetRowValues, summarizeSelection, moveSelection, selectionBounds, isSingleCell,
  plannedAmount, hasStarted, type YearLens, type CellSelection,
} from '@/application/yearViewLens';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { useAppSettings } from '@/features/settings/useAppSettings';
import { useBudgetMutations } from '@/application/useBudgetMutations';
import { getCurrentMonth } from '@/shared/helpers';
import type { PaymentMode } from '@/domain/budget/Budget';
import type { BudgetMonthRow } from '@/infrastructure/powersync/queries/types';
import { YearViewContextMenu } from '@/features/budget/YearViewContextMenu';
import { YearViewForwardConfirmDialog } from '@/features/budget/YearViewForwardConfirmDialog';
import type { BudgetCellHandle } from '@/features/budget/components/BudgetCell';
import { BudgetTableSection } from '@/features/budget/components/BudgetTableSection';
import { YearViewHeader } from '@/features/budget/components/YearViewHeader';
import { YearViewStatusBar, type StatusCell, type StatusRange } from '@/features/budget/components/YearViewStatusBar';
import type { CellContextData, ContextMenuPos, CtxMenuState, ForwardConfirmState } from '@/features/budget/components/yearViewTypes';

const YEAR_DEFAULT_SORT: YearSortKey = 'name-asc';

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
  const { t, locale } = useI18n();
  const [year, setYear]               = useState(getCurrentYear);
  const [yearFilter, setYearFilter]   = useState('');
  const [yearSortKey, setYearSortKey] = useState<YearSortKey>(YEAR_DEFAULT_SORT);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [lens, setLens] = useState<YearLens>('plan');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { numberFormat } = useAppSettings();
  const [sel, setSel] = useState<CellSelection | null>(null);
  const dragging = useRef(false);

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
    budgets, bmMap, expenseMap,
    availableMap, cashMetricsMap, cashExpenseByMonth,
  } = useYearViewData(year, months);

  // Sheet groups: dual budgets get their own group instead of repeating in card and cash.
  const groups = useMemo(() => {
    const q = yearFilter.toLowerCase().trim();
    const filtered = q ? budgets.filter(b => b.name.toLowerCase().includes(q)) : budgets;
    const sorted = sortYearBudgets(filtered, yearSortKey);
    const defs = [
      { id: 'cc' as const,   label: t.yearView.creditCardGroup },
      { id: 'dual' as const, label: t.yearView.dualGroup },
      { id: 'cash' as const, label: t.yearView.cashGroup },
    ];
    let startIdx = 0;
    return defs
      .map(d => ({ ...d, budgets: sorted.filter(b => groupIdOf(b) === d.id) }))
      .filter(g => g.budgets.length > 0)
      .map(g => {
        const out = { ...g, startIdx };
        if (!collapsed[g.id]) startIdx += g.budgets.length;
        return out;
      });
  }, [budgets, yearFilter, yearSortKey, collapsed, t]);

  const yearMatchCount = groups.reduce((n, g) => n + g.budgets.length, 0);

  const allVisibleBudgets = useMemo(
    () => groups.filter(g => !collapsed[g.id]).flatMap(g => g.budgets),
    [groups, collapsed],
  );

  // Footer rows (always visible at the bottom of the sheet)
  const currentIdx = months.indexOf(currentMonth);
  const footerRows = useMemo(() => {
    type Tone = 'neutral' | 'balance';
    const known = (m: string) => months.indexOf(m) <= currentIdx;
    const income = months.map(m => availableMap.get(m) ?? 0);
    const cashPlanned = months.map(m => cashMetricsMap.get(m)?.budgeted ?? 0);
    const cashSpent = months.map(m => (known(m) ? (cashExpenseByMonth.get(m) ?? 0) : null));
    const idealBalance = months.map((_, i) => income[i] - cashPlanned[i]);
    const realBalance = months.map((m, i) => (known(m) ? income[i] - (cashSpent[i] ?? 0) : null));
    const row = (label: string, values: Array<number | null>, tone: Tone) => ({ label, values, tone });
    if (lens === 'spent') {
      return [
        row(t.yearView.incomeRow, income, 'neutral'),
        row(t.yearView.cashSpentRow, cashSpent, 'neutral'),
        row(t.yearView.trueRealBalanceRow, realBalance, 'balance'),
      ];
    }
    if (lens === 'diff') {
      return [
        row(t.yearView.incomeRow, income, 'neutral'),
        row(t.yearView.realBalanceRow, idealBalance, 'balance'),
        row(t.yearView.trueRealBalanceRow, realBalance, 'balance'),
      ];
    }
    return [
      row(t.yearView.incomeRow, income, 'neutral'),
      row(t.yearView.cashExpensesRow, cashPlanned, 'neutral'),
      row(t.yearView.realBalanceRow, idealBalance, 'balance'),
      row(t.yearView.trueRealBalanceRow, realBalance, 'balance'),
    ];
  }, [lens, months, currentIdx, availableMap, cashMetricsMap, cashExpenseByMonth, t]);

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

  function openCellForEdit(globalIdx: number, mIdx: number, initial?: string) {
    activeEditRef.current?.current?.cancelEdit();
    const ref = getCellRef(globalIdx, mIdx);
    activeEditRef.current = ref;
    setSel({ ar: globalIdx, ac: mIdx, fr: globalIdx, fc: mIdx });
    setTimeout(() => ref.current?.startEdit(initial), 0);
  }

  // --- Selection: values per visible cell, used for sums and the status bar ----
  const valueMatrix = useMemo(
    () => allVisibleBudgets.map(b => budgetRowValues(lens, b, months, currentMonth, bmMap, expenseMap)),
    [allVisibleBudgets, lens, months, currentMonth, bmMap, expenseMap],
  );

  // Selection is cleared whenever the visible grid changes shape.
  useEffect(() => { setSel(null); }, [lens, year, yearFilter, yearSortKey, collapsed]);

  const activeSel = sel && sel.fr < allVisibleBudgets.length && sel.ar < allVisibleBudgets.length ? sel : null;

  const statusCell: StatusCell | null = useMemo(() => {
    if (!activeSel || !isSingleCell(activeSel)) return null;
    const budget = allVisibleBudgets[activeSel.fr];
    const month = months[activeSel.fc];
    const bm = bmMap.get(`${budget.id}|${month}`);
    return {
      budgetName: budget.name,
      monthLabel: new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2000, activeSel.fc, 1)),
      started: hasStarted(budget, month),
      planned: plannedAmount(budget, bm),
      spent: bm ? (expenseMap.get(bm.id) ?? 0) : 0,
      executed: bm?.is_executed === 1,
      when: month < currentMonth ? 'past' : month === currentMonth ? 'current' : 'future',
    };
  }, [activeSel, allVisibleBudgets, months, bmMap, expenseMap, currentMonth, locale]);

  const statusRange: StatusRange | null = useMemo(
    () => (activeSel && !isSingleCell(activeSel) ? summarizeSelection(valueMatrix, activeSel) : null),
    [activeSel, valueMatrix],
  );

  function revealCell(r: number, c: number) {
    requestAnimationFrame(() => {
      document.querySelector(`[data-r="${r}"][data-c="${c}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }

  function cellFromEvent(e: React.MouseEvent) {
    const el = (e.target as HTMLElement).closest('[data-r][data-c]');
    if (!el) return null;
    return { r: Number(el.getAttribute('data-r')), c: Number(el.getAttribute('data-c')) };
  }

  function onGridMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('input, button, select')) return;
    const rows = allVisibleBudgets.length;
    const colEl = target.closest('[data-col]');
    if (colEl && rows > 0) {
      const c = Number(colEl.getAttribute('data-col'));
      setSel({ ar: 0, ac: c, fr: rows - 1, fc: c });
      return;
    }
    const p = cellFromEvent(e);
    if (!p) return;
    if (p.c === -1) {
      setSel({ ar: p.r, ac: 0, fr: p.r, fc: months.length - 1 });
      return;
    }
    if (e.shiftKey && activeSel) {
      e.preventDefault();
      setSel({ ...activeSel, fr: p.r, fc: p.c });
      return;
    }
    setSel({ ar: p.r, ac: p.c, fr: p.r, fc: p.c });
    dragging.current = true;
  }

  function onGridMouseOver(e: React.MouseEvent) {
    if (!dragging.current) return;
    const p = cellFromEvent(e);
    if (!p || p.c < 0) return;
    setSel(cur => (cur && (cur.fr !== p.r || cur.fc !== p.c) ? { ...cur, fr: p.r, fc: p.c } : cur));
  }

  useEffect(() => {
    const stop = () => { dragging.current = false; };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  function openExpensesFor(globalIdx: number, mIdx: number) {
    const budget = allVisibleBudgets[globalIdx];
    if (!budget || !hasStarted(budget, months[mIdx])) return;
    const bm = bmMap.get(`${budget.id}|${months[mIdx]}`);
    expenseModalKeyRef.current += 1;
    setExpenseModal({
      budgetId: budget.id, budgetName: budget.name,
      budgetMonthId: bm?.id ?? null, budgetMonthAmount: plannedAmount(budget, bm),
      month: months[mIdx], debtId: budget.debt_id ?? null, paymentMode: budget.payment_mode,
      openKey: expenseModalKeyRef.current,
    });
  }

  // Keyboard: arrows move (Shift extends), Enter/F2 edits, a digit starts typing, Esc clears.
  // Kept in a ref so the single window listener always sees fresh state.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (expenseModal || ctxMenu || forwardConfirm) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')) return;
    const rows = allVisibleBudgets.length;
    if (rows === 0) return;

    const arrows: Record<string, [number, number]> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    };
    if (arrows[e.key]) {
      e.preventDefault();
      const next = activeSel
        ? moveSelection(activeSel, arrows[e.key][0], arrows[e.key][1], e.shiftKey, rows, months.length)
        : (() => { const c = Math.max(0, currentIdx); return { ar: 0, ac: c, fr: 0, fc: c }; })();
      setSel(next);
      revealCell(next.fr, next.fc);
      return;
    }
    if (!activeSel) return;
    if (e.key === 'Escape') { setSel(null); return; }
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      if (lens === 'plan') openCellForEdit(activeSel.fr, activeSel.fc);
      else openExpensesFor(activeSel.fr, activeSel.fc);
      return;
    }
    if (lens === 'plan' && /^[0-9]$/.test(e.key)) {
      e.preventDefault();
      openCellForEdit(activeSel.fr, activeSel.fc, e.key);
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
        title={t.yearView.title}
        subtitle={t.yearView.budgetYear(year)}
        maxWidth="max-w-full"
        compact
        actions={<SpendingViewSwitch current="year" />}
      />

      <YearViewHeader
        year={year}
        budgets={budgets}
        yearFilter={yearFilter}
        yearSortKey={yearSortKey}
        lens={lens}
        matchCount={yearMatchCount}
        onYearChange={setYear}
        onFilterChange={setYearFilter}
        onSortChange={setYearSortKey}
        onLensChange={setLens}
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

      <div
        className="flex-1 overflow-auto bg-[var(--bg-surface)]"
        style={{
          '--yv-col': numberFormat === 'full' ? '6.75rem' : '4.75rem',
          '--yv-foot': `${footerRows.length * 36 + 8}px`,
        } as React.CSSProperties}
        onMouseDown={onGridMouseDown}
        onMouseOver={onGridMouseOver}
      >
        <table className="border-separate border-spacing-0 text-sm min-w-max w-full select-none">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky top-0 left-0 z-30 h-9 w-[8.5rem] min-w-[8.5rem] sm:w-60 sm:min-w-60 border-b border-r border-[var(--border-medium)] bg-[var(--bg-surface-2)] px-3 text-left text-xs font-semibold text-[var(--text-secondary)]"
              >
                {t.yearView.itemHeader}
              </th>
              {months.map((month, i) => (
                <th
                  key={month}
                  scope="col"
                  data-col={i}
                  className={cn(
                    'sticky top-0 z-20 h-9 min-w-[var(--yv-col)] cursor-pointer border-b border-r border-[var(--border-medium)] bg-[var(--bg-surface-2)] px-2.5 text-right text-xs font-semibold whitespace-nowrap',
                    activeSel && i >= selectionBounds(activeSel).c1 && i <= selectionBounds(activeSel).c2
                      ? 'text-[var(--text-brand)]'
                      : month === currentMonth
                        ? 'text-[var(--text-now)]'
                        : 'text-[var(--text-secondary)]',
                  )}
                >
                  {month === currentMonth && (
                    <span className="mr-1.5 rounded-full bg-[var(--color-now)]/15 px-1.5 py-px text-[10px] font-semibold">
                      {t.yearView.currentBadge}
                    </span>
                  )}
                  {t.months.short[String(i + 1).padStart(2, '0')]}
                </th>
              ))}
              <th
                scope="col"
                className="sticky top-0 z-20 h-9 min-w-[var(--yv-col)] border-b border-l border-[var(--border-medium)] bg-[var(--bg-surface-2)] px-2.5 text-right text-xs font-semibold whitespace-nowrap text-[var(--text-secondary)]"
              >
                {lens === 'plan' ? t.yearView.totalYear : t.yearView.totalToDate}
              </th>
            </tr>
          </thead>

          <tbody>
            {groups.map(g => (
              <BudgetTableSection
                key={g.id}
                groupId={g.id}
                label={g.label}
                collapsed={!!collapsed[g.id]}
                onToggle={() => setCollapsed(c => ({ ...c, [g.id]: !c[g.id] }))}
                lens={lens}
                selection={activeSel}
                budgets={g.budgets}
                startIdx={g.startIdx}
                months={months}
                currentMonth={currentMonth}
                bmMap={bmMap}
                expenseMap={expenseMap}
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
            ))}

            {budgets.length === 0 && (
              <tr>
                <td colSpan={14} className="py-20 text-[var(--text-muted)]">
                  {/* The row is as wide as the 12-month table; pin the message to the
                      visible part of the scroller so it stays centered on phones. */}
                  <div className="sticky left-0 flex w-[min(100%,100vw)] flex-col items-center px-4 text-center">
                    <LayoutList size={32} strokeWidth={1.5} aria-hidden="true" className="mb-3" />
                    <p className="text-sm">{t.yearView.noItems}</p>
                    <p className="text-xs mt-1">{t.yearView.addFromSettings}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>

          <tfoot>
            {footerRows.map((fr, i) => {
              const bottom = (footerRows.length - 1 - i) * 36;
              const base = 'sticky h-9 border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[13px] tabular-nums';
              const total = sumKnown(fr.values);
              return (
                <tr key={fr.label}>
                  <th
                    scope="row"
                    style={{ bottom }}
                    className={cn(
                      base, 'left-0 z-30 w-[8.5rem] min-w-[8.5rem] sm:w-60 sm:min-w-60 border-r border-[var(--border-medium)] px-3 text-left font-semibold whitespace-nowrap',
                      i === 0 ? 'border-t-2 border-t-[var(--border-strong)]' : 'border-t',
                    )}
                  >
                    {fr.label}
                  </th>
                  {[...fr.values, total].map((v, c) => (
                    <td
                      key={c}
                      style={{ bottom }}
                      className={cn(
                        base, 'z-20 min-w-[var(--yv-col)] border-r px-2.5 text-right',
                        c === 12 && 'border-l border-l-[var(--border-medium)]',
                        i === 0 ? 'border-t-2 border-t-[var(--border-strong)]' : 'border-t',
                        fr.tone === 'balance' ? 'font-bold' : 'font-medium',
                        v !== null && v !== 0 && fr.tone === 'balance'
                          ? (v > 0 ? 'text-[var(--text-positive)]' : 'text-[var(--text-negative)]')
                          : 'text-[var(--text-primary)]',
                      )}
                    >
                      {v === null ? null : v === 0
                        ? <span className="text-[var(--text-muted)]">–</span>
                        : <>{fr.tone === 'balance' && v > 0 && '+'}<AbbreviatedAmount value={v} /></>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tfoot>
        </table>
      </div>

      <YearViewStatusBar lens={lens} cell={statusCell} range={statusRange} />

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