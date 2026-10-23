import { useState } from 'react';
import { Pencil, Trash2, Check } from 'lucide-react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/ui/cn';
import { useIncomeMutations } from '@/application/useIncomeMutations';
import type { MemberRef } from '@/domain/member/HouseholdMember';
import { HolderChips } from '@/features/members/components/HolderChips';
import { SalaryBreakdownDialog } from './SalaryBreakdownDialog';
import type { IncomeRow, IncomeMonthRow } from './types';

interface IncomeCardProps {
  income: IncomeRow;
  incomeMonth: IncomeMonthRow | null;
  month: string;
  householdId: string;
  userId: string;
  trm: number | null;
  /** Active holders of this income (empty = the whole household). */
  holders: MemberRef[];
  /** Whether the household has any active member. */
  hasMembers: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function IncomeCard({ income, incomeMonth, month, householdId, userId, trm, holders, hasMembers, onEdit, onDelete }: IncomeCardProps) {
  const { t } = useI18n();
  const { formatCOP, formatNumber } = useNumberFormat();
  const { upsertIncomeMonth } = useIncomeMutations(householdId, userId);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);

  const isSalary = income.category === 'Salario';
  const isUSD = income.currency !== 'COP';
  const rawAmount = incomeMonth?.real_amount ?? income.default_amount;
  const copAmount = isUSD ? (trm ? Math.round(rawAmount * trm) : null) : rawAmount;
  const isModified = incomeMonth !== null;

  function handleAmountClick() {
    if (isSalary) setSalaryDialogOpen(true);
    else { setValue(String(rawAmount)); setEditing(true); }
  }

  async function handleSave() {
    const parsed = parseInt(value.replace(/\D/g, ''), 10);
    if (isNaN(parsed)) { setEditing(false); return; }
    setSaving(true);
    try {
      await upsertIncomeMonth({
        id: incomeMonth?.id,
        income_id: income.id,
        month,
        real_amount: parsed,
        currency: income.currency,
      });
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  return (
    <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] shadow-sm p-4 group">
      {isSalary && (
        <SalaryBreakdownDialog
          open={salaryDialogOpen}
          onClose={() => setSalaryDialogOpen(false)}
          income={income}
          incomeMonth={incomeMonth}
          month={month}
          householdId={householdId}
          userId={userId}
          trm={trm}
        />
      )}

      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{income.name}</p>
            <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium shrink-0',
              income.is_fixed === 1 ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600')}>
              {income.is_fixed === 1 ? t.income.fixed : t.income.variable}
            </span>
          </div>
          <p className="text-xs text-gray-400">{t.income.categories[income.category] ?? income.category} · {t.common.from} {income.start_month}</p>
          <HolderChips holders={holders} hasMembers={hasMembers} subject="income" className="mt-2" />
        </div>

        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 rounded text-gray-300 hover:text-pink-500 hover:bg-pink-50">
            <Pencil size={13} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-pink-50">
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 shrink-0">{income.currency}</span>
            <Input className="h-8 text-sm w-36 text-right" inputMode="numeric" value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
              autoFocus />
            <button onClick={handleSave} disabled={saving}
              className="p-1.5 rounded-lg bg-pink-500 text-white hover:bg-pink-600 disabled:opacity-50">
              <Check size={14} />
            </button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
          </div>
        ) : (
          <div className="flex items-end justify-between cursor-pointer" onClick={handleAmountClick}
            title={isSalary ? t.income.clickSalaryBreakdown : t.income.clickEditAmount}>
            <div>
              <div className="flex items-baseline gap-1.5">
                {isUSD && <span className="text-xs font-medium text-violet-400">USD</span>}
                <span className="text-lg font-bold text-gray-800 tabular-nums">{formatNumber(rawAmount)}</span>
                {isModified && <span className="text-[10px] text-violet-400 font-medium">{t.income.edited}</span>}
              </div>

              {isSalary && isModified && incomeMonth && (incomeMonth.base_salary > 0 || incomeMonth.deductions > 0 || incomeMonth.extra_days > 0) && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Base {formatCOP(incomeMonth.base_salary)}
                  {incomeMonth.deductions > 0 && ` − ${formatCOP(incomeMonth.deductions)}`}
                  {incomeMonth.extra_days > 0 && ` + ${incomeMonth.extra_days}d extra`}
                </p>
              )}

              {isUSD && (
                copAmount !== null
                  ? <p className="text-xs text-[var(--text-secondary)] mt-0.5">≈ <span className="font-semibold text-gray-700">{formatCOP(copAmount)}</span></p>
                  : <p className="text-xs text-amber-500 mt-0.5">{t.income.noTrmCannotConvert}</p>
              )}
            </div>
            {!isSalary && <Pencil size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity mb-0.5" />}
          </div>
        )}
      </div>
    </div>
  );
}
