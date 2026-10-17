import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { I18nProvider } from '@/shared/i18n/I18nContext';
import type { SyncHealth } from '@/application/useSyncStatus';
import { SyncConsole } from './SyncConsole';
import { SyncStatusButton } from './SyncStatusButton';

const health: SyncHealth = { state: 'synced', pendingCount: 0, error: null, alert: null, nextCheckAt: null };
const resolved = () => Promise.resolve();

describe('SyncConsole', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps no clock running while the console is closed', () => {
    vi.useFakeTimers();

    render(
      <I18nProvider>
        <SyncStatusButton health={health} open={false} onOpenChange={() => {}}>
          <SyncConsole
            health={health}
            events={[]}
            lastSyncedAt={null}
            downloadFraction={null}
            onRetry={resolved}
            onClearLog={() => {}}
            onCopyDiagnostics={resolved}
            onSignIn={() => {}}
          />
        </SyncStatusButton>
      </I18nProvider>,
    );

    expect(vi.getTimerCount()).toBe(0);
  });
});
