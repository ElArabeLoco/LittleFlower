import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../client', () => ({ db: { disconnect: vi.fn(), connect: vi.fn() } }));
vi.mock('../SupabaseConnector', () => ({
  supabase: { auth: { getSession: vi.fn() } },
  SupabaseConnector: vi.fn(),
}));

import { db } from '../client';
import { supabase, SupabaseConnector } from '../SupabaseConnector';
import { reconnectSync } from './reconnect';

function givenSession(signedIn: boolean) {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: signedIn ? { access_token: 'jwt' } : null },
    error: null,
  } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
}

describe('reconnectSync()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    givenSession(true);
  });

  it('disconnects, then connects again with a fresh connector', async () => {
    const calls: string[] = [];
    vi.mocked(db.disconnect).mockImplementation(async () => {
      calls.push('disconnect');
    });
    vi.mocked(db.connect).mockImplementation(async () => {
      calls.push('connect');
    });

    await reconnectSync();

    expect(calls).toEqual(['disconnect', 'connect']);
    expect(db.connect).toHaveBeenCalledWith(expect.any(SupabaseConnector));
  });

  it('waits for the disconnect to finish before connecting', async () => {
    let finishDisconnect: () => void = () => {};
    vi.mocked(db.disconnect).mockReturnValue(
      new Promise<void>((resolve) => {
        finishDisconnect = resolve;
      }),
    );
    vi.mocked(db.connect).mockResolvedValue(undefined);

    const pending = reconnectSync();
    await vi.waitFor(() => expect(db.disconnect).toHaveBeenCalled());
    expect(db.connect).not.toHaveBeenCalled();

    finishDisconnect();
    await pending;
    expect(db.connect).toHaveBeenCalledOnce();
  });

  it('does nothing without a Supabase session', async () => {
    givenSession(false);

    await reconnectSync();

    expect(db.disconnect).not.toHaveBeenCalled();
    expect(db.connect).not.toHaveBeenCalled();
  });
});
