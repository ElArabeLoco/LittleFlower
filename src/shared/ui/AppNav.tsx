/**
 * AppNav — bottom navigation bar shared across all main pages.
 *
 * Mobile-first. Fixed to the bottom of the viewport. 4 tabs + profile avatar;
 * which paths each tab owns lives in navTabs.ts.
 *
 * The active tab is marked by a ribbon hanging from the bar's top edge.
 */

import { Link, useRouterState } from '@tanstack/react-router';
import { House, ChartColumn, Receipt, Wallet, type LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { useAuth } from '@/features/auth/useAuth';
import { useI18n } from '@/shared/i18n/useI18n';
import { activeNavTab, NAV_TABS, type NavPath, type NavTabKey } from './navTabs';

// ---------------------------------------------------------------------------
// User avatar
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
// Tab icons (profile shows the user's avatar instead)
// ---------------------------------------------------------------------------

const TAB_ICONS: Record<Exclude<NavTabKey, 'profile'>, LucideIcon> = {
  home: House,
  dashboard: ChartColumn,
  spending: Receipt,
  finances: Wallet,
};

// ---------------------------------------------------------------------------
// Tab link
// ---------------------------------------------------------------------------

function NavTab({ to, isActive, label, children }: {
  to: NavPath;
  isActive: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      // Our `match` lists decide the active tab. Exact matching keeps the router's own
      // aria-current (fuzzy by default) from flagging /settings on /settings/budgets.
      activeOptions={{ exact: true, includeSearch: false }}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] transition-colors',
        // Inset, rounded focus outline so it stays inside the bar instead of crossing its edges.
        'rounded-xl focus-visible:-outline-offset-4',
        isActive
          ? 'font-semibold text-[var(--nav-active)]'
          : 'font-medium text-[var(--nav-inactive)] hover:text-[var(--text-secondary)]',
      )}
    >
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-0 h-[3px] w-6 -translate-x-1/2 rounded-b-full bg-[var(--nav-active)]"
        />
      )}
      {children}
      <span>{label}</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// AppNav
// ---------------------------------------------------------------------------

export function AppNav() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const { session } = useAuth();
  const { t } = useI18n();

  const email = session?.email ?? '';
  const activeTab = activeNavTab(pathname);
  const isProfileActive = activeTab === 'profile';

  return (
    <>
      {/* Spacer so page content isn't hidden behind the fixed bar */}
      <div className="h-[calc(4rem+env(safe-area-inset-bottom))]" aria-hidden="true" />

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--nav-border)] bg-[var(--nav-bg)] pb-[env(safe-area-inset-bottom)] transition-colors">
        <ul className="mx-auto flex h-16 max-w-lg items-stretch">
          {NAV_TABS.map(tab => {
            if (tab.key === 'profile') return null;
            const isActive = activeTab === tab.key;
            const Icon = TAB_ICONS[tab.key];

            return (
              <li key={tab.to} className="flex-1">
                <NavTab to={tab.to} isActive={isActive} label={t.nav[tab.key]}>
                  <Icon size={22} strokeWidth={isActive ? 2.25 : 1.75} aria-hidden="true" />
                </NavTab>
              </li>
            );
          })}

          {/* Profile tab — avatar instead of generic icon */}
          <li className="flex-1">
            <NavTab to="/settings" isActive={isProfileActive} label={t.nav.profile}>
              <span
                aria-hidden="true"
                className={cn(
                  'rounded-full transition-shadow',
                  isProfileActive && 'ring-2 ring-[var(--nav-active)] ring-offset-2 ring-offset-[var(--nav-bg)]',
                )}
              >
                <UserAvatar email={email} size={22} />
              </span>
            </NavTab>
          </li>
        </ul>
      </nav>
    </>
  );
}
