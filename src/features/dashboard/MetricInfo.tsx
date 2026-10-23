/**
 * MetricInfo — the KPI tile's corner icon, as a button that opens an overlay
 * explaining the metric in plain words and how it is calculated.
 *
 *   ┌──────────────────────────────┐
 *   │ (⚖) Balance real              │
 *   │ What the household really     │
 *   │ has left this month…          │
 *   │ ┌──────────────────────────┐ │
 *   │ │ Cómo se calcula           │ │
 *   │ │ Disponible − gastos…      │ │
 *   │ └──────────────────────────┘ │
 *   └──────────────────────────────┘
 */

import { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

interface MetricInfoProps {
  /** Metric name, also the overlay's title. */
  label: string;
  icon: LucideIcon;
  description: string;
  formula: string;
}

export function MetricInfo({ label, icon: Icon, description, formula }: MetricInfoProps) {
  const { t } = useI18n();
  const titleId = useId();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t.dashboard.metricInfoButton(label)}
          // Negative margins keep the 36px target from pushing the tile's label row.
          className="-my-2 -mr-2 grid size-9 shrink-0 place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-brand)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] data-[state=open]:bg-[var(--bg-hover)] data-[state=open]:text-[var(--text-brand)]"
        >
          <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent aria-labelledby={titleId} className="w-[min(21rem,calc(100vw-1rem))] p-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--bg-surface-2)] text-[var(--text-brand)]">
            <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h3 id={titleId} className="text-base font-[700] leading-tight">{label}</h3>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{description}</p>
        <div className="mt-4 rounded-xl bg-[var(--bg-surface-2)] px-3.5 py-3">
          <p className="text-xs font-semibold text-[var(--text-muted)]">{t.dashboard.metricFormulaLabel}</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{formula}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
