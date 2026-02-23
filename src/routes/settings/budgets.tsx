import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentSession } from '@/infrastructure/auth/SupabaseAuthAdapter';
import { BudgetManagementPage } from '@/features/budget/BudgetManagementPage';

export const Route = createFileRoute('/settings/budgets')({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (!session) throw redirect({ to: '/login' });
    if (!session.householdId) throw redirect({ to: '/onboarding' });
  },
  component: BudgetManagementPage,
});
