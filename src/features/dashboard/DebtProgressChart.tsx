import { useMemo } from 'react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { ChartCard } from './shared';
import { useDebtData } from './useDebtData';

export function DebtProgressChart() {
  const { t } = useI18n();
  const { dashDebts, dashDebtTxs, debtInitialCOP } = useDebtData();

  const debtProgressData = useMemo(() => {
    return dashDebts
      .map(debt => {
        const initialCOP = debtInitialCOP(debt);
        const txs = dashDebtTxs.filter(tx => tx.debt_id === debt.id);
        const credits = txs.filter(tx => tx.type === 'credit').reduce((s, tx) => s + tx.amount, 0);
        const debits  = txs.filter(tx => tx.type === 'debit').reduce((s, tx) => s + tx.amount, 0);
        const totalBase = initialCOP + credits;
        const balance   = totalBase - debits;
        const pctPaid   = totalBase > 0
          ? Math.min(Math.max(debits / totalBase * 100, 0), 100)
          : 0;
        return { id: debt.id, name: debt.name, balance, initial: totalBase, pctPaid };
      })
      .sort((a, b) => b.balance - a.balance);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashDebts, dashDebtTxs]);

  if (dashDebts.length === 0) return null;

  return (
    <ChartCard
      title={t.dashboard.debtProgress}
      subtitle={t.dashboard.debtProgressDesc}
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
                  ({d.pctPaid.toFixed(0)}{t.dashboard.pctPaid})
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
  );
}
