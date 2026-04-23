/**
 * PendingPaymentsChart — "Por pagar este mes"
 *
 * Shows active budget items (CC + cash) that are not yet marked as executed
 * and still have a remaining balance: pending = max(0, budgeted − expenses).
 *
 * Each row is toggleable — clicking it removes the item from the running
 * total without hiding it, so you can isolate fixed bills from open budgets
 * (e.g. exclude "Domicilios" to see only hard commitments).
 *
 * Bar widths are proportional to each item's pending amount relative to the
 * largest pending item in the list (not relative to its own budget total).
 */

import { useMemo, useState } from 'react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { CATEGORY_MAP } from '@/domain/budget/categories';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { cn } from '@/shared/ui/cn';
import { ChartCard } from './shared';
import { useMonthlyData } from './useMonthlyData';

export function PendingPaymentsChart() {
  const { t } = useI18n();
  const { budgets, bmIdMap, budgetAmountMap, expenseByBmId, currentMonth } = useMonthlyData();

  // ids of items the user has manually toggled off (excluded from total)
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // Build the pending list: only items not yet marked as executed
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
          pending,
          isExecuted,
          isCC: b.payment_mode !== 'cash',
          emoji: cat?.emoji ?? '•',
        };
      })
      // exclude items already marked as paid (is_executed = 1)
      .filter(item => !item.isExecuted && item.pending > 0)
      .sort((a, b) => b.pending - a.pending);
  }, [budgets, bmIdMap, budgetAmountMap, expenseByBmId, currentMonth]);

  // Running total counts only toggled-in items
  const activeTotal = useMemo(
    () => items.filter(i => !excluded.has(i.id)).reduce((s, i) => s + i.pending, 0),
    [items, excluded],
  );
  const activeCount = items.filter(i => !excluded.has(i.id)).length;

  // Bar widths are always relative to the largest item in the full list
  // so proportions don't jump when you toggle items off
  const maxPending = items[0]?.pending ?? 1;

  if (items.length === 0) {
    return (
      <ChartCard title={t.dashboard.pendingPayments}>
        <div className="flex flex-col items-center justify-center py-6 gap-1.5">
          <span className="text-3xl">🎉</span>
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
      subtitle={t.dashboard.pendingItemsCount(activeCount)}
    >
      {/* Compact total — updates as rows are toggled */}
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-2xl font-extrabold tabular-nums text-amber-500 dark:text-amber-400 leading-none transition-all">
          <AbbreviatedAmount value={activeTotal} />
        </span>
        <span className="text-xs text-[var(--text-muted)]">{t.dashboard.totalPending}</span>
        {excluded.size > 0 && (
          <button
            onClick={() => setExcluded(new Set())}
            className="ml-auto text-[10px] text-[var(--text-muted)] hover:text-violet-600 transition-colors underline underline-offset-2"
          >
            {t.dashboard.pendingRestoreAll}
          </button>
        )}
      </div>

      {/* Toggleable item rows */}
      <div className="space-y-1">
        {items.map(item => {
          const isOff   = excluded.has(item.id);
          const barPct  = (item.pending / maxPending) * 100;
          const barColor = item.isCC ? '#a78bfa' : '#fbbf24';

          return (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className={cn(
                'w-full text-left rounded-lg px-2 py-2 -mx-2 cursor-pointer select-none',
                'hover:bg-[var(--bg-hover)] active:bg-[var(--bg-app)] transition-colors',
                isOff && 'opacity-40',
              )}
            >
              {/* Name row */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)] truncate min-w-0">
                  {/* Toggle indicator */}
                  <span className={cn(
                    'shrink-0 w-3.5 h-3.5 rounded border-[1.5px] flex items-center justify-center transition-colors',
                    isOff
                      ? 'border-[var(--border-medium)]'
                      : item.isCC
                        ? 'border-violet-400 bg-violet-100 dark:bg-violet-900/40'
                        : 'border-amber-400 bg-amber-50 dark:bg-amber-900/30',
                  )}>
                    {!isOff && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4L3 5.5L6.5 2" stroke={item.isCC ? '#7c3aed' : '#d97706'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  <span className="shrink-0">{item.emoji}</span>
                  <span className={cn('truncate', isOff && 'line-through decoration-[var(--text-muted)]')}>
                    {item.name}
                  </span>
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
                <span className={cn(
                  'shrink-0 ml-3 text-xs font-bold tabular-nums transition-colors',
                  isOff
                    ? 'text-[var(--text-muted)]'
                    : 'text-amber-600 dark:text-amber-400',
                )}>
                  <AbbreviatedAmount value={item.pending} />
                </span>
              </div>

              {/* Proportional bar — grays out when excluded */}
              <div className="h-1.5 rounded-full bg-[var(--border-subtle)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${barPct}%`,
                    background: isOff ? 'var(--border-medium)' : barColor,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </ChartCard>
  );
}
