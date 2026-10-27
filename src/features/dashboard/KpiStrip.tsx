import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet, Scale, AlertCircle, type LucideIcon } from 'lucide-react';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { useI18n } from '@/shared/i18n/useI18n';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { cn } from '@/shared/ui/cn';
import { useMonthlyData } from './useMonthlyData';
import { useDebtData } from './useDebtData';
import { MetricInfo } from './MetricInfo';

type KpiHighlight = 'positive' | 'negative' | 'default';

const HIGHLIGHT_CLASS: Record<KpiHighlight, string> = {
  positive: 'text-[var(--text-positive)]',
  negative: 'text-[var(--text-negative)]',
  default: 'text-[var(--text-primary)]',
};

interface KpiTileProps {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Plain-words explanation shown when the corner icon is pressed. */
  info: { description: string; formula: string };
  highlight?: KpiHighlight;
}

/**
 * Longer amounts step down. Each step keeps the widest amount of that length
 * inside the narrowest tile (~125px of content on a 360px phone), e.g.
 * "$27.4M" at 28px, "-$127.4M" at 22px and "$ 27.398.988" (full number
 * format) at 16px.
 */
function amountSize(length: number) {
  if (length <= 6) return 'text-[28px]';
  if (length === 7) return 'text-2xl';
  if (length === 8) return 'text-[22px]';
  if (length <= 11) return 'text-lg';
  if (length === 12) return 'text-base';
  return 'text-sm';
}

/** One KPI: sentence-case label, corner icon that explains the metric, large amount. */
export function KpiTile({ label, value, icon, info, highlight = 'default' }: KpiTileProps) {
  const { formatCOP } = useNumberFormat();
  const size = amountSize(formatCOP(value).length);

  return (
    // `justify-between` keeps amounts on one line across a row when a label wraps.
    <div className="flex flex-col justify-between gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-medium leading-snug text-[var(--text-secondary)]">{label}</span>
        <MetricInfo label={label} icon={icon} description={info.description} formula={info.formula} />
      </div>
      {/* Size before leading: tailwind-merge drops a `leading-*` that precedes a `text-*` size. */}
      <p className={cn('font-bold tabular-nums tracking-[-0.01em]', size, 'leading-tight', HIGHLIGHT_CLASS[highlight])}>
        <AbbreviatedAmount value={value} />
      </p>
    </div>
  );
}

export function KpiStrip() {
  const { t } = useI18n();
  const { monthlyData, currentMonth } = useMonthlyData();
  const { dashDebts, dashDebtTxs, debtInitialCOP } = useDebtData();

  const currentData = monthlyData.find(d => d.month === currentMonth) ?? {
    available: 0, budgeted: 0, spent: 0, balance: 0, realBalance: 0, pending: 0,
  };

  const hasDebts = dashDebts.length > 0;

  const debtProgressData = useMemo(() => {
    return dashDebts
      .map(debt => {
        const initialCOP = debtInitialCOP(debt);
        const txs = dashDebtTxs.filter(tx => tx.debt_id === debt.id);
        const credits = txs.filter(tx => tx.type === 'credit').reduce((s, tx) => s + tx.amount, 0);
        const debits  = txs.filter(tx => tx.type === 'debit').reduce((s, tx) => s + tx.amount, 0);
        const totalBase = initialCOP + credits;
        const balance   = totalBase - debits;
        return { balance };
      });
  }, [dashDebts, dashDebtTxs, debtInitialCOP]);

  const totalDebtBalance = useMemo(
    () => debtProgressData.reduce((s, d) => s + Math.max(d.balance, 0), 0),
    [debtProgressData],
  );

  const balanceHighlight: 'positive' | 'negative' | 'default' =
    currentData.realBalance > 0 ? 'positive' : currentData.realBalance < 0 ? 'negative' : 'default';

  // Tiles stay at least ~150px wide: large amounts do not fit a sixth of a tablet row.
  return (
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${hasDebts ? 'xl:grid-cols-6' : 'lg:grid-cols-5'}`}>
      <KpiTile
        label={t.dashboard.realBalance}
        info={t.dashboard.metricInfo.realBalance}
        value={currentData.realBalance}
        icon={Scale}
        highlight={balanceHighlight}
      />
      <KpiTile
        label={t.dashboard.available}
        info={t.dashboard.metricInfo.available}
        value={currentData.available}
        icon={Wallet}
        highlight="default"
      />
      <KpiTile
        label={t.dashboard.budgeted}
        info={t.dashboard.metricInfo.budgeted}
        value={currentData.budgeted}
        icon={TrendingUp}
        highlight="default"
      />
      <KpiTile
        label={t.dashboard.spent}
        info={t.dashboard.metricInfo.spent}
        value={currentData.spent}
        icon={TrendingDown}
        highlight={currentData.spent > currentData.budgeted ? 'negative' : 'default'}
      />
      <KpiTile
        label={t.dashboard.toSpend}
        info={t.dashboard.metricInfo.toSpend}
        value={currentData.pending ?? 0}
        icon={TrendingDown}
        highlight="default"
      />
      {hasDebts && (
        <KpiTile
          label={t.dashboard.totalOwed}
        info={t.dashboard.metricInfo.totalOwed}
          value={totalDebtBalance}
          icon={AlertCircle}
          highlight={totalDebtBalance > 0 ? 'negative' : 'positive'}
        />
      )}
    </div>
  );
}
