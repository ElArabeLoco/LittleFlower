/**
 * SupabaseConnector.uploadData — classified errors and activity logging.
 *
 * Exercised with a fake Supabase client and a fake CRUD transaction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type { AbstractPowerSyncDatabase, CrudEntry } from '@powersync/web';

type Response = { error: Record<string, string> | null; status: number };

const supabaseMock = vi.hoisted(() => {
  const respond = vi.fn<(op: string, table: string) => Promise<Response>>();
  return {
    respond,
    client: {
      auth: { getSession: vi.fn() },
      from: (table: string) => ({
        upsert: () => respond('PUT', table),
        update: () => ({ eq: () => respond('PATCH', table) }),
        delete: () => ({ eq: () => respond('DELETE', table) }),
      }),
    },
  };
});

vi.mock('@supabase/supabase-js', () => ({ createClient: () => supabaseMock.client }));

import { SupabaseConnector } from './SupabaseConnector';
import { SyncUploadError } from './sync/syncErrors';
import { syncActivity, selectUnresolvedUploadFailure } from './sync/syncActivityStore';

const OK: Response = { error: null, status: 201 };

function entry(op: string, table: string, id: string, opData?: Record<string, unknown>): CrudEntry {
  return { op, table, id, opData } as unknown as CrudEntry;
}

function fakeDatabase(crud: CrudEntry[]) {
  const complete = vi.fn().mockResolvedValue(undefined);
  const database = {
    getNextCrudTransaction: vi.fn().mockResolvedValue({ crud, complete }),
  } as unknown as AbstractPowerSyncDatabase;
  return { database, complete };
}

async function uploadFailure(promise: Promise<void>): Promise<SyncUploadError> {
  try {
    await promise;
  } catch (err) {
    return err as SyncUploadError;
  }
  throw new Error('Expected the upload to fail');
}

const BUDGET_PUT = entry('PUT', 'budgets', 'b-1', { name: 'Arriendo', default_amount: 1_500_000 });
const EXPENSE_PUT = entry('PUT', 'expenses', 'e-1', { amount: 50_000, note: 'Mercado' });

describe('SupabaseConnector.uploadData()', () => {
  let connector: SupabaseConnector;
  let consoleError: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    syncActivity.clear();
    connector = new SupabaseConnector();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {}) as unknown as Mock;
  });

  it('completes the transaction and logs the uploaded changes', async () => {
    supabaseMock.respond.mockResolvedValue(OK);
    const { database, complete } = fakeDatabase([BUDGET_PUT, EXPENSE_PUT]);

    await connector.uploadData(database);

    expect(complete).toHaveBeenCalledOnce();
    const [event] = syncActivity.getSnapshot().events;
    expect(event).toMatchObject({
      kind: 'upload',
      changes: [
        { table: 'budgets', op: 'create', id: 'b-1', label: 'Arriendo', amount: 1_500_000 },
        { table: 'expenses', op: 'create', id: 'e-1', label: 'Mercado', amount: 50_000 },
      ],
    });
  });

  it('does nothing without a pending transaction', async () => {
    const database = { getNextCrudTransaction: vi.fn().mockResolvedValue(null) } as unknown as AbstractPowerSyncDatabase;

    await connector.uploadData(database);

    expect(syncActivity.getSnapshot().events).toEqual([]);
  });

  it('throws a classified SyncUploadError and never completes on a rejected write', async () => {
    supabaseMock.respond.mockImplementation(async (_op, table) =>
      table === 'expenses'
        ? { error: { code: '42501', message: 'new row violates row-level security policy', details: '', hint: '' }, status: 403 }
        : OK,
    );
    const { database, complete } = fakeDatabase([BUDGET_PUT, EXPENSE_PUT]);

    const error = await uploadFailure(connector.uploadData(database));

    expect(error).toBeInstanceOf(SyncUploadError);
    expect(error.info).toEqual({
      kind: 'rejected',
      message: 'new row violates row-level security policy',
      code: '42501',
      status: 403,
      table: 'expenses',
      op: 'PUT',
      recordId: 'e-1',
    });
    expect(complete).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it('logs the failure with every change of the transaction and folds retries', async () => {
    supabaseMock.respond.mockResolvedValue({
      error: { message: 'TypeError: Failed to fetch', details: 'TypeError: Failed to fetch\n    at fetch', hint: '', code: '' },
      status: 0,
    });
    const { database } = fakeDatabase([BUDGET_PUT, EXPENSE_PUT]);

    await expect(connector.uploadData(database)).rejects.toBeInstanceOf(SyncUploadError);
    await expect(connector.uploadData(database)).rejects.toBeInstanceOf(SyncUploadError);

    const { events } = syncActivity.getSnapshot();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'upload-failed',
      attempts: 2,
      error: { kind: 'offline', status: 0, table: 'budgets', op: 'PUT', recordId: 'b-1' },
      changes: [{ id: 'b-1' }, { id: 'e-1' }],
    });
  });

  it('classifies PATCH and DELETE failures with their HTTP status', async () => {
    supabaseMock.respond.mockResolvedValue({ error: { message: 'upstream connect error', code: '', details: '', hint: '' }, status: 503 });

    const patch = await uploadFailure(
      connector.uploadData(fakeDatabase([entry('PATCH', 'budgets', 'b-1', { deleted_at: '2026-03-01' })]).database),
    );
    const del = await uploadFailure(connector.uploadData(fakeDatabase([entry('DELETE', 'debts', 'd-1')]).database));

    expect(patch.info).toMatchObject({ kind: 'server', status: 503, op: 'PATCH', table: 'budgets' });
    expect(del.info).toMatchObject({ kind: 'server', status: 503, op: 'DELETE', table: 'debts' });
  });

  it('wraps unexpected errors (e.g. completing the transaction) in a SyncUploadError', async () => {
    supabaseMock.respond.mockResolvedValue(OK);
    const { database, complete } = fakeDatabase([BUDGET_PUT]);
    complete.mockRejectedValue(new Error('disk I/O error'));

    const error = await uploadFailure(connector.uploadData(database));

    expect(error).toBeInstanceOf(SyncUploadError);
    expect(error.info).toMatchObject({ kind: 'unknown', message: 'disk I/O error' });
    expect(error.cause).toBeInstanceOf(Error);
    expect(selectUnresolvedUploadFailure(syncActivity.getSnapshot())).toMatchObject({ changes: [{ id: 'b-1' }] });
  });

  it('resolves the logged failure once the transaction finally uploads', async () => {
    supabaseMock.respond.mockResolvedValueOnce({ error: { message: 'JWT expired', code: 'PGRST301', details: '', hint: '' }, status: 401 });
    const { database } = fakeDatabase([BUDGET_PUT]);
    await expect(connector.uploadData(database)).rejects.toMatchObject({ info: { kind: 'auth' } });

    supabaseMock.respond.mockResolvedValue(OK);
    await connector.uploadData(database);

    expect(selectUnresolvedUploadFailure(syncActivity.getSnapshot())).toBeNull();
    expect(syncActivity.getSnapshot().events.map((e) => e.kind)).toEqual(['upload', 'upload-failed']);
  });
});
