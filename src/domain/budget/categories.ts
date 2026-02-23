/**
 * Hardcoded category list — MVP.
 * No CRUD UI. Categories are used for sorting and filtering in the spreadsheet.
 * Phase 2: full category management per household.
 */

export interface Category {
  id: string;
  name: string;
  icon: string; // Lucide icon name
  color: string;
  emoji: string;
}

export const CATEGORIES: Category[] = [
  { id: 'housing',       name: 'Vivienda',         icon: 'home',          color: '#f9a8d4', emoji: '🏠' },
  { id: 'food',          name: 'Alimentación',      icon: 'shopping-cart', color: '#86efac', emoji: '🛒' },
  { id: 'transport',     name: 'Transporte',        icon: 'car',           color: '#93c5fd', emoji: '🚗' },
  { id: 'health',        name: 'Salud',             icon: 'heart-pulse',   color: '#f87171', emoji: '❤️‍🩹' },
  { id: 'education',     name: 'Educación',         icon: 'graduation-cap',color: '#a78bfa', emoji: '🎓' },
  { id: 'utilities',     name: 'Servicios',         icon: 'zap',           color: '#fcd34d', emoji: '⚡' },
  { id: 'entertainment', name: 'Entretenimiento',   icon: 'tv',            color: '#fb923c', emoji: '🎬' },
  { id: 'clothing',      name: 'Ropa',              icon: 'shirt',         color: '#e879f9', emoji: '👕' },
  { id: 'personal',      name: 'Personal',          icon: 'user',          color: '#94a3b8', emoji: '🧴' },
  { id: 'savings',       name: 'Ahorro',            icon: 'piggy-bank',    color: '#34d399', emoji: '🐷' },
  { id: 'debt',          name: 'Deudas',            icon: 'credit-card',   color: '#f472b6', emoji: '💳' },
  { id: 'taxes',         name: 'Impuestos',         icon: 'landmark',      color: '#64748b', emoji: '🏛️' },
  { id: 'gifts',         name: 'Regalos',           icon: 'gift',          color: '#c084fc', emoji: '🎁' },
  { id: 'pets',          name: 'Mascotas',          icon: 'paw-print',     color: '#a3e635', emoji: '🐾' },
  { id: 'travel',        name: 'Viajes',            icon: 'plane',         color: '#38bdf8', emoji: '✈️' },
  { id: 'other',         name: 'Otro',              icon: 'circle-dot',    color: '#cbd5e1', emoji: '•' },
];

export const CATEGORY_MAP = new Map(CATEGORIES.map(c => [c.id, c]));

export function getCategoryName(id: string): string {
  return CATEGORY_MAP.get(id)?.name ?? 'Otro';
}

export function getCategoryEmoji(id: string): string {
  return CATEGORY_MAP.get(id)?.emoji ?? '•';
}
