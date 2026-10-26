import { lazy, Suspense } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentSession } from '@/infrastructure/auth/SupabaseAuthAdapter';
import { FeatureErrorBoundary } from '@/shared/ui/FeatureErrorBoundary';

const LazyTransactionsPage = lazy(() =>
  import('@/features/transactions/TransactionsPage').then(m => ({ default: m.TransactionsPage })),
);

function TransactionsRoute() {
  return (
    <FeatureErrorBoundary feature="Lista de gastos">
      <Suspense fallback={<div className="flex items-center justify-center p-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" /></div>}>
        <LazyTransactionsPage />
      </Suspense>
    </FeatureErrorBoundary>
  );
}

export const Route = createFileRoute('/transactions')({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (!session) throw redirect({ to: '/login' });
    if (!session.householdId) throw redirect({ to: '/onboarding' });
  },
  component: TransactionsRoute,
});
