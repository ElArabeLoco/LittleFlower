import type { BudgetRow } from './useYearViewData';
import type { BudgetMonthRow } from '@/infrastructure/powersync/queries/types';

/** What each month cell of the yearly sheet shows. */
export type YearLens = 'plan' | 'spent' | 'diff';

export type YearGroupId = 'cc' | 'dual' | 'cash';

export function groupIdOf(budget: Pick<BudgetRow, 'payment_mode'>): YearGroupId {
  if (budget.payment_mode === 'both') return 'dual';
  return budget.payment_mode === 'cash' ? 'cash' : 'cc';
}

export function hasStarted(budget: Pick<BudgetRow, 'start_month' | 'end_month'>, month: string): boolean {
  return month >= budget.start_month && (budget.end_month == null || month <= budget.end_month);
}

export function plannedAmount(budget: Pick<BudgetRow, 'default_amount'>, bm: BudgetMonthRow | undefined): number {
  return bm?.amount ?? budget.default_amount;
}

/**
 * Value shown in a month cell for the given lens.
 * Spent / diff are only known up to the current month → null afterwards.
 */
export function lensValue(
  lens: YearLens,
  planned: number,
  spent: number,
  month: string,
  currentMonth: string,
): number | null {
  if (lens === 'plan') return planned;
  if (month > currentMonth) return null;
  return lens === 'spent' ? spent : planned - spent;
}

/** Sum of the non-null values, or null when there is nothing to add. */
export function sumKnown(values: Array<number | null>): number | null {
  let total: number | null = null;
  for (const v of values) {
    if (v !== null) total = (total ?? 0) + v;
  }
  return total;
}

/** Cell value for a budget in a month, null when the budget is not active then. */
export function budgetMonthValue(
  lens: YearLens,
  budget: BudgetRow,
  month: string,
  currentMonth: string,
  bmMap: Map<string, BudgetMonthRow>,
  expenseMap: Map<string, number>,
): number | null {
  if (!hasStarted(budget, month)) return null;
  const bm = bmMap.get(`${budget.id}|${month}`);
  const spent = bm ? (expenseMap.get(bm.id) ?? 0) : 0;
  return lensValue(lens, plannedAmount(budget, bm), spent, month, currentMonth);
}

/** One value per month for a budget (null where the budget is inactive or unknown). */
export function budgetRowValues(
  lens: YearLens,
  budget: BudgetRow,
  months: string[],
  currentMonth: string,
  bmMap: Map<string, BudgetMonthRow>,
  expenseMap: Map<string, number>,
): Array<number | null> {
  return months.map(m => budgetMonthValue(lens, budget, m, currentMonth, bmMap, expenseMap));
}

/** Column-wise sum of several rows (group subtotals). */
export function sumColumns(rows: Array<Array<number | null>>, columns: number): Array<number | null> {
  return Array.from({ length: columns }, (_, c) => sumKnown(rows.map(r => r[c] ?? null)));
}

/** Rectangular cell selection: anchor (ar, ac) → focus (fr, fc). */
export interface CellSelection {
  ar: number;
  ac: number;
  fr: number;
  fc: number;
}

export function selectionBounds(sel: CellSelection) {
  return {
    r1: Math.min(sel.ar, sel.fr), r2: Math.max(sel.ar, sel.fr),
    c1: Math.min(sel.ac, sel.fc), c2: Math.max(sel.ac, sel.fc),
  };
}

export function isSingleCell(sel: CellSelection): boolean {
  return sel.ar === sel.fr && sel.ac === sel.fc;
}

/** Sum / average / count of the known values inside the selection. */
export function summarizeSelection(matrix: Array<Array<number | null>>, sel: CellSelection) {
  const { r1, r2, c1, c2 } = selectionBounds(sel);
  let sum = 0;
  let count = 0;
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const v = matrix[r]?.[c];
      if (v !== null && v !== undefined) { sum += v; count++; }
    }
  }
  return { sum, count, average: count > 0 ? Math.round(sum / count) : 0 };
}

/** Moves the focus corner by (dr, dc), clamped to the grid; `extend` keeps the anchor. */
export function moveSelection(
  sel: CellSelection, dr: number, dc: number, extend: boolean, rows: number, cols: number,
): CellSelection {
  const fr = Math.max(0, Math.min(rows - 1, sel.fr + dr));
  const fc = Math.max(0, Math.min(cols - 1, sel.fc + dc));
  return extend ? { ...sel, fr, fc } : { ar: fr, ac: fc, fr, fc };
}
