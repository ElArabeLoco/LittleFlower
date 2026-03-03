import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet, Scale, AlertCircle } from 'lucide-react';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { useI18n } from '@/shared/i18n/I18nContext';
import { KpiCard } from './shared';
import { useMonthlyData } from './useMonthlyData';
import { useDebtData } from './useDebtData';

export function KpiStrip() {
  const { formatCOP } = useNumberFormat();
  const { t } = useI18n();
  const { monthlyData, currentMonth } = useMonthlyData();
  const { dashDebts, dashDebtTxs, debtInitialCOP } = useDebtData();

  const currentData = monthlyData.find(d => d.month === currentMonth) ?? {
    available: 0, budgeted: 0, spent: 0, balance: 0, pending: 0,
  };

  const hasDebts = dashDebts.length > 0;

  const debtProgressData = useMemo(() => {
    return dashDebts
      .map(debt => {
        const initialCOP = debtInitialCOP(debt);
        const txs = dashDebtTxs.filter(tx => tx.debt_id === debt.id);
        const credits = txs.filter(tx => tx.type === 'credit').reduce((s, tx) => s + tx.amount, 0);
        const debits  = txs.filter(tx => tx.type === 'debit').reduce((s, tx) => s + tx.amount, 0);
        const totalBase = initialCOP + credits;
        const balance   = totalBase - debits;
        return { balance };
      });
  }, [dashDebts, dashDebtTxs, debtInitialCOP]);

  const totalDebtBalance = useMemo(
    () => debtProgressData.reduce((s, d) => s + Math.max(d.balance, 0), 0),
    [debtProgressData],
  );

  const balanceHighlight: 'positive' | 'negative' | 'default' =
    currentData.balance > 0 ? 'positive' : currentData.balance < 0 ? 'negative' : 'default';

  return (
    <div className={`grid grid-cols-2 gap-3 ${hasDebts ? 'sm:grid-cols-6' : 'sm:grid-cols-5'}`}>
      <KpiCard
        label={t.dashboard.realBalance}
        value={currentData.balance}
        icon={<Scale size={16} />}
        highlight={balanceHighlight}
        formatCOP={formatCOP}
      />
      <KpiCard
        label={t.dashboard.available}
        value={currentData.available}
        icon={<Wallet size={16} />}
        highlight="default"
        formatCOP={formatCOP}
      />
      <KpiCard
        label={t.dashboard.budgeted}
        value={currentData.budgeted}
        icon={<TrendingUp size={16} />}
        highlight="default"
        formatCOP={formatCOP}
      />
      <KpiCard
        label={t.dashboard.spent}
        value={currentData.spent}
        icon={<TrendingDown size={16} />}
        highlight={currentData.spent > currentData.budgeted ? 'negative' : 'default'}
        formatCOP={formatCOP}
      />
      <KpiCard
        label={t.dashboard.toSpend}
        value={currentData.pending ?? 0}
        icon={<TrendingDown size={16} />}
        highlight="default"
        formatCOP={formatCOP}
      />
      {hasDebts && (
        <KpiCard
          label={t.dashboard.totalOwed}
          value={totalDebtBalance}
          icon={<AlertCircle size={16} />}
          highlight={totalDebtBalance > 0 ? 'negative' : 'positive'}
          formatCOP={formatCOP}
        />
      )}
    </div>
  );
}
