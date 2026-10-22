/**
 * FlowerMark — the Florecita sakura: five notched pink petals, deep at the
 * heart and pale at the tips, around violet stamens.
 *
 * Decorative: it never carries meaning on its own, so it is hidden from
 * assistive technology. Petal colors are fixed brand colors; only the thin
 * petal edge follows the theme (`--flower-edge`) so it melts into the page.
 *
 * `bloom` plays the one-time opening: petals unfold one after another, then
 * the stamens appear. Reduced-motion users get the open flower at once.
 */

import { useId, type SVGProps } from 'react';
import { cn } from './cn';

/** One petal pointing up from the flower's heart at (0, 0); tip at y = -54. */
export const PETAL_PATH =
  'M0 0C-10-8-22-24-22-38C-22-48-15-54-8-53C-5-52.5-2-51 0-48C2-51 5-52.5 8-53C15-54 22-48 22-38C22-24 10-8 0 0Z';

/** Petal directions, clockwise from the top. */
export const PETAL_ANGLES = [0, 72, 144, 216, 288];

/** Long stamens sit over the petals, short ones between them. */
const STAMENS = [
  ...PETAL_ANGLES.map((angle) => ({ angle, length: 13.5, r: 1.9, color: '#9A8FF4' })),
  ...PETAL_ANGLES.map((angle) => ({ angle: angle + 36, length: 10, r: 1.6, color: '#BEB7FF' })),
];

/** Shared radial fill: deep at the heart, pale at the tips. */
export function PetalGradient({ id }: { id: string }) {
  return (
    <radialGradient id={id} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="54">
      <stop offset="0" stopColor="#951B48" />
      <stop offset="0.32" stopColor="#E8538C" />
      <stop offset="1" stopColor="#FECFE0" />
    </radialGradient>
  );
}

interface FlowerMarkProps extends SVGProps<SVGSVGElement> {
  /** Play the opening animation once on mount. */
  bloom?: boolean;
}

export function FlowerMark({ bloom = false, ...props }: FlowerMarkProps) {
  const fillId = useId();

  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" {...props}>
      <defs>
        <PetalGradient id={fillId} />
      </defs>
      <g transform="translate(60 62)">
        <g
          fill={`url(#${fillId})`}
          strokeOpacity="0.6"
          strokeWidth="1.2"
          strokeLinejoin="round"
          style={{ stroke: 'var(--flower-edge)' }}
        >
          {PETAL_ANGLES.map((angle, index) =>
            bloom ? (
              // CSS transform (not the attribute) so the bloom keyframes can animate it.
              <path
                key={angle}
                d={PETAL_PATH}
                className="flower-bloom-petal"
                style={{ transform: `rotate(${angle}deg)`, animationDelay: `${index * 110}ms` }}
              />
            ) : (
              <path key={angle} d={PETAL_PATH} transform={`rotate(${angle})`} />
            ),
          )}
        </g>
        <g className={cn(bloom && 'flower-bloom-heart')}>
          {STAMENS.map(({ angle, length, r, color }) => (
            <g key={angle} transform={`rotate(${angle})`}>
              <path d={`M0-4V-${length}`} stroke="#7C6DE1" strokeWidth="1.1" strokeLinecap="round" />
              <circle cy={-(length + 1)} r={r} fill={color} />
            </g>
          ))}
          <circle r="5" fill="#6859CE" />
        </g>
      </g>
    </svg>
  );
}
