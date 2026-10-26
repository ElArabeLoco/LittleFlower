/**
 * Budget lifecycle rules (pure).
 *
 * A partida with expenses can neither be deleted nor have its range narrowed
 * past the months where those expenses live. "Months with expenses" are the
 * months whose non-deleted expenses net to a non-zero sum.
 */

/** First and last month ('YYYY-MM') that have expenses. */
export type ExpenseSpan = { first: string; last: string };

export type RangeViolation = { field: 'start'; limit: string } | { field: 'end'; limit: string };

/** Finished = ended before the current month. Ending this month is still active. */
export function isFinished(endMonth: string | null, currentMonth: string): boolean {
  return endMonth !== null && endMonth < currentMonth;
}

/** Checks that [start, end] still contains the expense span. Start is checked first. */
export function rangeViolation(
  startMonth: string,
  endMonth: string | null,
  span: ExpenseSpan | null,
): RangeViolation | null {
  if (!span) return null;
  if (startMonth > span.first) return { field: 'start', limit: span.first };
  if (endMonth !== null && endMonth < span.last) return { field: 'end', limit: span.last };
  return null;
}

/** Earliest allowed last month, and the month the finish form starts on. */
export function finishBounds(
  startMonth: string,
  span: ExpenseSpan | null,
  currentMonth: string,
): { min: string; initial: string } {
  const spanLast = span?.last ?? startMonth;
  const min = spanLast > startMonth ? spanLast : startMonth;
  const initial = currentMonth > min ? currentMonth : min;
  return { min, initial };
}

export class BudgetExpenseRangeError extends Error {
  readonly kind: 'delete' | 'start' | 'end';
  readonly limit: string | null;

  constructor(kind: 'delete' | 'start' | 'end', limit: string | null = null) {
    super(
      kind === 'delete'
        ? 'Cannot delete a budget that has expenses'
        : `Budget ${kind} month cannot move past its expenses (${limit})`,
    );
    this.name = 'BudgetExpenseRangeError';
    this.kind = kind;
    this.limit = limit;
  }
}
