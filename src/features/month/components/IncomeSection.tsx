import { useState } from 'react';
import { TrendingUp, ChevronUp } from 'lucide-react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { cn } from '@/shared/ui/cn';
import type { IncomeRow, IncomeMonthRow } from '@/application/useMonthViewData';

interface IncomeSectionProps {
  incomes: IncomeRow[];
  imMap: Map<string, IncomeMonthRow>;
  trm: number | null;
  totalAvailable: number;
  hasMissingTrm: boolean;
}

export function IncomeSection({ incomes, imMap, trm, totalAvailable, hasMissingTrm }: IncomeSectionProps) {
  const { t } = useI18n();
  const { formatNumber } = useNumberFormat();
  const [collapsed, setCollapsed] = useState(true);

  return (
    <section>
      <button
        className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border bg-[var(--group-available-bg)] border-[var(--border-medium)] mb-2 transition-colors text-left"
        onClick={() => setCollapsed(c => !c)}
      >
        <TrendingUp size={15} className="text-[var(--group-available-text)] shrink-0" />
        <span className="flex-1 text-sm font-semibold text-[var(--group-available-text)]">
          {t.monthView.incomeLabel}
        </span>
        {hasMissingTrm && (
          <span className="text-[11px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium shrink-0">
            {t.monthView.noTrm}
          </span>
        )}
        <span className="text-sm font-semibold tabular-nums text-[var(--group-available-text)] shrink-0">
          <AbbreviatedAmount value={totalAvailable} />
        </span>
        <span className={cn(
          'shrink-0 text-[var(--group-available-text)] transition-transform duration-200',
          collapsed && 'rotate-180',
        )}>
          <ChevronUp size={14} />
        </span>
      </button>

      {!collapsed && (
        <div className="space-y-2">
          {incomes.map(inc => {
            const im = imMap.get(inc.id);
            const amount = im ? im.real_amount : inc.default_amount;
            const currency = im ? im.currency : inc.currency;
            const isUSD = currency !== 'COP';
            const copEquiv = isUSD && trm ? Math.round(amount * trm) : null;
            const isModified = im !== null;

            return (
              <div
                key={inc.id}
                className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] px-4 py-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {inc.name}
                    </p>
                    {isModified && (
                      <span className="text-xs text-[var(--text-muted)] shrink-0">{t.monthView.edited}</span>
                    )}
                  </div>
                  <p className="flex flex-wrap gap-x-2.5 text-xs text-[var(--text-muted)] mt-0.5">
                    <span>{inc.is_fixed === 1 ? t.monthView.fixed : t.monthView.variable}</span>
                    {/* Separator for screen readers and copy-paste; the visual gap separates on screen. */}
                    {isUSD && <span className="sr-only">, </span>}
                    {isUSD && (
                      trm
                        ? <span className="tabular-nums">TRM {formatNumber(trm)}</span>
                        : <span className="text-amber-800 dark:text-amber-300">{t.monthView.noTrm}</span>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                    {isUSD && <span className="text-xs font-medium text-[var(--text-muted)] mr-1">USD</span>}
                    {formatNumber(amount)}
                  </p>
                  {copEquiv !== null && (
                    <p className="text-xs text-[var(--text-muted)] tabular-nums">
                      ≈ <AbbreviatedAmount value={copEquiv} />
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}