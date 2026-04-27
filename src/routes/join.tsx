import { lazy, Suspense } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentSession } from '@/infrastructure/auth/SupabaseAuthAdapter';
import { FeatureErrorBoundary } from '@/shared/ui/FeatureErrorBoundary';

interface JoinSearch {
  code?: string;
}

const LazyJoinPage = lazy(() =>
  import('@/features/auth/JoinPage').then(m => ({ default: m.JoinPage })),
);

function JoinRoute() {
  return (
    <FeatureErrorBoundary feature="Unirse">
      <Suspense fallback={<div className="flex items-center justify-center p-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" /></div>}>
        <LazyJoinPage />
      </Suspense>
    </FeatureErrorBoundary>
  );
}

export const Route = createFileRoute('/join')({
  validateSearch: (search: Record<string, unknown>): JoinSearch => ({
    code: typeof search.code === 'string' ? search.code : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const session = await getCurrentSession();
    // Not logged in → go to login preserving the join code
    if (!session) {
      throw redirect({
        to: '/login',
        search: { joinCode: search.code },
      });
    }
  },
  component: JoinRoute,
});
