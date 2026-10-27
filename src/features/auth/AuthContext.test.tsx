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
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';

const mockRefreshSession = supabase.auth.refreshSession as Mock;
const mockOnAuthStateChange = supabase.auth.onAuthStateChange as Mock;
const mockDb = db as unknown as { connected: boolean; connecting: boolean; connect: Mock };

type AuthListener = (event: string, session: unknown) => Promise<void> | void;

/** The callback AuthProvider registered with supabase.auth.onAuthStateChange. */
function authListener(): AuthListener {
  return mockOnAuthStateChange.mock.calls[0][0] as AuthListener;
}

function supabaseSession(householdId: string) {
  return {
    access_token: 'fresh-jwt',
    user: { id: 'user-1', email: 'ana@example.com', user_metadata: { household_id: householdId } },
  };
}

function refreshedSession(householdId: string) {
  return { data: { session: supabaseSession(householdId) }, error: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.connected = false;
  mockDb.connecting = false;
  mockDb.connect.mockResolvedValue(undefined);
});

describe('AuthProvider refreshSession()', () => {
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

  it('does not wait for the reconnect handshake', async () => {
    mockDb.connect.mockReturnValue(new Promise(() => {}));
    mockRefreshSession.mockResolvedValue(refreshedSession('hh-new'));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    let settled = false;
    act(() => {
      void result.current.refreshSession().then(() => {
        settled = true;
      });
    });

    await vi.waitFor(() => expect(settled).toBe(true));
    expect(result.current.session).toMatchObject({ householdId: 'hh-new' });
  });

  it('warns instead of failing when the reconnect fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockDb.connect.mockRejectedValue(new Error('connect failed'));
    mockRefreshSession.mockResolvedValue(refreshedSession('hh-new'));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(() => result.current.refreshSession());

    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    warn.mockRestore();
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

describe('AuthProvider auth listener', () => {
  it('connects PowerSync on sign-in when it is idle', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(() => authListener()('SIGNED_IN', supabaseSession('hh-1')));

    expect(mockDb.connect).toHaveBeenCalledOnce();
    expect(result.current.session).toMatchObject({ userId: 'user-1', householdId: 'hh-1' });
  });

  it.each([
    { state: 'connected', flags: { connected: true } },
    { state: 'connecting', flags: { connecting: true } },
  ])('does not restart the stream on SIGNED_IN / TOKEN_REFRESHED while $state', async ({ flags }) => {
    Object.assign(mockDb, flags);
    renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(() => authListener()('SIGNED_IN', supabaseSession('hh-1')));
    await act(() => authListener()('TOKEN_REFRESHED', supabaseSession('hh-1')));

    expect(mockDb.connect).not.toHaveBeenCalled();
  });

  it('stops loading without waiting for the connection', async () => {
    mockDb.connect.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    act(() => {
      void authListener()('INITIAL_SESSION', supabaseSession('hh-1'));
    });

    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
