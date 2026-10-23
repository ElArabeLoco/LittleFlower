/**
 * Geometry of the Florecita flower, shared by FlowerMark and PetalMeter.
 * The viewBox is 120×120 with the flower's heart translated to (60, 62).
 */

/** One petal pointing up from the flower's heart at (0, 0); tip at y = -54. */
export const PETAL_PATH =
  'M0 0C-10-8-22-24-22-38C-22-48-15-54-8-53C-5-52.5-2-51 0-48C2-51 5-52.5 8-53C15-54 22-48 22-38C22-24 10-8 0 0Z';

/** Petal tip distance from the heart, in viewBox units. */
export const PETAL_LENGTH = 54;

/** Petal directions, clockwise from the top. */
export const PETAL_ANGLES = [0, 72, 144, 216, 288];

/** How full each petal is (0..1), clockwise from the top: a fifth of the value each. */
export function petalFills(value: number): number[] {
  const safe = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  return PETAL_ANGLES.map((_, index) => {
    // Round away float noise (0.7 * 5 - 3 = 0.5000000000000004).
    const fill = Math.round((safe * PETAL_ANGLES.length - index) * 1000) / 1000;
    return Math.min(1, Math.max(0, fill));
  });
}
