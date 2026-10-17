import { describe, it, expect } from 'vitest';
import { SyncUploadError, classifySupabaseError, classifySyncError } from './syncErrors';
import type { SyncErrorInfo } from './types';

/** Shape postgrest-js returns when fetch itself rejects (network down). */
const FETCH_FAILURE = {
  message: 'TypeError: Failed to fetch',
  details: 'TypeError: Failed to fetch\n    at fetch (native)\n    at PostgrestBuilder.then',
  hint: '',
  code: '',
};

describe('classifySupabaseError()', () => {
  it.each([
    {
      name: 'fetch failure with status 0 → offline',
      error: FETCH_FAILURE,
      status: 0,
      kind: 'offline',
    },
    {
      name: 'PGRST301 "JWT expired" 401 → auth',
      error: { code: 'PGRST301', message: 'JWT expired' },
      status: 401,
      kind: 'auth',
    },
    {
      name: 'PGRST303 JWT claims validation → auth',
      error: { code: 'PGRST303', message: 'JWT claims validation or parsing failed' },
      status: null,
      kind: 'auth',
    },
    {
      name: '42501 RLS violation with 403 → rejected (not auth)',
      error: { code: '42501', message: 'new row violates row-level security policy for table "budgets"' },
      status: 403,
      kind: 'rejected',
    },
    {
      name: '42501 stays rejected even when the message sounds like auth',
      error: { code: '42501', message: 'permission denied: unauthorized role' },
      status: 403,
      kind: 'rejected',
    },
    {
      name: '23505 unique violation with 409 → rejected',
      error: { code: '23505', message: 'duplicate key value violates unique constraint "budgets_pkey"' },
      status: 409,
      kind: 'rejected',
    },
    {
      name: '23503 foreign key violation → rejected',
      error: { code: '23503', message: 'insert or update on table "expenses" violates foreign key constraint' },
      status: null,
      kind: 'rejected',
    },
    {
      name: '22P02 invalid text representation → rejected',
      error: { code: '22P02', message: 'invalid input syntax for type integer: "abc"' },
      status: null,
      kind: 'rejected',
    },
    {
      name: '42703 undefined column (other 42xxx) → rejected',
      error: { code: '42703', message: 'column "foo" does not exist' },
      status: null,
      kind: 'rejected',
    },
    {
      name: 'PGRST204 schema cache miss with 400 → rejected',
      error: { code: 'PGRST204', message: "Could not find the 'foo' column of 'budgets' in the schema cache" },
      status: 400,
      kind: 'rejected',
    },
    {
      name: 'PGRST116 → rejected',
      error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
      status: 406,
      kind: 'rejected',
    },
    {
      name: '422 without a code → rejected',
      error: { message: 'Unprocessable' },
      status: 422,
      kind: 'rejected',
    },
    {
      name: '503 → server',
      error: { message: 'upstream connect error' },
      status: 503,
      kind: 'server',
    },
    {
      name: 'PGRST002 → server',
      error: { code: 'PGRST002', message: 'Could not query the database for the schema cache. Retrying.' },
      status: null,
      kind: 'server',
    },
    {
      name: 'unrecognised error → unknown',
      error: { code: 'XX999', message: 'Something odd' },
      status: 418,
      kind: 'unknown',
    },
  ])('$name', ({ error, status, kind }) => {
    expect(classifySupabaseError(error, { status }).kind).toBe(kind);
  });

  it('propagates the context fields and the code', () => {
    const info = classifySupabaseError(
      { code: '23505', message: 'duplicate key value violates unique constraint "budgets_pkey"' },
      { status: 409, table: 'budgets', op: 'PUT', recordId: 'b-1' },
    );

    expect(info).toEqual<SyncErrorInfo>({
      kind: 'rejected',
      message: 'duplicate key value violates unique constraint "budgets_pkey"',
      code: '23505',
      status: 409,
      table: 'budgets',
      op: 'PUT',
      recordId: 'b-1',
    });
  });

  it('sets absent context fields to null', () => {
    const info = classifySupabaseError({ message: 'Something odd' }, {});

    expect(info).toMatchObject({ code: null, status: null, table: null, op: null, recordId: null });
  });

  it('normalizes an empty code and an unknown op to null', () => {
    const info = classifySupabaseError({ message: 'x', code: '' }, { op: 'MERGE' });

    expect(info.code).toBeNull();
    expect(info.op).toBeNull();
  });

  it('appends single-line details to the message', () => {
    const info = classifySupabaseError(
      { code: '23503', message: 'violates foreign key constraint', details: 'Key (budget_id)=(b-9) is not present in table "budgets".' },
      {},
    );

    expect(info.message).toBe(
      'violates foreign key constraint (Key (budget_id)=(b-9) is not present in table "budgets".)',
    );
  });

  it('does not append multi-line details such as fetch stack traces', () => {
    expect(classifySupabaseError(FETCH_FAILURE, { status: 0 }).message).toBe('TypeError: Failed to fetch');
  });
});

