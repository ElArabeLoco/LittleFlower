import { describe, it, expect } from 'vitest';
import { CATEGORIES, CATEGORY_MAP, getCategoryName, getCategoryEmoji } from './categories';

describe('CATEGORIES', () => {
  it('has exactly 20 items', () => {
    expect(CATEGORIES).toHaveLength(20);
  });

  it('each category has all required fields: id, name, icon, color, emoji', () => {
    for (const cat of CATEGORIES) {
      expect(cat).toHaveProperty('id');
      expect(cat).toHaveProperty('name');
      expect(cat).toHaveProperty('icon');
      expect(cat).toHaveProperty('color');
      expect(cat).toHaveProperty('emoji');
      expect(cat.id).toBeTruthy();
      expect(cat.name).toBeTruthy();
      expect(cat.icon).toBeTruthy();
      expect(cat.color).toBeTruthy();
      expect(cat.emoji).toBeTruthy();
    }
  });

  it('all category IDs are unique', () => {
    const ids = CATEGORIES.map(c => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('CATEGORY_MAP', () => {
  it('has an entry for every category', () => {
    for (const cat of CATEGORIES) {
      expect(CATEGORY_MAP.has(cat.id)).toBe(true);
      expect(CATEGORY_MAP.get(cat.id)).toBe(cat);
    }
  });
});

describe('getCategoryName', () => {
  it('returns the correct name for a known id', () => {
    expect(getCategoryName('housing')).toBe('Vivienda');
  });

  it('returns "Otro" for an unknown id', () => {
    expect(getCategoryName('non-existent-category')).toBe('Otro');
  });
});

describe('getCategoryEmoji', () => {
  it('returns the correct emoji for a known id', () => {
    expect(getCategoryEmoji('housing')).toBe('🏠');
  });

  it('returns "•" for an unknown id', () => {
    expect(getCategoryEmoji('non-existent-category')).toBe('•');
  });
});
