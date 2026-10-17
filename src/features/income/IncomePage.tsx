import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';
import { useIncomeMutations } from '@/application/useIncomeMutations';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { getCurrentMonth, prevMonth, nextMonth } from './helpers';
import { useIncomeData } from './useIncomeData';
import { IncomeFormDialog } from './IncomeFormDialog';
import { TrmSection } from './TrmSection';
import { IncomeCard } from './IncomeCard';
import type { IncomeRow } from './types';

export function IncomePage() {
  const { t } = useI18n();
  const { formatCOP } = useNumberFormat();
  const { session } = useAuth();
  const [month, setMonth] = useState(getCurrentMonth());
  const [editingIncome, setEditingIncome] = useState<IncomeRow | null>(null);

  const householdId = session?.householdId ?? '';
  const userId = session?.userId ?? '';

  const { incomes, imMap, exchangeRate, trm, hasUSDIncome, totalCOP, missingTrm } = useIncomeData(month);
  const { deleteIncome } = useIncomeMutations(householdId, userId);

  const fmtMonth = (m: string) => {
    const [y, mo] = m.split('-');
    return `${t.months.full[mo] ?? mo} ${y}`;
  };

  async function handleDeleteIncome(id: string, name: string) {
    if (!confirm(t.income.confirmDelete(name))) return;
    await deleteIncome(id);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <AppHeader
        title={t.income.title}
        subtitle={fmtMonth(month)}
        maxWidth="max-w-3xl"
        actions={
          <IncomeFormDialog
            mode="create"
            householdId={householdId}
            userId={userId}
            onDone={() => {}}
            trigger={
              <Button size="sm" className="gap-1.5">
                <Plus size={14} /> {t.common.new}
              </Button>
            }
          />
        }
      />

      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
        <Button variant="outline" size="icon" onClick={() => setMonth(prevMonth(month))}>
          <ChevronLeft size={16} />
        </Button>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{fmtMonth(month)}</h2>
        <Button variant="outline" size="icon" onClick={() => setMonth(nextMonth(month))}>
          <ChevronRight size={16} />
        </Button>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {hasUSDIncome && (
          <TrmSection
            month={month}
            householdId={householdId}
            userId={userId}
            exchangeRate={exchangeRate}
          />
        )}

        {incomes.length > 0 && (
          <div className={cn(
            'rounded-xl p-4 flex items-center justify-between shadow-sm',
            missingTrm ? 'bg-amber-500 text-white' : 'bg-pink-600 text-white',
          )}>
            <div>
              <p className="text-xs font-medium opacity-80">{t.income.availableForMonth(fmtMonth(month))}</p>
              {missingTrm && (
                <p className="text-xs opacity-70 mt-0.5">⚠ {t.income.usdExcludedNoTrm}</p>
              )}
            </div>
            <span className="text-xl font-bold tabular-nums">{formatCOP(totalCOP)}</span>
          </div>
        )}

        {incomes.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">💰</p>
            <p className="text-sm font-medium">{t.income.noIncomeSources}</p>
            <p className="text-xs mt-1">{t.income.addFirstHint}</p>
          </div>
        )}

        {incomes.map(income => (
          <IncomeCard
            key={income.id}
            income={income}
            incomeMonth={imMap.get(income.id) ?? null}
            month={month}
            householdId={householdId}
            userId={userId}
            trm={trm}
            onEdit={() => setEditingIncome(income)}
            onDelete={() => handleDeleteIncome(income.id, income.name)}
          />
        ))}
      </main>

      {editingIncome && (
        <IncomeFormDialog
          key={editingIncome.id}
          mode="edit"
          incomeId={editingIncome.id}
          householdId={householdId}
          userId={userId}
          defaultOpen
          initial={{
            name: editingIncome.name,
            category: editingIncome.category,
            default_amount: String(editingIncome.default_amount),
            currency: editingIncome.currency,
            is_fixed: editingIncome.is_fixed === 1,
            start_month: editingIncome.start_month,
            end_month: editingIncome.end_month ?? '',
          }}
          onDone={() => setEditingIncome(null)}
          trigger={<span />}
        />
      )}

      <AppNav />
    </div>
  );
}
