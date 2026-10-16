import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CreditCard, Banknote, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { cn } from '@/shared/ui/cn';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { getCategoryEmoji, getCategoryName } from '@/domain/budget/categories';
import { useTransactionsForMonth, type TransactionRow } from '@/infrastructure/powersync/queries';
import { getCurrentMonth, prevMonth, nextMonth } from '@/shared/helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(timestamp: string): string {
  const [, m, d] = timestamp.slice(0, 10).split('-');
  return `${d}/${m}`;
}

// ---------------------------------------------------------------------------
// Sort types
// ---------------------------------------------------------------------------

type SortCol = 'budget' | 'amount' | 'timestamp';

interface SortState {
  col: SortCol;
  dir: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// SortableHeader
// ---------------------------------------------------------------------------

function SortableHeader({
  label,
  col,
  sort,
  onSort,
}: {
  label: string;
  col: SortCol;
  sort: SortState;
  onSort: (col: SortCol) => void;
}) {
  const isActive = sort.col === col;
  return (
    <th
      onClick={() => onSort(col)}
      className={cn(
        'px-3 py-2 text-left text-xs font-semibold cursor-pointer select-none whitespace-nowrap transition-colors',
        isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
      )}
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive
          ? sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
          : <ArrowUpDown size={11} className="opacity-40" />}
      </span>
    </th>
  );
}

// ---------------------------------------------------------------------------
// TransactionGrid
// ---------------------------------------------------------------------------

interface GridLabels {
  budgetHeader: string;
  noteHeader: string;
  amountHeader: string;
  dateHeader: string;
  total: string;
  noTransactions: string;
}

function TransactionGrid({
  title,
  icon,
  rows,
  formatCOP,
  labels,
}: {
  title: string;
  icon: React.ReactNode;
  rows: TransactionRow[];
  formatCOP: (n: number) => string;
  labels: GridLabels;
}) {
  const [sort, setSort] = useState<SortState>({ col: 'timestamp', dir: 'asc' });

  function toggleSort(col: SortCol) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
  }

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    let cmp = 0;
    if (sort.col === 'budget') {
      cmp = a.budget_name.localeCompare(b.budget_name);
    } else if (sort.col === 'amount') {
      cmp = a.amount - b.amount;
    } else {
      cmp = a.timestamp.localeCompare(b.timestamp);
    }
    return sort.dir === 'asc' ? cmp : -cmp;
  }), [rows, sort]);

  const total = rows.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-subtle)]">
        <span className="text-[var(--text-muted)]">{icon}</span>
        <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
        {rows.length > 0 && (
          <span className="ml-auto text-xs tabular-nums text-[var(--text-muted)]">{rows.length}</span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-xs text-[var(--text-muted)]">{labels.noTransactions}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[var(--bg-surface-2)]">
              <tr>
                <SortableHeader label={labels.budgetHeader} col="budget" sort={sort} onSort={toggleSort} />
                <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)] whitespace-nowrap">
                  {labels.noteHeader}
                </th>
                <SortableHeader label={labels.amountHeader} col="amount" sort={sort} onSort={toggleSort} />
                <SortableHeader label={labels.dateHeader} col="timestamp" sort={sort} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => (
                <tr
                  key={row.id}
                  className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <td className="px-3 py-2 text-[var(--text-primary)] whitespace-nowrap">
                    <span title={getCategoryName(row.category_id)} className="cursor-default mr-1">
                      {getCategoryEmoji(row.category_id)}
                    </span>
                    {row.budget_name}
                  </td>
                  <td className="px-3 py-2 max-w-[160px] truncate text-[var(--text-secondary)]">
                    {row.note ?? <span className="text-[var(--text-muted)]">—</span>}
                  </td>
                  <td className={cn(
                    'px-3 py-2 text-right font-mono tabular-nums',
                    row.amount < 0 ? 'text-rose-500' : 'text-[var(--text-primary)]',
                  )}>
                    {formatCOP(row.amount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-muted)]">
                    {formatDate(row.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--border-medium)] bg-[var(--bg-surface-2)]">
                <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">
                  {labels.total}
                </td>
                <td className={cn(
                  'px-3 py-2 text-right text-xs font-bold font-mono tabular-nums',
                  total < 0 ? 'text-rose-500' : 'text-[var(--text-primary)]',
                )}>
                  {formatCOP(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TransactionsPage
// ---------------------------------------------------------------------------

export function TransactionsPage() {
  const [month, setMonth] = useState(getCurrentMonth);
  const { t } = useI18n();
  const { formatCOP } = useNumberFormat();
  const { data: rows } = useTransactionsForMonth(month);

  const ccRows = useMemo(() => rows.filter(r => r.paid_with_credit_card === 1), [rows]);
  const cashRows = useMemo(() => rows.filter(r => r.paid_with_credit_card === 0), [rows]);

  const monthKey = month.slice(5, 7);
  const year = month.slice(0, 4);
  const monthLabel = `${t.months.full[monthKey]} ${year}`;

  const gridLabels: GridLabels = {
    budgetHeader: t.transactions.budgetHeader,
    noteHeader: t.transactions.noteHeader,
    amountHeader: t.transactions.amountHeader,
    dateHeader: t.transactions.dateHeader,
    total: t.transactions.total,
    noTransactions: t.transactions.noTransactions,
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col">
      <AppHeader title={t.transactions.title} subtitle={t.transactions.subtitle} maxWidth="max-w-7xl" />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 flex flex-col gap-6">

        {/* Month navigator */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setMonth(m => prevMonth(m))}
            aria-label={t.monthView.prevMonth}
            className="p-2 rounded-xl hover:bg-[var(--bg-surface)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-[var(--text-primary)] min-w-[160px] text-center capitalize">
            {monthLabel}
          </span>
          <button
            onClick={() => setMonth(m => nextMonth(m))}
            aria-label={t.monthView.nextMonth}
            className="p-2 rounded-xl hover:bg-[var(--bg-surface)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Grids — side by side on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Credit card grid */}
        <TransactionGrid
          title={t.transactions.creditCardGroup}
          icon={<CreditCard size={16} />}
          rows={ccRows}
          formatCOP={formatCOP}
          labels={gridLabels}
        />

        {/* Cash grid */}
        <TransactionGrid
          title={t.transactions.cashGroup}
          icon={<Banknote size={16} />}
          rows={cashRows}
          formatCOP={formatCOP}
          labels={gridLabels}
        />

        </div>{/* end grids */}

      </main>

      <AppNav />
    </div>
  );
}
