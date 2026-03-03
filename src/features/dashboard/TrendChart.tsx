import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useI18n } from '@/shared/i18n/I18nContext';
import { ChartCard, ChartTooltip } from './shared';
import { formatK } from './helpers';
import { useMonthlyData } from './useMonthlyData';

export function TrendChart() {
  const { t } = useI18n();
  const { monthlyData } = useMonthlyData();

  return (
    <ChartCard
      title={t.dashboard.trend6m}
      subtitle={t.dashboard.budgetedVsSpent}
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
            formatter={(v) => v === 'budgeted' ? t.dashboard.budgetedLabel : t.dashboard.spentLabel}
          />
          <Bar dataKey="budgeted" name="budgeted" fill="#c4b5fd" radius={[4, 4, 0, 0]} />
          <Bar dataKey="spent" name="spent" fill="#f472b6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
