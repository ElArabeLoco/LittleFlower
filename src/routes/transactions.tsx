import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentSession } from '@/infrastructure/auth/SupabaseAuthAdapter';
import { TransactionsPage } from '@/features/transactions/TransactionsPage';

export const Route = createFileRoute('/transactions')({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (!session) throw redirect({ to: '/login' });
    if (!session.householdId) throw redirect({ to: '/onboarding' });
  },
  component: TransactionsPage,
});
