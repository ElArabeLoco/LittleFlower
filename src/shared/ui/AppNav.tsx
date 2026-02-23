/**
 * AppNav — bottom navigation bar shared across all main pages.
 *
 * Mobile-first. Fixed to the bottom of the viewport.
 * Highlights the active route automatically via useRouterState.
 *
 * Items:
 *   Vista Anual   → /
 *   Vista Mensual → /month
 *   Presupuestos  → /settings/budgets
 *   Ingresos      → /income
 *   Perfil        → /settings  (avatar con inicial del usuario)
 *
 * SyncIndicator lives in the top-bar of each page, NOT here.
 */

import { useNavigate, useRouterState } from '@tanstack/react-router';
import { LayoutDashboard, CalendarRange, CalendarDays, TrendingUp } from 'lucide-react';
import { cn } from './cn';
import { useAuth } from '@/features/auth/AuthContext';

// ---------------------------------------------------------------------------
// User avatar — shows initials from email, styled with brand colors
// ---------------------------------------------------------------------------

function UserAvatar({ email, size = 20 }: { email: string; size?: number }) {
  const initial = email ? email[0].toUpperCase() : '?';
  return (
    <span
      className="flex items-center justify-center rounded-full bg-[var(--color-primary)] text-white font-semibold leading-none select-none"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {initial}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Nav item definitions (all except profile — profile is special)
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  icon: React.ReactNode;
  to: string;
  /** Match these paths as "active" (exact or prefix) */
  match: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    icon: <LayoutDashboard size={20} />,
    to: '/dashboard',
    match: ['/dashboard'],
  },
  {
    label: 'Anual',
    icon: <CalendarRange size={20} />,
    to: '/anual',
    match: ['/anual'],
  },
  {
    label: 'Mensual',
    icon: <CalendarDays size={20} />,
    to: '/month',
    match: ['/month'],
  },
  {
    label: 'Ingresos',
    icon: <TrendingUp size={20} />,
    to: '/income',
    match: ['/income'],
  },
];

// ---------------------------------------------------------------------------
// AppNav
// ---------------------------------------------------------------------------

export function AppNav() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const { session } = useAuth();

  const email = session?.email ?? '';

  // Profile tab is active on /settings but NOT on /settings/budgets
  const isProfileActive = pathname === '/settings' || pathname === '/settings/';

  return (
    <>
      {/* Spacer so page content isn't hidden behind the fixed bar */}
      <div className="h-16" aria-hidden="true" />

      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[var(--nav-bg)] border-t border-[var(--nav-border)] shadow-[0_-1px_8px_rgba(0,0,0,0.12)] transition-colors">
        <ul className="flex h-16 items-stretch">
          {NAV_ITEMS.map(item => {
            // Active: prefix match for all items
            const isActive = item.match.some(m => pathname === m || pathname.startsWith(m + '/'));

            return (
              <li key={item.to} className="flex-1">
                <button
                  onClick={() => navigate({ to: item.to })}
                  className={cn(
                    'flex h-full w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                    isActive
                      ? 'text-[var(--nav-active)]'
                      : 'text-[var(--nav-inactive)] hover:text-[var(--text-secondary)]',
                  )}
                >
                  <span
                    className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-xl transition-colors',
                      isActive && 'bg-[var(--nav-active-bg)]',
                    )}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}

          {/* Profile tab — avatar instead of generic icon */}
          <li className="flex-1">
            <button
              onClick={() => navigate({ to: '/settings' })}
              className={cn(
                'flex h-full w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                isProfileActive
                  ? 'text-[var(--nav-active)]'
                  : 'text-[var(--nav-inactive)] hover:text-[var(--text-secondary)]',
              )}
            >
              <span
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-xl transition-colors',
                  isProfileActive && 'bg-[var(--nav-active-bg)]',
                )}
              >
                {/* Ring when active */}
                <span className={cn(
                  'rounded-full transition-all',
                  isProfileActive
                    ? 'ring-2 ring-[var(--nav-active)] ring-offset-1 ring-offset-[var(--nav-bg)]'
                    : '',
                )}>
                  <UserAvatar email={email} size={22} />
                </span>
              </span>
              <span>Perfil</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
