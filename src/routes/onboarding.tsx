import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentSession } from '@/infrastructure/auth/SupabaseAuthAdapter';
import { OnboardingPage } from '@/features/auth/OnboardingPage';

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    // Not logged in → go to login
    if (!session) throw redirect({ to: '/login' });
    // Already has household → go to app
    if (session.householdId) throw redirect({ to: '/' });
  },
  component: OnboardingPage,
});
