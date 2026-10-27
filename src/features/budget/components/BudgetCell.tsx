import React, {
  useState, useRef, useEffect, useImperativeHandle,
} from 'react';
import { useI18n } from '@/shared/i18n/useI18n';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { cn } from '@/shared/ui/cn';
import type { YearLens } from '@/application/yearViewLens';
import type { ContextMenuPos, CellContextData } from './yearViewTypes';

export interface BudgetCellHandle {
  /** `initial` replaces the draft (typing a digit on a selected cell). */
  startEdit(initial?: string): void;
  cancelEdit(): void;
}

interface BudgetCellProps {
  budgetId: string;
  budgetName: string;
  budgetMonthId: string | null;
  month: string;
  amount: number;
  spentAmount: number;
  /** What this cell displays (null = unknown yet, e.g. spent in a future month). */
  lens: YearLens;
  value: number | null;
  /** Only the Budget lens edits amounts. */
  editable: boolean;
  /** Position in the sheet + selection state (range highlight / focused cell). */
  rowIdx: number;
  colIdx: number;
  selected: boolean;
  active: boolean;
  isExecuted: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  hasStarted: boolean;
  debtId: string | null;
  paymentMode: string;
  onTabNext: () => void;
  onTabPrev: () => void;
  onEnterDown: () => void;
  onOpenExpenses: () => void;
  onContextMenu: (pos: ContextMenuPos, data: CellContextData) => void;
  onForwardRequest: (amount: number) => void;
  onSave: (budgetMonthId: string | null, month: string, amount: number, isExecuted: boolean, newAmount: number) => Promise<void>;
}

