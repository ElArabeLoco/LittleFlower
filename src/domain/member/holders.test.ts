import { describe, it, expect } from 'vitest';
import { holderId, diffHolders, describeHolders } from './holders';

describe('holderId', () => {
  it('is deterministic: type, subject and member joined by colons', () => {
    expect(holderId('income', 'i-1', 'm-1')).toBe('income:i-1:m-1');
    expect(holderId('debt', 'd-9', 'm-2')).toBe('debt:d-9:m-2');
  });
});

describe('diffHolders', () => {
  it('adds members that are new', () => {
    expect(diffHolders([], ['a', 'b'])).toEqual({ add: ['a', 'b'], remove: [] });
  });

  it('removes members that are gone', () => {
    expect(diffHolders(['a', 'b'], [])).toEqual({ add: [], remove: ['a', 'b'] });
  });

  it('does nothing when both sides match, in any order', () => {
    expect(diffHolders(['a', 'b'], ['b', 'a'])).toEqual({ add: [], remove: [] });
  });

  it('adds and removes at once, keeping input order', () => {
    expect(diffHolders(['a', 'b', 'c'], ['d', 'b', 'e'])).toEqual({
      add: ['d', 'e'],
      remove: ['a', 'c'],
    });
  });

  it('dedupes both inputs', () => {
    expect(diffHolders(['a', 'a'], ['a', 'b', 'b'])).toEqual({ add: ['b'], remove: [] });
  });
});

describe('describeHolders', () => {
  it('no names means the whole household', () => {
    expect(describeHolders([])).toEqual({ kind: 'household', names: [] });
  });

  it('one name is a single holder', () => {
    expect(describeHolders(['Ana'])).toEqual({ kind: 'single', names: ['Ana'] });
  });

  it('two or more names are shared', () => {
    expect(describeHolders(['Ana', 'Luis'])).toEqual({ kind: 'shared', names: ['Ana', 'Luis'] });
    expect(describeHolders(['Ana', 'Luis', 'Eva'])).toEqual({
      kind: 'shared',
      names: ['Ana', 'Luis', 'Eva'],
    });
  });
});
