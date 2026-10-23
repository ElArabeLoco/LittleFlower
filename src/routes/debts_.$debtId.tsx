import { lazy, Suspense } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentSession } from '@/infrastructure/auth/SupabaseAuthAdapter';
import { FeatureErrorBoundary } from '@/shared/ui/FeatureErrorBoundary';

const LazyDebtProjectionPage = lazy(() =>
  import('@/features/debts/DebtProjectionPage').then(m => ({ default: m.DebtProjectionPage })),
);

function DebtProjectionRoute() {
  const { debtId } = Route.useParams();
  return (
    <FeatureErrorBoundary feature="Proyección de deuda">
      <Suspense fallback={<div className="flex items-center justify-center p-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" /></div>}>
        <LazyDebtProjectionPage debtId={debtId} />
      </Suspense>
    </FeatureErrorBoundary>
  );
}

export const Route = createFileRoute('/debts_/$debtId')({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (!session) throw redirect({ to: '/login' });
    if (!session.householdId) throw redirect({ to: '/onboarding' });
  },
  component: DebtProjectionRoute,
});
