import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginPage } from '@/features/auth/LoginPage';
import { getCurrentSession } from '@/infrastructure/auth/SupabaseAuthAdapter';

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (session) throw redirect({ to: '/' });
  },
  component: LoginPage,
});
