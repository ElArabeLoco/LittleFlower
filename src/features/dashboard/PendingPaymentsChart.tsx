/**
 * PendingPaymentsChart — "Por pagar este mes"
 *
 * Shows every active budget item (CC + cash) that still has a pending
 * balance, sorted by pending amount descending, with a prominent total
 * so you can instantly see what's left to pay this month.
 *
 * A budget item is "pending" when:
 *   • is_executed === 0 (not yet marked as paid), AND
 *   • amount − spent > 0 (real money still to go out)
 */

import { useMemo } from 'react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { CATEGORY_MAP } from '@/domain/budget/categories';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { ChartCard } from './shared';
import { useMonthlyData } from './useMonthlyData';

export function PendingPaymentsChart() {
  const { t } = useI18n();
  const { budgets, bmIdMap, budgetAmountMap, expenseByBmId, currentMonth } = useMonthlyData();

  // Build the pending-item list for the selected month
  const items = useMemo(() => {
    return budgets
      .filter(b => {
        if (b.start_month > currentMonth) return false;
        if (b.end_month && b.end_month < currentMonth) return false;
        return true;
      })
      .map(b => {
        const bmRow  = bmIdMap.get(`${b.id}|${currentMonth}`);
        const amount = budgetAmountMap.get(`${b.id}|${currentMonth}`) ?? b.default_amount;
        const spent  = bmRow ? (expenseByBmId.get(bmRow.id) ?? 0) : 0;
        const isExecuted = bmRow?.is_executed === 1;
        const pending = Math.max(0, amount - spent);
        const cat = CATEGORY_MAP.get(b.category_id);
        return {
          id: b.id,
          name: b.name,
          amount,
          spent,
          pending,
          isExecuted,
          isCC: b.paid_with_credit_card === 1,
          emoji: cat?.emoji ?? '•',
          // % of the budget already paid (for the two-tone bar)
          pctPaid: amount > 0 ? Math.min(100, Math.round((spent / amount) * 100)) : 0,
        };
      })
      .filter(item => !item.isExecuted && item.pending > 0)
      .sort((a, b) => b.pending - a.pending);
  }, [budgets, bmIdMap, budgetAmountMap, expenseByBmId, currentMonth]);

  const totalPending = items.reduce((s, i) => s + i.pending, 0);
  const ccPending    = items.filter(i => i.isCC).reduce((s, i) => s + i.pending, 0);
  const cashPending  = items.filter(i => !i.isCC).reduce((s, i) => s + i.pending, 0);

  // All paid: show a minimal success state so the chart doesn't vanish completely
  if (items.length === 0) {
    return (
      <ChartCard title={t.dashboard.pendingPayments}>
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <span className="text-4xl">🎉</span>
          <p className="text-sm font-semibold text-green-600 dark:text-green-400">
            {t.dashboard.allPaidThisMonth}
          </p>
          <p className="text-xs text-[var(--text-muted)]">{t.dashboard.noPendingItems}</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title={t.dashboard.pendingPayments}
      subtitle={t.dashboard.pendingItemsCount(items.length)}
    >
      {/* ── Hero total ──────────────────────────────────────────────────── */}
      <div className="mb-5 pb-4 border-b border-[var(--border-subtle)]">
        <p className="text-[11px] uppercase tracking-widest font-semibold text-[var(--text-muted)] mb-1">
          {t.dashboard.totalPending}
        </p>
        <p className="text-4xl font-extrabold tabular-nums text-amber-500 dark:text-amber-400 leading-none">
          <AbbreviatedAmount value={totalPending} />
        </p>

        {/* CC / Cash breakdown pills */}
        {ccPending > 0 && cashPending > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                             bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300
                             border border-violet-200 dark:border-violet-800">
              💳 <AbbreviatedAmount value={ccPending} />
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                             bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400
                             border border-amber-200 dark:border-amber-800">
              💵 <AbbreviatedAmount value={cashPending} />
            </span>
          </div>
        )}
      </div>

      {/* ── Items list ──────────────────────────────────────────────────── */}
      <div className="space-y-3.5">
        {items.map(item => (
          <div key={item.id}>
            {/* Row: name + pending amount */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)] truncate min-w-0">
                <span className="shrink-0">{item.emoji}</span>
                <span className="truncate">{item.name}</span>
                {item.isCC && (
                  <span className="shrink-0 text-[9px] font-bold leading-none
                                   text-violet-600 dark:text-violet-400
                                   bg-violet-100 dark:bg-violet-900/40
                                   border border-violet-200 dark:border-violet-700
                                   px-1 py-0.5 rounded">
                    TC
                  </span>
                )}
              </span>
              <span className="shrink-0 ml-3 text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400">
                <AbbreviatedAmount value={item.pending} />
              </span>
            </div>

            {/* Two-tone progress bar: paid (left) + pending (right, amber) */}
            <div className="h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden flex">
              {/* Paid portion */}
              {item.pctPaid > 0 && (
                <div
                  className="h-full shrink-0 rounded-l-full"
                  style={{
                    width: `${item.pctPaid}%`,
                    background: item.isCC ? '#a78bfa' : '#4ade80',
                  }}
                />
              )}
              {/* Pending portion — amber, always fills the rest */}
              <div
                className="h-full shrink-0"
                style={{
                  width: `${100 - item.pctPaid}%`,
                  background: '#fbbf24',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
