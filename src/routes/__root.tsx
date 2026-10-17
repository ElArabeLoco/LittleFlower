import { createRootRoute, Outlet } from '@tanstack/react-router';
import { PowerSyncContext } from '@powersync/react';
import { db } from '@/infrastructure/powersync/client';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { AppSettingsProvider } from '@/features/settings/AppSettingsContext';
import { I18nProvider, useI18n } from '@/shared/i18n/I18nContext';
import { useSyncActivityTracking } from '@/application/useSyncStatus';
import { SyncStatusProvider } from '@/features/sync/SyncStatusProvider';
import { Logo } from '@/shared/ui/Logo';

// ---------------------------------------------------------------------------
// RootInner
// ---------------------------------------------------------------------------

function RootInner() {
  const { isLoading, session } = useAuth();
  const { t } = useI18n();
  // Sync activity belongs to the signed-in person: it starts with a session
  // and starts over clean on sign-out or a user change.
  useSyncActivityTracking(session?.userId ?? null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
        <div className="text-center">
          <Logo size={48} className="mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)]">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  // One sync state for the whole app, kept across navigation; each page's
  // AppHeader shows it (features/sync).
  return (
    <SyncStatusProvider>
      <Outlet />
    </SyncStatusProvider>
  );
}

export const Route = createRootRoute({
  component: () => (
    <I18nProvider>
      <AppSettingsProvider>
        <PowerSyncContext.Provider value={db}>
          <AuthProvider>
            <RootInner />
          </AuthProvider>
        </PowerSyncContext.Provider>
      </AppSettingsProvider>
    </I18nProvider>
  ),
});
