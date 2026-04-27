import { lazy, Suspense } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentSession } from '@/infrastructure/auth/SupabaseAuthAdapter';
import { FeatureErrorBoundary } from '@/shared/ui/FeatureErrorBoundary';

interface OnboardingSearch {
  code?: string;
}

const LazyOnboardingPage = lazy(() =>
  import('@/features/auth/OnboardingPage').then(m => ({ default: m.OnboardingPage })),
);

function OnboardingRoute() {
  return (
    <FeatureErrorBoundary feature="Onboarding">
      <Suspense fallback={<div className="flex items-center justify-center p-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" /></div>}>
        <LazyOnboardingPage />
      </Suspense>
    </FeatureErrorBoundary>
  );
}

export const Route = createFileRoute('/onboarding')({
  validateSearch: (search: Record<string, unknown>): OnboardingSearch => ({
    code: typeof search.code === 'string' ? search.code : undefined,
  }),
  beforeLoad: async () => {
    const session = await getCurrentSession();
    // Not logged in → go to login
    if (!session) throw redirect({ to: '/login' });
    // Already has household → go to app
    if (session.householdId) throw redirect({ to: '/' });
  },
  component: OnboardingRoute,
});
