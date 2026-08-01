import React, {
  useState, useRef, useEffect, useImperativeHandle,
} from 'react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { cn } from '@/shared/ui/cn';
import type { ContextMenuPos, CellContextData } from './yearViewTypes';

export interface BudgetCellHandle {
  startEdit(): void;
  cancelEdit(): void;
}

interface BudgetCellProps {
  budgetId: string;
  budgetName: string;
  budgetMonthId: string | null;
  month: string;
  amount: number;
  spentAmount: number;
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
    budgetId, budgetName, budgetMonthId, month, amount, spentAmount,
    isExecuted, isCurrent, isFuture, hasStarted, debtId, paymentMode,
    onTabNext, onTabPrev, onEnterDown, onOpenExpenses, onContextMenu, onForwardRequest, onSave,
  }, ref) {
    const { t } = useI18n();
    const [editing,   setEditing]   = useState(false);
    const [draft,     setDraft]     = useState('');
    const [saveError, setSaveError] = useState<string | null>(null);
    const inputRef                  = useRef<HTMLInputElement>(null);
    const longPressTimer            = useRef<ReturnType<typeof setTimeout> | null>(null);
    const touchOrigin               = useRef<{ x: number; y: number } | null>(null);

    useImperativeHandle(ref, () => ({
      startEdit() {
        if (!hasStarted || isExecuted) return;
        setDraft(String(amount));
        setEditing(true);
      },
      cancelEdit() { setEditing(false); },
    }), [hasStarted, isExecuted, amount]);

    useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

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
        <td className="border-r border-[var(--border-cell)] px-2 py-1.5 text-center text-[var(--text-muted)] text-xs w-20">
          —
        </td>
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
          className="border-r border-[var(--border-cell)] px-1 py-1 w-20 relative overflow-visible"
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
            className="w-full text-right text-xs px-1 py-0.5 border border-violet-400 rounded focus:outline-none bg-violet-50 dark:bg-[var(--bg-surface-2)] dark:text-[var(--text-primary)] dark:border-violet-700"
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

    const hasExpenses = spentAmount > 0;
    const overBudget  = hasExpenses && spentAmount > amount;
    const pct         = amount > 0 ? Math.min(100, Math.round((spentAmount / amount) * 100)) : 0;

    return (
      <td
        className={cn(
          'border-r border-[var(--border-cell)] px-2 py-1 text-right text-xs tabular-nums select-none w-20 transition-colors group/cell relative',
          isExecuted ? 'bg-green-50/60 dark:bg-green-950/30' : '',
          isCurrent && !isExecuted && 'bg-pink-50/30 dark:bg-pink-950/15',
          isCurrent && 'shadow-[inset_0_0_0_1px_var(--border-medium)]',
          'hover:bg-[var(--row-hover)]',
        )}
        onContextMenu={handleNativeContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'manipulation' }}
      >
        <div
          className={cn(
            'font-medium leading-tight cursor-pointer',
            isExecuted
              ? 'text-green-700 dark:text-green-400'
              : isFuture ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]',
            isCurrent && !isExecuted && 'font-semibold',
          )}
          onDoubleClick={() => {
            if (isExecuted) return;
            setDraft(String(amount));
            setEditing(true);
          }}
          title={isExecuted ? t.yearView.executedHint : t.yearView.editHint}
        >
          <AbbreviatedAmount value={amount} />
          {isExecuted && <span className="ml-1 text-green-600">✓</span>}
        </div>

        {hasExpenses && (
          <div
            className={cn(
              'leading-tight text-[10px] tabular-nums cursor-pointer flex items-center justify-end gap-0.5',
              overBudget
                ? 'text-red-500 dark:text-red-400 font-semibold'
                : 'text-violet-600 dark:text-violet-400',
            )}
            onClick={onOpenExpenses}
            title={t.yearView.viewExpenses}
          >
            <AbbreviatedAmount value={spentAmount} />{overBudget && ' ⚠'}
          </div>
        )}

        {hasExpenses && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--border-subtle)]">
            <div
              className={cn('h-full transition-all', overBudget ? 'bg-red-400' : 'bg-violet-400')}
              style={{ width: `${pct}%` }}
            />
          </div>
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