import { createRootRoute, Outlet } from '@tanstack/react-router';
import { PowerSyncContext, useStatus, useQuery } from '@powersync/react';
import { db } from '@/infrastructure/powersync/client';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { AppSettingsProvider } from '@/features/settings/AppSettingsContext';
import { SupabaseConnector } from '@/infrastructure/powersync/SupabaseConnector';
import { AlertCircle, AlertTriangle, CloudOff, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { cn } from '@/shared/ui/cn';

// ---------------------------------------------------------------------------
// SyncPill — singleton at root level so it never remounts on navigation.
//
// States (priority order):
//   1. !connected            → "Sin conexión"  (grey)
//   2. uploadError           → "Error sync"     (red)
//   3. uploading             → "Subiendo..."    (blue, animated)
//   4. queue > 0 + connected → "N pendientes"  (amber)
//   5. connected + queue = 0 → "Sync"           (green)
// ---------------------------------------------------------------------------

interface CrudCountRow { count: number }

function SyncPill() {
  const { session } = useAuth();
  const status = useStatus();
  const connected = status.connected;
  const uploading = status.dataFlowStatus?.uploading ?? false;
  const uploadError = status.dataFlowStatus?.uploadError ?? null;

  const { data: crudRows = [] } = useQuery<CrudCountRow>(
    'SELECT COUNT(*) as count FROM ps_crud',
    [],
  );
  const pendingCount = crudRows[0]?.count ?? 0;

  // Auto-reconnect when PowerSync drops the connection.
  // Uses exponential backoff: 3s → 6s → 12s → … capped at 60s.
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(3000);

  useEffect(() => {
    if (connected) {
      // Connection restored — reset backoff
      reconnectDelay.current = 3000;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      return;
    }

    // Not connected — only attempt reconnect when the user has a session
    if (!session) return;

    reconnectTimer.current = setTimeout(async () => {
      try {
        await db.connect(new SupabaseConnector());
      } catch {
        // will retry on next disconnect cycle
      }
      reconnectDelay.current = Math.min(reconnectDelay.current * 2, 60_000);
    }, reconnectDelay.current);

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connected, session]);

  // Don't render on public pages (no session)
  if (!session) return null;

  let label: string;
  let icon: React.ReactNode;
  let colorClass: string;

  if (!connected) {
    label = 'Sin conexión';
    icon = <WifiOff size={9} strokeWidth={2.5} />;
    colorClass = 'bg-[var(--bg-surface-2)] text-[var(--text-muted)] border-[var(--border-medium)]';
  } else if (uploadError) {
    label = 'Error sync';
    icon = <AlertCircle size={9} strokeWidth={2.5} />;
    colorClass = 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800';
  } else if (uploading) {
    label = pendingCount > 0 ? `Subiendo (${pendingCount})` : 'Subiendo...';
    icon = <Loader2 size={9} strokeWidth={2.5} className="animate-spin" />;
    colorClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800';
  } else if (pendingCount > 0) {
    label = `${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}`;
    icon = <CloudOff size={9} strokeWidth={2.5} />;
    colorClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800';
  } else {
    label = 'Sync';
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
        <strong>Error de sincronización:</strong> los cambios recientes no se están guardando en el
        servidor. Evita ingresar datos nuevos hasta que esto se resuelva. Si el problema persiste,
        recarga la página o verifica tu conexión.
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RootInner
// ---------------------------------------------------------------------------

function RootInner() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50">
        <div className="text-center">
          <div className="text-4xl mb-3">🌸</div>
          <p className="text-gray-500 text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SyncErrorBanner />
      {/* SyncPill rendered here as a singleton — survives page navigation */}
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
    <AppSettingsProvider>
      <PowerSyncContext.Provider value={db}>
        <AuthProvider>
          <RootInner />
        </AuthProvider>
      </PowerSyncContext.Provider>
    </AppSettingsProvider>
  ),
});
