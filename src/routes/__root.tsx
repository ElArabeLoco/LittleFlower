import { createRootRoute, Outlet } from '@tanstack/react-router';
import { PowerSyncContext, useStatus } from '@powersync/react';
import { db } from '@/infrastructure/powersync/client';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { AppSettingsProvider } from '@/features/settings/AppSettingsContext';
import { AlertTriangle } from 'lucide-react';

// ---------------------------------------------------------------------------
// SyncErrorBanner — sticky warning shown when PowerSync uploadError is active
//
// Only renders when the user has an active session (avoids showing on
// login / landing pages). Alerts the user that writes are failing so they
// can decide whether it's safe to keep entering data.
// ---------------------------------------------------------------------------

function SyncErrorBanner() {
  const { session } = useAuth();
  const status = useStatus();
  const uploadError = status.dataFlowStatus?.uploadError ?? null;

  // Only show when authenticated and there's an active upload error
  if (!session || !uploadError) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex items-start gap-2 bg-red-600 text-white px-4 py-2.5 text-xs font-medium shadow-md"
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
// RootInner — waits for auth hydration, then renders routes + sync banner
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
