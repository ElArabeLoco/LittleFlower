import { useState, useRef } from 'react';
import { ChevronUp, SlidersHorizontal, Search, X, RotateCcw } from 'lucide-react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { cn } from '@/shared/ui/cn';

export type SortKey =
  | 'pending-desc'
  | 'value-desc' | 'value-asc'
  | 'name-asc'   | 'name-desc'
  | 'category-asc' | 'category-desc';

const SORT_CHIPS: {
  dimension: 'value' | 'name' | 'category';
  ascKey: SortKey;
  descKey: SortKey;
  defaultDir: 'asc' | 'desc';
}[] = [
  { dimension: 'value',    ascKey: 'value-asc',    descKey: 'value-desc',    defaultDir: 'desc' },
  { dimension: 'name',     ascKey: 'name-asc',     descKey: 'name-desc',     defaultDir: 'asc'  },
  { dimension: 'category', ascKey: 'category-asc', descKey: 'category-desc', defaultDir: 'asc'  },
];

interface FilterSortBarProps {
  sortKey: SortKey;
  filterText: string;
  onSortChange: (key: SortKey) => void;
  onFilterChange: (text: string) => void;
  matchCount: number;
}

export function FilterSortBar({ sortKey, filterText, onSortChange, onFilterChange, matchCount }: FilterSortBarProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasFilter = filterText.trim().length > 0;
  const isDefault = sortKey === 'pending-desc';

  function toggleExpanded() {
    setExpanded(v => {
      if (!v) setTimeout(() => inputRef.current?.focus(), 50);
      return !v;
    });
  }

  function clearFilter() {
    onFilterChange('');
    inputRef.current?.focus();
  }

  function handleChipClick(chip: typeof SORT_CHIPS[number]) {
    if (sortKey === chip.ascKey) {
      onSortChange(chip.descKey);
    } else if (sortKey === chip.descKey) {
      onSortChange(chip.ascKey);
    } else {
      onSortChange(chip.defaultDir === 'desc' ? chip.descKey : chip.ascKey);
    }
  }

  function chipLabel(chip: typeof SORT_CHIPS[number]): string {
    const active = sortKey === chip.ascKey || sortKey === chip.descKey;
    const isAsc = sortKey === chip.ascKey;
    if (!active) {
      if (chip.dimension === 'value')    return t.monthView.sortValue;
      if (chip.dimension === 'name')     return t.monthView.sortName;
      return t.monthView.sortCategory;
    }
    if (chip.dimension === 'value')    return isAsc ? `↑ ${t.monthView.sortValue}` : `↓ ${t.monthView.sortValue}`;
    if (chip.dimension === 'name')     return isAsc ? `A→Z ${t.monthView.sortName}` : `Z→A ${t.monthView.sortName}`;
    return isAsc ? `${t.monthView.sortCategory} A→Z` : `${t.monthView.sortCategory} Z→A`;
  }

  function activeBadgeLabel(): string {
    if (isDefault) return t.monthView.sortDefault;
    const chip = SORT_CHIPS.find(c => sortKey === c.ascKey || sortKey === c.descKey);
    if (chip) return chipLabel(chip);
    return t.monthView.sortDefault;
  }

  return (
    <div className="mx-4 mb-2">
      <button
        onClick={toggleExpanded}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors',
          'bg-[var(--bg-surface)] border border-[var(--border-medium)]',
          expanded ? 'rounded-t-xl border-b-transparent' : 'rounded-xl',
          'hover:bg-[var(--bg-hover)]',
        )}
        aria-expanded={expanded}
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 shrink-0">
          <SlidersHorizontal size={12} />
        </span>
        <span className="flex-1 text-xs font-semibold text-[var(--text-secondary)]">
          {t.monthView.sortAndFilter}
        </span>

        {hasFilter ? (
          <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full shrink-0">
            {t.monthView.matchCount(matchCount)}
          </span>
        ) : (
          <span className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
            isDefault
              ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-500 dark:text-violet-400'
              : 'bg-violet-600 dark:bg-violet-500 text-white',
          )}>
            {activeBadgeLabel()}
          </span>
        )}

        <ChevronUp
          size={13}
          className={cn(
            'shrink-0 text-[var(--text-muted)] transition-transform duration-200',
            !expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-medium)] border-t-0 rounded-b-xl px-3 pb-3 pt-2 space-y-2.5">
          <div className={cn(
            'flex items-center gap-2 bg-[var(--bg-app)] border rounded-lg px-3 py-0',
            hasFilter ? 'border-violet-400 dark:border-violet-600' : 'border-[var(--border-medium)]',
          )}>
            <Search size={13} className="text-[var(--text-muted)] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={filterText}
              onChange={e => onFilterChange(e.target.value)}
              placeholder={t.monthView.searchPlaceholder}
              className="flex-1 bg-transparent py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            />
            {hasFilter && (
              <button onClick={clearFilter} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-0.5">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {SORT_CHIPS.map(chip => {
              const isActive = sortKey === chip.ascKey || sortKey === chip.descKey;
              return (
                <button
                  key={chip.dimension}
                  onClick={() => handleChipClick(chip)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all duration-150',
                    isActive
                      ? 'bg-violet-600 dark:bg-violet-500 text-white border-violet-600 dark:border-violet-500'
                      : 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/40',
                  )}
                >
                  {chipLabel(chip)}
                </button>
              );
            })}

            {!isDefault && (
              <button
                onClick={() => onSortChange('pending-desc')}
                className="flex items-center gap-1 ml-auto text-[10px] text-[var(--text-muted)] hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                <RotateCcw size={11} />
                <span>{t.monthView.sortReset}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}