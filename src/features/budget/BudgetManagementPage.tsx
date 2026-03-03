import { useQuery } from '@powersync/react';
import { Plus, CreditCard, Banknote } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/shared/ui/button';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { deleteBudget } from '@/infrastructure/powersync/mutationWrappers';
import { useI18n } from '@/shared/i18n/I18nContext';
import { BudgetFormDialog } from './BudgetFormDialog';
import { BudgetList } from './BudgetList';
import type { BudgetRow, DebtOption } from './types';

export function BudgetManagementPage() {
  const { t } = useI18n();
  const { session } = useAuth();
  const householdId = session?.householdId ?? '';
  const userId = session?.userId ?? '';

  const { data: budgets = [] } = useQuery<BudgetRow>(
    `SELECT id, name, description, category_id, start_month, end_month, default_amount, paid_with_credit_card, household_id, debt_id
     FROM budgets WHERE deleted_at IS NULL ORDER BY paid_with_credit_card DESC, name ASC`,
  );

  const { data: debtOptions = [] } = useQuery<DebtOption>(
    `SELECT id, name FROM debts WHERE deleted_at IS NULL ORDER BY name ASC`,
  );

  const creditCard = budgets.filter(b => b.paid_with_credit_card === 1);
  const cash = budgets.filter(b => b.paid_with_credit_card === 0);

  async function handleDelete(id: string, name: string) {
    if (!confirm(t.budgets.confirmDelete(name))) return;
    await deleteBudget(id, userId);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <AppHeader
        emoji="📋"
        title={t.budgets.title}
        subtitle={t.budgets.subtitle}
        maxWidth="max-w-3xl"
        actions={
          <BudgetFormDialog
            mode="create"
            householdId={householdId}
            userId={userId}
            debts={debtOptions}
            onDone={() => {}}
            trigger={
              <Button size="sm" className="gap-1.5">
                <Plus size={14} /> {t.common.new}
              </Button>
            }
          />
        }
      />

      <main className="max-w-3xl mx-auto px-4 py-6">
        {budgets.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm font-medium">{t.budgets.noBudgets}</p>
            <p className="text-xs mt-1">{t.budgets.createFirst}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {creditCard.length > 0 && (
            <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] shadow-sm p-4">
              <h2 className="text-sm font-bold text-violet-700 mb-3 flex items-center gap-1.5">
                <CreditCard size={14} /> {t.budgets.creditCardGroup}
              </h2>
              <BudgetList
                items={creditCard}
                emptyLabel={t.budgets.noCardItems}
                householdId={householdId}
                userId={userId}
                debts={debtOptions}
                onDelete={handleDelete}
              />
            </div>
          )}

          {cash.length > 0 && (
            <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] shadow-sm p-4">
              <h2 className="text-sm font-bold text-green-700 mb-3 flex items-center gap-1.5">
                <Banknote size={14} /> {t.budgets.cashGroup}
              </h2>
              <BudgetList
                items={cash}
                emptyLabel={t.budgets.noCashItems}
                householdId={householdId}
                userId={userId}
                debts={debtOptions}
                onDelete={handleDelete}
              />
            </div>
          )}
        </div>
      </main>

      <AppNav />
    </div>
  );
}
