import { createRootRoute, Outlet } from '@tanstack/react-router';
import { PowerSyncContext, useStatus, useQuery } from '@powersync/react';
import { db } from '@/infrastructure/powersync/client';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { AppSettingsProvider } from '@/features/settings/AppSettingsContext';
import { I18nProvider, useI18n } from '@/shared/i18n/I18nContext';
import { AlertCircle, AlertTriangle, CloudOff, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/shared/ui/cn';
import { Logo } from '@/shared/ui/Logo';

// ---------------------------------------------------------------------------
// SyncPill — singleton at root, never remounts on navigation.
//
// Uses a debounced "disconnected" state: only shows "Sin conexión" after
// being disconnected for >2s, so transient connecting phases are invisible.
// ---------------------------------------------------------------------------

interface CrudCountRow { count: number }

function SyncPill() {
  const { session } = useAuth();
  const { t } = useI18n();
  const status = useStatus();
  const connected = status.connected;
  const uploading = status.dataFlowStatus?.uploading ?? false;
  const uploadError = status.dataFlowStatus?.uploadError ?? null;

  const { data: crudRows = [] } = useQuery<CrudCountRow>(
    'SELECT COUNT(*) as count FROM ps_crud',
    [],
  );
  const pendingCount = crudRows[0]?.count ?? 0;

  // Debounce disconnected state: only show offline after 2s.
  const [showDisconnected, setShowDisconnected] = useState(false);
  useEffect(() => {
    if (connected) {
      setShowDisconnected(false);
      return;
    }
    const timer = setTimeout(() => setShowDisconnected(true), 2000);
    return () => clearTimeout(timer);
  }, [connected]);

  // Don't render on public pages (no session)
  if (!session) return null;

  let label: string;
  let icon: React.ReactNode;
  let colorClass: string;

  if (showDisconnected) {
    label = t.sync.offline;
    icon = <WifiOff size={9} strokeWidth={2.5} />;
    colorClass = 'bg-[var(--bg-surface-2)] text-[var(--text-muted)] border-[var(--border-medium)]';
  } else if (uploadError) {
    label = t.sync.error;
    icon = <AlertCircle size={9} strokeWidth={2.5} />;
    colorClass = 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800';
  } else if (uploading) {
    label = t.sync.uploading(pendingCount);
    icon = <Loader2 size={9} strokeWidth={2.5} className="animate-spin" />;
    colorClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800';
  } else if (pendingCount > 0) {
    label = t.sync.pending(pendingCount);
    icon = <CloudOff size={9} strokeWidth={2.5} />;
    colorClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800';
  } else {
    label = t.sync.synced;
    icon = <Wifi size={9} strokeWidth={2.5} />;
    colorClass = 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors',
        colorClass,
      )}
    >
      {icon}
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// SyncErrorBanner — sticky warning when uploadError is active
// ---------------------------------------------------------------------------

function SyncErrorBanner() {
  const { session } = useAuth();
  const { t } = useI18n();
  const status = useStatus();
  const uploadError = status.dataFlowStatus?.uploadError ?? null;

  if (!session || !uploadError) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-50 flex items-start gap-2 bg-red-600 text-white px-4 py-2.5 text-xs font-medium shadow-md"
    >
      <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" strokeWidth={2.5} />
      <span>
        <strong>{t.sync.syncErrorTitle}</strong> {t.sync.syncErrorBody}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RootInner
// ---------------------------------------------------------------------------

function RootInner() {
  const { isLoading } = useAuth();
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50">
        <div className="text-center">
          <Logo size={48} className="mx-auto mb-3" />
          <p className="text-gray-500 text-sm">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SyncErrorBanner />
      {/* SyncPill as singleton — survives page navigation */}
      <div className="fixed top-2 right-3 z-40 pointer-events-none">
        <div className="pointer-events-auto">
          <SyncPill />
        </div>
      </div>
      <Outlet />
    </>
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