describe('classifySyncError()', () => {
  it.each([
    { name: '"TypeError: Failed to fetch" → offline', error: new TypeError('Failed to fetch'), kind: 'offline' },
    { name: '"Load failed" (Safari) → offline', error: new TypeError('Load failed'), kind: 'offline' },
    {
      name: 'Firefox NetworkError → offline',
      error: new TypeError('NetworkError when attempting to fetch resource.'),
      kind: 'offline',
    },
    {
      name: 'missing Supabase session → auth',
      error: new Error('No active Supabase session. User must be logged in before PowerSync connects.'),
      kind: 'auth',
    },
    { name: '"PSYNC_S2101 …" → auth', error: new Error('PSYNC_S2101: Authentication required'), kind: 'auth' },
    { name: 'HTTP Unauthorized → auth', error: new Error('HTTP Unauthorized: {"error":"invalid token"}'), kind: 'auth' },
    { name: 'gateway timeout message → server', error: new Error('HTTP Gateway Timeout'), kind: 'server' },
    { name: 'plain Error("Something odd") → unknown', error: new Error('Something odd'), kind: 'unknown' },
    { name: 'string error → classified by its text', error: 'fetch failed', kind: 'offline' },
  ])('$name', ({ error, kind }) => {
    expect(classifySyncError(error).kind).toBe(kind);
  });

  it('treats any error as offline when the browser reports online=false', () => {
    expect(classifySyncError(new Error('Something odd'), false).kind).toBe('offline');
  });

  it('reads status and code from error-like objects', () => {
    const httpError = Object.assign(new Error('Request failed'), { status: 401 });
    const postgrestLike = { message: 'duplicate key value', code: '23505', details: 'Key (id)=(e-1) already exists.' };

    expect(classifySyncError(httpError)).toMatchObject({ kind: 'auth', status: 401 });
    expect(classifySyncError(postgrestLike)).toMatchObject({
      kind: 'rejected',
      code: '23505',
      message: 'duplicate key value (Key (id)=(e-1) already exists.)',
    });
  });

  it('describes errors without a message as "Unknown error"', () => {
    expect(classifySyncError(undefined)).toMatchObject({ kind: 'unknown', message: 'Unknown error' });
  });

  it('has no record context', () => {
    expect(classifySyncError(new Error('Something odd'))).toMatchObject({ table: null, op: null, recordId: null });
  });

  it('returns the info carried by a SyncUploadError', () => {
    const info = classifySupabaseError({ code: '42501', message: 'rls' }, { status: 403, table: 'expenses', op: 'PUT', recordId: 'e-1' });

    expect(classifySyncError(new SyncUploadError(info))).toEqual(info);
  });

  it('marks a SyncUploadError as offline when the browser is offline, keeping its context', () => {
    const info = classifySupabaseError({ message: 'Something odd' }, { table: 'expenses', op: 'PATCH', recordId: 'e-1' });

    expect(classifySyncError(new SyncUploadError(info), false)).toEqual({ ...info, kind: 'offline' });
  });
});

describe('SyncUploadError', () => {
  it('is an Error that carries the classified info', () => {
    const info = classifySupabaseError({ code: '23505', message: 'duplicate key' }, { status: 409, table: 'budgets', op: 'PUT', recordId: 'b-1' });
    const error = new SyncUploadError(info);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('SyncUploadError');
    expect(error.info).toBe(info);
    expect(error.message).toBe('Supabase PUT failed on budgets: duplicate key');
  });

  it('uses the bare message when there is no record context', () => {
    const error = new SyncUploadError(classifySyncError(new Error('Something odd')));

    expect(error.message).toBe('Something odd');
  });
});
