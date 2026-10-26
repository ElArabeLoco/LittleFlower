import { useState } from 'react';
import { Plus, CreditCard, Banknote, ChevronRight, ChevronDown } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/shared/ui/button';
import { AppNav } from '@/shared/ui/AppNav';
import { AppHeader } from '@/shared/ui/AppHeader';
import { useBudgetMutations, BudgetExpenseRangeError } from '@/application/useBudgetMutations';
import { useI18n } from '@/shared/i18n/I18nContext';
import { useBudgetManagementData } from '@/application/useBudgetManagementData';
import { useDebtOptionsQuery } from '@/infrastructure/powersync/queries/useDebtQueries';
import { BudgetFormDialog } from './BudgetFormDialog';
import { BudgetList } from './BudgetList';

export function BudgetManagementPage() {
  const { t } = useI18n();
  const { session } = useAuth();
  const householdId = session?.householdId ?? '';
  const userId = session?.userId ?? '';

  const { creditCard, cash, finished, expenseSpans, hasBudgets } = useBudgetManagementData();
  const [showFinished, setShowFinished] = useState(false);
  const { data: debtOptions = [] } = useDebtOptionsQuery();
  const { deleteBudget } = useBudgetMutations(householdId, userId);

  async function handleDelete(id: string, name: string) {
    if (!confirm(t.budgets.confirmDelete(name))) return;
    try {
      await deleteBudget(id);
    } catch (err) {
      if (err instanceof BudgetExpenseRangeError) alert(t.budgets.deleteHasExpenses);
      else throw err;
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <AppHeader
        title={t.budgets.title}
        subtitle={t.budgets.subtitle}
        maxWidth="max-w-5xl"
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

      <main className="max-w-5xl mx-auto px-4 py-6">
        {!hasBudgets && (
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
                expenseSpans={expenseSpans}
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
                expenseSpans={expenseSpans}
              />
            </div>
          )}
        </div>

        {finished.length > 0 && (
          <section className="mt-5">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              aria-expanded={showFinished}
              aria-controls="finished-budgets"
              onClick={() => setShowFinished(v => !v)}
            >
              {showFinished ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {t.budgets.finishedSection(finished.length)}
            </button>
            {showFinished && (
              <div id="finished-budgets" className="mt-2 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] shadow-sm p-4">
                <BudgetList
                  items={finished}
                  emptyLabel=""
                  householdId={householdId}
                  userId={userId}
                  debts={debtOptions}
                  onDelete={handleDelete}
                  expenseSpans={expenseSpans}
                  finished
                />
              </div>
            )}
          </section>
        )}
      </main>

      <AppNav />
    </div>
  );
}
