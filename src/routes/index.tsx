import { lazy, Suspense } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentSession } from '@/infrastructure/auth/SupabaseAuthAdapter';
import { FeatureErrorBoundary } from '@/shared/ui/FeatureErrorBoundary';

const LazyLandingPage = lazy(() =>
  import('@/features/landing/LandingPage').then(m => ({ default: m.LandingPage })),
);

function LandingRoute() {
  return (
    <FeatureErrorBoundary feature="Landing">
      <Suspense fallback={<div className="flex items-center justify-center p-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" /></div>}>
        <LazyLandingPage />
      </Suspense>
    </FeatureErrorBoundary>
  );
}

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    // Already authenticated → go straight to the app
    if (session?.householdId) throw redirect({ to: '/dashboard' });
    if (session) throw redirect({ to: '/onboarding' });
    // No session → show landing
  },
  component: LandingRoute,
});
