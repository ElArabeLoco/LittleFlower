import { Wallet, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { AbbreviatedAmount } from '@/shared/ui/AbbreviatedAmount';
import { cn } from '@/shared/ui/cn';

interface BalanceCardProps {
  available: number;
  totalBudgeted: number;
  totalSpent: number;
  totalRealSpent: number;
  month: string;
  hasMissingTrm: boolean;
  formatMonthLabel: (m: string) => string;
}

export function BalanceCard({ available, totalBudgeted, totalSpent, totalRealSpent, month, hasMissingTrm, formatMonthLabel }: BalanceCardProps) {
  const { t } = useI18n();
  const balance = available - totalBudgeted;
  const realBalance = available - totalRealSpent;
  const pending = Math.max(0, totalBudgeted - totalSpent);
  const positive = balance >= 0;

  return (
    <div className={cn(
      'rounded-2xl p-5 text-white shadow-lg',
      hasMissingTrm
        ? 'bg-gradient-to-br from-amber-500 to-amber-600'
        : positive
          ? 'bg-gradient-to-br from-pink-500 to-violet-600'
          : 'bg-gradient-to-br from-red-500 to-pink-700',
    )}>
      <p className="text-[11px] font-semibold opacity-70 mb-1 uppercase tracking-wider">
        {formatMonthLabel(month)}
      </p>

      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-xs opacity-70 mb-0.5">{t.monthView.balanceReal}</p>
          <p className="text-3xl font-bold tabular-nums leading-none tracking-tight">
            {balance > 0 ? '+' : ''}<AbbreviatedAmount value={balance} />
          </p>
          <p className="text-[10px] opacity-60 mt-0.5">{t.monthView.availableMinusBudgeted}</p>
        </div>
        <Wallet size={28} className="opacity-25 mb-1" />
      </div>

      <div className="flex items-center gap-3 py-2.5 mb-3 border-y border-white/20">
        <div>
          <p className="text-[10px] opacity-60 mb-0.5">{t.monthView.trueBalanceReal}</p>
          <p className={cn('text-lg font-bold tabular-nums leading-none', realBalance < 0 && 'text-red-200')}>
            {realBalance > 0 ? '+' : ''}<AbbreviatedAmount value={realBalance} />
          </p>
          <p className="text-[10px] opacity-50 mt-0.5">{t.monthView.availableMinusSpent}</p>
        </div>
      </div>

      {hasMissingTrm && (
        <div className="flex items-center gap-1.5 text-xs opacity-90 bg-black/15 rounded-lg px-3 py-1.5 mb-3">
          <AlertTriangle size={12} />
          {t.monthView.usdExcludedNoTrm}
        </div>
      )}

      <div className="grid grid-cols-4 gap-1 pt-3 border-t border-white/20 mt-1">
        <div className="text-center">
          <p className="text-[9px] opacity-55 mb-0.5 uppercase tracking-wide">{t.monthView.availableLabel}</p>
          <p className="text-xs font-bold tabular-nums"><AbbreviatedAmount value={available} /></p>
        </div>
        <div className="text-center border-x border-white/20">
          <p className="text-[9px] opacity-55 mb-0.5 uppercase tracking-wide">{t.monthView.budgetedLabel}</p>
          <p className="text-xs font-bold tabular-nums"><AbbreviatedAmount value={totalBudgeted} /></p>
        </div>
        <div className="text-center border-r border-white/20">
          <p className="text-[9px] opacity-55 mb-0.5 uppercase tracking-wide">{t.monthView.executedLabel}</p>
          <p className="text-xs font-bold tabular-nums"><AbbreviatedAmount value={totalSpent} /></p>
        </div>
        <div className="text-center">
          <p className="text-[9px] opacity-55 mb-0.5 uppercase tracking-wide">{t.monthView.toExecuteLabel}</p>
          <p className="text-xs font-bold tabular-nums"><AbbreviatedAmount value={pending} /></p>
        </div>
      </div>
    </div>
  );
}