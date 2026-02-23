/**
 * MonthViewPage — /month
 *
 * Vista detallada de un mes: presupuestos agrupados por tipo de pago,
 * cada uno con ejecución real y acceso a gastos registrados.
 * Muestra ingresos y balance final del mes.
 *
 * Diseño de tarjetas, no tabular. Optimizado para móvil y escritorio.
 */

import { useState } from 'react';
import { useQuery } from '@powersync/react';
import {
  ChevronLeft, ChevronRight, CreditCard, Banknote,
  TrendingUp, AlertTriangle, Wallet,
  CheckCircle2, Circle, ChevronUp,
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { cn } from '@/shared/ui/cn';
import { getCategoryEmoji, getCategoryName } from '@/domain/budget/categories';
import { ExpenseFormDialog } from '@/features/expenses/ExpenseFormDialog';
import { updateBudgetMonthExecution, upsertBudgetMonth } from '@/infrastructure/powersync/mutationWrappers';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function prevMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  if (mo === 1) return `${y - 1}-12`;
  return `${y}-${String(mo - 1).padStart(2, '0')}`;
}

function nextMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  if (mo === 12) return `${y + 1}-01`;
  return `${y}-${String(mo + 1).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatMonthLabel(m: string): string {
  const [y, mo] = m.split('-');
  return `${MONTH_NAMES[parseInt(mo) - 1]} ${y}`;
}

// ---------------------------------------------------------------------------
// Types
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
}

interface BudgetMonthRow {
  id: string;
  budget_id: string;
  month: string;
  amount: number;
  is_executed: number;
}

interface ExpenseSumRow {
  budget_month_id: string;
  total: number;
}

interface IncomeRow {
  id: string;
  default_amount: number;
  currency: string;
  start_month: string;
  name: string;
  is_fixed: number;
}

interface IncomeMonthRow {
  income_id: string;
  real_amount: number;
  currency: string;
}

interface ExchangeRateRow {
  rate: number;
}

// ---------------------------------------------------------------------------
// MiniProgressBar
// ---------------------------------------------------------------------------

function MiniProgressBar({ pct, over }: { pct: number; over: boolean }) {
  return (
    <div className="h-1 rounded-full bg-[var(--border-subtle)] overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-300', over ? 'bg-red-400' : 'bg-violet-400')}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// BudgetCard — one budget item per card
// ---------------------------------------------------------------------------

interface BudgetCardProps {
  budget: BudgetRow;
  bm: BudgetMonthRow | null;
  spentAmount: number;
  month: string;
  householdId: string;
  userId: string;
}

function BudgetCard({ budget, bm, spentAmount, month, householdId, userId }: BudgetCardProps) {
  const { formatCOP } = useNumberFormat();
  const [expenseOpen, setExpenseOpen] = useState(false);

  const amount = bm?.amount ?? budget.default_amount;
  const isExecuted = bm?.is_executed === 1;
  const overBudget = spentAmount > amount;
  const remaining = amount - spentAmount;
  const pct = amount > 0 ? Math.round((spentAmount / amount) * 100) : 0;
  const hasExpenses = spentAmount > 0;

  async function toggleExecution() {
    if (bm) {
      await updateBudgetMonthExecution(bm.id, !isExecuted, userId);
    } else {
      await upsertBudgetMonth(
        { household_id: householdId, budget_id: budget.id, month, amount, is_executed: true },
        userId,
      );
    }
  }

  return (
    <>
      <div className={cn(
        'rounded-xl border transition-colors',
        isExecuted
          ? 'bg-green-50/40 border-green-100 dark:bg-green-950/20 dark:border-green-900/40'
          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)]',
      )}>
        {/* Row: emoji + name + toggle */}
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
          <span className="text-xl leading-none shrink-0">
            {getCategoryEmoji(budget.category_id)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate leading-tight">
              {budget.name}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {getCategoryName(budget.category_id)}
            </p>
          </div>
          {/* Execution toggle */}
          <button
            onClick={toggleExecution}
            title={isExecuted ? 'Desmarcar como ejecutado' : 'Marcar como ejecutado'}
            className={cn(
              'shrink-0 transition-colors rounded-full p-0.5',
              isExecuted
                ? 'text-green-500 hover:text-green-400 dark:text-green-400'
                : 'text-[var(--text-muted)] hover:text-green-500',
            )}
          >
            {isExecuted ? <CheckCircle2 size={20} /> : <Circle size={20} />}
          </button>
        </div>

        {/* Amounts — tap to open expense dialog */}
        <button
          className="w-full grid grid-cols-3 gap-1 px-4 pb-3 text-left hover:bg-[var(--bg-hover)] transition-colors rounded-b-xl"
          onClick={() => setExpenseOpen(true)}
          title="Ver o registrar gastos"
        >
          <div>
            <p className="text-[10px] text-[var(--text-muted)] mb-0.5">Presupuesto</p>
            <p className="text-sm font-medium text-[var(--text-secondary)] tabular-nums">
              {formatCOP(amount)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--text-muted)] mb-0.5">Gastado</p>
            <p className={cn(
              'text-sm font-semibold tabular-nums',
              hasExpenses
                ? overBudget
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-violet-600 dark:text-violet-400'
                : 'text-[var(--text-muted)]',
            )}>
              {hasExpenses ? formatCOP(spentAmount) : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--text-muted)] mb-0.5">Restante</p>
            <p className={cn(
              'text-sm font-semibold tabular-nums',
              !hasExpenses
                ? 'text-[var(--text-muted)]'
                : remaining < 0
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-green-600 dark:text-green-400',
            )}>
              {hasExpenses ? formatCOP(remaining) : '—'}
            </p>
          </div>
        </button>

        {/* Progress bar — only when there are expenses */}
        {hasExpenses && (
          <div className="px-4 pb-3 -mt-1">
            <MiniProgressBar pct={pct} over={overBudget} />
          </div>
        )}
      </div>

      {expenseOpen && (
        <ExpenseFormDialog
          key={`${budget.id}|${month}`}
          budgetId={budget.id}
          budgetName={budget.name}
          budgetMonthId={bm?.id ?? null}
          budgetMonthAmount={amount}
          month={month}
          householdId={householdId}
          userId={userId}
          trigger={<span />}
          defaultOpen
          onClose={() => setExpenseOpen(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// GroupSection — collapsible group (Tarjeta / Efectivo)
// ---------------------------------------------------------------------------

interface GroupSectionProps {
  label: string;
  icon: React.ReactNode;
  accent: 'violet' | 'green';
  budgets: BudgetRow[];
  bmMap: Map<string, BudgetMonthRow>;
  expenseMap: Map<string, number>;
  month: string;
  householdId: string;
  userId: string;
  totalBudgeted: number;
  totalSpent: number;
}

function GroupSection({
  label, icon, accent, budgets, bmMap, expenseMap,
  month, householdId, userId, totalBudgeted, totalSpent,
}: GroupSectionProps) {
  const { formatCOP } = useNumberFormat();
  const [collapsed, setCollapsed] = useState(false);

  if (budgets.length === 0) return null;

  const over = totalSpent > totalBudgeted;
  const pct = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;
  const remaining = totalBudgeted - totalSpent;

  return (
    <section>
      {/* Group header — tappable to collapse/expand */}
      <button
        className={cn(
          'w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border mb-2 transition-colors text-left',
          accent === 'violet'
            ? 'bg-[var(--group-cc-bg)] border-[var(--group-cc-border)]'
            : 'bg-[var(--group-cash-bg)] border-[var(--group-cash-border)]',
        )}
        onClick={() => setCollapsed(c => !c)}
      >
        <span className={cn(
          'shrink-0',
          accent === 'violet' ? 'text-[var(--group-cc-text)]' : 'text-[var(--group-cash-text)]',
        )}>
          {icon}
        </span>
        <span className={cn(
          'flex-1 text-sm font-bold uppercase tracking-wide',
          accent === 'violet' ? 'text-[var(--group-cc-text)]' : 'text-[var(--group-cash-text)]',
        )}>
          {label}
        </span>
        {/* Inline summary */}
        <span className={cn(
          'text-xs font-semibold tabular-nums shrink-0',
          over ? 'text-red-500' : accent === 'violet' ? 'text-[var(--group-cc-text)]' : 'text-[var(--group-cash-text)]',
        )}>
          {totalSpent > 0 ? `${pct}%` : formatCOP(totalBudgeted)}
        </span>
        <span className={cn(
          'shrink-0 transition-transform duration-200',
          accent === 'violet' ? 'text-[var(--group-cc-text)]' : 'text-[var(--group-cash-text)]',
          collapsed && 'rotate-180',
        )}>
          <ChevronUp size={14} />
        </span>
      </button>

      {/* Totals strip — only when expanded and has spending */}
      {!collapsed && totalSpent > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 mb-2 bg-[var(--group-totals-bg)] rounded-lg border border-[var(--border-subtle)]">
          <div className="flex-1 min-w-0">
            <MiniProgressBar pct={pct} over={over} />
          </div>
          <span className={cn(
            'text-xs font-medium tabular-nums shrink-0',
            over ? 'text-red-500 dark:text-red-400' : 'text-violet-600 dark:text-violet-400',
          )}>
            {formatCOP(totalSpent)} / {formatCOP(totalBudgeted)}
          </span>
          <span className={cn(
            'text-xs font-semibold tabular-nums shrink-0',
            remaining < 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400',
          )}>
            {remaining >= 0 ? '+' : ''}{formatCOP(remaining)}
          </span>
        </div>
      )}

      {/* Budget cards */}
      {!collapsed && (
        <div className="space-y-2">
          {budgets.map(b => {
            const bm = bmMap.get(`${b.id}|${month}`) ?? null;
            const spent = bm ? (expenseMap.get(bm.id) ?? 0) : 0;
            return (
              <BudgetCard
                key={b.id}
                budget={b}
                bm={bm}
                spentAmount={spent}
                month={month}
                householdId={householdId}
                userId={userId}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// BalanceCard — hero card at top
// ---------------------------------------------------------------------------

interface BalanceCardProps {
  available: number;
  totalBudgeted: number;
  totalSpent: number;
  month: string;
  hasMissingTrm: boolean;
}

function BalanceCard({ available, totalBudgeted, totalSpent, month, hasMissingTrm }: BalanceCardProps) {
  const { formatCOP } = useNumberFormat();
  const balance = available - totalBudgeted;
  const positive = balance >= 0;

  return (
    <div className={cn(
      'rounded-2xl p-5 text-white shadow-lg',
      hasMissingTrm
        ? 'bg-gradient-to-br from-amber-500 to-amber-600'
        : positive
          ? 'bg-gradient-to-br from-pink-500 to-violet-600'
          : 'bg-gradient-to-br from-red-500 to-pink-700',
    )}>
      <p className="text-[11px] font-semibold opacity-70 mb-1 uppercase tracking-wider">
        {formatMonthLabel(month)}
      </p>

      {/* Main balance number */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-xs opacity-70 mb-0.5">Balance real</p>
          <p className="text-3xl font-bold tabular-nums leading-none tracking-tight">
            {balance > 0 ? '+' : ''}{formatCOP(balance)}
          </p>
        </div>
        <Wallet size={28} className="opacity-25 mb-1" />
      </div>

      {hasMissingTrm && (
        <div className="flex items-center gap-1.5 text-xs opacity-90 bg-black/15 rounded-lg px-3 py-1.5 mb-3">
          <AlertTriangle size={12} />
          Ingresos USD excluidos — ingresa la TRM en la sección Ingresos
        </div>
      )}

      {/* Three-stat strip */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/20 mt-1">
        <div className="text-center">
          <p className="text-[10px] opacity-55 mb-0.5 uppercase tracking-wide">Disponible</p>
          <p className="text-sm font-bold tabular-nums">{formatCOP(available)}</p>
        </div>
        <div className="text-center border-x border-white/20">
          <p className="text-[10px] opacity-55 mb-0.5 uppercase tracking-wide">Presupuest.</p>
          <p className="text-sm font-bold tabular-nums">{formatCOP(totalBudgeted)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] opacity-55 mb-0.5 uppercase tracking-wide">Ejecutado</p>
          <p className="text-sm font-bold tabular-nums">{formatCOP(totalSpent)}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IncomeSection — collapsible list of income sources
// ---------------------------------------------------------------------------

interface IncomeSectionProps {
  incomes: IncomeRow[];
  imMap: Map<string, IncomeMonthRow>;
  trm: number | null;
  totalAvailable: number;
  hasMissingTrm: boolean;
}

function IncomeSection({ incomes, imMap, trm, totalAvailable, hasMissingTrm }: IncomeSectionProps) {
  const { formatCOP, formatNumber } = useNumberFormat();
  const [collapsed, setCollapsed] = useState(true);

  return (
    <section>
      <button
        className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border bg-[var(--group-available-bg)] border-[var(--border-medium)] mb-2 transition-colors text-left"
        onClick={() => setCollapsed(c => !c)}
      >
        <TrendingUp size={15} className="text-[var(--group-available-text)] shrink-0" />
        <span className="flex-1 text-sm font-bold uppercase tracking-wide text-[var(--group-available-text)]">
          Ingresos
        </span>
        {hasMissingTrm && (
          <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium shrink-0">
            Sin TRM
          </span>
        )}
        <span className="text-sm font-semibold tabular-nums text-[var(--group-available-text)] shrink-0">
          {formatCOP(totalAvailable)}
        </span>
        <span className={cn(
          'shrink-0 text-[var(--group-available-text)] transition-transform duration-200',
          collapsed && 'rotate-180',
        )}>
          <ChevronUp size={14} />
        </span>
      </button>

      {!collapsed && (
        <div className="space-y-2">
          {incomes.map(inc => {
            const im = imMap.get(inc.id);
            const amount = im ? im.real_amount : inc.default_amount;
            const currency = im ? im.currency : inc.currency;
            const isUSD = currency !== 'COP';
            const copEquiv = isUSD && trm ? Math.round(amount * trm) : null;
            const isModified = im !== null;

            return (
              <div
                key={inc.id}
                className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] px-4 py-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {inc.name}
                    </p>
                    {isModified && (
                      <span className="text-[10px] text-violet-400 font-medium shrink-0">editado</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {inc.is_fixed === 1 ? 'Fijo' : 'Variable'}
                    {isUSD && (
                      <>
                        {' · '}
                        {trm
                          ? <span>TRM {formatNumber(trm)}</span>
                          : <span className="text-amber-500">Sin TRM</span>
                        }
                      </>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                    {isUSD && <span className="text-xs text-violet-400 mr-1">USD</span>}
                    {formatNumber(amount)}
                  </p>
                  {copEquiv !== null && (
                    <p className="text-xs text-[var(--text-muted)] tabular-nums">
                      ≈ {formatCOP(copEquiv)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// MonthViewPage
// ---------------------------------------------------------------------------

export function MonthViewPage() {
  const { session } = useAuth();
  const [month, setMonth] = useState(getCurrentMonth());

  const householdId = session?.householdId ?? '';
  const userId = session?.userId ?? '';

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: budgets = [] } = useQuery<BudgetRow>(
    `SELECT id, name, category_id, paid_with_credit_card, default_amount, household_id, start_month, end_month
     FROM budgets WHERE deleted_at IS NULL ORDER BY paid_with_credit_card DESC, name ASC`,
  );

  const { data: budgetMonths = [] } = useQuery<BudgetMonthRow>(
    `SELECT id, budget_id, month, amount, is_executed
     FROM budget_months WHERE month = ?`,
    [month],
  );

  const { data: expenseSums = [] } = useQuery<ExpenseSumRow>(
    `SELECT e.budget_month_id, SUM(e.amount) as total
     FROM expenses e
     JOIN budget_months bm ON bm.id = e.budget_month_id
     WHERE bm.month = ? AND e.deleted_at IS NULL
     GROUP BY e.budget_month_id`,
    [month],
  );

  const { data: incomes = [] } = useQuery<IncomeRow>(
    `SELECT id, default_amount, currency, start_month, name, is_fixed
     FROM incomes WHERE deleted_at IS NULL`,
  );

  const { data: incomeMonths = [] } = useQuery<IncomeMonthRow>(
    `SELECT income_id, real_amount, currency
     FROM income_months WHERE month = ?`,
    [month],
  );

  const { data: exchangeRates = [] } = useQuery<ExchangeRateRow>(
    `SELECT rate FROM exchange_rates
     WHERE from_currency = 'USD' AND to_currency = 'COP' AND month = ?`,
    [month],
  );

  // ── Build lookup maps ──────────────────────────────────────────────────────

  const bmMap = new Map<string, BudgetMonthRow>();
  for (const bm of budgetMonths) bmMap.set(`${bm.budget_id}|${bm.month}`, bm);

  const expenseMap = new Map<string, number>();
  for (const es of expenseSums) expenseMap.set(es.budget_month_id, es.total);

  const imMap = new Map<string, IncomeMonthRow>();
  for (const im of incomeMonths) imMap.set(im.income_id, im);

  const trm = exchangeRates[0]?.rate ?? null;

  // ── Compute available income ───────────────────────────────────────────────

  let totalAvailable = 0;
  let hasMissingTrm = false;

  for (const inc of incomes) {
    if (inc.start_month > month) continue;
    const im = imMap.get(inc.id);
    const amount = im ? im.real_amount : inc.default_amount;
    const currency = im ? im.currency : inc.currency;
    if (currency === 'COP') {
      totalAvailable += amount;
    } else if (trm) {
      totalAvailable += Math.round(amount * trm);
    } else {
      hasMissingTrm = true;
    }
  }

  // ── Filter budgets active in this month ───────────────────────────────────

  const activeForMonth = budgets.filter(b =>
    b.start_month <= month &&
    (b.end_month == null || b.end_month >= month),
  );

  const creditCardBudgets = activeForMonth.filter(b => b.paid_with_credit_card === 1);
  const cashBudgets = activeForMonth.filter(b => b.paid_with_credit_card === 0);

  // ── Group totals ───────────────────────────────────────────────────────────

  function groupTotals(group: BudgetRow[]) {
    let budgeted = 0, spent = 0;
    for (const b of group) {
      const bm = bmMap.get(`${b.id}|${month}`);
      budgeted += bm?.amount ?? b.default_amount;
      spent += bm ? (expenseMap.get(bm.id) ?? 0) : 0;
    }
    return { budgeted, spent };
  }

  const ccTotals = groupTotals(creditCardBudgets);
  const cashTotals = groupTotals(cashBudgets);
  const totalBudgeted = ccTotals.budgeted + cashTotals.budgeted;
  const totalSpent = ccTotals.spent + cashTotals.spent;

  // ── Active income sources ─────────────────────────────────────────────────

  const activeIncomes = incomes.filter(inc => inc.start_month <= month);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">

      <AppHeader
        emoji="🗓️"
        title="Vista Mensual"
        subtitle={formatMonthLabel(month)}
        maxWidth="max-w-lg"
      />

      {/* Month navigator */}
      <div className="max-w-lg mx-auto w-full px-4 py-2.5 flex items-center gap-3">
        <button
          onClick={() => setMonth(m => prevMonth(m))}
          className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          aria-label="Mes anterior"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="flex-1 text-center text-sm font-semibold text-[var(--text-primary)]">
          {formatMonthLabel(month)}
        </h2>
        <button
          onClick={() => setMonth(m => nextMonth(m))}
          className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          aria-label="Mes siguiente"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Scrollable content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-lg mx-auto px-4 pb-6 space-y-4">

          {/* Hero balance card */}
          <BalanceCard
            available={totalAvailable}
            totalBudgeted={totalBudgeted}
            totalSpent={totalSpent}
            month={month}
            hasMissingTrm={hasMissingTrm}
          />

          {/* Empty state */}
          {activeForMonth.length === 0 && (
            <div className="text-center py-16 text-[var(--text-muted)]">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-sm font-medium text-[var(--text-secondary)]">Sin presupuestos activos</p>
              <p className="text-xs mt-1">Agrega presupuestos desde la sección Presupuestos</p>
            </div>
          )}

          {/* Credit Card group */}
          <GroupSection
            label="Tarjeta de Crédito"
            icon={<CreditCard size={15} />}
            accent="violet"
            budgets={creditCardBudgets}
            bmMap={bmMap}
            expenseMap={expenseMap}
            month={month}
            householdId={householdId}
            userId={userId}
            totalBudgeted={ccTotals.budgeted}
            totalSpent={ccTotals.spent}
          />

          {/* Cash group */}
          <GroupSection
            label="Efectivo"
            icon={<Banknote size={15} />}
            accent="green"
            budgets={cashBudgets}
            bmMap={bmMap}
            expenseMap={expenseMap}
            month={month}
            householdId={householdId}
            userId={userId}
            totalBudgeted={cashTotals.budgeted}
            totalSpent={cashTotals.spent}
          />

          {/* Income section */}
          {activeIncomes.length > 0 && (
            <IncomeSection
              incomes={activeIncomes}
              imMap={imMap}
              trm={trm}
              totalAvailable={totalAvailable}
              hasMissingTrm={hasMissingTrm}
            />
          )}

        </div>
      </main>

      <AppNav />
    </div>
  );
}
