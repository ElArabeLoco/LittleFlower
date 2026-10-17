import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('../powersync/SupabaseConnector', () => ({
  supabase: { auth: { getSession: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn() } },
  SupabaseConnector: vi.fn(),
}));

vi.mock('../powersync/client', () => ({
  db: { connected: false, connecting: false, connect: vi.fn() },
}));

import { supabase, SupabaseConnector } from '../powersync/SupabaseConnector';
import { db } from '../powersync/client';
import { getCurrentSession, login, register } from './SupabaseAuthAdapter';

const mockGetSession = supabase.auth.getSession as Mock;
const mockSignIn = supabase.auth.signInWithPassword as Mock;
const mockSignUp = supabase.auth.signUp as Mock;
const mockDb = db as unknown as { connected: boolean; connecting: boolean; connect: Mock };

/** signInWithPassword / signUp response with a session. */
function authResponse() {
  return {
    data: {
      session: { access_token: 'jwt-token' },
      user: { id: 'user-1', email: 'ana@example.com', user_metadata: { household_id: 'hh-1' } },
    },
    error: null,
  };
}

const BUSY_STATES = [
  { state: 'connected', flags: { connected: true } },
  { state: 'connecting', flags: { connecting: true } },
];

describe('login()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.connected = false;
    mockDb.connecting = false;
    mockDb.connect.mockResolvedValue(undefined);
    mockSignIn.mockResolvedValue(authResponse());
  });

  it('connects PowerSync when it is idle', async () => {
    const result = await login('ana@example.com', 'secret');

    expect(mockDb.connect).toHaveBeenCalledOnce();
    expect(result).toEqual({
      session: { userId: 'user-1', email: 'ana@example.com', token: 'jwt-token', householdId: 'hh-1' },
    });
  });

  it.each(BUSY_STATES)('does not connect again while PowerSync is $state (the auth listener did)', async ({ flags }) => {
    Object.assign(mockDb, flags);

    const result = await login('ana@example.com', 'secret');

    expect(mockDb.connect).not.toHaveBeenCalled();
    expect(result).toHaveProperty('session');
  });
});

describe('register()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.connected = false;
    mockDb.connecting = false;
    mockDb.connect.mockResolvedValue(undefined);
    mockSignUp.mockResolvedValue(authResponse());
  });

  it('connects PowerSync when it is idle', async () => {
    await register('ana@example.com', 'secret', 'Ana');

    expect(mockDb.connect).toHaveBeenCalledOnce();
  });

  it.each(BUSY_STATES)('does not connect again while PowerSync is $state (the auth listener did)', async ({ flags }) => {
    Object.assign(mockDb, flags);

    const result = await register('ana@example.com', 'secret', 'Ana');

    expect(mockDb.connect).not.toHaveBeenCalled();
    expect(result).toHaveProperty('session');
  });

  it('does not connect while the email still needs confirming', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null, user: { id: 'user-1' } }, error: null });

    await expect(register('ana@example.com', 'secret', 'Ana')).resolves.toEqual({ pendingConfirmation: true });
    expect(mockDb.connect).not.toHaveBeenCalled();
  });
});

function sessionResponse(householdId: string | null = 'hh-1') {
  return {
    data: {
      session: {
        access_token: 'jwt-token',
        user: {
          id: 'user-1',
          email: 'ana@example.com',
          user_metadata: householdId ? { household_id: householdId } : {},
        },
      },
    },
    error: null,
  };
}

describe('getCurrentSession()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.connected = false;
    mockDb.connecting = false;
    mockDb.connect.mockResolvedValue(undefined);
    mockGetSession.mockResolvedValue(sessionResponse());
  });

  it('returns the mapped session', async () => {
    await expect(getCurrentSession()).resolves.toEqual({
      userId: 'user-1',
      email: 'ana@example.com',
      token: 'jwt-token',
      householdId: 'hh-1',
    });
  });

  it('connects PowerSync when it is disconnected', async () => {
    await getCurrentSession();

    expect(mockDb.connect).toHaveBeenCalledOnce();
    expect(SupabaseConnector).toHaveBeenCalledOnce();
  });

  it('does NOT reconnect when PowerSync is already connected', async () => {
    mockDb.connected = true;

    await getCurrentSession();

    expect(mockDb.connect).not.toHaveBeenCalled();
  });

  it('does NOT reconnect while PowerSync is connecting', async () => {
    mockDb.connecting = true;

    await getCurrentSession();

    expect(mockDb.connect).not.toHaveBeenCalled();
  });

  it('does not connect and returns null when there is no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(getCurrentSession()).resolves.toBeNull();
    expect(mockDb.connect).not.toHaveBeenCalled();
  });

  it('does not wait for the background connect to finish', async () => {
    mockDb.connect.mockReturnValue(new Promise(() => {}));

    await expect(getCurrentSession()).resolves.not.toBeNull();
  });

  it('swallows a failed background connect', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockDb.connect.mockRejectedValue(new Error('boom'));

    await expect(getCurrentSession()).resolves.not.toBeNull();
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    warn.mockRestore();
  });
});
