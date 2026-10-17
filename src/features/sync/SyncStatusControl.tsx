/**
 * SyncStatusControl — the sync UI's slots for the page header.
 *
 * Reads the app-wide sync state from SyncStatusProvider and hands two
 * ready-made slots to its render function: the status button with its
 * console, and the alert band. Two slots from one source: the header places
 * them in different rows.
 *
 * Renders nothing into the slots without a provider (previews, tests) or
 * without a session: before login and after logout the sync state says
 * "offline" by design, which is not news.
 */

import type { ReactNode } from 'react';
import { SyncAlert } from './SyncAlert';
import { SyncConsole } from './SyncConsole';
import { SyncStatusButton } from './SyncStatusButton';
import { isAlertFresh } from './syncPresentation';
import { useSyncStatusContext } from './syncStatusContext';

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

export function SyncStatusControl({ open, onOpenChange, maxWidth, children }: SyncStatusControlProps) {
  const sync = useSyncStatusContext();
  if (!sync?.signedIn) return children(NO_SLOTS);

  const { health, events, lastSyncedAt, downloadFraction } = sync.status;
  const signIn = async () => {
    onOpenChange(false);
    await sync.signIn();
  };

  return children({
    button: (
      <SyncStatusButton health={health} open={open} onOpenChange={onOpenChange}>
        <SyncConsole
          health={health}
          events={events}
          lastSyncedAt={lastSyncedAt}
          downloadFraction={downloadFraction}
          onRetry={sync.retry}
          onClearLog={sync.clearLog}
          onCopyDiagnostics={sync.copyDiagnostics}
          onSignIn={signIn}
        />
      </SyncStatusButton>
    ),
    alert: (
      <SyncAlert
        alert={health.alert}
        // A header mounting after the first moments shows a known alert quietly.
        announce={isAlertFresh(sync.alertSince, Date.now())}
        maxWidth={maxWidth}
        onViewDetails={() => onOpenChange(true)}
        onRetry={sync.retry}
        onSignIn={signIn}
      />
    ),
  });
}
