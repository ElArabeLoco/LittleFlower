import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useI18n } from '@/shared/i18n/I18nContext';
import { ChartCard, ChartTooltip } from './shared';
import { formatK } from './helpers';
import { useMonthlyData } from './useMonthlyData';

export function BalanceChart() {
  const { t } = useI18n();
  const { monthlyData } = useMonthlyData();

  return (
    <ChartCard
      title={t.dashboard.balanceOverTime}
      subtitle={t.dashboard.availableMinusBudgeted}
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
  );
}
