import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentSession } from '@/infrastructure/auth/SupabaseAuthAdapter';
import { JoinPage } from '@/features/auth/JoinPage';

interface JoinSearch {
  code?: string;
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
  component: JoinPage,
});
