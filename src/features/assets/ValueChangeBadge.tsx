/**
 * The change of an asset's value in words, with an icon and the signed
 * amount: never color alone.
 */

import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { ValueChange } from '@/domain/asset/assetValuation';
import { cn } from '@/shared/ui/cn';
import { useI18n } from '@/shared/i18n/useI18n';
import { signedPercent, useValuationFormat } from './valuationFormat';

const TONES = {
  up: { icon: TrendingUp, className: 'text-green-700 dark:text-green-300' },
  down: { icon: TrendingDown, className: 'text-red-700 dark:text-red-300' },
  flat: { icon: Minus, className: 'text-[var(--text-secondary)]' },
} as const;

/**
 * `compact` keeps only the word, the percentage and the date; `since`
 * false leaves the date out where it is already shown.
 */
export function ValueChangeBadge({
  change,
  compact = false,
  since = true,
}: {
  change: ValueChange;
  compact?: boolean;
  since?: boolean;
}) {
  const { t } = useI18n();
  const { signedMoney, date } = useValuationFormat();
  const direction = change.delta > 0 ? 'up' : change.delta < 0 ? 'down' : 'flat';
  const { icon: Icon, className } = TONES[direction];
  const word = direction === 'up' ? t.assets.changeUp : direction === 'down' ? t.assets.changeDown : t.assets.changeFlat;

  return (
    <p className={cn('flex flex-wrap items-center gap-x-1.5 text-sm', className)}>
      <Icon size={16} aria-hidden="true" className="shrink-0" />
      <span className="font-semibold">{word}</span>
      {direction !== 'flat' && (
        <span className="tabular-nums">
          {compact ? null : signedMoney(change.delta, change.to.currency)}
          {change.percent !== null && (compact ? signedPercent(change.percent) : ` · ${signedPercent(change.percent)}`)}
        </span>
      )}
      {since && <span className="text-[var(--text-secondary)]">{t.assets.changeSince(date(change.from.valuedOn))}</span>}
    </p>
  );
}
