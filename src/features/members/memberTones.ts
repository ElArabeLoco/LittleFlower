/**
 * Tailwind classes of each member tone.
 *
 * Static strings on purpose: Tailwind finds classes by scanning the source,
 * so they must never be built by concatenation. Every pair keeps text above
 * 4.5:1 on its own soft background in light and dark.
 */

import type { MemberTone } from '@/domain/member/HouseholdMember';

export interface MemberToneClasses {
  /** Avatar and selected-chip background + text. */
  soft: string;
  /** Strong text (selected chip, selected label). */
  strongText: string;
  /** Strong border (selected chip). */
  strongBorder: string;
  /** Strong ring (selected tone swatch). */
  strongRing: string;
  /** Solid circle (selected chip marker) and its check mark. */
  solid: string;
}

export const MEMBER_TONE_CLASSES: Record<MemberTone, MemberToneClasses> = {
  petal: {
    soft: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
    strongText: 'text-pink-700 dark:text-pink-300',
    strongBorder: 'border-pink-700 dark:border-pink-300',
    strongRing: 'ring-pink-700 dark:ring-pink-300',
    solid: 'bg-pink-700 text-white dark:bg-pink-300 dark:text-gray-950',
  },
  iris: {
    soft: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    strongText: 'text-violet-700 dark:text-violet-300',
    strongBorder: 'border-violet-700 dark:border-violet-300',
    strongRing: 'ring-violet-700 dark:ring-violet-300',
    solid: 'bg-violet-700 text-white dark:bg-violet-300 dark:text-gray-950',
  },
  leaf: {
    soft: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    strongText: 'text-green-700 dark:text-green-300',
    strongBorder: 'border-green-700 dark:border-green-300',
    strongRing: 'ring-green-700 dark:ring-green-300',
    solid: 'bg-green-700 text-white dark:bg-green-300 dark:text-gray-950',
  },
  polen: {
    soft: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    strongText: 'text-amber-700 dark:text-amber-300',
    strongBorder: 'border-amber-700 dark:border-amber-300',
    strongRing: 'ring-amber-700 dark:ring-amber-300',
    solid: 'bg-amber-700 text-white dark:bg-amber-300 dark:text-gray-950',
  },
  sky: {
    soft: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    strongText: 'text-sky-700 dark:text-sky-300',
    strongBorder: 'border-sky-700 dark:border-sky-300',
    strongRing: 'ring-sky-700 dark:ring-sky-300',
    solid: 'bg-sky-700 text-white dark:bg-sky-300 dark:text-gray-950',
  },
  mist: {
    soft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
    strongText: 'text-gray-700 dark:text-gray-200',
    strongBorder: 'border-gray-700 dark:border-gray-200',
    strongRing: 'ring-gray-700 dark:ring-gray-200',
    solid: 'bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-950',
  },
};
