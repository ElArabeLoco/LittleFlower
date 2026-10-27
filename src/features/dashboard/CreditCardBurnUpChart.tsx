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
import { useI18n } from '@/shared/i18n/useI18n';
import { ChartCard } from './shared';
import { formatK, getPreviousMonth, buildBurnUpData } from './helpers';
import { useDailyExpensesByCreditCard } from '@/infrastructure/powersync/queries/useExpenseQueries';
import { useCreditCardBudgetTarget } from '@/infrastructure/powersync/queries/useBudgetQueries';

interface CreditCardBurnUpChartProps {
  month: string;
  isCurrentMonth: boolean;
  householdId: string;
}

const COLOR = '#a78bfa';
const GRADIENT_ID = 'burnUp-creditcard';

export function CreditCardBurnUpChart({ month, isCurrentMonth, householdId }: CreditCardBurnUpChartProps) {
  const { t } = useI18n();
  const prevMonth = getPreviousMonth(month);

  const { data: targetRows = [] } = useCreditCardBudgetTarget(month, householdId);
  const { data: curRaw = [] } = useDailyExpensesByCreditCard(month, householdId);
  const { data: prevRaw = [] } = useDailyExpensesByCreditCard(prevMonth, householdId);

  const target = targetRows[0]?.total ?? 0;

  const chartData = useMemo(
    () => buildBurnUpData(curRaw, prevRaw, month, target),
    [curRaw, prevRaw, month, target],
  );

  const today = new Date().getDate();

  if (!target) return null;

  return (
    <ChartCard title={t.dashboard.burnUpCreditCardTitle} subtitle={t.dashboard.burnUpCreditCardDesc}>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLOR} stopOpacity={0.25} />
              <stop offset="95%" stopColor={COLOR} stopOpacity={0.03} />
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
                  {cur != null && <p style={{ color: COLOR }} className="font-semibold">{t.dashboard.burnUpCurrent}: {formatK(cur)}</p>}
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
            stroke={COLOR}
            strokeWidth={2}
            fill={`url(#${GRADIENT_ID})`}
            dot={false}
            activeDot={{ r: 3, fill: COLOR }}
            connectNulls={false}
          />

          {/* Today marker — only shown when viewing the current month */}
          {isCurrentMonth && (
            <ReferenceLine
              x={String(today)}
              stroke={COLOR}
              strokeWidth={1}
              strokeDasharray="3 3"
              label={{ value: t.dashboard.burnUpToday, position: 'insideTopRight', fontSize: 9, fill: COLOR }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
