import { Plus } from 'lucide-react';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { Button } from '@/shared/ui/button';
import { useAuth } from '@/features/auth/AuthContext';
import { useNumberFormat } from '@/shared/hooks/useNumberFormat';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useDebtMutations } from '@/application/useDebtMutations';
import { useHoldersBySubject } from '@/application/useHolders';
import { useHouseholdMembers } from '@/application/useHouseholdMembers';
import { useDebtsData } from './useDebtsData';
import { DebtFormDialog } from './DebtFormDialog';
import { DebtCard } from './DebtCard';

export function DebtsPage() {
  const { session } = useAuth();
  const householdId = session?.householdId ?? '';
  const userId = session?.userId ?? '';
  const { formatCOP } = useNumberFormat();
  const { t } = useI18n();

  const { debts, txByDebt, currentMonthRate, totalBalance, activeDebts } = useDebtsData();
  const { softDeleteDebt } = useDebtMutations(householdId, userId);
  const holdersByDebt = useHoldersBySubject('debt');
  const { hasMembers } = useHouseholdMembers();

  async function handleDelete(id: string, name: string) {
    if (!confirm(t.debts.confirmDelete(name))) return;
    await softDeleteDebt(id);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <AppHeader
        title={t.debts.title}
        subtitle={t.debts.subtitle}
        maxWidth="max-w-5xl"
        actions={
          <DebtFormDialog
            mode="create"
            householdId={householdId}
            userId={userId}
            onDone={() => {}}
            trigger={
              <Button size="sm" className="gap-1.5">
                <Plus size={14} /> {t.debts.newDebt}
              </Button>
            }
          />
        }
      />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {debts.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4">
              <p className="text-xs text-[var(--text-muted)] mb-1">{t.debts.totalOwed}</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">{formatCOP(totalBalance)}</p>
            </div>
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-4">
              <p className="text-xs text-[var(--text-muted)] mb-1">{t.debts.activeDebts}</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">{activeDebts.length}</p>
              <p className="text-[10px] text-[var(--text-muted)]">{t.debts.ofTotal(debts.length)}</p>
            </div>
          </div>
        )}

        {debts.length === 0 && (
          <div className="text-center py-20 text-[var(--text-muted)]">
            <p className="text-5xl mb-4">💳</p>
            <p className="text-sm font-medium text-[var(--text-secondary)]">{t.debts.noDebts}</p>
            <p className="text-xs mt-1">{t.debts.noDebtsHint}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {debts.map(debt => (
            <DebtCard
              key={debt.id}
              debt={debt}
              transactions={txByDebt.get(debt.id) ?? []}
              householdId={householdId}
              userId={userId}
              currentMonthRate={currentMonthRate}
              holders={holdersByDebt.get(debt.id) ?? []}
              hasMembers={hasMembers}
              formatCOP={formatCOP}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </main>

      <AppNav />
    </div>
  );
}
