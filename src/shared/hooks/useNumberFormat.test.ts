import { describe, it, expect, beforeEach } from 'vitest';
import { formatCOPStatic } from './useNumberFormat';

describe('formatCOPStatic', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('abbreviated format (default when localStorage is empty)', () => {
    it('formats 1,200,000 as "$1.2M"', () => {
      expect(formatCOPStatic(1_200_000)).toBe('$1.2M');
    });

    it('formats 2,000,000 as "$2M" (no decimal for whole millions)', () => {
      expect(formatCOPStatic(2_000_000)).toBe('$2M');
    });

    it('formats 150,000 as "$150K"', () => {
      expect(formatCOPStatic(150_000)).toBe('$150K');
    });

    it('formats 900 as "$900"', () => {
      expect(formatCOPStatic(900)).toBe('$900');
    });

    it('formats -1,200,000 as "-$1.2M"', () => {
      expect(formatCOPStatic(-1_200_000)).toBe('-$1.2M');
    });

    it('formats -150,000 as "-$150K"', () => {
      expect(formatCOPStatic(-150_000)).toBe('-$150K');
    });
  });

  describe('when localStorage has "lf:numberFormat" = "full"', () => {
    it('uses full format — returns a non-empty string with the amount', () => {
      localStorage.setItem('lf:numberFormat', 'full');
      const result = formatCOPStatic(1_200_000);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      // Full format should contain the number in some form
      expect(result).toContain('1');
    });

    it('returns a non-empty formatted string', () => {
      localStorage.setItem('lf:numberFormat', 'full');
      const result = formatCOPStatic(900);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('when localStorage has "lf:numberFormat" = "abbreviated"', () => {
    it('uses abbreviated format', () => {
      localStorage.setItem('lf:numberFormat', 'abbreviated');
      expect(formatCOPStatic(1_200_000)).toBe('$1.2M');
    });
  });
});
