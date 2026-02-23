import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentSession } from '@/infrastructure/auth/SupabaseAuthAdapter';
import { MonthViewPage } from '@/features/month/MonthViewPage';

export const Route = createFileRoute('/month')({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (!session) throw redirect({ to: '/login' });
    if (!session.householdId) throw redirect({ to: '/onboarding' });
  },
  component: MonthViewPage,
});
