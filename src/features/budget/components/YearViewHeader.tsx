import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { useI18n } from '@/shared/i18n/useI18n';
import { cn } from '@/shared/ui/cn';
import type { YearLens } from '@/application/yearViewLens';
import type { YearSortKey } from '../sortYearBudgets';

const SORT_OPTIONS: YearSortKey[] = ['name-asc', 'value-desc', 'category-asc'];

interface YearViewHeaderProps {
  year: number;
  budgets: unknown[];
  yearFilter: string;
  yearSortKey: YearSortKey;
  lens: YearLens;
  matchCount: number;
  onYearChange: (year: number) => void;
  onFilterChange: (filter: string) => void;
  onSortChange: (key: YearSortKey) => void;
  onLensChange: (lens: YearLens) => void;
}

export function YearViewHeader({
  year, budgets, yearFilter, yearSortKey, lens, matchCount,
  onYearChange, onFilterChange, onSortChange, onLensChange,
}: YearViewHeaderProps) {
  const { t } = useI18n();
  const hasBudgets = budgets.length > 0;

  const lenses: { key: YearLens; label: string }[] = [
    { key: 'plan',  label: t.yearView.lensPlan },
    { key: 'spent', label: t.yearView.lensSpent },
    { key: 'diff',  label: t.yearView.lensDiff },
  ];
  const sortLabels: Record<string, string> = {
    'name-asc': t.yearView.sortName,
    'value-desc': t.yearView.sortValue,
    'category-asc': t.yearView.sortCategory,
  };
  const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-medium)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors';

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 bg-[var(--bg-surface)] border-b border-[var(--border-medium)]">
      <div className="flex items-center gap-1">
        <button type="button" className={iconBtn} aria-label={t.yearView.prevYear} onClick={() => onYearChange(year - 1)}>
          <ChevronLeft size={15} />
        </button>
        <span className="min-w-14 text-center text-[15px] font-semibold text-[var(--text-primary)] tabular-nums">{year}</span>
        <button type="button" className={iconBtn} aria-label={t.yearView.nextYear} onClick={() => onYearChange(year + 1)}>
          <ChevronRight size={15} />
        </button>
      </div>

      <div
        role="group"
        aria-label={t.yearView.lensLabel}
        className="flex gap-0.5 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-[3px]"
      >
        {lenses.map(l => (
          <button
            key={l.key}
            type="button"
            aria-pressed={lens === l.key}
            onClick={() => onLensChange(l.key)}
            className={cn(
              'h-[30px] rounded-[7px] px-3.5 text-[13px] font-semibold transition-colors',
              lens === l.key
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
          >
            {l.label}
          </button>
        ))}
      </div>

      {hasBudgets && (
        <>
          <label className="flex h-8 min-w-48 max-w-80 flex-1 items-center gap-2 rounded-lg border border-[var(--border-field)] bg-[var(--bg-surface)] px-2.5 text-[var(--text-muted)] focus-within:border-[var(--focus-ring)]">
            <Search size={14} className="shrink-0" aria-hidden="true" />
            <input
              type="text"
              value={yearFilter}
              onChange={e => onFilterChange(e.target.value)}
              placeholder={t.yearView.searchPlaceholder}
              aria-label={t.yearView.searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            />
            {yearFilter && (
              <button type="button" onClick={() => onFilterChange('')} aria-label={t.yearView.forwardCancel} className="hover:text-[var(--text-primary)]">
                <X size={14} />
              </button>
            )}
          </label>

          <label className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
            <span>{t.yearView.sortLabel}</span>
            <select
              value={SORT_OPTIONS.includes(yearSortKey) ? yearSortKey : 'name-asc'}
              onChange={e => onSortChange(e.target.value as YearSortKey)}
              className="h-8 rounded-lg border border-[var(--border-field)] bg-[var(--bg-surface)] px-2 text-[13px] text-[var(--text-primary)]"
            >
              {SORT_OPTIONS.map(k => <option key={k} value={k}>{sortLabels[k]}</option>)}
            </select>
          </label>

          {yearFilter && (
            <span className="text-xs text-[var(--text-muted)]">{t.yearView.matchCount(matchCount)}</span>
          )}
        </>
      )}
    </div>
  );
}
