/**
 * HouseholdMember — a person of the household economy.
 *
 * Not an app account: a member needs no login, and a login creates no member.
 * Members are who incomes and debts can be "in the name of" (see holders.ts).
 */

/** Avatar palette keys. The order is the order tones are suggested in. */
export const MEMBER_TONES = ['petal', 'iris', 'leaf', 'polen', 'sky', 'mist'] as const;

export type MemberTone = (typeof MEMBER_TONES)[number];

export interface HouseholdMember {
  id: string;
  householdId: string;
  name: string;
  tone: MemberTone;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastEditedBy: string | null;
  lastEditedAt: string | null;
  /** Soft delete: set means the member no longer shows anywhere. */
  deletedAt: string | null;
}

/** The minimum needed to show a member (avatar + name). */
export interface MemberRef {
  id: string;
  name: string;
  tone: MemberTone;
}

/** Tone for a value read from sync; anything unknown falls back to petal. */
export function toMemberTone(value: unknown): MemberTone {
  return MEMBER_TONES.find(tone => tone === value) ?? 'petal';
}

/**
 * The tone to suggest for a new member: the first palette tone nobody uses.
 * When every tone is taken, the least used one (ties go to the earliest).
 */
export function nextMemberTone(used: MemberTone[]): MemberTone {
  const counts = new Map<MemberTone, number>(MEMBER_TONES.map(tone => [tone, 0]));
  for (const tone of used) counts.set(tone, (counts.get(tone) ?? 0) + 1);

  let best: MemberTone = MEMBER_TONES[0];
  for (const tone of MEMBER_TONES) {
    if ((counts.get(tone) ?? 0) < (counts.get(best) ?? 0)) best = tone;
  }
  return best;
}

/** Whether `name` equals another name, ignoring case, accents and edge spaces. */
export function isDuplicateMemberName(name: string, others: string[]): boolean {
  const candidate = name.trim();
  return others.some(
    other => candidate.localeCompare(other.trim(), undefined, { sensitivity: 'base' }) === 0,
  );
}
