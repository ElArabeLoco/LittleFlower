import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginPage } from '@/features/auth/LoginPage';
import { getCurrentSession } from '@/infrastructure/auth/SupabaseAuthAdapter';

interface LoginSearch {
  joinCode?: string;
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

function LoginRoute() {
  const { joinCode } = Route.useSearch();
  return <LoginPage joinCode={joinCode} />;
}
