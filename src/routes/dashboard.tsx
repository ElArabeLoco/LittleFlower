import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentSession } from '@/infrastructure/auth/SupabaseAuthAdapter';
import { DashboardPage } from '@/features/dashboard/DashboardPage';

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (!session) throw redirect({ to: '/login' });
    if (!session.householdId) throw redirect({ to: '/onboarding' });
  },
  component: DashboardPage,
});
