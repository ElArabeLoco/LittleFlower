import { useI18n } from '@/shared/i18n/useI18n';
import type { ForwardConfirmState } from './yearViewTypes';

interface YearViewForwardConfirmDialogProps {
  forwardConfirm: ForwardConfirmState;
  isApplying: boolean;
  months: string[];
  monthLabel: (month: string) => string;
  onApply: () => Promise<void>;
  onClose: () => void;
}

export function YearViewForwardConfirmDialog({
  forwardConfirm, isApplying, months, monthLabel, onApply, onClose,
}: YearViewForwardConfirmDialogProps) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[var(--bg-surface)] rounded-2xl p-6 max-w-sm w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">
          {t.yearView.forwardDialogTitle}
        </h3>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-1">
          {t.yearView.forwardDialogMsg(
            `$${forwardConfirm.amount.toLocaleString('es-CO')}`,
            `${monthLabel(forwardConfirm.fromMonth)}–${monthLabel(forwardConfirm.toMonth)}`,
            months.filter(m => m >= forwardConfirm.fromMonth && m <= forwardConfirm.toMonth).length,
          )}
        </p>
        <p className="text-xs text-[var(--text-muted)] mb-5">{t.yearView.forwardDialogNote}</p>
        <div className="flex gap-3">
          <button
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[var(--bg-app)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
            onClick={onClose}
            disabled={isApplying}
          >
            {t.yearView.forwardCancel}
          </button>
          <button
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onApply}
            disabled={isApplying}
          >
            {isApplying ? '…' : t.yearView.forwardApply}
          </button>
        </div>
      </div>
    </div>
  );
}
