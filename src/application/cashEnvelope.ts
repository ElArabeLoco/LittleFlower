/**
 * cashEnvelope — the month's cash figures as the month view's BalanceCard
 * defines them. Shared so the dashboard and Home show the same numbers.
 *
 *   budgeted  = planned amount of cash budgets (dual budgets plan in the card envelope)
 *   executed  = cash-paid expenses on cash and dual budgets
 *   realSpent = every cash-paid expense of the month
 *
 * Balance ideal = available − budgeted; Balance real = available − realSpent.
 */

export interface CashEnvelopeBudget {
  id: string;
  payment_mode: string; // 'cash' | 'credit_card' | 'both'
  default_amount: number;
}

export interface CashEnvelopeInput {
  /** Budgets active in the month. */
  budgets: CashEnvelopeBudget[];
  /** The month's budget_month row per budget id, when it exists. */
  budgetMonthByBudgetId: Map<string, { id: string; amount: number }>;
  /** Cash-paid expense totals (paid_with_credit_card = 0) per budget_month id, for the month. */
  cashSpentByBudgetMonthId: Map<string, number>;
}

export interface CashEnvelope {
  budgeted: number;
  executed: number;
  realSpent: number;
}

export function cashEnvelope({ budgets, budgetMonthByBudgetId, cashSpentByBudgetMonthId }: CashEnvelopeInput): CashEnvelope {
  let budgeted = 0;
  let executed = 0;

  for (const budget of budgets) {
    if (budget.payment_mode !== 'cash' && budget.payment_mode !== 'both') continue;
    const budgetMonth = budgetMonthByBudgetId.get(budget.id);
    if (budget.payment_mode === 'cash') budgeted += budgetMonth?.amount ?? budget.default_amount;
    if (budgetMonth) executed += cashSpentByBudgetMonthId.get(budgetMonth.id) ?? 0;
  }

  let realSpent = 0;
  for (const spent of cashSpentByBudgetMonthId.values()) realSpent += spent;

  return { budgeted, executed, realSpent };
}
