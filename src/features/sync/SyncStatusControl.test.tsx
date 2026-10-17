import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/shared/i18n/I18nContext';
import type { SyncHealth } from '@/application/useSyncStatus';
import { SyncStatusContext, type SyncStatusContextValue } from './syncStatusContext';
import { SyncStatusControl } from './SyncStatusControl';

const resolved = () => Promise.resolve();

function contextValue(health: Partial<SyncHealth> = {}, overrides: Partial<SyncStatusContextValue> = {}) {
  const value: SyncStatusContextValue = {
    signedIn: true,
    status: {
      health: { state: 'synced', pendingCount: 0, error: null, alert: null, nextCheckAt: null, ...health },
      events: [],
      connection: { connectedAt: null, disconnectedSince: null, downloadErrorSince: null, lastSyncedAt: null },
      lastSyncedAt: null,
      downloadFraction: null,
      sessionStartedAt: 0,
    },
    alertSince: health.alert ? Date.now() : null,
    retry: resolved,
    clearLog: () => {},
    copyDiagnostics: resolved,
    signIn: resolved,
    ...overrides,
  };
  return value;
}

const rejected: Partial<SyncHealth> = { state: 'error', pendingCount: 2, alert: { kind: 'upload-rejected', severity: 'error' } };

function renderControl(value: SyncStatusContextValue | null) {
  const control = (
    <I18nProvider>
      <SyncStatusControl open={false} onOpenChange={() => {}}>
        {({ button, alert }) => (
          <div data-testid="slots">
            {button}
            {alert}
          </div>
        )}
      </SyncStatusControl>
    </I18nProvider>
  );
  return render(value ? <SyncStatusContext.Provider value={value}>{control}</SyncStatusContext.Provider> : control);
}

describe('SyncStatusControl', () => {
  beforeEach(() => {
    localStorage.setItem('lf:language', 'es');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders nothing without a sync provider', () => {
    renderControl(null);
    expect(screen.getByTestId('slots')).toBeEmptyDOMElement();
  });

  it('renders nothing while signed out', () => {
    renderControl(contextValue(rejected, { signedIn: false }));
    expect(screen.getByTestId('slots')).toBeEmptyDOMElement();
  });

  it('shows the status button and announces a fresh alert', () => {
    renderControl(contextValue(rejected));

    expect(screen.getByRole('button', { name: 'Sincronización: sin sincronizar' })).toHaveTextContent('Sin sincronizar');
    expect(screen.getByRole('alert')).toHaveTextContent('Un cambio no se pudo guardar en la nube');
  });

  it('says in words that everything is synced', () => {
    renderControl(contextValue());

    expect(screen.getByRole('button', { name: 'Sincronización: sincronizado' })).toHaveTextContent('Sincronizado');
  });

  it('says in words how many changes wait to upload', () => {
    renderControl(contextValue({ state: 'pending', pendingCount: 3 }));

    expect(screen.getByRole('button', { name: 'Sincronización: 3 por subir' })).toHaveTextContent('3 por subir');
  });

  it('shows an alert that is no longer fresh as a quiet labelled region', () => {
    renderControl(contextValue(rejected, { alertSince: Date.now() - 60_000 }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('region', { name: 'Sincronización' })).toHaveTextContent(
      'Un cambio no se pudo guardar en la nube',
    );
  });
});
