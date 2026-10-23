import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/infrastructure/powersync/client', () => ({
  db: {
    execute: vi.fn(),
    getOptional: vi.fn(),
    getAll: vi.fn(),
    writeTransaction: vi.fn(),
  },
}));

import { db } from '@/infrastructure/powersync/client';
import type { Executor } from '@/infrastructure/powersync/mutationHelpers';
import {
  insertMember,
  updateMember,
  softDeleteMember,
  setHolders,
} from './PowerSyncMemberRepository';

const mockExecute = db.execute as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  mockExecute.mockResolvedValue({});
});

describe('insertMember', () => {
  it('inserts an active member with authorship and returns its id', async () => {
    const id = await insertMember(
      { household_id: 'hh-1', name: '  Sofía ', tone: 'iris', created_by: 'user-1' },
      'user-1',
    );

    expect(id).toEqual(expect.any(String));
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain('INSERT INTO household_members');
    const [rowId, householdId, name, tone, createdBy, createdAt, updatedAt, editedBy, editedAt] = params;
    expect(rowId).toBe(id);
    expect([householdId, name, tone, createdBy]).toEqual(['hh-1', 'Sofía', 'iris', 'user-1']);
    expect(updatedAt).toBe(createdAt);
    expect(editedBy).toBe('user-1');
    expect(editedAt).toEqual(expect.any(String));
  });

  it('refuses to write before the session is ready', async () => {
    await expect(
      insertMember({ household_id: '', name: 'Ana', tone: 'petal', created_by: '' }, ''),
    ).rejects.toThrow('empty auth');
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

describe('updateMember', () => {
  it('updates only the given fields and stamps the edit', async () => {
    await updateMember('m-1', { name: ' Ana María ' }, 'user-1');

    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain('UPDATE household_members SET');
    expect(sql).toContain('name = ?');
    expect(sql).not.toContain('tone = ?');
    expect(sql).toContain('updated_at = ?');
    expect(sql).toContain('last_edited_by = ?');
    expect(params[0]).toBe('Ana María');
    expect(params).toContain('user-1');
    expect(params[params.length - 1]).toBe('m-1');
  });

  it('updates the tone too', async () => {
    await updateMember('m-1', { name: 'Ana', tone: 'leaf' }, 'user-1');
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain('tone = ?');
    expect(params.slice(0, 2)).toEqual(['Ana', 'leaf']);
  });

  it('does nothing for an empty patch', async () => {
    await updateMember('m-1', {}, 'user-1');
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

describe('softDeleteMember', () => {
  it('sets deleted_at and the edit stamp, nothing else', async () => {
    await softDeleteMember('m-1', 'user-1');

    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toMatch(/^\s*UPDATE household_members\s+SET deleted_at = \?/);
    expect(sql).not.toMatch(/DELETE FROM/);
    expect(params[params.length - 1]).toBe('m-1');
    expect(params).toContain('user-1');
  });
});

describe('setHolders', () => {
  /** The mock only implements what setHolders reads and writes. */
  const asExecutor = (mock: unknown) => mock as Executor;

  /** Executor whose reads are answered from fixtures. */
  function makeExec(opts: {
    current?: string[];
    existingHolderIds?: string[];
    knownMembers?: string[];
  }) {
    const { current = [], existingHolderIds = [], knownMembers } = opts;
    return {
      execute: vi.fn().mockResolvedValue({}),
      getAll: vi.fn().mockResolvedValue(current.map(member_id => ({ member_id }))),
      getOptional: vi.fn(async (sql: string, params: unknown[]) => {
        const [id] = params as [string];
        if (String(sql).includes('FROM holders')) {
          return existingHolderIds.includes(id) ? { id } : null;
        }
        return knownMembers === undefined || knownMembers.includes(id) ? { id } : null;
      }),
    };
  }

  const base = { householdId: 'hh-1', subjectType: 'income' as const, subjectId: 'i-1', userId: 'user-1' };

  it('reads only holders whose member is active', async () => {
    const exec = makeExec({});
    await setHolders(asExecutor(exec), { ...base, memberIds: [] });

    const [sql, params] = exec.getAll.mock.calls[0];
    expect(sql).toContain('JOIN household_members');
    expect(sql).toContain('deleted_at IS NULL');
    expect(params).toEqual(['income', 'i-1']);
  });

  it('inserts added holders with deterministic ids', async () => {
    const exec = makeExec({ current: ['m-1'] });
    await setHolders(asExecutor(exec), { ...base, memberIds: ['m-1', 'm-2'] });

    const inserts = exec.execute.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO holders'));
    expect(inserts).toHaveLength(1);
    const [, params] = inserts[0];
    expect(params.slice(0, 5)).toEqual(['income:i-1:m-2', 'hh-1', 'm-2', 'income', 'i-1']);
    expect(params[5]).toBe('user-1');
    expect(exec.execute.mock.calls.some(([sql]) => String(sql).includes('DELETE'))).toBe(false);
  });

  it('deletes removed holders by subject and member', async () => {
    const exec = makeExec({ current: ['m-1', 'm-2'] });
    await setHolders(asExecutor(exec), { ...base, subjectType: 'debt', subjectId: 'd-1', memberIds: ['m-2'] });

    const deletes = exec.execute.mock.calls.filter(([sql]) => String(sql).includes('DELETE FROM holders'));
    expect(deletes).toHaveLength(1);
    expect(String(deletes[0][0])).toContain('subject_type = ? AND subject_id = ? AND member_id = ?');
    expect(deletes[0][1]).toEqual(['debt', 'd-1', 'm-1']);
    expect(exec.execute.mock.calls.some(([sql]) => String(sql).includes('INSERT'))).toBe(false);
  });

  it('writes nothing when the holders already match', async () => {
    const exec = makeExec({ current: ['m-1', 'm-2'] });
    await setHolders(asExecutor(exec), { ...base, memberIds: ['m-2', 'm-1'] });
    expect(exec.execute).not.toHaveBeenCalled();
  });

  it('does not insert a holder row that already exists (offline duplicate)', async () => {
    const exec = makeExec({ existingHolderIds: ['income:i-1:m-3'] });
    await setHolders(asExecutor(exec), { ...base, memberIds: ['m-3'] });
    expect(exec.execute).not.toHaveBeenCalled();
  });

  it('never uploads a holder whose member does not exist', async () => {
    const exec = makeExec({ knownMembers: ['m-1'] });
    await setHolders(asExecutor(exec), { ...base, memberIds: ['m-1', 'ghost'] });

    const inserts = exec.execute.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO holders'));
    expect(inserts.map(([, params]) => params[2])).toEqual(['m-1']);
  });

  it('removes every holder when given an empty list', async () => {
    const exec = makeExec({ current: ['m-1', 'm-2'] });
    await setHolders(asExecutor(exec), { ...base, memberIds: [] });
    const deletes = exec.execute.mock.calls.filter(([sql]) => String(sql).includes('DELETE FROM holders'));
    expect(deletes.map(([, params]) => params[2])).toEqual(['m-1', 'm-2']);
  });
});
