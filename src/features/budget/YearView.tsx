/**
 * YearView — vista principal del presupuesto anual.
 *
 * Spreadsheet con 12 meses como columnas y presupuestos como filas.
 * Grupos: Tarjeta de Crédito | Efectivo.
 *
 * Cada celda muestra el monto presupuestado para ese (budget × mes).
 * Clic en celda → edición inline.
 * Tab / Shift+Tab → mes siguiente / anterior.
 * Enter → confirmar + bajar fila.
 * Escape → cancelar.
 *
 * Fila de totales al pie de cada grupo:
 *   Disponible | Presupuestado | Balance pres. | Ejecutado | Restante | Por ejecutar | Balance real
 */

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@powersync/react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';
import { upsertBudgetMonth, updateBudgetMonthExecution } from '@/infrastructure/powersync/mutationWrappers';
import { ExpenseFormDialog } from '@/features/expenses/ExpenseFormDialog';
import { getCategoryEmoji } from '@/domain/budget/categories';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { formatCOPStatic, useNumberFormat } from '@/shared/hooks/useNumberFormat';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function yearMonths(year: number): string[] {
  return MONTHS.map((_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

// formatCOP is provided by useNumberFormat() hook in YearView,
// and by formatCOPStatic in standalone sub-components (BudgetCell, TotalsRow).
const formatCOP = formatCOPStatic;


function getCurrentYear(): number {
  return new Date().getFullYear();
}

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// ---------------------------------------------------------------------------
// Raw row types from SQLite
// ---------------------------------------------------------------------------

interface BudgetRow {
  id: string;
  name: string;
  category_id: string;
  paid_with_credit_card: number;
  default_amount: number;
  household_id: string;
  start_month: string;
  end_month: string | null;
  debt_id: string | null;
}

interface BudgetMonthRow {
  id: string;
  budget_id: string;
  month: string;
  amount: number;
  is_executed: number;
}

interface IncomeRow {
  id: string;
  default_amount: number;
  currency: string;
  start_month: string;
}

interface IncomeMonthRow {
  income_id: string;
  month: string;
  real_amount: number;
  currency: string;
}

interface ExchangeRateRow {
  month: string;
  rate: number;
}

interface ExpenseSumRow {
  budget_month_id: string;
  total: number;
}

// ---------------------------------------------------------------------------
// BudgetCell — editable inline
// ---------------------------------------------------------------------------

interface BudgetCellProps {
  budgetId: string;
  budgetMonthId: string | null;
  month: string;
  amount: number;
  spentAmount: number;  // SUM of real expenses for this budget_month
  isExecuted: boolean;
  householdId: string;
  userId: string;
  isCurrent: boolean;
  isFuture: boolean;
  hasStarted: boolean; // budget.startMonth <= month
  onTabNext: () => void;
  onTabPrev: () => void;
  onEnterDown: () => void;
  onOpenExpenses: () => void; // opens the expense list/form for this cell
}

function BudgetCell({
  budgetId, budgetMonthId, month, amount, spentAmount, isExecuted,
  householdId, userId, isCurrent, isFuture, hasStarted,
  onTabNext, onTabPrev, onEnterDown, onOpenExpenses,
}: BudgetCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (!hasStarted) {
    return (
      <td className="border-r border-[var(--border-subtle)] px-2 py-1.5 text-center text-[var(--text-muted)] text-xs w-20">—</td>
    );
  }

  async function save(value: string) {
    const parsed = parseInt(value.replace(/\D/g, ''), 10);
    if (!isNaN(parsed) && parsed !== amount) {
      await upsertBudgetMonth({
        id: budgetMonthId ?? undefined,
        household_id: householdId,
        budget_id: budgetId,
        month,
        amount: parsed,
        is_executed: isExecuted,
      }, userId);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); save(draft).then(onEnterDown); }
    else if (e.key === 'Escape') { setEditing(false); }
    else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); save(draft).then(onTabNext); }
    else if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); save(draft).then(onTabPrev); }
  }

  async function handleToggleExecution(e: React.MouseEvent) {
    e.preventDefault(); // prevent browser context menu
    if (budgetMonthId) {
      // Row exists → toggle
      await updateBudgetMonthExecution(budgetMonthId, !isExecuted, userId);
    } else {
      // No row yet → create with is_executed = true
      await upsertBudgetMonth({
        household_id: householdId,
        budget_id: budgetId,
        month,
        amount,
        is_executed: true,
      }, userId);
    }
  }

  if (editing) {
    return (
      <td className="border-r border-[var(--border-subtle)] px-1 py-1 w-20">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => save(draft)}
          onKeyDown={handleKeyDown}
          className="w-full text-right text-xs px-1 py-0.5 border border-pink-400 rounded focus:outline-none bg-pink-50 dark:bg-[var(--bg-surface-2)] dark:text-[var(--text-primary)] dark:border-[var(--border-strong)]"
        />
      </td>
    );
  }

  const hasExpenses = spentAmount > 0;
  const overBudget = hasExpenses && spentAmount > amount;
  const pct = amount > 0 ? Math.min(100, Math.round((spentAmount / amount) * 100)) : 0;

  return (
    <td
      className={cn(
        'border-r border-[var(--border-subtle)] px-2 py-1 text-right text-xs tabular-nums select-none w-20 transition-colors group/cell relative',
        isExecuted ? 'bg-green-50/60 dark:bg-green-950/30' : '',
        isCurrent && !isExecuted && 'bg-pink-50/60 dark:bg-pink-950/20',
        'hover:bg-[var(--bg-hover)]',
      )}
      onContextMenu={handleToggleExecution}
    >
      {/* Presupuesto — clic izquierdo edita el monto */}
      <div
        className={cn(
          'font-medium leading-tight cursor-pointer',
          isExecuted ? 'text-green-700 dark:text-green-400' : isFuture ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]',
          isCurrent && !isExecuted && 'font-semibold',
        )}
        onClick={() => { if (!isExecuted) { setDraft(String(amount)); setEditing(true); } }}
        title={isExecuted ? 'Ejecutado ✓ — clic derecho para desmarcar' : 'Clic para editar · clic derecho para marcar ejecutado'}
      >
        {formatCOP(amount)}
        {isExecuted && <span className="ml-1 text-green-600">✓</span>}
        {!isExecuted && (
          <span className="ml-1 text-gray-300 opacity-0 group-hover/cell:opacity-100 transition-opacity text-[10px]">☑</span>
        )}
      </div>

      {/* Ejecutado real — clic abre el modal de gastos */}
      <div
        className={cn(
          'leading-tight text-[10px] tabular-nums cursor-pointer flex items-center justify-end gap-0.5',
          hasExpenses
            ? overBudget ? 'text-red-500 dark:text-red-400 font-semibold' : 'text-violet-600 dark:text-violet-400'
            : 'text-[var(--text-muted)] opacity-0 group-hover/cell:opacity-60',
        )}
        onClick={onOpenExpenses}
        title="Ver / registrar gastos"
      >
        {hasExpenses ? (
          <>{formatCOP(spentAmount)}{overBudget && ' ⚠'}</>
        ) : (
          <Plus size={9} />
        )}
      </div>

      {/* Barra de progreso */}
      {hasExpenses && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--border-subtle)]">
          <div
            className={cn('h-full transition-all', overBudget ? 'bg-red-400' : 'bg-violet-400')}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </td>
  );
}

