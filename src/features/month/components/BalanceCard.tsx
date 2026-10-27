import { AlertTriangle } from 'lucide-react';
import { useI18n } from '@/shared/i18n/useI18n';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { cn } from '@/shared/ui/cn';

interface BalanceCardProps {
  available: number;
  totalBudgeted: number;
  totalSpent: number;
  totalRealSpent: number;
  hasMissingTrm: boolean;
}

/** Ledger ink: negative amounts are written in brick, everything else in plum ink. */
function inkFor(value: number) {
  return value < 0 ? 'text-[var(--text-negative)]' : 'text-[var(--text-primary)]';
}

/**
 * Month summary. Both balances share the columns of the stats row below
 * (same column gap), so on wide screens "Balance real" lines up with the
 * third stat and the card reads as one ruled ledger page.
 */
export function BalanceCard({ available, totalBudgeted, totalSpent, totalRealSpent, hasMissingTrm }: BalanceCardProps) {
  const { t } = useI18n();
  const { formatCOP } = useNumberFormat();
  const balance = available - totalBudgeted;
  const realBalance = available - totalRealSpent;
  const pending = Math.max(0, totalBudgeted - totalSpent);

  // Full-format amounts step down so they stay on one line on a 360px phone
  // ("+$ 28.633.556" at 28px, "+$27.4M" keeps 40px).
  const heroLength = (balance > 0 ? 1 : 0) + formatCOP(balance).length;
  const realLength = (realBalance > 0 ? 1 : 0) + formatCOP(realBalance).length;
  const heroSize = heroLength <= 9 ? 'text-[40px]' : heroLength <= 12 ? 'text-[32px]' : 'text-[28px]';
  const realSize = realLength <= 9 ? 'text-[28px]' : 'text-[22px]';

  const stats = [
    { label: t.monthView.availableLabel, value: available },
    { label: t.monthView.budgetedLabel, value: totalBudgeted },
    { label: t.monthView.executedLabel, value: totalSpent },
    { label: t.monthView.toExecuteLabel, value: pending },
  ];

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6">
      {/* Bottom-aligned on wide screens: both amounts sit on one baseline. */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:items-end sm:gap-x-8">
        <div>
          <p className="text-[13px] font-medium text-[var(--text-secondary)]">{t.monthView.balanceReal}</p>
          <p className={cn('mt-1.5 font-bold tracking-[-0.01em] tabular-nums', heroSize, 'leading-none', inkFor(balance))}>
            {balance > 0 ? '+' : ''}<AbbreviatedAmount value={balance} />
          </p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">{t.monthView.availableMinusBudgeted}</p>
        </div>

        <div>
          <p className="text-[13px] font-medium text-[var(--text-secondary)]">{t.monthView.trueBalanceReal}</p>
          <p className={cn('mt-1.5 font-bold tracking-[-0.01em] tabular-nums', realSize, 'leading-none', inkFor(realBalance))}>
            {realBalance > 0 ? '+' : ''}<AbbreviatedAmount value={realBalance} />
          </p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">{t.monthView.availableMinusSpent}</p>
        </div>
      </div>

      {hasMissingTrm && (
        <p className="mt-5 flex items-start gap-2 rounded-[10px] bg-amber-50 px-3 py-2 text-[13px] leading-snug text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" className="mt-px shrink-0" />
          {t.monthView.usdExcludedNoTrm}
        </p>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-4">
        {stats.map(stat => (
          <div key={stat.label}>
            <dt className="text-[13px] text-[var(--text-secondary)]">{stat.label}</dt>
            <dd className={cn('mt-0.5 text-[15px] font-semibold tabular-nums', inkFor(stat.value))}>
              <AbbreviatedAmount value={stat.value} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
