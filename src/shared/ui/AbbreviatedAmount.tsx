/**
 * AbbreviatedAmount — displays a formatted COP (or USD) amount, and when the
 * app is in "abbreviated" number format mode, shows a tooltip with the full
 * Intl-formatted value on hover.
 *
 * Usage:
 *   <AbbreviatedAmount value={27_398_988} />
 *   <AbbreviatedAmount value={1_500} currency="USD" className="font-bold" />
 *
 * In 'abbreviated' mode → "$27.4M" with tooltip "$ 27.398.988"
 * In 'full' mode        → "$ 27.398.988" (no tooltip needed)
 */

import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { useAppSettings } from '@/features/settings/AppSettingsContext';
import { cn } from '@/shared/ui/cn';

interface AbbreviatedAmountProps {
  value: number;
  currency?: 'COP' | 'USD';
  className?: string;
}

export function AbbreviatedAmount({
  value,
  currency = 'COP',
  className,
}: AbbreviatedAmountProps) {
  const { numberFormat } = useAppSettings();
  const { formatCOP, formatUSD } = useNumberFormat();

  const displayValue = currency === 'USD' ? formatUSD(value) : formatCOP(value);

  // In full mode the display is already the full value — no tooltip needed
  if (numberFormat !== 'abbreviated') {
    return <span className={className}>{displayValue}</span>;
  }

  // Only add a tooltip if the value is actually abbreviated (contains K or M suffix)
  const isAbbreviated = displayValue.includes('K') || displayValue.includes('M');
  if (!isAbbreviated) {
    return <span className={className}>{displayValue}</span>;
  }

  // Full (non-abbreviated) representation for the tooltip
  const fullValue = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'COP',
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(value);

  return (
    <span className={cn('relative group/amt inline-block', className)}>
      {displayValue}
      {/* Tooltip bubble */}
      <span
        className={cn(
          'pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50',
          'whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-medium shadow-lg',
          'bg-gray-900 text-gray-100 dark:bg-gray-800 dark:text-gray-100',
          'opacity-0 group-hover/amt:opacity-100 transition-opacity duration-150',
        )}
      >
        {fullValue}
        {/* Downward arrow */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800" />
      </span>
    </span>
  );
}
