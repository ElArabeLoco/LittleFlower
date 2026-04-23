/**
 * MonthlyMetricsService
 *
 * Pure financial calculation functions for a single household month.
 * Zero external dependencies. No side effects. No DB access.
 * All monetary amounts are integer COP pesos.
 *
 * Spanish ↔ English name mapping (domain concept → code name):
 *   totalPresupuestado      → totalBudgeted
 *   dineroDisponible        → availableIncome
 *   balancePresupuestado    → budgetedBalance
 *   presupuestoEjecutado    → executedBudget
 *   dineroDisponibleRestante→ remainingAvailable
 *   presupuestoPorEjecutar  → pendingBudget
 *   balanceReal             → realBalance
 */

import type { PaymentMode } from '@/domain/budget/Budget';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** Immutable budget definition metadata needed for calculations. */
export interface BudgetRow {
  id: string;
  paymentMode: PaymentMode;
  defaultAmount: number; // integer COP
}

/** A budget entry for a specific month. */
export interface BudgetMonthRow {
  id: string;
  budgetId: string;
  month: string; // 'YYYY-MM'
  amount: number; // integer COP — overrides Budget.defaultAmount for this month
  isExecuted: boolean; // true = this budget line has been paid/executed
}

/**
 * An expense record. Append-only ledger: positive = expense, negative = reversal.
 * In the full architecture there is no deletedAt. In MVP, soft-delete is supported.
 * Net spend for a BudgetMonth = SUM(amount) for non-deleted records.
 */
export interface ExpenseRow {
  id: string;
  budgetId: string;
  budgetMonthId: string;
  amount: number; // integer COP. Negative values are reversals.
  deletedAt: string | null; // MVP soft-delete. null = active record.
}

/** Actual income for a specific month, in its native currency. */
export interface IncomeMonthRow {
  id: string;
  incomeId: string;
  realAmount: number; // integer, in income's native currency (e.g. USD cents or COP pesos)
  currency: string; // ISO 4217 — e.g. 'USD', 'COP'
}

/**
 * A known exchange rate for a (fromCurrency → COP) pair in a given month.
 * rate is a float (e.g. 4200.50). All other amounts stay integer.
 */
export interface ExchangeRateRow {
  id: string;
  fromCurrency: string;
  toCurrency: string; // always 'COP'
  month: string; // 'YYYY-MM'
  rate: number; // e.g. 4200.5 — NOT integer, TRM has decimal precision
  source: 'manual' | 'fallback';
}

/** All data required to compute monthly metrics for one household month. */
export interface MonthlyMetricsInput {
  month: string; // 'YYYY-MM'
  budgets: Map<string, BudgetRow>; // keyed by Budget.id
  budgetMonths: BudgetMonthRow[]; // all BudgetMonth rows for this month
  expenses: ExpenseRow[]; // all expense records for this month (may include soft-deleted)
  incomeMonths: IncomeMonthRow[]; // all IncomeMonth rows for this month
  exchangeRates: ExchangeRateRow[]; // all ExchangeRate rows — any month, for fallback lookups
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/** All seven monthly financial metrics plus two credit card subset values. */
export interface MonthlyMetricsOutput {
  /** SUM of all budgetMonth.amount for this month (credit card + cash). */
  totalBudgeted: number;

  /** Total income converted to COP. Excludes income with no available rate. */
  availableIncome: number;

  /** True if any income source was excluded because no exchange rate was found. */
  hasMissingRates: boolean;

  /** availableIncome minus the total credit card budget slice. */
  budgetedBalance: number;

  /** SUM of executed (paid) non-credit-card budget amounts. */
  executedBudget: number;

  /** availableIncome minus executedBudget. */
  remainingAvailable: number;

  /** SUM of unexecuted non-credit-card budget amounts. */
  pendingBudget: number;

  /**
   * availableIncome
   *   minus net actual expenses (SUM including reversals)
   *   minus executed credit card budget amounts.
   */
  realBalance: number;

  /** SUM of all credit card budget amounts (executed or not). */
  totalCreditCardBudgeted: number;

