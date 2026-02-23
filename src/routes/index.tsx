import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentSession } from '@/infrastructure/auth/SupabaseAuthAdapter';
import { LandingPage } from '@/features/landing/LandingPage';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    // Already authenticated → go straight to the app
    if (session?.householdId) throw redirect({ to: '/dashboard' });
    if (session) throw redirect({ to: '/onboarding' });
    // No session → show landing
  },
  component: LandingPage,
});
