import { lazy, Suspense } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentSession } from '@/infrastructure/auth/SupabaseAuthAdapter';
import { FeatureErrorBoundary } from '@/shared/ui/FeatureErrorBoundary';

const LazyNetWorthPage = lazy(() =>
  import('@/features/netWorth/NetWorthPage').then(m => ({ default: m.NetWorthPage })),
);

function NetWorthRoute() {
  return (
    <FeatureErrorBoundary feature="Patrimonio">
      <Suspense fallback={<div className="flex items-center justify-center p-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" /></div>}>
        <LazyNetWorthPage />
      </Suspense>
    </FeatureErrorBoundary>
  );
}

export const Route = createFileRoute('/net-worth')({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (!session) throw redirect({ to: '/login' });
    if (!session.householdId) throw redirect({ to: '/onboarding' });
  },
  component: NetWorthRoute,
});
