/**
 * MonthViewPage — /month
 *
 * Vista detallada de un mes: presupuestos agrupados por tipo de pago,
 * cada uno con ejecución real y acceso a gastos registrados.
 * Muestra ingresos y balance final del mes.
 *
 * Diseño de tarjetas, no tabular. Optimizado para móvil y escritorio.
 */

import { useState, useRef, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, CreditCard, Banknote,
  TrendingUp, AlertTriangle, Wallet,
  CheckCircle2, Circle, ChevronUp, SlidersHorizontal, Search, X,
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { cn } from '@/shared/ui/cn';
import { getCategoryEmoji, getCategoryName } from '@/domain/budget/categories';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortKey = 'pending-desc' | 'value-desc' | 'value-asc' | 'name' | 'category';
import { ExpenseFormDialog } from '@/features/expenses/ExpenseFormDialog';
import { updateBudgetMonthExecution, upsertBudgetMonth } from '@/infrastructure/powersync/mutationWrappers';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { useI18n } from '@/shared/i18n/I18nContext';
import {
  useMonthViewData,
  type BudgetRow,
  type BudgetMonthRow,
  type IncomeRow,
  type IncomeMonthRow,
} from '@/application/useMonthViewData';

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

/** Returns a copy of budgets filtered by name query and sorted by sortKey. */
function sortAndFilterBudgets(
  budgets: BudgetRow[],
  sortKey: SortKey,
  filterText: string,
  bmMap: Map<string, BudgetMonthRow>,
  month: string,
): BudgetRow[] {
  const q = filterText.toLowerCase().trim();
  const filtered = q ? budgets.filter(b => b.name.toLowerCase().includes(q)) : budgets;

  return [...filtered].sort((a, b) => {
    switch (sortKey) {
      case 'pending-desc': {
        const bmA = bmMap.get(`${a.id}|${month}`);
        const bmB = bmMap.get(`${b.id}|${month}`);
        const execA = bmA?.is_executed === 1 ? 1 : 0;
        const execB = bmB?.is_executed === 1 ? 1 : 0;
        if (execA !== execB) return execA - execB; // pending (0) before executed (1)
        if (execA === 0) {
          // Both pending: value desc, then name asc
          const amtA = bmA?.amount ?? a.default_amount;
          const amtB = bmB?.amount ?? b.default_amount;
          if (amtB !== amtA) return amtB - amtA;
        }
        return a.name.localeCompare(b.name);
      }
      case 'value-desc': {
        const amtA = bmMap.get(`${a.id}|${month}`)?.amount ?? a.default_amount;
        const amtB = bmMap.get(`${b.id}|${month}`)?.amount ?? b.default_amount;
        return amtB - amtA;
      }
      case 'value-asc': {
        const amtA = bmMap.get(`${a.id}|${month}`)?.amount ?? a.default_amount;
        const amtB = bmMap.get(`${b.id}|${month}`)?.amount ?? b.default_amount;
        return amtA - amtB;
      }
      case 'name':
        return a.name.localeCompare(b.name);
      case 'category': {
        const catCmp = getCategoryName(a.category_id).localeCompare(getCategoryName(b.category_id));
        return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name);
      }
      default:
        return 0;
    }
  });
}

/** Renders budget name with highlighted match. */
function HighlightedName({ name, query }: { name: string; query: string }) {
  if (!query) return <>{name}</>;
  const idx = name.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return <>{name}</>;
  return (
    <>
      {name.slice(0, idx)}
      <mark className="bg-amber-200 dark:bg-amber-800/40 text-inherit rounded-sm px-0">
        {name.slice(idx, idx + query.length)}
      </mark>
      {name.slice(idx + query.length)}
    </>
  );
}

// Types are imported from the application layer (BudgetRow, BudgetMonthRow)

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
// FilterSortBar — collapsible sort & filter strip
// ---------------------------------------------------------------------------

interface FilterSortBarProps {
  sortKey: SortKey;
  filterText: string;
  onSortChange: (key: SortKey) => void;
  onFilterChange: (text: string) => void;
  matchCount: number;
}

