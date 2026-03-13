import { useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { useI18n } from '@/shared/i18n/I18nContext';
import { ChartCard } from './shared';
import { formatK, getCurrentMonth, getPreviousMonth, buildBurnUpData } from './helpers';
import {
  useDailyExpensesByBudgetName,
} from '@/infrastructure/powersync/queries/useExpenseQueries';
import {
  useBudgetTargetByName,
} from '@/infrastructure/powersync/queries/useBudgetQueries';

interface BudgetBurnUpChartProps {
  budgetName: string;
  title: string;
  subtitle: string;
  color: string; // e.g. '#f472b6'
  householdId: string;
}

export function BudgetBurnUpChart({ budgetName, title, subtitle, color, householdId }: BudgetBurnUpChartProps) {
  const { t } = useI18n();
  const currentMonth = getCurrentMonth();
  const prevMonth = getPreviousMonth(currentMonth);
  const gradientId = `burnUp-${budgetName.replace(/\s/g, '_')}`;

  const { data: targetRows = [] } = useBudgetTargetByName(currentMonth, budgetName, householdId);
  const { data: curRaw = [] } = useDailyExpensesByBudgetName(currentMonth, budgetName, householdId);
  const { data: prevRaw = [] } = useDailyExpensesByBudgetName(prevMonth, budgetName, householdId);

  const target = targetRows[0]?.amount ?? 0;

  const chartData = useMemo(
    () => buildBurnUpData(curRaw, prevRaw, currentMonth, target),
    [curRaw, prevRaw, currentMonth, target],
  );

  const today = new Date().getDate();

  if (!targetRows.length || target === 0) return null;

  return (
    <ChartCard title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0.03} />
            </linearGradient>
          </defs>

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
              const cur = payload.find(p => p.dataKey === 'current')?.value as number | null | undefined;
              const prev = payload.find(p => p.dataKey === 'previous')?.value as number | null | undefined;
              const ideal = payload.find(p => p.dataKey === 'ideal')?.value as number | undefined;
              return (
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-lg px-3 py-2 text-xs space-y-0.5">
                  <p className="font-semibold text-[var(--text-primary)] mb-1">{t.dashboard.dayLabel(String(label ?? ''))}</p>
                  {cur != null && <p style={{ color }} className="font-semibold">{t.dashboard.burnUpCurrent}: {formatK(cur)}</p>}
                  {ideal != null && <p className="text-[var(--text-muted)]">{t.dashboard.burnUpIdeal}: {formatK(ideal)}</p>}
                  {prev != null && <p className="text-[var(--text-muted)]">{t.dashboard.burnUpPrevMonth}: {formatK(prev)}</p>}
                </div>
              );
            }}
            cursor={{ stroke: 'var(--border-medium)', strokeWidth: 1 }}
          />

          {/* Ideal pace — dashed diagonal */}
          <Line
            type="linear"
            dataKey="ideal"
            stroke="var(--text-muted)"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            activeDot={false}
          />

          {/* Previous month — dashed, muted */}
          <Line
            type="monotone"
            dataKey="previous"
            stroke="var(--text-muted)"
            strokeWidth={1}
            strokeDasharray="2 4"
            dot={false}
            activeDot={false}
            connectNulls={false}
          />

          {/* Current month — area fill */}
          <Area
            type="monotone"
            dataKey="current"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3, fill: color }}
            connectNulls={false}
          />

          {/* Today marker */}
          <ReferenceLine
            x={String(today)}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="3 3"
            label={{ value: t.dashboard.burnUpToday, position: 'insideTopRight', fontSize: 9, fill: color }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
