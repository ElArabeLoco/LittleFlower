import { createFileRoute, redirect } from '@tanstack/react-router';

// The Gastos tab opens the month view directly; /budget stays for saved links.
export const Route = createFileRoute('/budget')({
  beforeLoad: () => {
    throw redirect({ to: '/month', replace: true });
  },
});
