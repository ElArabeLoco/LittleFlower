/**
 * homeSummary — pure calculations behind the Home page.
 *
 * The month figures mirror the month view's BalanceCard (cash envelope:
 * budgeted, executed, real spent) so both screens always show the same
 * numbers for the same month.
 */

import type { PaymentMode } from '@/domain/budget/Budget';
import type { BudgetMonthRow, BudgetRow } from '@/infrastructure/powersync/queries/types';

// ---------------------------------------------------------------------------
// Month balance
// ---------------------------------------------------------------------------

export interface MonthBalanceInput {
  /** Income available for the month, in COP. */
  available: number;
  /** Planned cash-envelope amount (dual budgets count in the card envelope only). */
  budgeted: number;
  /** Executed against the planned amount. */
  executed: number;
  /** Cash actually spent in the month. */
  realSpent: number;
}

export interface MonthBalance extends MonthBalanceInput {
  /** Available minus cash actually spent ("Balance real"). */
  realBalance: number;
  /** Planned amount still to execute, never negative. */
  toExecute: number;
  /** Executed / budgeted; may pass 1 when over budget, 0 when nothing is budgeted. */
  executedRatio: number;
}

export function summarizeMonthBalance(input: MonthBalanceInput): MonthBalance {
  const { available, budgeted, executed, realSpent } = input;
  return {
    ...input,
    realBalance: available - realSpent,
    toExecute: Math.max(0, budgeted - executed),
    executedRatio: budgeted > 0 ? executed / budgeted : 0,
  };
}

// ---------------------------------------------------------------------------
// Budgets of the month
// ---------------------------------------------------------------------------

export interface MonthBudget {
  id: string;
  name: string;
  /** Planned amount for the month (override or default). */
  amount: number;
  paymentMode: PaymentMode;
  debtId: string | null;
  budgetMonth: BudgetMonthRow | null;
  isExecuted: boolean;
}

export interface MonthBudgets {
  /** Every active budget once, in the order the groups list them. */
  all: MonthBudget[];
  /** Not yet executed, largest planned amount first. */
  pending: MonthBudget[];
  pendingTotal: number;
  executedCount: number;
  totalCount: number;
}

/**
 * Merges the month's credit-card and cash groups (dual budgets appear in both)
 * into one list per budget, and splits out what is still pending.
 */
export function listMonthBudgets(
  creditCardBudgets: BudgetRow[],
  cashBudgets: BudgetRow[],
  bmMap: Map<string, BudgetMonthRow>,
  month: string,
): MonthBudgets {
  const seen = new Set<string>();
  const all: MonthBudget[] = [];

  for (const budget of [...creditCardBudgets, ...cashBudgets]) {
    if (seen.has(budget.id)) continue;
    seen.add(budget.id);
    const budgetMonth = bmMap.get(`${budget.id}|${month}`) ?? null;
    all.push({
      id: budget.id,
      name: budget.name,
      amount: budgetMonth?.amount ?? budget.default_amount,
      paymentMode: budget.payment_mode as PaymentMode,
      debtId: budget.debt_id,
      budgetMonth,
      isExecuted: budgetMonth?.is_executed === 1,
    });
  }

  const pending = all.filter(b => !b.isExecuted).sort((a, b) => b.amount - a.amount);

  return {
    all,
    pending,
    pendingTotal: pending.reduce((sum, b) => sum + b.amount, 0),
    executedCount: all.length - pending.length,
    totalCount: all.length,
  };
}

// ---------------------------------------------------------------------------
// Calendar helpers
// ---------------------------------------------------------------------------

export type GreetingPeriod = 'morning' | 'afternoon' | 'evening';

/** Morning 5–11 h, afternoon 12–18 h, evening otherwise. */
export function greetingPeriod(hour: number): GreetingPeriod {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 19) return 'afternoon';
  return 'evening';
}

/** Whole days after `date` until the end of its month (0 on the last day). */
export function daysLeftInMonth(date: Date): number {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return lastDay - date.getDate();
}
