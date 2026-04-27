import { Button } from '@/shared/ui/button';
import { ChevronLeft, ChevronRight, Search, X, RotateCcw } from 'lucide-react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { cn } from '@/shared/ui/cn';
import type { YearSortKey } from '../YearViewV2';

const YEAR_SORT_CHIPS: {
  dimension: 'value' | 'name' | 'category';
  ascKey: YearSortKey;
  descKey: YearSortKey;
  defaultDir: 'asc' | 'desc';
}[] = [
  { dimension: 'name',     ascKey: 'name-asc',     descKey: 'name-desc',     defaultDir: 'asc'  },
  { dimension: 'value',    ascKey: 'value-asc',    descKey: 'value-desc',    defaultDir: 'desc' },
  { dimension: 'category', ascKey: 'category-asc', descKey: 'category-desc', defaultDir: 'asc'  },
];

interface YearViewHeaderProps {
  year: number;
  budgets: { length: number }[];
  yearFilter: string;
  yearSortKey: YearSortKey;
  matchCount: number;
  onYearChange: (year: number) => void;
  onFilterChange: (filter: string) => void;
  onSortChange: (key: YearSortKey) => void;
}

export function YearViewHeader({
  year, budgets, yearFilter, yearSortKey, matchCount,
  onYearChange, onFilterChange, onSortChange,
}: YearViewHeaderProps) {
  const { t } = useI18n();
  const hasBudgets = budgets.length > 0;

  return (
    <div className="flex flex-col">
      {/* Year navigator */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
        <Button variant="outline" size="icon" onClick={() => onYearChange(year - 1)}>
          <ChevronLeft size={16} />
        </Button>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">{year}</h2>
        <Button variant="outline" size="icon" onClick={() => onYearChange(year + 1)}>
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Sort & filter bar */}
      {hasBudgets && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
          <div className={cn(
            'flex items-center gap-2 flex-1 bg-[var(--bg-app)] border rounded-lg px-3',
            yearFilter ? 'border-violet-400 dark:border-violet-600' : 'border-[var(--border-medium)]',
          )}>
            <Search size={13} className="text-[var(--text-muted)] shrink-0" />
            <input
              type="text"
              value={yearFilter}
              onChange={e => onFilterChange(e.target.value)}
              placeholder={t.yearView.searchPlaceholder}
              className="flex-1 bg-transparent py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            />
            {yearFilter && (
              <button onClick={() => onFilterChange('')} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X size={13} />
              </button>
            )}
          </div>

          {YEAR_SORT_CHIPS.map(chip => {
            const isActive = yearSortKey === chip.ascKey || yearSortKey === chip.descKey;
            const isAsc    = yearSortKey === chip.ascKey;
            const chipLabel = (() => {
              if (!isActive) {
                if (chip.dimension === 'name')  return t.yearView.sortName;
                if (chip.dimension === 'value') return t.yearView.sortValue;
                return t.yearView.sortCategory;
              }
              if (chip.dimension === 'value') return isAsc ? `↑ ${t.yearView.sortValue}` : `↓ ${t.yearView.sortValue}`;
              if (chip.dimension === 'name')  return isAsc ? `A→Z ${t.yearView.sortName}` : `Z→A ${t.yearView.sortName}`;
              return isAsc ? `${t.yearView.sortCategory} A→Z` : `${t.yearView.sortCategory} Z→A`;
            })();
            return (
              <button
                key={chip.dimension}
                onClick={() => {
                  if (yearSortKey === chip.ascKey)       onSortChange(chip.descKey);
                  else if (yearSortKey === chip.descKey) onSortChange(chip.ascKey);
                  else onSortChange(chip.defaultDir === 'desc' ? chip.descKey : chip.ascKey);
                }}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all duration-150 whitespace-nowrap shrink-0',
                  isActive
                    ? 'bg-violet-600 dark:bg-violet-500 text-white border-violet-600'
                    : 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 hover:bg-violet-100',
                )}
              >
                {chipLabel}
              </button>
            );
          })}

          {yearSortKey !== 'name-asc' && (
            <button
              onClick={() => onSortChange('name-asc')}
              className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-violet-600 transition-colors shrink-0"
            >
              <RotateCcw size={10} /><span>{t.yearView.sortReset}</span>
            </button>
          )}

          {yearFilter && (
            <span className="text-[10px] text-[var(--text-muted)] shrink-0 ml-auto">
              {t.yearView.matchCount(matchCount)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}