const SORT_OPTIONS: { key: SortKey; labelKey: 'sortPendingDesc' | 'sortValueAsc' | 'sortName' | 'sortCategory' }[] = [
  { key: 'pending-desc', labelKey: 'sortPendingDesc' },
  { key: 'value-asc',    labelKey: 'sortValueAsc' },
  { key: 'name',         labelKey: 'sortName' },
  { key: 'category',     labelKey: 'sortCategory' },
];

function FilterSortBar({ sortKey, filterText, onSortChange, onFilterChange, matchCount }: FilterSortBarProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasFilter = filterText.trim().length > 0;

  function toggleExpanded() {
    setExpanded(v => {
      if (!v) setTimeout(() => inputRef.current?.focus(), 50);
      return !v;
    });
  }

  function clearFilter() {
    onFilterChange('');
    inputRef.current?.focus();
  }

  const activeLabel = t.monthView[SORT_OPTIONS.find(o => o.key === sortKey)!.labelKey];

  return (
    <div className="mx-4 mb-2">
      {/* Toggle row */}
      <button
        onClick={toggleExpanded}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors',
          'bg-[var(--bg-surface)] border border-[var(--border-medium)]',
          expanded ? 'rounded-t-xl border-b-transparent' : 'rounded-xl',
          'hover:bg-[var(--bg-hover)]',
        )}
        aria-expanded={expanded}
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 shrink-0">
          <SlidersHorizontal size={12} />
        </span>
        <span className="flex-1 text-xs font-semibold text-[var(--text-secondary)]">
          {t.monthView.sortAndFilter}
        </span>

        {/* Show match count when filtering, otherwise show active sort */}
        {hasFilter ? (
          <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full shrink-0">
            {t.monthView.matchCount(matchCount)}
          </span>
        ) : (
          <span className="text-[10px] font-bold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full shrink-0">
            {activeLabel}
          </span>
        )}

        <ChevronUp
          size={13}
          className={cn(
            'shrink-0 text-[var(--text-muted)] transition-transform duration-200',
            !expanded && 'rotate-180',
          )}
        />
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-medium)] border-t-0 rounded-b-xl px-3 pb-3 pt-2 space-y-2.5">
          {/* Search field */}
          <div className={cn(
            'flex items-center gap-2 bg-[var(--bg-app)] border rounded-lg px-3 py-0',
            hasFilter ? 'border-violet-400 dark:border-violet-600' : 'border-[var(--border-medium)]',
          )}>
            <Search size={13} className="text-[var(--text-muted)] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={filterText}
              onChange={e => onFilterChange(e.target.value)}
              placeholder={t.monthView.searchPlaceholder}
              className="flex-1 bg-transparent py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            />
            {hasFilter && (
              <button onClick={clearFilter} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-0.5">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Sort chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => onSortChange(opt.key)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors',
                  sortKey === opt.key
                    ? 'bg-violet-600 dark:bg-violet-500 text-white border-violet-600 dark:border-violet-500'
                    : 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/40',
                )}
              >
                {t.monthView[opt.labelKey]}
              </button>
            ))}
          </div>
        </div>
      )}
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
  highlightText?: string;
}

