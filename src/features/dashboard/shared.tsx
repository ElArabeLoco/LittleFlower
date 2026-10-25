import { cn } from '@/shared/ui/cn';
import { formatK } from './helpers';
import { useWidgetSlot } from './layout/WidgetSlotContext';

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
// Chart Card (section wrapper)
// ---------------------------------------------------------------------------

export function ChartCard({ title, subtitle, children, className, bare = false }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  /** No card and no title outside edit mode (the KPI strip brings its own tiles). */
  bare?: boolean;
}) {
  // Inside the configurable grid the slot adds the edit controls and the motion classes.
  const slot = useWidgetSlot();
  const chromeless = bare && !slot?.editing;
  return (
    <div
      className={cn(
        'rounded-2xl',
        !chromeless && 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm p-5',
        slot && 'dash-card',
        slot?.editing && 'is-editing',
        slot?.lifted && 'is-lifted',
        className,
      )}
    >
      {slot?.controls}
      {!chromeless && (
        <div className="mb-4">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">{title}</h2>
          {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
        </div>
      )}
      {slot ? <div className="dash-body">{children}</div> : children}
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
