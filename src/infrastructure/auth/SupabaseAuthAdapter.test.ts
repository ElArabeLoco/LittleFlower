import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('../powersync/SupabaseConnector', () => ({
  supabase: { auth: { getSession: vi.fn() } },
  SupabaseConnector: vi.fn(),
}));

vi.mock('../powersync/client', () => ({
  db: { connected: false, connecting: false, connect: vi.fn() },
}));

import { supabase, SupabaseConnector } from '../powersync/SupabaseConnector';
import { db } from '../powersync/client';
import { getCurrentSession } from './SupabaseAuthAdapter';

const mockGetSession = supabase.auth.getSession as Mock;
const mockDb = db as unknown as { connected: boolean; connecting: boolean; connect: Mock };

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
