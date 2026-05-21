import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useI18n } from '@/shared/i18n/I18nContext';
import { cn } from '@/shared/ui/cn';
import { ChartCard, ChartTooltip } from './shared';
import { formatK, getCurrentMonth, makeShortMonth } from './helpers';
import { useExpenseHistoryData } from '@/application/useExpenseHistoryData';

const RANGES = [3, 6, 12, 24, 60] as const;
type Range = typeof RANGES[number];

function makeTickFormatter(
  months: string[],
  n: Range,
  shortMonth: (ym: string) => string,
): (value: string) => string {
  if (n <= 12) {
    return (value: string) => shortMonth(value);
  }
  return (value: string) => {
    const [year, mo] = value.split('-');
    const label = shortMonth(value);
    if (mo === '01' || value === months[0]) {
      return `${label} '${year.slice(2)}`;
    }
    return label;
  };
}

function xAxisInterval(n: Range): number | 'preserveStartEnd' {
  if (n <= 6)  return 0;
  if (n === 12) return 1;
  if (n === 24) return 3;
  return 11;
}

const COLOR_MAP: Record<string, { stroke: string; gradStart: string; gradEnd: string }> = {
  Domicilios:      { stroke: '#f472b6', gradStart: '#f472b6', gradEnd: '#f472b6' },
  Mercado:         { stroke: '#34d399', gradStart: '#34d399', gradEnd: '#34d399' },
  'Fiados Cactus': { stroke: '#fbbf24', gradStart: '#fbbf24', gradEnd: '#fbbf24' },
  'Cosas de Salud': { stroke: '#60a5fa', gradStart: '#60a5fa', gradEnd: '#60a5fa' },
};

const DEFAULT_COLOR = { stroke: '#7c3aed', gradStart: '#a78bfa', gradEnd: '#a78bfa' };

interface ExpenseHistoryChartProps {
  budgetName: string;
  title: string;
  subtitle: string;
  label: string;
  householdId: string;
}

export function ExpenseHistoryChart({
  budgetName, title, subtitle, label, householdId,
}: ExpenseHistoryChartProps) {
  const { t } = useI18n();
  const [range, setRange] = useState<Range>(12);
  const currentMonth = useMemo(getCurrentMonth, []);
  const shortMonth   = useMemo(() => makeShortMonth(t), [t]);

  const raw = useExpenseHistoryData(budgetName, range, currentMonth, householdId);
  const colors = COLOR_MAP[budgetName] ?? DEFAULT_COLOR;

  const data = useMemo(
    () => raw.map(d => ({ ...d, label: d.month })),
    [raw],
  );

  const tickFormatter = useMemo(
    () => makeTickFormatter(raw.map(d => d.month), range, shortMonth),
    [raw, range, shortMonth],
  );

  const avgSpent = useMemo(() => {
    const filled = data.filter(d => d.spent > 0);
    if (!filled.length) return 0;
    return Math.round(filled.reduce((s, d) => s + d.spent, 0) / filled.length);
  }, [data]);

  const hasData = data.some(d => d.spent > 0);

  const gradId = `expGrad-${budgetName.replace(/\s+/g, '')}`;

  return (
    <ChartCard title={title} subtitle={subtitle}>
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
        {hasData && avgSpent > 0 && (
          <span className="ml-auto text-[11px] text-[var(--text-muted)]">
            o {formatK(avgSpent)}
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={colors.gradStart} stopOpacity={0.3} />
              <stop offset="95%" stopColor={colors.gradEnd}   stopOpacity={0}   />
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

          {hasData && avgSpent > 0 && (
            <ReferenceLine
              y={avgSpent}
              stroke={colors.stroke}
              strokeDasharray="4 3"
              strokeWidth={1.5}
              strokeOpacity={0.6}
            />
          )}

          <Area
            type="monotone"
            dataKey="spent"
            name={label}
            stroke={colors.stroke}
            strokeWidth={2.5}
            fill={`url(#${gradId})`}
            dot={range <= 12
              ? { r: 3, fill: colors.stroke, strokeWidth: 0 }
              : false
            }
            activeDot={{ r: 5, fill: colors.stroke, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
