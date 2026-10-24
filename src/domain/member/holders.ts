/**
 * Holders (titulares) — who an income, a debt or an asset is in the name of.
 *
 * Zero or more members per record. No holders means the whole household.
 */

/** Kinds of record that can have holders. */
export const HOLDABLE_TYPES = ['income', 'debt', 'asset'] as const;

export type HoldableType = (typeof HOLDABLE_TYPES)[number];

/**
 * Deterministic id of one holder row. Two devices that assign the same holder
 * offline write the same row instead of creating a duplicate.
 */
export function holderId(type: HoldableType, subjectId: string, memberId: string): string {
  return `${type}:${subjectId}:${memberId}`;
}

/** Members to add and to remove to go from `current` to `next` (deduped, input order). */
export function diffHolders(
  current: string[],
  next: string[],
): { add: string[]; remove: string[] } {
  const currentSet = new Set(current);
  const nextSet = new Set(next);
  return {
    add: [...nextSet].filter(id => !currentSet.has(id)),
    remove: [...currentSet].filter(id => !nextSet.has(id)),
  };
}

export type HoldersKind = 'household' | 'single' | 'shared';

/** Classifies a list of holder names: nobody, one person, or several. */
export function describeHolders(names: string[]): { kind: HoldersKind; names: string[] } {
  if (names.length === 0) return { kind: 'household', names: [] };
  return { kind: names.length === 1 ? 'single' : 'shared', names };
}
