/**
 * PetalMeter — progress drawn as the Florecita flower: each of the five petals
 * is a fifth of the value, filled clockwise from the top, and a partly filled
 * petal fills from the heart outward.
 *
 * Always pair it with the value in words (a label next to it, or `label` for
 * screen readers): the flower alone is an approximation.
 *
 * Usage:
 *   <PetalMeter value={0.7} label="70% del presupuesto ejecutado" className="size-40" />
 */

import { useId } from 'react';
import { PetalGradient } from './FlowerMark';
import { PETAL_ANGLES, PETAL_LENGTH, PETAL_PATH, petalFills } from './flowerGeometry';

interface PetalMeterProps {
  /** Progress from 0 to 1; values outside are clamped. */
  value: number;
  /** Accessible name. Without it the meter is decorative. */
  label?: string;
  className?: string;
}

export function PetalMeter({ value, label, className }: PetalMeterProps) {
  const id = useId();
  const fillId = `${id}-fill`;
  const fills = petalFills(value);

  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      focusable="false"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <defs>
        <PetalGradient id={fillId} />
        {fills.map((fill, index) =>
          fill > 0 && fill < 1 ? (
            <clipPath key={index} id={`${id}-clip-${index}`}>
              {/* Grows from the heart (y = 0) toward the tip (y = -54). */}
              <rect x="-30" y={-PETAL_LENGTH * fill} width="60" height={PETAL_LENGTH * fill + 4} />
            </clipPath>
          ) : null,
        )}
      </defs>
      <g transform="translate(60 62)" strokeLinejoin="round">
        {PETAL_ANGLES.map((angle, index) => {
          const fill = fills[index];
          return (
            <g key={angle} transform={`rotate(${angle})`}>
              {fill < 1 && (
                <path
                  d={PETAL_PATH}
                  strokeWidth="1.2"
                  style={{ fill: 'var(--bg-surface-2)', stroke: 'var(--border-medium)' }}
                />
              )}
              {fill > 0 && (
                <path
                  d={PETAL_PATH}
                  fill={`url(#${fillId})`}
                  strokeWidth="1.4"
                  clipPath={fill < 1 ? `url(#${id}-clip-${index})` : undefined}
                  style={{ stroke: 'var(--flower-edge)' }}
                />
              )}
            </g>
          );
        })}
        <circle r="8" fill="#6859CE" strokeWidth="2.5" style={{ stroke: 'var(--bg-surface)' }} />
      </g>
    </svg>
  );
}
