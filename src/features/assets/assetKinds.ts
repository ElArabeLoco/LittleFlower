/**
 * Icon and colors of each asset kind.
 *
 * Static class strings on purpose: Tailwind finds classes by scanning the
 * source, so they must never be built by concatenation. `soft` keeps its
 * text above 4.5:1 on its background. `solid` is the categorical palette of
 * the net worth composition bar, in ASSET_KINDS order: checked with the
 * dataviz validator (lightness band, colorblind separation of neighbours,
 * 3:1 against the card) in light and dark with the theme's own hexes. Sky
 * and violet are too close in this theme, so they are never neighbours.
 * "Other" is gray on purpose: the catch-all bucket, always labeled in words.
 * Green and red are left out: they mean assets and debts on that page.
 */

import { Building2, Car, ChartLine, Gem, PiggyBank, type LucideIcon } from 'lucide-react';
import type { AssetKind } from '@/domain/asset/Asset';

export interface AssetKindStyle {
  icon: LucideIcon;
  /** Icon tile background + icon color. */
  soft: string;
  /** Bar segments and legend dots. */
  solid: string;
}

export const ASSET_KIND_STYLES: Record<AssetKind, AssetKindStyle> = {
  savings: {
    icon: PiggyBank,
    soft: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    solid: 'bg-sky-600',
  },
  investment: {
    icon: ChartLine,
    soft: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
    solid: 'bg-pink-600',
  },
  real_estate: {
    icon: Building2,
    soft: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    solid: 'bg-violet-600 dark:bg-violet-500',
  },
  vehicle: {
    icon: Car,
    soft: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    solid: 'bg-amber-600',
  },
  other: {
    icon: Gem,
    soft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
    solid: 'bg-gray-500 dark:bg-gray-400',
  },
};
