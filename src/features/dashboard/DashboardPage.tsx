/**
 * DashboardPage — /dashboard
 *
 * Resumen visual e inteligente del presupuesto familiar.
 *
 * Secciones:
 *   1. KPI hero strip   — Balance, Presupuestado, Gastado, Disponible del mes
 *   2. Tendencia 6M     — BarChart presupuesto vs gasto por mes
 *   3. Distribución     — PieChart por categoría (gasto real del mes)
 *   4. CC vs Efectivo   — PieChart tipo de pago
 *   5. Top presupuestos — BarChart horizontal de los más costosos
 *   6. Balance mensual  — AreaChart de balance real últimos 6 meses
 *   7. Gastos recientes — Feed de las últimas transacciones
 */

import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Scale, CreditCard, Banknote, AlertCircle } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { cn } from '@/shared/ui/cn';
import { CATEGORY_MAP } from '@/domain/budget/categories';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function prevNMonths(n: number): string[] {
  const months: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

function shortMonth(ym: string): string {
  return MONTH_LABELS[ym.slice(5, 7)] ?? ym.slice(5, 7);
}

function formatK(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

// ---------------------------------------------------------------------------
// Raw SQL row types
// ---------------------------------------------------------------------------

interface BudgetRow {
  id: string;
  name: string;
  category_id: string;
  paid_with_credit_card: number;
  default_amount: number;
  start_month: string;
  end_month: string | null;
}

interface BudgetMonthRow {
  budget_id: string;
  month: string;
  amount: number;
}

interface ExpenseSumRow {
  budget_month_id: string;
  month: string;
  total: number;
}

interface BudgetMonthIdRow {
  id: string;
  budget_id: string;
  month: string;
  amount: number;
}

interface IncomeRow {
  id: string;
  default_amount: number;
  currency: string;
  start_month: string;
  end_month: string | null;
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

interface RecentExpenseRow {
  id: string;
  amount: number;
  note: string | null;
  timestamp: string;
  budget_name: string;
  category_id: string;
}

interface DebtDashRow {
  id: string;
  name: string;
  initial_amount: number;
  currency: string;
}

interface DebtTxDashRow {
  debt_id: string;
  type: string;
  amount: number;
  date: string;
}

interface DailyExpenseRow {
  day: string; // 'YYYY-MM-DD'
  total: number;
}

// ---------------------------------------------------------------------------
// Shared chart tooltip styles
// ---------------------------------------------------------------------------

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

function ChartTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-lg px-3 py-2.5 text-xs">
      {label && <p className="font-semibold text-[var(--text-primary)] mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold">{formatK(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function PieTooltip({
  active, payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { color: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-[var(--text-primary)]">{p.name}</p>
      <p style={{ color: p.payload.color }}>{formatK(p.value)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  highlight?: 'positive' | 'negative' | 'warning' | 'default';
  formatCOP: (v: number) => string;
}

function KpiCard({ label, value, icon, highlight = 'default', formatCOP }: KpiCardProps) {
  const colorMap = {
    positive: 'text-green-600 dark:text-green-400',
    negative: 'text-red-500 dark:text-red-400',
    warning: 'text-amber-500 dark:text-amber-400',
    default: 'text-[var(--text-primary)]',
  };

  const formatted = formatCOP(value);
  // Scale font size down for long strings (full COP format can be 12+ chars)
  const textSize =
    formatted.length > 11 ? 'text-sm' :
    formatted.length > 8  ? 'text-base' :
                             'text-xl';

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm px-4 py-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
        <span className="text-[var(--text-muted)]">{icon}</span>
      </div>
      <p className={cn('font-bold tabular-nums leading-tight', textSize, colorMap[highlight])}>
        <AbbreviatedAmount value={value} />
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function ChartCard({ title, subtitle, children, className }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-5', className)}>
      <div className="mb-4">
        <h2 className="text-sm font-bold text-[var(--text-primary)]">{title}</h2>
        {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Pie label
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (percent < 0.06) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={10} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ---------------------------------------------------------------------------
// DashboardPage
// ---------------------------------------------------------------------------

export function DashboardPage() {
  useAuth(); // ensures auth context is available
  const { formatCOP } = useNumberFormat();

  const currentMonth = getCurrentMonth();
  const last6 = useMemo(() => prevNMonths(6), []);
  // ── All budgets ────────────────────────────────────────────────────────────
  const { data: budgets = [] } = useQuery<BudgetRow>(
    `SELECT id, name, category_id, paid_with_credit_card, default_amount, start_month, end_month
     FROM budgets WHERE deleted_at IS NULL`,
  );

  // ── Budget months for last 6 months ────────────────────────────────────────
  const { data: budgetMonthAmounts = [] } = useQuery<BudgetMonthRow>(
    `SELECT budget_id, month, amount
     FROM budget_months
     WHERE month IN (${last6.map(() => '?').join(',')})`,
    last6,
  );

  // ── Budget month IDs (needed to join expenses) ─────────────────────────────
  const { data: budgetMonthIds = [] } = useQuery<BudgetMonthIdRow>(
    `SELECT id, budget_id, month, amount
     FROM budget_months
     WHERE month IN (${last6.map(() => '?').join(',')})`,
    last6,
  );

  // ── Expense sums grouped by budget_month ───────────────────────────────────
  const { data: expenseSums = [] } = useQuery<ExpenseSumRow>(
    `SELECT e.budget_month_id, bm.month, SUM(e.amount) as total
     FROM expenses e
     JOIN budget_months bm ON bm.id = e.budget_month_id
     WHERE bm.month IN (${last6.map(() => '?').join(',')}) AND e.deleted_at IS NULL
     GROUP BY e.budget_month_id, bm.month`,
    last6,
  );

  // ── Incomes + income months ────────────────────────────────────────────────
  const { data: incomes = [] } = useQuery<IncomeRow>(
    `SELECT id, default_amount, currency, start_month, end_month FROM incomes WHERE deleted_at IS NULL`,
  );

  const { data: incomeMonths = [] } = useQuery<IncomeMonthRow>(
    `SELECT income_id, month, real_amount, currency
     FROM income_months WHERE month IN (${last6.map(() => '?').join(',')})`,
    last6,
  );

  // ── Exchange rates ─────────────────────────────────────────────────────────
  const { data: exchangeRates = [] } = useQuery<ExchangeRateRow>(
    `SELECT month, rate FROM exchange_rates
     WHERE from_currency = 'USD' AND to_currency = 'COP'
     AND month IN (${last6.map(() => '?').join(',')})`,
    last6,
  );

  // ── Recent expenses (last 10, this month) ─────────────────────────────────
  const { data: recentExpenses = [] } = useQuery<RecentExpenseRow>(
    `SELECT e.id, e.amount, e.note, e.timestamp, b.name as budget_name, b.category_id
     FROM expenses e
     JOIN budgets b ON b.id = e.budget_id
     WHERE e.deleted_at IS NULL AND e.amount > 0
     ORDER BY e.timestamp DESC, e.created_at DESC
     LIMIT 10`,
  );

  // ── Debts ─────────────────────────────────────────────────────────────────
  const { data: dashDebts = [] } = useQuery<DebtDashRow>(
    `SELECT id, name, initial_amount, currency FROM debts WHERE deleted_at IS NULL`,
  );

  const { data: dashDebtTxs = [] } = useQuery<DebtTxDashRow>(
    `SELECT debt_id, type, amount, date FROM debt_transactions WHERE deleted_at IS NULL ORDER BY date ASC`,
  );

  // Most recent TRM available (not limited to last 6 months — needed for USD debts)
  const { data: latestTrmRows = [] } = useQuery<ExchangeRateRow>(
    `SELECT month, rate FROM exchange_rates
     WHERE from_currency = 'USD' AND to_currency = 'COP'
     ORDER BY month DESC LIMIT 1`,
  );

  // ── Daily expense distribution for Restaurantes (current month) ────────────
  // Join expenses → budget_months → budgets filtered by category_id = 'restaurants'
  const { data: restaurantesDailyRaw = [] } = useQuery<DailyExpenseRow>(
    `SELECT substr(e.timestamp, 1, 10) as day, SUM(e.amount) as total
     FROM expenses e
     JOIN budget_months bm ON bm.id = e.budget_month_id
     JOIN budgets b ON b.id = bm.budget_id
     WHERE bm.month = ?
       AND b.category_id = 'restaurants'
       AND e.deleted_at IS NULL
       AND e.amount > 0
     GROUP BY substr(e.timestamp, 1, 10)
     ORDER BY day ASC`,
    [currentMonth],
  );

  // ── Daily expense distribution for Groceries (current month) ──────────────
  const { data: groceriesDailyRaw = [] } = useQuery<DailyExpenseRow>(
    `SELECT substr(e.timestamp, 1, 10) as day, SUM(e.amount) as total
     FROM expenses e
     JOIN budget_months bm ON bm.id = e.budget_month_id
     JOIN budgets b ON b.id = bm.budget_id
     WHERE bm.month = ?
       AND b.category_id = 'groceries'
       AND e.deleted_at IS NULL
       AND e.amount > 0
     GROUP BY substr(e.timestamp, 1, 10)
     ORDER BY day ASC`,
    [currentMonth],
  );

  // ── Build lookup maps ──────────────────────────────────────────────────────

  const bmIdMap = useMemo(() => {
    const m = new Map<string, BudgetMonthIdRow>(); // key: `${budget_id}|${month}`
    for (const bm of budgetMonthIds) m.set(`${bm.budget_id}|${bm.month}`, bm);
    return m;
  }, [budgetMonthIds]);

  const expenseByBmId = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenseSums) m.set(e.budget_month_id, (m.get(e.budget_month_id) ?? 0) + e.total);
    return m;
  }, [expenseSums]);

  const budgetAmountMap = useMemo(() => {
    const m = new Map<string, number>(); // key: `${budget_id}|${month}`
    for (const bm of budgetMonthAmounts) m.set(`${bm.budget_id}|${bm.month}`, bm.amount);
    return m;
  }, [budgetMonthAmounts]);

  const imMap = useMemo(() => {
    const m = new Map<string, IncomeMonthRow>(); // key: `${income_id}|${month}`
    for (const im of incomeMonths) m.set(`${im.income_id}|${im.month}`, im);
    return m;
  }, [incomeMonths]);

  const trmMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const er of exchangeRates) m.set(er.month, er.rate);
    return m;
  }, [exchangeRates]);


  // ── Per-month aggregates ───────────────────────────────────────────────────

  const monthlyData = useMemo(() => {
    return last6.map(month => {
      const trm = trmMap.get(month) ?? null;

      // Available income
      let available = 0;
      for (const inc of incomes) {
        if (inc.start_month > month) continue;
        if (inc.end_month != null && inc.end_month < month) continue;
        const im = imMap.get(`${inc.id}|${month}`);
        const amount = im ? im.real_amount : inc.default_amount;
        const currency = im ? im.currency : inc.currency;
        if (currency === 'COP') available += amount;
        else if (trm) available += Math.round(amount * trm);
      }

      // Budgeted & spent — cash only (paid_with_credit_card = 0).
      // Credit card budgets are excluded from these metrics because they
      // are not a real cash outflow (the card bill is paid separately).
      let budgeted = 0, spent = 0;
      for (const b of budgets) {
        if (b.paid_with_credit_card === 1) continue; // skip CC budgets
        if (b.start_month > month) continue;
        if (b.end_month && b.end_month < month) continue;
        const bmKey = `${b.id}|${month}`;
        const bmRow = bmIdMap.get(bmKey);
        const amount = budgetAmountMap.get(bmKey) ?? b.default_amount;
        budgeted += amount;
        if (bmRow) spent += expenseByBmId.get(bmRow.id) ?? 0;
      }

      // Balance real = Disponible − Presupuestado (efectivo)
      // "¿cuánto del ingreso queda libre después de comprometer el presupuesto?"
      const balance = available - budgeted;
      // Por ejecutar = Presupuestado − Ejecutado (efectivo, floor at 0)
      // "¿cuánto del presupuesto comprometido aún no se ha gastado?"
      const pending = Math.max(0, budgeted - spent);

      return { month, label: shortMonth(month), available, budgeted, spent, balance, pending };
    });
  }, [last6, budgets, incomes, budgetAmountMap, bmIdMap, expenseByBmId, imMap, trmMap]);

  // Current month metrics
  const currentData = monthlyData.find(d => d.month === currentMonth) ?? {
    available: 0, budgeted: 0, spent: 0, balance: 0, pending: 0,
  };

  // ── Pie: spending by category (current month) ──────────────────────────────

  const categoryPieData = useMemo(() => {
    const catSpend = new Map<string, number>();
    for (const b of budgets) {
      if (b.start_month > currentMonth) continue;
      if (b.end_month && b.end_month < currentMonth) continue;
      const bmRow = bmIdMap.get(`${b.id}|${currentMonth}`);
      if (!bmRow) continue;
      const spent = expenseByBmId.get(bmRow.id) ?? 0;
      if (spent <= 0) continue;
      const cat = b.category_id;
      catSpend.set(cat, (catSpend.get(cat) ?? 0) + spent);
    }
    return Array.from(catSpend.entries())
      .map(([cat, value]) => ({
        name: CATEGORY_MAP.get(cat)?.name ?? 'Otro',
        value,
        color: CATEGORY_MAP.get(cat)?.color ?? '#cbd5e1',
        emoji: CATEGORY_MAP.get(cat)?.emoji ?? '•',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [budgets, bmIdMap, expenseByBmId, currentMonth]);

  // ── Pie: CC vs Efectivo (current month) ───────────────────────────────────

  const paymentPieData = useMemo(() => {
    let cc = 0, cash = 0;
    for (const b of budgets) {
      if (b.start_month > currentMonth) continue;
      if (b.end_month && b.end_month < currentMonth) continue;
      const bmRow = bmIdMap.get(`${b.id}|${currentMonth}`);
      const spent = bmRow ? (expenseByBmId.get(bmRow.id) ?? 0) : 0;
      if (b.paid_with_credit_card === 1) cc += spent;
      else cash += spent;
    }
    const data = [];
    if (cc > 0) data.push({ name: 'Tarjeta', value: cc, color: '#a78bfa' });
    if (cash > 0) data.push({ name: 'Efectivo', value: cash, color: '#34d399' });
    return data;
  }, [budgets, bmIdMap, expenseByBmId, currentMonth]);

  // ── Top budgets by spending (current month) ────────────────────────────────

  const topBudgets = useMemo(() => {
    return budgets
      .filter(b => {
        if (b.start_month > currentMonth) return false;
        if (b.end_month && b.end_month < currentMonth) return false;
        return true;
      })
      .map(b => {
        const bmRow = bmIdMap.get(`${b.id}|${currentMonth}`);
        const budgeted = budgetAmountMap.get(`${b.id}|${currentMonth}`) ?? b.default_amount;
        const spent = bmRow ? (expenseByBmId.get(bmRow.id) ?? 0) : 0;
        const cat = CATEGORY_MAP.get(b.category_id);
        return {
          name: b.name,
          budgeted,
          spent,
          pct: budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : 0,
          color: cat?.color ?? '#cbd5e1',
          emoji: cat?.emoji ?? '•',
        };
      })
      .filter(b => b.budgeted > 0)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 6);
  }, [budgets, bmIdMap, budgetAmountMap, expenseByBmId, currentMonth]);

  // ── Rubros excedidos en los últimos 6 meses ───────────────────────────────
  // For each budget × month combination where spent > budgeted, produce one row.
  // Both CC and cash budgets are included here (spending reality check).

  interface ExceededRow {
    budgetId: string;
    name: string;
    emoji: string;
    color: string;
    isCreditCard: boolean;
    month: string;
    label: string;
    budgeted: number;
    spent: number;
    overage: number;
    pct: number;
  }

  const exceededBudgets = useMemo((): ExceededRow[] => {
    const rows: ExceededRow[] = [];
    for (const b of budgets) {
      for (const month of last6) {
        if (b.start_month > month) continue;
        if (b.end_month && b.end_month < month) continue;
        const bmKey = `${b.id}|${month}`;
        const bmRow = bmIdMap.get(bmKey);
        if (!bmRow) continue;
        const spent = expenseByBmId.get(bmRow.id) ?? 0;
        if (spent <= 0) continue;
        const budgeted = budgetAmountMap.get(bmKey) ?? b.default_amount;
        if (spent <= budgeted) continue;
        const cat = CATEGORY_MAP.get(b.category_id);
        rows.push({
          budgetId: b.id,
          name: b.name,
          emoji: cat?.emoji ?? '•',
          color: cat?.color ?? '#cbd5e1',
          isCreditCard: b.paid_with_credit_card === 1,
          month,
          label: shortMonth(month),
          budgeted,
          spent,
          overage: spent - budgeted,
          pct: budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0,
        });
      }
    }
    return rows.sort((a, b) => b.overage - a.overage);
  }, [budgets, last6, bmIdMap, expenseByBmId, budgetAmountMap]);

  // ── Format recent expense date ─────────────────────────────────────────────

  function fmtDate(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
    } catch { return iso.slice(0, 10); }
  }

  // ── Debt computations ─────────────────────────────────────────────────────

  // Latest available TRM (for USD debt conversion)
  const latestTrm = latestTrmRows[0]?.rate ?? null;

  /** Convert a debt's initial_amount to COP using the best available TRM.
   *  All transaction amounts are already stored in COP (mutationWrappers converts at insert time),
   *  so only initial_amount needs conversion here. */
  function debtInitialCOP(debt: DebtDashRow): number {
    if (debt.currency === 'COP') return debt.initial_amount;
    // Use the TRM for the month of disbursement if available, else fall back to latest
    const trm = latestTrm ?? 0;
    return Math.round(debt.initial_amount * trm);
  }

  /** Per-debt balance (COP) and progress, sorted by pending balance desc */
  const debtProgressData = useMemo(() => {
    return dashDebts
      .map(debt => {
        const initialCOP = debtInitialCOP(debt);
        const txs = dashDebtTxs.filter(t => t.debt_id === debt.id);
        const credits = txs.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
        const debits  = txs.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
        const totalBase = initialCOP + credits; // inicial COP + aumentos (ya en COP)
        const balance   = totalBase - debits;
        const pctPaid   = totalBase > 0
          ? Math.min(Math.max(debits / totalBase * 100, 0), 100)
          : 0;
        return { id: debt.id, name: debt.name, balance, initial: totalBase, pctPaid };
      })
      .sort((a, b) => b.balance - a.balance);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashDebts, dashDebtTxs, latestTrm]);

  const totalDebtBalance = useMemo(
    () => debtProgressData.reduce((s, d) => s + Math.max(d.balance, 0), 0),
    [debtProgressData],
  );

  /** Monthly total debt balance for last 6 months — AreaChart data */
  const debtEvolutionData = useMemo(() => {
    return last6.map(month => {
      const endOfMonth = `${month}-31`;
      let total = 0;
      for (const debt of dashDebts) {
        const initialCOP = debtInitialCOP(debt);
        const txs = dashDebtTxs.filter(t => t.debt_id === debt.id && t.date <= endOfMonth);
        const credits = txs.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
        const debits  = txs.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
        const balance = initialCOP + credits - debits;
        total += Math.max(balance, 0);
      }
      return { month, label: shortMonth(month), saldo: total };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last6, dashDebts, dashDebtTxs, latestTrm]);

  const hasDebts = dashDebts.length > 0;

  // ── Daily distribution charts ─────────────────────────────────────────────
  // Build a full array of days for the current month, filling 0 for days with no spend.

  function buildDailyChartData(rawRows: DailyExpenseRow[]): { day: number; label: string; total: number }[] {
    const [y, m] = currentMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const rawMap = new Map(rawRows.map(r => [parseInt(r.day.slice(8, 10), 10), r.total]));
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      return { day: d, label: String(d), total: rawMap.get(d) ?? 0 };
    });
  }

  const restaurantesDailyData = useMemo(
    () => buildDailyChartData(restaurantesDailyRaw),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [restaurantesDailyRaw, currentMonth],
  );

  const groceriesDailyData = useMemo(
    () => buildDailyChartData(groceriesDailyRaw),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groceriesDailyRaw, currentMonth],
  );

  const hasRestaurantes = restaurantesDailyRaw.length > 0;
  const hasGroceries = groceriesDailyRaw.length > 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasSpend = currentData.spent > 0;
  const balanceHighlight: 'positive' | 'negative' | 'default' =
    currentData.balance > 0 ? 'positive' : currentData.balance < 0 ? 'negative' : 'default';

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">
      <AppHeader
        emoji="✨"
        title="Dashboard"
        subtitle={`${shortMonth(currentMonth)} ${currentMonth.slice(0, 4)}`}
        maxWidth="max-w-4xl"
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-5 space-y-5">

        {/* ── KPI strip ── */}
        {/* All cash-only metrics (paid_with_credit_card = 0):                    */}
        {/* Balance real    = Disponible − Presupuestado                           */}
        {/* Presupuestado   = total presupuesto efectivo comprometido              */}
        {/* Ejecutado       = gasto real registrado en efectivo                   */}
        {/* Por ejecutar    = Presupuestado − Ejecutado (pendiente del presupuesto)*/}
        <div className={`grid grid-cols-2 gap-3 ${hasDebts ? 'sm:grid-cols-6' : 'sm:grid-cols-5'}`}>
          <KpiCard
            label="Balance real"
            value={currentData.balance}
            icon={<Scale size={16} />}
            highlight={balanceHighlight}
            formatCOP={formatCOP}
          />
          <KpiCard
            label="Disponible"
            value={currentData.available}
            icon={<Wallet size={16} />}
            highlight="default"
            formatCOP={formatCOP}
          />
          <KpiCard
            label="Presupuestado"
            value={currentData.budgeted}
            icon={<TrendingUp size={16} />}
            highlight="default"
            formatCOP={formatCOP}
          />
          <KpiCard
            label="Ejecutado"
            value={currentData.spent}
            icon={<TrendingDown size={16} />}
            highlight={currentData.spent > currentData.budgeted ? 'negative' : 'default'}
            formatCOP={formatCOP}
          />
          <KpiCard
            label="Por ejecutar"
            value={currentData.pending ?? 0}
            icon={<TrendingDown size={16} />}
            highlight="default"
            formatCOP={formatCOP}
          />
          {hasDebts && (
            <KpiCard
              label="Total adeudado"
              value={totalDebtBalance}
              icon={<AlertCircle size={16} />}
              highlight={totalDebtBalance > 0 ? 'negative' : 'positive'}
              formatCOP={formatCOP}
            />
          )}
        </div>

        {/* ── Tendencia + Balance — 2-col en lg ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartCard
            title="Tendencia de los últimos 6 meses"
            subtitle="Presupuestado vs. gastado real"
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} barCategoryGap="28%" barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tickFormatter={formatK}
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  axisLine={false} tickLine={false} width={48}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)', paddingTop: 8 }}
                  formatter={(v) => v === 'budgeted' ? 'Presupuestado' : 'Gastado'}
                />
                <Bar dataKey="budgeted" name="budgeted" fill="#c4b5fd" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spent" name="spent" fill="#f472b6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Balance real mes a mes"
            subtitle="Disponible − Presupuestado (efectivo)"
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f472b6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f472b6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tickFormatter={formatK}
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  axisLine={false} tickLine={false} width={48}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="balance"
                  name="Balance"
                  stroke="#f472b6"
                  strokeWidth={2.5}
                  fill="url(#balanceGrad)"
                  dot={{ r: 3, fill: '#f472b6', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#f472b6' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* ── Pies row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

          {/* Pie por categoría */}
          <ChartCard
            title="Gasto por categoría"
            subtitle={hasSpend ? 'Distribución este mes' : 'Sin datos este mes'}
          >
            {hasSpend && categoryPieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={categoryPieData}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={88}
                      paddingAngle={2}
                      dataKey="value"
                      labelLine={false}
                      label={PieLabel}
                    >
                      {categoryPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2 justify-center">
                  {categoryPieData.map((d, i) => (
                    <span key={i} className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                      {d.emoji} {d.name}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-[var(--text-muted)] text-sm">
                Sin gastos registrados
              </div>
            )}
          </ChartCard>

          {/* Pie CC vs Efectivo */}
          <ChartCard
            title="Tarjeta vs. Efectivo"
            subtitle={hasSpend ? 'Distribución por tipo de pago' : 'Sin datos este mes'}
          >
            {hasSpend && paymentPieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={paymentPieData}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={88}
                      paddingAngle={3}
                      dataKey="value"
                      labelLine={false}
                      label={PieLabel}
                    >
                      {paymentPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2 justify-center">
                  {paymentPieData.map((d, i) => (
                    <span key={i} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
                      {d.name === 'Tarjeta' ? <CreditCard size={12} /> : <Banknote size={12} />}
                      {d.name} — <AbbreviatedAmount value={d.value} className="font-semibold text-[var(--text-secondary)]" />
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-[var(--text-muted)] text-sm">
                Sin gastos registrados
              </div>
            )}
          </ChartCard>
        </div>

        {/* ── Top presupuestos (barra horizontal de ejecución) ── */}
        {topBudgets.length > 0 && (
          <ChartCard
            title="Top presupuestos este mes"
            subtitle="Ejecución: gastado sobre presupuestado"
          >
            <div className="space-y-3">
              {topBudgets.map((b, i) => {
                const over = b.spent > b.budgeted;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)] truncate">
                        <span>{b.emoji}</span>
                        <span className="truncate">{b.name}</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <AbbreviatedAmount value={b.spent} className={cn('text-[11px] font-semibold tabular-nums',
                          over ? 'text-red-500 dark:text-red-400' : 'text-[var(--text-secondary)]')} />
                        <span className="text-[10px] text-[var(--text-muted)]">/ <AbbreviatedAmount value={b.budgeted} /></span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${b.pct}%`,
                          background: over ? '#f87171' : b.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        )}

        {/* ── Rubros excedidos en últimos 6 meses ── */}
        {exceededBudgets.length > 0 && (
          <ChartCard
            title="Rubros excedidos"
            subtitle={`Presupuestos superados en los últimos 6 meses (${exceededBudgets.length} ocurrencia${exceededBudgets.length !== 1 ? 's' : ''})`}
          >
            <div className="space-y-3">
              {exceededBudgets.map((b, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)] truncate min-w-0">
                      <span className="shrink-0">{b.emoji}</span>
                      <span className="truncate">{b.name}</span>
                      <span className="shrink-0 text-[10px] text-[var(--text-muted)] font-normal">
                        {b.label}
                      </span>
                      {b.isCreditCard && (
                        <CreditCard size={10} className="shrink-0 text-violet-400" />
                      )}
                    </span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[11px] font-bold tabular-nums text-red-500 dark:text-red-400">
                        +<AbbreviatedAmount value={b.overage} />
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {b.pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all bg-red-400"
                      style={{ width: `${Math.min(b.pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[10px] text-[var(--text-muted)]">Presup. <AbbreviatedAmount value={b.budgeted} /></span>
                    <span className="text-[10px] text-red-500 dark:text-red-400">Gastado <AbbreviatedAmount value={b.spent} /></span>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        )}

        {/* ── Gastos recientes ── */}
        {recentExpenses.length > 0 && (
          <ChartCard title="Gastos recientes" subtitle="Últimas transacciones registradas">
            <div className="space-y-1 -mx-1">
              {recentExpenses.map(exp => {
                const cat = CATEGORY_MAP.get(exp.category_id);
                return (
                  <div
                    key={exp.id}
                    className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <span className="w-8 h-8 rounded-xl bg-[var(--bg-surface-2)] flex items-center justify-center text-base shrink-0 border border-[var(--border-subtle)]">
                      {cat?.emoji ?? '💸'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                        {exp.budget_name}
                        {exp.note ? <span className="text-[var(--text-muted)] font-normal"> · {exp.note}</span> : null}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">{fmtDate(exp.timestamp)}</p>
                    </div>
                    <AbbreviatedAmount value={exp.amount} className="text-xs font-semibold text-[var(--text-primary)] tabular-nums shrink-0" />
                  </div>
                );
              })}
            </div>
          </ChartCard>
        )}

        {/* ── Deudas: progreso + evolución — 2-col en lg ── */}
        {hasDebts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <ChartCard
            title="Progreso de deudas"
            subtitle="Saldo pendiente por deuda"
          >
            <div className="space-y-4">
              {debtProgressData.map((d) => (
                <div key={d.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-[var(--text-primary)] truncate flex items-center gap-1.5">
                      💳 <span className="truncate">{d.name}</span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <AbbreviatedAmount value={Math.max(d.balance, 0)} className="text-[11px] font-semibold tabular-nums text-rose-500 dark:text-rose-400" />
                      <span className="text-[10px] text-[var(--text-muted)]">
                        / <AbbreviatedAmount value={d.initial} />
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] font-medium">
                        ({d.pctPaid.toFixed(0)}% pagado)
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${d.pctPaid}%`,
                        background: 'var(--accent-rose, #fb7185)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>

          <ChartCard
            title="Evolución de deudas"
            subtitle="Saldo total de deudas en los últimos 6 meses"
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={debtEvolutionData}>
                <defs>
                  <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fb7185" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tickFormatter={formatK}
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  axisLine={false} tickLine={false} width={52}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="saldo"
                  name="Saldo deudas"
                  stroke="#fb7185"
                  strokeWidth={2.5}
                  fill="url(#debtGrad)"
                  dot={{ r: 3, fill: '#fb7185', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#fb7185' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        )}

        {/* ── Distribución diaria: Restaurantes + Groceries ── */}
        {(hasRestaurantes || hasGroceries) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Restaurantes */}
            {hasRestaurantes && (
              <ChartCard
                title="🍽️ Restaurantes este mes"
                subtitle="Gasto diario en restaurantes"
              >
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={restaurantesDailyData} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                      axisLine={false} tickLine={false}
                      interval={4}
                    />
                    <YAxis
                      tickFormatter={formatK}
                      tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                      axisLine={false} tickLine={false} width={44}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const v = (payload[0]?.value as number) ?? 0;
                        if (v === 0) return null;
                        return (
                          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-lg px-3 py-2 text-xs">
                            <p className="font-semibold text-[var(--text-primary)] mb-0.5">Día {label}</p>
                            <p className="text-[#fb923c] font-semibold">{formatK(v)}</p>
                          </div>
                        );
                      }}
                      cursor={{ fill: 'var(--bg-hover)' }}
                    />
                    <Bar dataKey="total" name="Restaurantes" fill="#fdba74" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Groceries */}
            {hasGroceries && (
              <ChartCard
                title="🛍️ Groceries este mes"
                subtitle="Gasto diario en supermercado"
              >
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={groceriesDailyData} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                      axisLine={false} tickLine={false}
                      interval={4}
                    />
                    <YAxis
                      tickFormatter={formatK}
                      tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                      axisLine={false} tickLine={false} width={44}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const v = (payload[0]?.value as number) ?? 0;
                        if (v === 0) return null;
                        return (
                          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-lg px-3 py-2 text-xs">
                            <p className="font-semibold text-[var(--text-primary)] mb-0.5">Día {label}</p>
                            <p className="text-[#6ee7b7] font-semibold">{formatK(v)}</p>
                          </div>
                        );
                      }}
                      cursor={{ fill: 'var(--bg-hover)' }}
                    />
                    <Bar dataKey="total" name="Groceries" fill="#6ee7b7" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>
        )}

        {/* Empty state */}
        {budgets.length === 0 && (
          <div className="text-center py-20 text-[var(--text-muted)]">
            <p className="text-5xl mb-4">📊</p>
            <p className="text-sm font-medium text-[var(--text-secondary)]">Aún no hay datos</p>
            <p className="text-xs mt-1">Agrega presupuestos e ingresos para ver tus estadísticas</p>
          </div>
        )}

      </main>

      <AppNav />
    </div>
  );
}