function BudgetCard({ budget, bm, spentAmount, month, householdId, userId, highlightText = '' }: BudgetCardProps) {
  const { t } = useI18n();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const expenseOpenKeyRef = useRef(0);

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
              <HighlightedName name={budget.name} query={highlightText} />
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {getCategoryName(budget.category_id)}
            </p>
          </div>
          {/* Execution toggle */}
          <button
            onClick={toggleExecution}
            title={isExecuted ? t.monthView.unmarkExecuted : t.monthView.markExecuted}
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
          onClick={() => { expenseOpenKeyRef.current += 1; setExpenseOpen(true); }}
          title={t.monthView.viewOrAddExpenses}
        >
          <div>
            <p className="text-[10px] text-[var(--text-muted)] mb-0.5">{t.monthView.budgetLabel}</p>
            <p className="text-sm font-medium text-[var(--text-secondary)] tabular-nums">
              <AbbreviatedAmount value={amount} />
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--text-muted)] mb-0.5">{t.monthView.spentLabel}</p>
            <p className={cn(
              'text-sm font-semibold tabular-nums',
              hasExpenses
                ? overBudget
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-violet-600 dark:text-violet-400'
                : 'text-[var(--text-muted)]',
            )}>
              {hasExpenses ? <AbbreviatedAmount value={spentAmount} /> : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--text-muted)] mb-0.5">{t.monthView.remainingLabel}</p>
            <p className={cn(
              'text-sm font-semibold tabular-nums',
              !hasExpenses
                ? 'text-[var(--text-muted)]'
                : remaining < 0
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-green-600 dark:text-green-400',
            )}>
              {hasExpenses ? <AbbreviatedAmount value={remaining} /> : '—'}
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
          key={`${budget.id}|${month}|${expenseOpenKeyRef.current}`}
          budgetId={budget.id}
          budgetName={budget.name}
          budgetMonthId={bm?.id ?? null}
          budgetMonthAmount={amount}
          month={month}
          householdId={householdId}
          userId={userId}
          debtId={budget.debt_id}
          trigger={<span />}
          defaultOpen
          onClose={() => setExpenseOpen(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// BudgetCardList — renders cards with optional pending/executed sub-dividers
// ---------------------------------------------------------------------------

interface BudgetCardListProps {
  budgets: BudgetRow[];
  bmMap: Map<string, BudgetMonthRow>;
  expenseMap: Map<string, number>;
  month: string;
  householdId: string;
  userId: string;
  sortKey: SortKey;
  filterText: string;
  pendingLabel: string;
  executedLabel: string;
}

function BudgetCardList({
  budgets, bmMap, expenseMap, month, householdId, userId,
  sortKey, filterText, pendingLabel, executedLabel,
}: BudgetCardListProps) {
  const showDividers = sortKey === 'pending-desc';

  const pendingBudgets = showDividers
    ? budgets.filter(b => (bmMap.get(`${b.id}|${month}`)?.is_executed ?? 0) !== 1)
    : budgets;
  const executedBudgets = showDividers
    ? budgets.filter(b => bmMap.get(`${b.id}|${month}`)?.is_executed === 1)
    : [];

  function renderCard(b: BudgetRow) {
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
        highlightText={filterText}
      />
    );
  }

  return (
    <div className="space-y-2">
      {showDividers && pendingBudgets.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            {pendingLabel}
          </span>
          <div className="flex-1 h-px bg-[var(--border-subtle)]" />
        </div>
      )}
      {pendingBudgets.map(renderCard)}
      {showDividers && executedBudgets.length > 0 && (
        <div className="flex items-center gap-2 px-1 pt-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            {executedLabel}
          </span>
          <div className="flex-1 h-px bg-[var(--border-subtle)]" />
        </div>
      )}
      {showDividers && executedBudgets.map(renderCard)}
    </div>
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
  sortKey: SortKey;
  filterText: string;
}

function GroupSection({
  label, icon, accent, budgets, bmMap, expenseMap,
  month, householdId, userId, totalBudgeted, totalSpent,
  sortKey, filterText,
}: GroupSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useI18n();

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
          {totalSpent > 0 ? `${pct}%` : <AbbreviatedAmount value={totalBudgeted} />}
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
            <AbbreviatedAmount value={totalSpent} /> / <AbbreviatedAmount value={totalBudgeted} />
          </span>
          <span className={cn(
            'text-xs font-semibold tabular-nums shrink-0',
            remaining < 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400',
          )}>
            {remaining >= 0 ? '+' : ''}<AbbreviatedAmount value={remaining} />
          </span>
        </div>
      )}

      {/* Budget cards — with optional pending/executed sub-dividers */}
      {!collapsed && (
        <BudgetCardList
          budgets={budgets}
          bmMap={bmMap}
          expenseMap={expenseMap}
          month={month}
          householdId={householdId}
          userId={userId}
          sortKey={sortKey}
          filterText={filterText}
          pendingLabel={t.monthView.pending}
          executedLabel={t.monthView.executed}
        />
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
  formatMonthLabel: (m: string) => string;
}

function BalanceCard({ available, totalBudgeted, totalSpent, month, hasMissingTrm, formatMonthLabel }: BalanceCardProps) {
  const { t } = useI18n();
  // Balance real = Disponible − Presupuestado (efectivo)
  // Answers: "¿cuánto del ingreso queda libre después de comprometer el presupuesto?"
  const balance = available - totalBudgeted;
  // Por ejecutar = Presupuestado − Ejecutado (efectivo)
  // Answers: "¿cuánto del presupuesto comprometido aún no se ha gastado?"
  const pending = Math.max(0, totalBudgeted - totalSpent);
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
          <p className="text-xs opacity-70 mb-0.5">{t.monthView.balanceReal}</p>
          <p className="text-3xl font-bold tabular-nums leading-none tracking-tight">
            {balance > 0 ? '+' : ''}<AbbreviatedAmount value={balance} />
          </p>
          <p className="text-[10px] opacity-60 mt-0.5">{t.monthView.availableMinusBudgeted}</p>
        </div>
        <Wallet size={28} className="opacity-25 mb-1" />
      </div>

      {hasMissingTrm && (
        <div className="flex items-center gap-1.5 text-xs opacity-90 bg-black/15 rounded-lg px-3 py-1.5 mb-3">
          <AlertTriangle size={12} />
          {t.monthView.usdExcludedNoTrm}
        </div>
      )}

      {/* Four-stat strip — solo efectivo */}
      <div className="grid grid-cols-4 gap-1 pt-3 border-t border-white/20 mt-1">
        <div className="text-center">
          <p className="text-[9px] opacity-55 mb-0.5 uppercase tracking-wide">{t.monthView.availableLabel}</p>
          <p className="text-xs font-bold tabular-nums"><AbbreviatedAmount value={available} /></p>
        </div>
        <div className="text-center border-x border-white/20">
          <p className="text-[9px] opacity-55 mb-0.5 uppercase tracking-wide">{t.monthView.budgetedLabel}</p>
          <p className="text-xs font-bold tabular-nums"><AbbreviatedAmount value={totalBudgeted} /></p>
        </div>
        <div className="text-center border-r border-white/20">
          <p className="text-[9px] opacity-55 mb-0.5 uppercase tracking-wide">{t.monthView.executedLabel}</p>
          <p className="text-xs font-bold tabular-nums"><AbbreviatedAmount value={totalSpent} /></p>
        </div>
        <div className="text-center">
          <p className="text-[9px] opacity-55 mb-0.5 uppercase tracking-wide">{t.monthView.toExecuteLabel}</p>
          <p className="text-xs font-bold tabular-nums"><AbbreviatedAmount value={pending} /></p>
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
  const { t } = useI18n();
  const { formatNumber } = useNumberFormat();
  const [collapsed, setCollapsed] = useState(true);

  return (
    <section>
      <button
        className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border bg-[var(--group-available-bg)] border-[var(--border-medium)] mb-2 transition-colors text-left"
        onClick={() => setCollapsed(c => !c)}
      >
        <TrendingUp size={15} className="text-[var(--group-available-text)] shrink-0" />
        <span className="flex-1 text-sm font-bold uppercase tracking-wide text-[var(--group-available-text)]">
          {t.monthView.incomeLabel}
        </span>
        {hasMissingTrm && (
          <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium shrink-0">
            {t.monthView.noTrm}
          </span>
        )}
        <span className="text-sm font-semibold tabular-nums text-[var(--group-available-text)] shrink-0">
          <AbbreviatedAmount value={totalAvailable} />
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
                      <span className="text-[10px] text-violet-400 font-medium shrink-0">{t.monthView.edited}</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {inc.is_fixed === 1 ? t.monthView.fixed : t.monthView.variable}
                    {isUSD && (
                      <>
                        {' · '}
                        {trm
                          ? <span>TRM {formatNumber(trm)}</span>
                          : <span className="text-amber-500">{t.monthView.noTrm}</span>
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
                      ≈ <AbbreviatedAmount value={copEquiv} />
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
  const { t } = useI18n();
  const [month, setMonth] = useState(getCurrentMonth());
  const [sortKey, setSortKey] = useState<SortKey>('pending-desc');
  const [filterText, setFilterText] = useState('');

  const householdId = session?.householdId ?? '';
  const userId = session?.userId ?? '';

  const formatMonthLabel = (m: string) => {
    const [y, mo] = m.split('-');
    return `${t.months.full[mo] ?? mo} ${y}`;
  };

  // ── Data via application hook ──────────────────────────────────────────────

  const {
    creditCardBudgets,
    cashBudgets,
    bmMap,
    expenseMap,
    activeIncomes,
    imMap,
    trm,
    totalAvailable,
    hasMissingTrm,
    ccTotals,
    cashTotals,
  } = useMonthViewData(month);

  // Sort + filter budgets for display
  const sortedCCBudgets = useMemo(
    () => sortAndFilterBudgets(creditCardBudgets, sortKey, filterText, bmMap, month),
    [creditCardBudgets, sortKey, filterText, bmMap, month],
  );
  const sortedCashBudgets = useMemo(
    () => sortAndFilterBudgets(cashBudgets, sortKey, filterText, bmMap, month),
    [cashBudgets, sortKey, filterText, bmMap, month],
  );

  const totalMatchCount = sortedCCBudgets.length + sortedCashBudgets.length;

  // Balance real uses cash-only figures: CC budgets are not real cash outflows.
  const totalBudgeted = cashTotals.budgeted;
  const totalSpent = cashTotals.spent;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">

      <AppHeader
        emoji="🗓️"
        title={t.monthView.title}
        subtitle={formatMonthLabel(month)}
        maxWidth="max-w-3xl"
      />

      {/* Month navigator */}
      <div className="max-w-3xl mx-auto w-full px-4 py-2.5 flex items-center gap-3">
        <button
          onClick={() => setMonth(m => prevMonth(m))}
          className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          aria-label={t.monthView.prevMonth}
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="flex-1 text-center text-sm font-semibold text-[var(--text-primary)]">
          {formatMonthLabel(month)}
        </h2>
        <button
          onClick={() => setMonth(m => nextMonth(m))}
          className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          aria-label={t.monthView.nextMonth}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Scrollable content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 pb-6 space-y-4">

          {/* Hero balance card — full width */}
          <BalanceCard
            available={totalAvailable}
            totalBudgeted={totalBudgeted}
            totalSpent={totalSpent}
            month={month}
            hasMissingTrm={hasMissingTrm}
            formatMonthLabel={formatMonthLabel}
          />

          {/* Sort & filter bar */}
          {(creditCardBudgets.length > 0 || cashBudgets.length > 0) && (
            <FilterSortBar
              sortKey={sortKey}
              filterText={filterText}
              onSortChange={setSortKey}
              onFilterChange={setFilterText}
              matchCount={totalMatchCount}
            />
          )}

          {/* Empty state */}
          {creditCardBudgets.length === 0 && cashBudgets.length === 0 && (
            <div className="text-center py-16 text-[var(--text-muted)]">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-sm font-medium text-[var(--text-secondary)]">{t.monthView.noBudgets}</p>
              <p className="text-xs mt-1">{t.monthView.addBudgetsHint}</p>
            </div>
          )}

          {/* Budget groups — 2-col on lg+ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* Credit Card group */}
            <GroupSection
              label={t.monthView.creditCard}
              icon={<CreditCard size={15} />}
              accent="violet"
              budgets={sortedCCBudgets}
              bmMap={bmMap}
              expenseMap={expenseMap}
              month={month}
              householdId={householdId}
              userId={userId}
              totalBudgeted={ccTotals.budgeted}
              totalSpent={ccTotals.spent}
              sortKey={sortKey}
              filterText={filterText}
            />

            {/* Cash group */}
            <GroupSection
              label={t.monthView.cashLabel}
              icon={<Banknote size={15} />}
              accent="green"
              budgets={sortedCashBudgets}
              bmMap={bmMap}
              expenseMap={expenseMap}
              month={month}
              householdId={householdId}
              userId={userId}
              totalBudgeted={cashTotals.budgeted}
              totalSpent={cashTotals.spent}
              sortKey={sortKey}
              filterText={filterText}
            />
          </div>

          {/* Income section — full width */}
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
