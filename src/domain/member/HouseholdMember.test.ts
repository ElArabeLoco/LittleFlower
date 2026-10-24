import { describe, it, expect } from 'vitest';
import {
  MEMBER_TONES,
  toMemberTone,
  nextMemberTone,
  isDuplicateMemberName,
  type MemberTone,
} from './HouseholdMember';

describe('toMemberTone', () => {
  it('keeps known tones', () => {
    for (const tone of MEMBER_TONES) expect(toMemberTone(tone)).toBe(tone);
  });

  it.each([['violet'], [''], [null], [undefined], [42], [{}]])(
    'falls back to petal for %j',
    value => {
      expect(toMemberTone(value)).toBe('petal');
    },
  );
});

describe('nextMemberTone', () => {
  it('starts with the first tone when nothing is used', () => {
    expect(nextMemberTone([])).toBe('petal');
  });

  it('picks the first free tone in palette order', () => {
    expect(nextMemberTone(['petal'])).toBe('iris');
    expect(nextMemberTone(['petal', 'leaf'])).toBe('iris');
    expect(nextMemberTone(['iris', 'leaf'])).toBe('petal');
  });

  it('picks the least used tone when all are used', () => {
    const used: MemberTone[] = [...MEMBER_TONES, 'petal', 'iris', 'leaf', 'polen', 'sky'];
    expect(nextMemberTone(used)).toBe('mist');
  });

  it('breaks ties by palette order when all are used equally', () => {
    expect(nextMemberTone([...MEMBER_TONES])).toBe('petal');
    expect(nextMemberTone([...MEMBER_TONES, ...MEMBER_TONES])).toBe('petal');
  });
});

describe('isDuplicateMemberName', () => {
  it('detects the same name', () => {
    expect(isDuplicateMemberName('Ana', ['Ana', 'Luis'])).toBe(true);
  });

  it('ignores case, surrounding spaces and accents', () => {
    expect(isDuplicateMemberName('  tomas ', ['Tomás'])).toBe(true);
    expect(isDuplicateMemberName('SOFIA', ['Sofía'])).toBe(true);
  });

  it('accepts different names', () => {
    expect(isDuplicateMemberName('Ana', ['Anabel', 'Luis'])).toBe(false);
    expect(isDuplicateMemberName('Ana', [])).toBe(false);
  });

  it('compares others as written (their own spacing counts as trimmed too)', () => {
    expect(isDuplicateMemberName('Ana', [' Ana '])).toBe(true);
  });
});
