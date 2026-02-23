import { createRootRoute, Outlet } from '@tanstack/react-router';
import { PowerSyncContext } from '@powersync/react';
import { db } from '@/infrastructure/powersync/client';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { AppSettingsProvider } from '@/features/settings/AppSettingsContext';

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

  return <Outlet />;
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
