import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/infrastructure/powersync/SupabaseConnector', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      refreshSession: vi.fn(),
    },
  },
  SupabaseConnector: vi.fn(),
}));

vi.mock('@/infrastructure/powersync/client', () => ({
  db: {
    connected: false,
    connecting: false,
    currentStatus: { connected: false, connecting: false },
    connect: vi.fn(),
  },
}));

vi.mock('@/infrastructure/auth/SupabaseAuthAdapter', () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}));

import { supabase, SupabaseConnector } from '@/infrastructure/powersync/SupabaseConnector';
import { db } from '@/infrastructure/powersync/client';
import { AuthProvider, useAuth } from './AuthContext';

const mockRefreshSession = supabase.auth.refreshSession as Mock;
const mockDb = db as unknown as { connected: boolean; connect: Mock };

function refreshedSession(householdId: string) {
  return {
    data: {
      session: {
        access_token: 'fresh-jwt',
        user: { id: 'user-1', email: 'ana@example.com', user_metadata: { household_id: householdId } },
      },
    },
    error: null,
  };
}

describe('AuthProvider refreshSession()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.connected = false;
    mockDb.connect.mockResolvedValue(undefined);
  });

  it('reconnects PowerSync even when it is already connected, so the new claims reach the sync rules', async () => {
    mockDb.connected = true;
    mockRefreshSession.mockResolvedValue(refreshedSession('hh-new'));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(() => result.current.refreshSession());

    expect(mockDb.connect).toHaveBeenCalledOnce();
    expect(mockDb.connect).toHaveBeenCalledWith(expect.any(SupabaseConnector));
    expect(result.current.session).toMatchObject({ householdId: 'hh-new', token: 'fresh-jwt' });
  });

  it('connects PowerSync when it is disconnected', async () => {
    mockRefreshSession.mockResolvedValue(refreshedSession('hh-1'));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(() => result.current.refreshSession());

    expect(mockDb.connect).toHaveBeenCalledOnce();
  });

  it('does not touch the connection or the session when the refresh fails', async () => {
    mockDb.connected = true;
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: new Error('refresh failed') });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(() => result.current.refreshSession());

    expect(mockDb.connect).not.toHaveBeenCalled();
    expect(result.current.session).toBeNull();
  });
});