  /** SUM of executed credit card budget amounts only. */
  totalCreditCardExecuted: number;
}

/** Result of looking up an exchange rate with 3-tier fallback. */
export interface EffectiveRate {
  rate: number;
  source: 'manual' | 'fallback' | null; // null = no rate found at all
  fromMonth: string | null; // the month the rate came from (null when source is null)
}

// ---------------------------------------------------------------------------
// getEffectiveRate — 3-tier fallback cascade
// ---------------------------------------------------------------------------

/**
 * Looks up the effective exchange rate for converting `currency` → COP in `month`.
 *
 * Tier 1: Exact match for (currency, month) — use whatever source it has.
 * Tier 2: Most recent prior manual rate (up to 12 months back) — returned as 'fallback'.
 * Tier 3: No rate found — returns { rate: 0, source: null, fromMonth: null }.
 *
 * Special case: COP → COP is always rate=1, source='manual' (identity conversion).
 *
 * The caller uses the returned source to decide:
 *   'manual'   → use silently
 *   'fallback' → show warning: "Using rate from [fromMonth]"
 *   null       → exclude this income from totals, show error prompt
 */
export function getEffectiveRate(
  currency: string,
  month: string,
  rates: ExchangeRateRow[],
): EffectiveRate {
  // COP → COP: identity conversion, always valid
  if (currency === 'COP') {
    return { rate: 1, source: 'manual', fromMonth: month };
  }

  // Tier 1: exact match for this month
  const exact = rates.find((r) => r.fromCurrency === currency && r.month === month);
  if (exact) {
    return { rate: exact.rate, source: exact.source, fromMonth: month };
  }

  // Tier 2: most recent prior manual rate (look back up to 12 months)
  const priorManual = rates
    .filter((r) => r.fromCurrency === currency && r.month < month && r.source === 'manual')
    .sort((a, b) => b.month.localeCompare(a.month))[0];

  if (priorManual !== undefined) {
    return { rate: priorManual.rate, source: 'fallback', fromMonth: priorManual.month };
  }

  // Tier 3: no usable rate
  return { rate: 0, source: null, fromMonth: null };
}

// ---------------------------------------------------------------------------
// Individual metric functions (exported for unit testing; prefixed _ to signal
// they are implementation details, not the primary public API)
// ---------------------------------------------------------------------------

/**
 * Total of all budget amounts for the month.
 * Includes both credit card and cash budget lines.
 */
export function _totalBudgeted(budgetMonths: BudgetMonthRow[]): number {
  return budgetMonths.reduce((sum, bm) => sum + bm.amount, 0);
}

/**
 * Total income converted to COP.
 * Each income source is converted independently using getEffectiveRate.
 * Sources with no available rate are excluded and flagged via hasMissingRates.
 *
 * Math.round is the ONLY rounding operation in this service.
 * All other arithmetic is integer addition/subtraction.
 */
export function _availableIncome(
  incomeMonths: IncomeMonthRow[],
  exchangeRates: ExchangeRateRow[],
  month: string,
): { total: number; hasMissingRates: boolean } {
  let total = 0;
  let hasMissingRates = false;

  for (const im of incomeMonths) {
    const { rate, source } = getEffectiveRate(im.currency, month, exchangeRates);
    if (source === null) {
      // No rate found — exclude this income source from the total
      hasMissingRates = true;
      continue;
    }
    total += Math.round(im.realAmount * rate);
  }

  return { total, hasMissingRates };
}

/**
 * Available income minus the total credit card budget slice.
 * Answers: "what's left after accounting for credit card commitments?"
 */
export function _budgetedBalance(
  availableIncome: number,
  budgetMonths: BudgetMonthRow[],
  budgets: Map<string, BudgetRow>,
): number {
  let creditCardTotal = 0;
  for (const bm of budgetMonths) {
    const budget = budgets.get(bm.budgetId);
    if (budget === undefined) continue; // orphaned row — skip silently
    if (budget.paymentMode !== 'cash') {
      creditCardTotal += bm.amount;
    }
  }
  return availableIncome - creditCardTotal;
}

/**
 * Sum of executed (paid) non-credit-card budget amounts.
 * Answers: "how much cash have we actually paid out this month?"
 */
export function _executedBudget(
  budgetMonths: BudgetMonthRow[],
  budgets: Map<string, BudgetRow>,
): number {
  let total = 0;
  for (const bm of budgetMonths) {
    const budget = budgets.get(bm.budgetId);
    if (budget === undefined) continue;
    if (bm.isExecuted && budget.paymentMode === 'cash') {
      total += bm.amount;
    }
  }
  return total;
}

/**
 * Available income minus executed (cash) budget.
 * Answers: "how much of our available income is still unaccounted for?"
 */
export function _remainingAvailable(availableIncome: number, executedBudget: number): number {
  return availableIncome - executedBudget;
}

/**
 * Sum of unexecuted non-credit-card budget amounts.
 * Answers: "how much cash do we still plan to spend but haven't yet?"
 */
export function _pendingBudget(
  budgetMonths: BudgetMonthRow[],
  budgets: Map<string, BudgetRow>,
): number {
  let total = 0;
  for (const bm of budgetMonths) {
    const budget = budgets.get(bm.budgetId);
    if (budget === undefined) continue;
    if (!bm.isExecuted && budget.paymentMode === 'cash') {
      total += bm.amount;
    }
  }
  return total;
}

/**
 * The real balance: available income minus actual spending.
 *
 *   realBalance = availableIncome
 *                 - SUM(expense.amount for active expenses)   ← includes reversals
 *                 - SUM(executedCreditCard budget amounts)     ← credit card spend treated as cash out
 *
 * Note: expense.amount is already in COP. Negative amounts are reversals.
 * In MVP: filter out soft-deleted records (deletedAt !== null).
 */
export function _realBalance(
  availableIncome: number,
  expenses: ExpenseRow[],
  budgetMonths: BudgetMonthRow[],
  budgets: Map<string, BudgetRow>,
): number {
  // Net actual expenses (includes positive expense records and negative reversal records)
  const netExpenses = expenses
    .filter((e) => e.deletedAt === null)
    .reduce((sum, e) => sum + e.amount, 0);

  // Executed credit card budget amounts (treated as cash outflow)
  let executedCreditCard = 0;
  for (const bm of budgetMonths) {
    const budget = budgets.get(bm.budgetId);
    if (budget === undefined) continue;
    if (bm.isExecuted && budget.paymentMode !== 'cash') {
      executedCreditCard += bm.amount;
    }
  }

  return availableIncome - netExpenses - executedCreditCard;
}

// ---------------------------------------------------------------------------
// computeMonthlyMetrics — main entry point
// ---------------------------------------------------------------------------

/**
 * Computes all seven monthly financial metrics plus two credit card subset values.
 *
 * Invariant that must hold for all inputs:
 *   executedBudget + pendingBudget === totalBudgeted - totalCreditCardBudgeted
 *
 * This function never throws. All edge cases (empty arrays, missing budgets,
 * missing exchange rates) produce 0 or false as appropriate.
 */
export function computeMonthlyMetrics(input: MonthlyMetricsInput): MonthlyMetricsOutput {
  const { month, budgets, budgetMonths, expenses, incomeMonths, exchangeRates } = input;

  // availableIncome and hasMissingRates are computed together
  const { total: availableIncome, hasMissingRates } = _availableIncome(
    incomeMonths,
    exchangeRates,
    month,
  );

  const totalBudgeted = _totalBudgeted(budgetMonths);
  const executedBudget = _executedBudget(budgetMonths, budgets);
  const pendingBudget = _pendingBudget(budgetMonths, budgets);
  const budgetedBalance = _budgetedBalance(availableIncome, budgetMonths, budgets);
  const remainingAvailable = _remainingAvailable(availableIncome, executedBudget);
  const realBalance = _realBalance(availableIncome, expenses, budgetMonths, budgets);

  // Credit card subset values
  let totalCreditCardBudgeted = 0;
  let totalCreditCardExecuted = 0;
  for (const bm of budgetMonths) {
    const budget = budgets.get(bm.budgetId);
    if (budget === undefined) continue;
    if (budget.paymentMode !== 'cash') {
      totalCreditCardBudgeted += bm.amount;
      if (bm.isExecuted) {
        totalCreditCardExecuted += bm.amount;
      }
    }
  }

  return {
    totalBudgeted,
    availableIncome,
    hasMissingRates,
    budgetedBalance,
    executedBudget,
    remainingAvailable,
    pendingBudget,
    realBalance,
    totalCreditCardBudgeted,
    totalCreditCardExecuted,
  };
}
