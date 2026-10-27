import { useRef, useEffect } from 'react';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { useI18n } from '@/shared/i18n/useI18n';
import { cn } from '@/shared/ui/cn';
import type { CtxMenuState, CellContextData } from './yearViewTypes';

interface YearViewContextMenuProps {
  ctxMenu: CtxMenuState;
  year: number;
  monthLabel: (month: string) => string;
  onClose: () => void;
  onMarkExecuted: (data: CellContextData) => Promise<void>;
  onRegisterFullPayment: (data: CellContextData) => Promise<void>;
  onViewExpenses: (data: CellContextData) => void;
  onForwardRequest: (data: CellContextData) => void;
}

export function YearViewContextMenu({
  ctxMenu, year, monthLabel,
  onClose, onMarkExecuted, onRegisterFullPayment, onViewExpenses, onForwardRequest,
}: YearViewContextMenuProps) {
  const { t } = useI18n();
  const ctxMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  const { pos, data } = ctxMenu;

  // ── Desktop dropdown ───────────────────────────────────────────────────────
  if (pos.source === 'mouse') {
    return (
      <div
        ref={ctxMenuRef}
        className="fixed z-50 bg-white dark:bg-[var(--bg-surface)] border border-[var(--border-medium)] rounded-xl shadow-xl overflow-hidden"
        style={{ left: pos.x, top: pos.y, minWidth: 240 }}
      >
        {/* Header */}
        <div className="px-3.5 py-2 border-b border-[var(--border-subtle)]">
          <p className="text-xs font-semibold text-[var(--text-primary)]">{data.budgetName}</p>
          <p className="text-[10px] text-[var(--text-muted)]">
            {monthLabel(data.month)} {year} · <AbbreviatedAmount value={data.amount} />
          </p>
        </div>
        {/* Mark executed / unmark */}
        <button
          className="flex items-center gap-2.5 px-3.5 py-2.5 w-full text-left hover:bg-[var(--bg-hover)] transition-colors"
          onClick={() => onMarkExecuted(data)}
        >
          <span className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-sm flex-shrink-0">
            {data.isExecuted ? '↩' : '✅'}
          </span>
          <span className="text-xs font-medium text-[var(--text-primary)]">
            {data.isExecuted ? t.yearView.ctxMarkUnexecuted : t.yearView.ctxMarkExecuted}
          </span>
        </button>
        {/* Register full payment */}
        {!data.isExecuted && (
          <button
            className="flex items-center gap-2.5 px-3.5 py-2.5 w-full text-left hover:bg-[var(--bg-hover)] transition-colors border-t border-[var(--border-subtle)]"
            onClick={() => onRegisterFullPayment(data)}
          >
            <span className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-sm flex-shrink-0">💳</span>
            <span>
              <span className="block text-xs font-medium text-[var(--text-primary)]">{t.yearView.ctxRegisterFullPayment}</span>
              <span className="block text-[10px] text-[var(--text-muted)]">{t.yearView.ctxRegisterFullPaymentDesc}</span>
            </span>
          </button>
        )}
        {/* Apply forward */}
        <button
          className={cn(
            'flex items-center gap-2.5 px-3.5 py-2.5 w-full text-left transition-colors border-t border-[var(--border-subtle)]',
            data.isPast ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[var(--bg-hover)]',
          )}
          disabled={data.isPast}
          onClick={() => !data.isPast && onForwardRequest(data)}
        >
          <span className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-sm flex-shrink-0">→</span>
          <span>
            <span className="block text-xs font-medium text-[var(--text-primary)]">{t.yearView.ctxForwardAmount}</span>
            <span className="block text-[10px] text-[var(--text-muted)]">
              {data.isPast
                ? t.yearView.ctxForwardPastNotAvailable
                : t.yearView.ctxForwardAmountDesc(monthLabel(data.month))}
            </span>
          </span>
        </button>
        {/* View expenses */}
        <button
          className="flex items-center gap-2.5 px-3.5 py-2.5 w-full text-left hover:bg-[var(--bg-hover)] transition-colors border-t border-[var(--border-subtle)]"
          onClick={() => onViewExpenses(data)}
        >
          <span className="w-7 h-7 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-sm flex-shrink-0">📋</span>
          <span className="text-xs font-medium text-[var(--text-primary)]">{t.yearView.ctxViewExpenses}</span>
        </button>
      </div>
    );
  }

  // ── Mobile bottom sheet ────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[var(--bg-surface)] rounded-t-2xl pb-safe overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-9 h-1 bg-gray-300 rounded-full mx-auto mt-2.5 mb-3" />
        {/* Header */}
        <div className="px-5 pb-3 border-b border-[var(--border-subtle)]">
          <p className="font-semibold text-[var(--text-primary)]">{data.budgetName}</p>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {monthLabel(data.month)} {year}
          </p>
          <div className="flex justify-between items-end mt-2">
            <div>
              <p className="text-[10px] text-[var(--text-muted)]">{t.yearView.budgetedRow}</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                <AbbreviatedAmount value={data.amount} />
              </p>
            </div>
            {data.spentAmount > 0 && (
              <div className="text-right">
                <p className="text-[10px] text-[var(--text-muted)]">{t.yearView.executedRow}</p>
                <p className="text-sm text-violet-600 dark:text-violet-400 font-medium">
                  <AbbreviatedAmount value={data.spentAmount} />
                </p>
              </div>
            )}
          </div>
        </div>
        {/* Actions */}
        <div>
          <button
            className="flex items-center gap-4 px-5 py-4 w-full text-left hover:bg-[var(--bg-hover)] active:bg-[var(--bg-app)] transition-colors"
            onClick={() => onMarkExecuted(data)}
          >
            <span className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-lg flex-shrink-0">
              {data.isExecuted ? '↩' : '✅'}
            </span>
            <div>
              <span className="block text-sm font-medium text-[var(--text-primary)]">
                {data.isExecuted ? t.yearView.ctxMarkUnexecuted : t.yearView.ctxMarkExecuted}
              </span>
            </div>
          </button>
          {!data.isExecuted && (
            <button
              className="flex items-center gap-4 px-5 py-4 w-full text-left hover:bg-[var(--bg-hover)] active:bg-[var(--bg-app)] transition-colors border-t border-[var(--border-subtle)]"
              onClick={() => onRegisterFullPayment(data)}
            >
              <span className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-lg flex-shrink-0">💳</span>
              <div>
                <span className="block text-sm font-medium text-[var(--text-primary)]">{t.yearView.ctxRegisterFullPayment}</span>
                <span className="block text-xs text-[var(--text-muted)] mt-0.5">{t.yearView.ctxRegisterFullPaymentDesc}</span>
              </div>
            </button>
          )}
          <button
            className={cn(
              'flex items-center gap-4 px-5 py-4 w-full text-left transition-colors border-t border-[var(--border-subtle)]',
              data.isPast ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[var(--bg-hover)]',
            )}
            disabled={data.isPast}
            onClick={() => !data.isPast && onForwardRequest(data)}
          >
            <span className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-lg flex-shrink-0">→</span>
            <div>
              <span className="block text-sm font-medium text-[var(--text-primary)]">{t.yearView.ctxForwardAmount}</span>
              <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                {data.isPast ? t.yearView.ctxForwardPastNotAvailable
                  : t.yearView.ctxForwardAmountDesc(monthLabel(data.month))}
              </span>
            </div>
          </button>
          <button
            className="flex items-center gap-4 px-5 py-4 w-full text-left hover:bg-[var(--bg-hover)] active:bg-[var(--bg-app)] transition-colors border-t border-[var(--border-subtle)]"
            onClick={() => onViewExpenses(data)}
          >
            <span className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center text-lg flex-shrink-0">📋</span>
            <span className="block text-sm font-medium text-[var(--text-primary)]">{t.yearView.ctxViewExpenses}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