// ---------------------------------------------------------------------------
// TotalsRow — métricas al pie de cada grupo o del año completo
// ---------------------------------------------------------------------------

interface MonthMetrics {
  available: number;
  budgeted: number;
  executed: number;
  pending: number;
}

function TotalsRow({ months, metricsMap }: {
  months: string[];
  metricsMap: Map<string, MonthMetrics>;
}) {
  const metrics = [
    { key: 'budgeted' as const, label: 'Presupuestado', color: 'text-[var(--text-secondary)] dark:text-[var(--text-secondary)]' },
    { key: 'executed' as const, label: 'Ejecutado', color: 'text-violet-700 dark:text-violet-400' },
    { key: 'pending' as const, label: 'Por ejecutar', color: 'text-amber-600 dark:text-amber-400' },
  ];

  return (
    <>
      {metrics.map(m => (
        <tr key={m.key} className="bg-[var(--group-totals-bg)] border-t border-[var(--border-subtle)]">
          <td className="sticky left-0 z-10 bg-[var(--group-totals-sticky)] px-3 py-1 text-xs text-[var(--text-secondary)] font-medium whitespace-nowrap border-r border-[var(--border-subtle)]">
            {m.label}
          </td>
          {months.map(month => {
            const v = metricsMap.get(month)?.[m.key] ?? 0;
            return (
              <td key={month} className={cn('border-r border-[var(--border-subtle)] px-2 py-1 text-right text-xs tabular-nums font-medium', m.color)}>
                {formatCOP(v)}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// YearView
// ---------------------------------------------------------------------------

export function YearView() {
  const { session } = useAuth();
  const [year, setYear] = useState(getCurrentYear());
  const months = yearMonths(year);
  const currentMonth = getCurrentMonth();

  const householdId = session?.householdId ?? '';
  const userId = session?.userId ?? '';
  const { formatCOP: fmt } = useNumberFormat();

  // Expense modal state — which budget × month is open
  const [expenseModal, setExpenseModal] = useState<{
    budgetId: string;
    budgetName: string;
    budgetMonthId: string | null;
    budgetMonthAmount: number;
    month: string;
    debtId: string | null;
  } | null>(null);

  // All active budgets
  const { data: budgets = [] } = useQuery<BudgetRow>(
    `SELECT id, name, category_id, paid_with_credit_card, default_amount, household_id, start_month, end_month, debt_id
     FROM budgets WHERE deleted_at IS NULL ORDER BY paid_with_credit_card DESC, name ASC`,
  );

  // All budget_months for this year
  const { data: budgetMonths = [] } = useQuery<BudgetMonthRow>(
    `SELECT id, budget_id, month, amount, is_executed
     FROM budget_months
     WHERE month >= ? AND month <= ?`,
    [`${year}-01`, `${year}-12`],
  );

  // All active income sources (to get default_amount as fallback)
  const { data: incomes = [] } = useQuery<IncomeRow>(
    `SELECT id, default_amount, currency, start_month FROM incomes WHERE deleted_at IS NULL`,
  );

  // Income months for this year (only rows where real_amount was explicitly set)
  const { data: incomeMonths = [] } = useQuery<IncomeMonthRow>(
    `SELECT income_id, month, real_amount, currency FROM income_months WHERE month >= ? AND month <= ?`,
    [`${year}-01`, `${year}-12`],
  );

  // Exchange rates for this year
  const { data: exchangeRates = [] } = useQuery<ExchangeRateRow>(
    `SELECT month, rate FROM exchange_rates WHERE from_currency = 'USD' AND to_currency = 'COP' AND month >= ? AND month <= ?`,
    [`${year}-01`, `${year}-12`],
  );

  // Sum of expenses per budget_month for this year (excluding soft-deleted)
  const { data: expenseSums = [] } = useQuery<ExpenseSumRow>(
    `SELECT e.budget_month_id, SUM(e.amount) as total
     FROM expenses e
     JOIN budget_months bm ON bm.id = e.budget_month_id
     WHERE bm.month >= ? AND bm.month <= ?
       AND e.deleted_at IS NULL
     GROUP BY e.budget_month_id`,
    [`${year}-01`, `${year}-12`],
  );

  // Build lookup maps
  const bmMap = new Map<string, BudgetMonthRow>(); // key: `${budgetId}|${month}`
  for (const bm of budgetMonths) bmMap.set(`${bm.budget_id}|${bm.month}`, bm);

  // Expenses lookup: key = budget_month_id → total spent (COP)
  const expenseMap = new Map<string, number>();
  for (const es of expenseSums) expenseMap.set(es.budget_month_id, es.total);

  const rateMap = new Map<string, number>(); // key: month
  for (const r of exchangeRates) rateMap.set(r.month, r.rate);

  // income_months lookup: key = `${incomeId}|${month}`
  const imMap = new Map<string, IncomeMonthRow>();
  for (const im of incomeMonths) imMap.set(`${im.income_id}|${im.month}`, im);

  // Available income per month:
  // For each active income source, use real_amount from income_months if it exists,
  // otherwise fall back to income.default_amount (the source of truth for fixed incomes).
  const availableMap = new Map<string, number>();
  for (const month of months) {
    const trm = rateMap.get(month);
    const total = incomes.reduce((sum, inc) => {
      // Skip income sources that hadn't started yet this month
      if (inc.start_month > month) return sum;
      const im = imMap.get(`${inc.id}|${month}`);
      const amount = im ? im.real_amount : inc.default_amount;
      const currency = im ? im.currency : inc.currency;
      if (currency === 'COP') return sum + amount;
      if (trm) return sum + Math.round(amount * trm);
      return sum; // USD income with no TRM → exclude from total
    }, 0);
    availableMap.set(month, total);
  }

  // Groups
  const creditCardBudgets = budgets.filter(b => b.paid_with_credit_card === 1);
  const cashBudgets = budgets.filter(b => b.paid_with_credit_card === 0);

  // Compute metrics per month for each group.
  // executed = SUM of real expenses recorded against each budget_month.
  function groupMetrics(groupBudgets: BudgetRow[], month: string): MonthMetrics {
    let budgeted = 0, executed = 0;
    for (const b of groupBudgets) {
      const bm = bmMap.get(`${b.id}|${month}`);
      budgeted += bm?.amount ?? b.default_amount;
      if (bm) executed += expenseMap.get(bm.id) ?? 0;
    }
    const pending = Math.max(0, budgeted - executed);
    return { available: availableMap.get(month) ?? 0, budgeted, executed, pending };
  }

  const ccMetricsMap = new Map(months.map(m => [m, groupMetrics(creditCardBudgets, m)]));
  const cashMetricsMap = new Map(months.map(m => [m, groupMetrics(cashBudgets, m)]));

  // Navigation: track which cell has focus for Tab/Enter
  const allBudgets = [...creditCardBudgets, ...cashBudgets];

  function getCellHandlers(budgetIdx: number, monthIdx: number) {
    return {
      onTabNext: () => {
        // move right (next month), wrap to next row
        if (monthIdx < 11) {
          focusCell(budgetIdx, monthIdx + 1);
        } else if (budgetIdx < allBudgets.length - 1) {
          focusCell(budgetIdx + 1, 0);
        }
      },
      onTabPrev: () => {
        if (monthIdx > 0) {
          focusCell(budgetIdx, monthIdx - 1);
        } else if (budgetIdx > 0) {
          focusCell(budgetIdx - 1, 11);
        }
      },
      onEnterDown: () => {
        if (budgetIdx < allBudgets.length - 1) {
          focusCell(budgetIdx + 1, monthIdx);
        }
      },
    };
  }

  const cellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());
  function focusCell(budgetIdx: number, monthIdx: number) {
    const key = `${budgetIdx}-${monthIdx}`;
    const td = cellRefs.current.get(key);
    if (td) (td as HTMLElement).click();
  }

  function BudgetTableSection({ budgets: sectionBudgets, metricsMap, startIdx }: {
    budgets: BudgetRow[];
    metricsMap: Map<string, MonthMetrics>;
    startIdx: number;
  }) {
    // Hide budgets that are completely outside the visible year
    const yearStart = `${year}-01`;
    const yearEnd = `${year}-12`;
    const visibleBudgets = sectionBudgets.filter(budget => {
      if (budget.start_month > yearEnd) return false;
      if (budget.end_month && budget.end_month < yearStart) return false;
      return true;
    });

    return (
      <>
        {visibleBudgets.map((budget, bIdx) => (
          <tr key={budget.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors group">
            {/* Budget name — sticky first column */}
            <td className="sticky left-0 z-10 bg-[var(--bg-surface)] group-hover:bg-[var(--bg-hover)] px-3 py-1.5 text-xs text-[var(--text-primary)] whitespace-nowrap font-medium border-r border-[var(--border-subtle)] max-w-[160px] truncate">
              <span className="mr-1.5">{getCategoryEmoji(budget.category_id)}</span>{budget.name}
            </td>

            {/* One BudgetCell per month */}
            {months.map((month, mIdx) => {
              const bm = bmMap.get(`${budget.id}|${month}`);
              const globalBudgetIdx = startIdx + bIdx;
              const handlers = getCellHandlers(globalBudgetIdx, mIdx);
              const spentAmount = bm ? (expenseMap.get(bm.id) ?? 0) : 0;
              const hasStarted =
                month >= budget.start_month &&
                (budget.end_month == null || month <= budget.end_month);
              return (
                <BudgetCell
                  key={month}
                  budgetId={budget.id}
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
                  onOpenExpenses={() => setExpenseModal({
                    budgetId: budget.id,
                    budgetName: budget.name,
                    budgetMonthId: bm?.id ?? null,
                    budgetMonthAmount: bm?.amount ?? budget.default_amount,
                    month,
                    debtId: budget.debt_id ?? null,
                  })}
                  {...handlers}
                />
              );
            })}
          </tr>
        ))}
        <TotalsRow months={months} metricsMap={metricsMap} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">
      <AppHeader
        emoji="📅"
        title="Vista Anual"
        subtitle={`Presupuesto ${year}`}
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

      {/* Spreadsheet */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse text-sm bg-[var(--bg-surface)] min-w-max w-full">
          {/* Header row */}
          <thead className="sticky top-0 z-10 bg-[var(--bg-surface)] shadow-sm">
            <tr className="border-b-2 border-[var(--border-medium)]">
              <th className="sticky left-0 z-20 bg-[var(--bg-surface)] px-3 py-2 text-left text-xs font-semibold text-[var(--text-secondary)] w-40 border-r border-[var(--border-subtle)]">
                Rubro
              </th>
              {months.map((month, i) => (
                <th
                  key={month}
                  className={cn(
                    'px-2 py-2 text-center text-xs font-semibold w-20 border-r border-[var(--border-subtle)]',
                    month === currentMonth
                      ? 'text-[var(--text-brand)] bg-[var(--group-available-bg)]'
                      : 'text-[var(--text-secondary)]',
                  )}
                >
                  {MONTHS[i]}
                  {month === currentMonth && (
                    <span className="block w-1.5 h-1.5 rounded-full bg-[var(--text-brand)] mx-auto mt-0.5" />
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Credit Card group */}
            {creditCardBudgets.length > 0 && (
              <>
                <tr className="bg-[var(--group-cc-bg)] border-t border-[var(--group-cc-border)]">
                  <td
                    colSpan={13}
                    className="sticky left-0 px-3 py-1.5 text-xs font-bold text-[var(--group-cc-text)] uppercase tracking-wide"
                  >
                    💳 Tarjeta de Crédito
                  </td>
                </tr>
                <BudgetTableSection
                  budgets={creditCardBudgets}
                  metricsMap={ccMetricsMap}
                  startIdx={0}
                />
              </>
            )}

            {/* Cash group */}
            {cashBudgets.length > 0 && (
              <>
                <tr className="bg-[var(--group-cash-bg)] border-t border-[var(--group-cash-border)]">
                  <td
                    colSpan={13}
                    className="sticky left-0 px-3 py-1.5 text-xs font-bold text-[var(--group-cash-text)] uppercase tracking-wide"
                  >
                    💵 Efectivo
                  </td>
                </tr>
                <BudgetTableSection
                  budgets={cashBudgets}
                  metricsMap={cashMetricsMap}
                  startIdx={creditCardBudgets.length}
                />
              </>
            )}

            {/* Available income row */}
            <tr className="bg-[var(--group-available-bg)] border-t-2 border-[var(--border-medium)]">
              <td className="sticky left-0 z-10 bg-[var(--group-available-sticky)] px-3 py-1.5 text-xs font-bold text-[var(--group-available-text)] whitespace-nowrap border-r border-[var(--border-medium)]">
                💰 Disponible
              </td>
              {months.map(month => (
                <td key={month} className="border-r border-[var(--border-subtle)] px-2 py-1.5 text-right text-xs tabular-nums font-bold text-[var(--group-available-text)]">
                  {fmt(availableMap.get(month) ?? 0)}
                </td>
              ))}
            </tr>

            {/* Total presupuestado efectivo */}
            <tr className="bg-[var(--group-total-bg)] border-b border-[var(--border-subtle)]">
              <td className="sticky left-0 z-10 bg-[var(--group-total-sticky)] px-3 py-1.5 text-xs font-bold text-[var(--group-total-text)] whitespace-nowrap border-r border-[var(--border-medium)]">
                📋 Total presupuestado
              </td>
              {months.map(month => {
                const cashBudgeted = cashMetricsMap.get(month)?.budgeted ?? 0;
                return (
                  <td key={month} className="border-r border-[var(--border-subtle)] px-2 py-1.5 text-right text-xs tabular-nums font-semibold text-[var(--group-total-text)]">
                    {fmt(cashBudgeted)}
                  </td>
                );
              })}
            </tr>

            {/* Balance real = Disponible − Efectivo presupuestado */}
            <tr className="bg-[var(--group-balance-bg)] border-b-2 border-[var(--border-subtle)]">
              <td className="sticky left-0 z-10 bg-[var(--group-balance-bg)] px-3 py-1.5 text-xs font-bold text-[var(--group-balance-text)] whitespace-nowrap border-r border-[var(--border-medium)]">
                ⚖️ Balance real
              </td>
              {months.map(month => {
                const available = availableMap.get(month) ?? 0;
                const cashBudgeted = cashMetricsMap.get(month)?.budgeted ?? 0;
                const balance = available - cashBudgeted;
                return (
                  <td
                    key={month}
                    className={cn(
                      'border-r border-[var(--border-subtle)] px-2 py-2 text-right text-xs tabular-nums font-bold',
                      balance > 0 ? 'text-green-600 dark:text-green-400' : balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-[var(--text-muted)]',
                    )}
                  >
                    {balance > 0 && '+'}
                    {fmt(balance)}
                  </td>
                );
              })}
            </tr>

            {/* Empty state */}
            {budgets.length === 0 && (
              <tr>
                <td colSpan={13} className="py-20 text-center text-gray-400">
                  <p className="text-3xl mb-2">📋</p>
                  <p className="text-sm">No hay ítems de presupuesto.</p>
                  <p className="text-xs mt-1">Agrega presupuestos desde Configuración.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Expense modal — rendered outside the table, controlled by expenseModal state */}
      {expenseModal && (
        <ExpenseFormDialog
          key={`${expenseModal.budgetId}|${expenseModal.month}`}
          budgetId={expenseModal.budgetId}
          budgetName={expenseModal.budgetName}
          budgetMonthId={expenseModal.budgetMonthId}
          budgetMonthAmount={expenseModal.budgetMonthAmount}
          month={expenseModal.month}
          householdId={householdId}
          userId={userId}
          debtId={expenseModal.debtId}
          trigger={<span />}
          defaultOpen
          onClose={() => setExpenseModal(null)}
        />
      )}

      <AppNav />
    </div>
  );
}
