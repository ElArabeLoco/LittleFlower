import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentSession } from '@/infrastructure/auth/SupabaseAuthAdapter';
import { DebtsPage } from '@/features/debts/DebtsPage';

export const Route = createFileRoute('/finances/debts')({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (!session) throw redirect({ to: '/login' });
    if (!session.householdId) throw redirect({ to: '/onboarding' });
  },
  component: DebtsPage,
});
