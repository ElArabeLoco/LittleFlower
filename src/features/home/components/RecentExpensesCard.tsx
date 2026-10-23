/**
 * RecentExpensesCard — the latest expenses of the month, from either phone.
 */

import { Link } from '@tanstack/react-router';
import type { RecentExpenseRow } from '@/application/useHomeData';
import { useI18n } from '@/shared/i18n/I18nContext';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';

export function RecentExpensesCard({ expenses }: { expenses: RecentExpenseRow[] }) {
  const { t, locale } = useI18n();
  const dateFormat = new Intl.DateTimeFormat(locale === 'es' ? 'es-CO' : 'en-US', { day: 'numeric', month: 'short' });

  return (
    <section
      aria-labelledby="home-recent-title"
      className="flex min-w-0 flex-col rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-7"
    >
      <h2 id="home-recent-title" className="text-xl font-[720] tracking-[-0.01em]">{t.dashboard.recentExpenses}</h2>

      {expenses.length === 0 ? (
        <p className="mt-4 text-[15px] text-[var(--text-secondary)]">{t.home.recentEmpty}</p>
      ) : (
        <ul className="mt-3">
          {expenses.map(expense => (
            <li key={expense.id} className="flex items-center gap-3 border-t border-[var(--border-subtle)] py-3 first:border-t-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{expense.budget_name}</span>
                <span className="block truncate text-xs text-[var(--text-muted)]">
                  {dateFormat.format(new Date(expense.timestamp))}
                  {expense.note ? `, ${expense.note}` : ''}
                </span>
              </span>
              <AbbreviatedAmount value={expense.amount} className="text-[15px] font-bold tabular-nums" />
            </li>
          ))}
        </ul>
      )}

      <Link to="/transactions" className="mt-auto inline-flex min-h-10 items-center pt-3 text-sm font-semibold text-[var(--text-brand)] hover:underline">
        {t.home.seeTransactions}
      </Link>
    </section>
  );
}
