import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useI18n } from '@/shared/i18n/I18nContext';
import { cn } from '@/shared/ui/cn';
import { ChartCard, ChartTooltip } from './shared';
import { formatK, getCurrentMonth, makeShortMonth } from './helpers';
import { useIncomeHistoryData } from '@/application/useIncomeHistoryData';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RANGES = [3, 6, 12, 24, 60] as const;
type Range = typeof RANGES[number];

// ---------------------------------------------------------------------------
// X-axis label builder
// ---------------------------------------------------------------------------

/**
 * Returns a tick formatter for the XAxis.
 * Short ranges (≤12): "ene", "feb"…
 * Long ranges (>12): "ene '24", "ene '25"… shown only on first month of each year,
 *   or at regular intervals.
 */
function makeTickFormatter(
  months: string[],
  n: Range,
  shortMonth: (ym: string) => string,
): (value: string) => string {
  if (n <= 12) {
    return (value: string) => shortMonth(value);
  }
  // For long ranges show "MMM 'YY" but only when useful
  return (value: string) => {
    const [year, mo] = value.split('-');
    const label = shortMonth(value);
    // Show year suffix on January or the first data point
    if (mo === '01' || value === months[0]) {
      return `${label} '${year.slice(2)}`;
    }
    return label;
  };
}

// ---------------------------------------------------------------------------
// X-axis interval
// ---------------------------------------------------------------------------

function xAxisInterval(n: Range): number | 'preserveStartEnd' {
  if (n <= 6)  return 0;
  if (n === 12) return 1;
  if (n === 24) return 3;
  return 11; // 60M → every 12 months
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IncomeHistoryChart() {
  const { t } = useI18n();
  const [range, setRange] = useState<Range>(12);
  const currentMonth = useMemo(getCurrentMonth, []);
  const shortMonth   = useMemo(() => makeShortMonth(t), [t]);

  const raw = useIncomeHistoryData(range, currentMonth);

  const data = useMemo(
    () => raw.map(d => ({ ...d, label: d.month })),
    [raw],
  );

  const tickFormatter = useMemo(
    () => makeTickFormatter(raw.map(d => d.month), range, shortMonth),
    [raw, range, shortMonth],
  );

  const avgIncome = useMemo(() => {
    const filled = data.filter(d => d.income > 0);
    if (!filled.length) return 0;
    return Math.round(filled.reduce((s, d) => s + d.income, 0) / filled.length);
  }, [data]);

  const hasData = data.some(d => d.income > 0);

  return (
    <ChartCard
      title={t.dashboard.incomeHistory}
      subtitle={t.dashboard.incomeHistoryDesc}
    >
      {/* Range selector */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {RANGES.map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={cn(
              'px-3 py-1 rounded-full text-[11px] font-semibold border transition-all duration-150',
              range === r
                ? 'bg-violet-600 dark:bg-violet-500 text-white border-violet-600 dark:border-violet-500'
                : 'bg-transparent text-[var(--text-muted)] border-[var(--border-medium)] hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400',
            )}
          >
            {t.dashboard.incomeRanges[String(r) as keyof typeof t.dashboard.incomeRanges]}
          </button>
        ))}
        {hasData && avgIncome > 0 && (
          <span className="ml-auto text-[11px] text-[var(--text-muted)]">
            ø {formatK(avgIncome)}
          </span>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}    />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-subtle)"
            vertical={false}
          />

          <XAxis
            dataKey="label"
            tickFormatter={tickFormatter}
            interval={xAxisInterval(range)}
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            tickFormatter={formatK}
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
            width={52}
          />

          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
          />

          {/* Average reference line */}
          {hasData && avgIncome > 0 && (
            <ReferenceLine
              y={avgIncome}
              stroke="#a78bfa"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              strokeOpacity={0.6}
            />
          )}

          <Area
            type="monotone"
            dataKey="income"
            name={t.dashboard.incomeHistoryLabel}
            stroke="#7c3aed"
            strokeWidth={2.5}
            fill="url(#incomeGrad)"
            dot={range <= 12
              ? { r: 3, fill: '#7c3aed', strokeWidth: 0 }
              : false
            }
            activeDot={{ r: 5, fill: '#7c3aed', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
