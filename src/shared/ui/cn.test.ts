import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins multiple class strings', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('ignores falsy values (undefined, false, null)', () => {
    expect(cn('foo', undefined, false, null, 'bar')).toBe('foo bar');
  });

  it('handles conditional class objects', () => {
    expect(cn({ 'active': true, 'disabled': false })).toBe('active');
  });

  it('handles arrays of classes', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });

  it('resolves Tailwind conflicts — later class wins', () => {
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });

  it('handles empty input — returns empty string', () => {
    expect(cn()).toBe('');
  });
});
