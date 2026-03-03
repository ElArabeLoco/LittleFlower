import { cn } from '@/shared/ui/cn';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { formatK } from './helpers';

// ---------------------------------------------------------------------------
// Chart tooltip
// ---------------------------------------------------------------------------

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

export function ChartTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-lg px-3 py-2.5 text-xs">
      {label && <p className="font-semibold text-[var(--text-primary)] mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold">{formatK(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pie tooltip
// ---------------------------------------------------------------------------

export function PieTooltip({
  active, payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { color: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-[var(--text-primary)]">{p.name}</p>
      <p style={{ color: p.payload.color }}>{formatK(p.value)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  highlight?: 'positive' | 'negative' | 'warning' | 'default';
  formatCOP: (v: number) => string;
}

export function KpiCard({ label, value, icon, highlight = 'default', formatCOP }: KpiCardProps) {
  const colorMap = {
    positive: 'text-green-600 dark:text-green-400',
    negative: 'text-red-500 dark:text-red-400',
    warning: 'text-amber-500 dark:text-amber-400',
    default: 'text-[var(--text-primary)]',
  };

  const formatted = formatCOP(value);
  const textSize =
    formatted.length > 11 ? 'text-sm' :
    formatted.length > 8  ? 'text-base' :
                             'text-xl';

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm px-4 py-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
        <span className="text-[var(--text-muted)]">{icon}</span>
      </div>
      <p className={cn('font-bold tabular-nums leading-tight', textSize, colorMap[highlight])}>
        <AbbreviatedAmount value={value} />
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart Card (section wrapper)
// ---------------------------------------------------------------------------

export function ChartCard({ title, subtitle, children, className }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-5', className)}>
      <div className="mb-4">
        <h2 className="text-sm font-bold text-[var(--text-primary)]">{title}</h2>
        {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pie label
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PieLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (percent < 0.06) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={10} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}
