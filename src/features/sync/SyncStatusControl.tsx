/**
 * SyncStatusControl — the one container of the sync UI.
 *
 * Reads the sync model once (useSyncStatus / useSyncActions) and hands two
 * ready-made slots to its render function: the status button with its
 * console, and the alert band. Two slots, one instance: the header places
 * them in different rows without subscribing to sync twice.
 *
 * Renders nothing into the slots without a session: before login and after
 * logout the sync state says "offline" by design, which is not news.
 */

import { useCallback, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useSyncActions, useSyncStatus } from '@/application/useSyncStatus';
import { useAuth } from '@/features/auth/AuthContext';
import { SyncAlert } from './SyncAlert';
import { SyncConsole } from './SyncConsole';
import { SyncStatusButton } from './SyncStatusButton';

export interface SyncStatusSlots {
  button: ReactNode;
  alert: ReactNode;
}

interface SyncStatusControlProps {
  /** Whether the console is open; owned by the caller so other UI can open it. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Max-width class of the header content, so the alert lines up with it. */
  maxWidth?: string;
  children: (slots: SyncStatusSlots) => ReactNode;
}

const NO_SLOTS: SyncStatusSlots = { button: null, alert: null };

export function SyncStatusControl({ children, ...props }: SyncStatusControlProps) {
  const { session } = useAuth();
  if (!session) return children(NO_SLOTS);
  return <ConnectedSyncStatus {...props}>{children}</ConnectedSyncStatus>;
}

function ConnectedSyncStatus({ open, onOpenChange, maxWidth, children }: SyncStatusControlProps) {
  const { health, events, lastSyncedAt, downloadFraction } = useSyncStatus();
  const { retry, clearLog, diagnosticsText } = useSyncActions();
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Household data (labels, notes, amounts): the clipboard only, never the network.
  const copyDiagnostics = useCallback(async () => {
    await navigator.clipboard.writeText(diagnosticsText());
  }, [diagnosticsText]);

  // Logging out keeps the local database and its upload queue; the queue
  // uploads once the person signs in again.
  const signIn = useCallback(async () => {
    onOpenChange(false);
    await logout();
    await navigate({ to: '/login' });
  }, [logout, navigate, onOpenChange]);

  const openConsole = useCallback(() => onOpenChange(true), [onOpenChange]);

  return children({
    button: (
      <SyncStatusButton health={health} open={open} onOpenChange={onOpenChange}>
        <SyncConsole
          health={health}
          events={events}
          lastSyncedAt={lastSyncedAt}
          downloadFraction={downloadFraction}
          onRetry={retry}
          onClearLog={clearLog}
          onCopyDiagnostics={copyDiagnostics}
          onSignIn={signIn}
        />
      </SyncStatusButton>
    ),
    alert: (
      <SyncAlert
        alert={health.alert}
        maxWidth={maxWidth}
        onViewDetails={openConsole}
        onRetry={retry}
        onSignIn={signIn}
      />
    ),
  });
}
