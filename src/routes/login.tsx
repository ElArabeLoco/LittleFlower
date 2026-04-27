import { lazy, Suspense } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentSession } from '@/infrastructure/auth/SupabaseAuthAdapter';
import { FeatureErrorBoundary } from '@/shared/ui/FeatureErrorBoundary';

interface LoginSearch {
  joinCode?: string;
}

const LazyLoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then(m => ({ default: m.LoginPage })),
);

function LoginRoute() {
  const { joinCode } = Route.useSearch();
  return (
    <FeatureErrorBoundary feature="Login">
      <Suspense fallback={<div className="flex items-center justify-center p-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" /></div>}>
        <LazyLoginPage joinCode={joinCode} />
      </Suspense>
    </FeatureErrorBoundary>
  );
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    joinCode: typeof search.joinCode === 'string' ? search.joinCode : undefined,
  }),
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (session) throw redirect({ to: '/' });
  },
  component: LoginRoute,
});