export const BudgetCell = React.forwardRef<BudgetCellHandle, BudgetCellProps>(
  function BudgetCell({
    budgetId, budgetName, budgetMonthId, month, amount, spentAmount, lens, value, editable, rowIdx, colIdx, selected, active,
    isExecuted, isCurrent, isFuture, hasStarted, debtId, paymentMode,
    onTabNext, onTabPrev, onEnterDown, onOpenExpenses, onContextMenu, onForwardRequest, onSave,
  }, ref) {
    const { t } = useI18n();
    const { formatCOP } = useNumberFormat();
    const [editing,   setEditing]   = useState(false);
    const [draft,     setDraft]     = useState('');
    const [saveError, setSaveError] = useState<string | null>(null);
    const inputRef                  = useRef<HTMLInputElement>(null);
    const longPressTimer            = useRef<ReturnType<typeof setTimeout> | null>(null);
    const typedInitial              = useRef(false);
    const touchOrigin               = useRef<{ x: number; y: number } | null>(null);

    useImperativeHandle(ref, () => ({
      startEdit(initial?: string) {
        if (!hasStarted || isExecuted || !editable) return;
        typedInitial.current = initial !== undefined;
        setDraft(initial ?? String(amount));
        setEditing(true);
      },
      cancelEdit() { setEditing(false); },
    }), [hasStarted, isExecuted, editable, amount]);

    useEffect(() => {
      const el = inputRef.current;
      if (!editing || !el) return;
      if (typedInitial.current) el.setSelectionRange(el.value.length, el.value.length);
      else el.select();
    }, [editing]);

    const isPast = !isCurrent && !isFuture && hasStarted;
    const canForward = !isPast;

    const ctxData: CellContextData = {
      budgetId, budgetName, budgetMonthId, month, amount, spentAmount,
      isExecuted, isPast, debtId, paymentMode,
    };

    async function save(value: string) {
      const parsed = parseInt(value.replace(/\D/g, ''), 10);
      if (!isNaN(parsed) && parsed !== amount) {
        await onSave(budgetMonthId, month, amount, isExecuted, parsed);
      }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === 'Tab') {
        e.preventDefault();
        const val  = draft;
        const next = e.shiftKey ? onTabPrev : onTabNext;
        setEditing(false);
        save(val).then(next).catch(err => {
          console.error('[BudgetCell] save failed:', err);
          setSaveError(err instanceof Error ? err.message : t.common.unexpectedError);
        });
      } else if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        const parsed = parseInt(draft.replace(/\D/g, ''), 10);
        setEditing(false);
        if (!isNaN(parsed)) onForwardRequest(parsed);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const val = draft;
        setEditing(false);
        save(val).then(onEnterDown).catch(err => {
          console.error('[BudgetCell] save failed:', err);
          setSaveError(err instanceof Error ? err.message : t.common.unexpectedError);
        });
      } else if (e.key === 'Escape') {
        setEditing(false);
      }
    }

    function handleTouchStart(e: React.TouchEvent<HTMLTableCellElement>) {
      const touch = e.touches[0];
      touchOrigin.current = { x: touch.clientX, y: touch.clientY };
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        if (navigator.vibrate) navigator.vibrate(10);
        onContextMenu({ x: touch.clientX, y: touch.clientY, source: 'touch' }, ctxData);
      }, 500);
    }
    function handleTouchMove(e: React.TouchEvent<HTMLTableCellElement>) {
      if (!longPressTimer.current || !touchOrigin.current) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchOrigin.current.x);
      const dy = Math.abs(touch.clientY - touchOrigin.current.y);
      if (dx > 10 || dy > 10) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    }
    function handleTouchEnd() {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    }

    function handleNativeContextMenu(e: React.MouseEvent<HTMLTableCellElement>) {
      e.preventDefault();
      onContextMenu({ x: e.clientX, y: e.clientY, source: 'mouse' }, ctxData);
    }

    if (!hasStarted) {
      return (
        <td data-r={rowIdx} data-c={colIdx} className="h-8 border-b border-r border-[var(--border-subtle)] min-w-[var(--yv-col)]" />
      );
    }

    if (editing) {
      const monthLabels = t.months?.short;
      const monthIdx  = parseInt(month.slice(5)) - 1;
      const yearLabel = month.slice(0, 4);
      const endLabel  = `${yearLabel}-12`;
      const fromLabel = monthLabels
        ? monthLabels[String(monthIdx + 1).padStart(2, '0')]
        : month;
      const toLabel   = monthLabels ? monthLabels['12'] : endLabel;
      const rangeCount = 12 - monthIdx;

      return (
        <td
          data-r={rowIdx}
          data-c={colIdx}
          className="h-8 border-b border-r border-[var(--border-subtle)] px-1 min-w-[var(--yv-col)] relative overflow-visible"
          style={{ zIndex: 40 }}
        >
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={handleKeyDown}
            className="w-full text-right text-[13px] tabular-nums px-1.5 py-0.5 rounded border-2 border-[var(--focus-ring)] focus:outline-none bg-[var(--bg-surface)] text-[var(--text-primary)]"
          />
          <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-[var(--bg-surface)] border border-[var(--border-medium)] rounded-xl shadow-lg min-w-[210px] overflow-hidden">
            <button
              className="flex items-center gap-2 px-3 py-2.5 w-full text-left hover:bg-[var(--bg-hover)] transition-colors border-none bg-transparent"
              onMouseDown={e => {
                e.preventDefault();
                const val = draft;
                setEditing(false);
                save(val).then(onEnterDown).catch(err => {
                  console.error('[BudgetCell] save failed:', err);
                  setSaveError(err instanceof Error ? err.message : t.common.unexpectedError);
                });
              }}
            >
              <span className="w-6 h-6 rounded-md bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-xs flex-shrink-0">✓</span>
              <span className="flex-1">
                <span className="block text-xs font-medium text-[var(--text-primary)]">{t.yearView.editOnlyThisMonth}</span>
                <span className="block text-[10px] text-[var(--text-muted)]">Enter</span>
              </span>
            </button>
            <button
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 w-full text-left transition-colors border-none bg-transparent border-t border-[var(--border-subtle)]',
                canForward
                  ? 'hover:bg-[var(--bg-hover)]'
                  : 'opacity-40 cursor-not-allowed',
              )}
              disabled={!canForward}
              onMouseDown={e => {
                e.preventDefault();
                if (!canForward) return;
                const parsed = parseInt(draft.replace(/\D/g, ''), 10);
                setEditing(false);
                if (!isNaN(parsed)) onForwardRequest(parsed);
              }}
            >
              <span className="w-6 h-6 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-xs flex-shrink-0">→</span>
              <span className="flex-1">
                <span className="block text-xs font-medium text-[var(--text-primary)]">{t.yearView.ctxForwardAmount}</span>
                <span className="block text-[10px] text-[var(--text-muted)]">
                  {canForward
                    ? t.yearView.editForwardMonths(`${fromLabel}–${toLabel}`, rangeCount)
                    : t.yearView.ctxForwardPastNotAvailable}
                </span>
              </span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono bg-[var(--bg-app)] px-1 rounded flex-shrink-0">⇧ Enter</span>
            </button>
          </div>
        </td>
      );
    }

    const over = spentAmount > 0 && spentAmount > amount;
    const pct  = amount > 0 ? Math.min(1, spentAmount / amount) : (spentAmount > 0 ? 1 : 0);
    const paidTint = lens === 'plan' && isExecuted;

    let text = '';
    let tone = 'text-[var(--text-primary)]';
    if (value !== null) {
      text = value === 0 ? '–' : '';
      if (lens === 'diff') {
        tone = value > 0 ? 'text-[var(--text-positive)]' : value < 0 ? 'text-[var(--text-negative)] font-semibold' : 'text-[var(--text-muted)]';
      } else if (over) {
        tone = 'text-[var(--text-negative)] font-semibold';
      } else if (lens === 'plan' && isExecuted) {
        tone = 'text-green-800 dark:text-green-300';
      } else if (value === 0 || (lens === 'plan' && isFuture)) {
        tone = 'text-[var(--text-muted)]';
      }
    }

    const title = `${t.yearView.budgetedRow}: ${formatCOP(amount)} · ${t.yearView.executedRow}: ${formatCOP(spentAmount)}`
      + (isExecuted ? ` · ${t.yearView.legendPaid}` : '');

    return (
      <td
        className={cn(
          'relative h-8 min-w-[var(--yv-col)] scroll-mt-9 scroll-mb-[var(--yv-foot)] scroll-ml-[8.5rem] sm:scroll-ml-60 border-b border-r border-[var(--border-subtle)] px-2.5 text-right text-[13px] tabular-nums select-none cursor-cell',
          selected
            ? 'bg-[var(--color-primary)]/10'
            : paidTint
              ? 'bg-green-50 dark:bg-green-950/30'
              : isCurrent && 'bg-[var(--color-now)]/[0.07]',
          !selected && 'hover:bg-[var(--row-hover)]',
          active && 'z-[1] outline outline-2 -outline-offset-2 outline-[var(--focus-ring)]',
        )}
        data-r={rowIdx}
        data-c={colIdx}
        title={title}
        onDoubleClick={() => {
          if (!editable) {
            if (value !== null) onOpenExpenses();
            return;
          }
          if (isExecuted) return;
          typedInitial.current = false;
          setDraft(String(amount));
          setEditing(true);
        }}
        onContextMenu={handleNativeContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'manipulation' }}
      >
        {lens === 'spent' && value !== null && value > 0 && (
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-y-1 left-0.5 rounded-sm',
              over ? 'bg-red-500/25' : 'bg-green-500/20',
            )}
            style={{ width: `calc((100% - 4px) * ${pct})` }}
          />
        )}

        {value !== null && (
          <span className={cn('relative', tone)}>
            {value === 0
              ? text
              : (
                <>
                  {lens === 'diff' && value > 0 && '+'}
                  <AbbreviatedAmount value={value} />
                </>
              )}
          </span>
        )}

        {saveError && (
          <div
            className="absolute bottom-full right-0 mb-1 z-50 bg-red-600 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg"
            onClick={() => setSaveError(null)}
            title={saveError}
          >
            ⚠ {saveError}
          </div>
        )}
      </td>
    );
  },
);