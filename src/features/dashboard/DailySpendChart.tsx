import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useI18n } from '@/shared/i18n/I18nContext';
import { ChartCard } from './shared';
import { formatK, buildDailyChartData, getCurrentMonth } from './helpers';
import type { DailyExpenseRow } from './types';

interface DailySpendChartProps {
  categoryId: string;
  title: string;
  subtitle: string;
  barColor: string;
  textColor: string;
}

export function DailySpendChart({ categoryId, title, subtitle, barColor, textColor }: DailySpendChartProps) {
  const { t } = useI18n();
  const currentMonth = getCurrentMonth();

  const { data: dailyRaw = [] } = useQuery<DailyExpenseRow>(
    `SELECT substr(e.timestamp, 1, 10) as day, SUM(e.amount) as total
     FROM expenses e
     JOIN budget_months bm ON bm.id = e.budget_month_id
     JOIN budgets b ON b.id = bm.budget_id
     WHERE bm.month = ?
       AND b.category_id = ?
       AND e.deleted_at IS NULL
       AND e.amount > 0
     GROUP BY substr(e.timestamp, 1, 10)
     ORDER BY day ASC`,
    [currentMonth, categoryId],
  );

  const dailyData = useMemo(
    () => buildDailyChartData(dailyRaw, currentMonth),
    [dailyRaw, currentMonth],
  );

  if (dailyRaw.length === 0) return null;

  return (
    <ChartCard title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={dailyData} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            axisLine={false} tickLine={false}
            interval={4}
          />
          <YAxis
            tickFormatter={formatK}
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            axisLine={false} tickLine={false} width={44}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const v = (payload[0]?.value as number) ?? 0;
              if (v === 0) return null;
              return (
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-lg px-3 py-2 text-xs">
                  <p className="font-semibold text-[var(--text-primary)] mb-0.5">{t.dashboard.dayLabel(label ?? '')}</p>
                  <p style={{ color: textColor }} className="font-semibold">{formatK(v)}</p>
                </div>
              );
            }}
            cursor={{ fill: 'var(--bg-hover)' }}
          />
          <Bar dataKey="total" fill={barColor} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
