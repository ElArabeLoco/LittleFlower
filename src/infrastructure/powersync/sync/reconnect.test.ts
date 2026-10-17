import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../client', () => ({ db: { disconnect: vi.fn(), connect: vi.fn() } }));
vi.mock('../SupabaseConnector', () => ({ SupabaseConnector: vi.fn() }));

import { db } from '../client';
import { SupabaseConnector } from '../SupabaseConnector';
import { reconnectSync } from './reconnect';

describe('reconnectSync()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    await Promise.resolve();
    expect(db.connect).not.toHaveBeenCalled();

    finishDisconnect();
    await pending;
    expect(db.connect).toHaveBeenCalledOnce();
  });
});
