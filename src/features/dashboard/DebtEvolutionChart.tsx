import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useI18n } from '@/shared/i18n/useI18n';
import { ChartTooltip } from './shared';
import { ChartCard } from './shared';
import { formatK, makeShortMonth } from './helpers';
import { useDebtData } from './useDebtData';

export function DebtEvolutionChart() {
  const { t } = useI18n();
  const { dashDebts, dashDebtTxs, debtInitialCOP, last6 } = useDebtData();

  const debtEvolutionData = useMemo(() => {
    const shortMonth = makeShortMonth(t);
    return last6.map(month => {
      const endOfMonth = `${month}-31`;
      let total = 0;
      for (const debt of dashDebts) {
        const initialCOP = debtInitialCOP(debt);
        const txs = dashDebtTxs.filter(tx => tx.debt_id === debt.id && tx.date <= endOfMonth);
        const credits = txs.filter(tx => tx.type === 'credit').reduce((s, tx) => s + tx.amount, 0);
        const debits  = txs.filter(tx => tx.type === 'debit').reduce((s, tx) => s + tx.amount, 0);
        const balance = initialCOP + credits - debits;
        total += Math.max(balance, 0);
      }
      return { month, label: shortMonth(month), saldo: total };
    });
  }, [last6, dashDebts, dashDebtTxs, debtInitialCOP, t]);

  if (dashDebts.length === 0) return null;

  return (
    <ChartCard
      title={t.dashboard.debtEvolution}
      subtitle={t.dashboard.debtEvolutionDesc}
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
            name={t.dashboard.debtBalanceLabel}
            stroke="#fb7185"
            strokeWidth={2.5}
            fill="url(#debtGrad)"
            dot={{ r: 3, fill: '#fb7185', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#fb7185' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
