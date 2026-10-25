import { describe, expect, it } from 'vitest';
import { SETTLE_MS, pickTarget, settleFrames, spring } from './gridMotion';

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

describe('spring', () => {
  it('starts at 0 and is at rest by the end of the settle', () => {
    expect(spring(0)).toBe(0);
    expect(spring(SETTLE_MS / 1000)).toBeCloseTo(1, 2);
  });

  it('overshoots slightly before resting, so the card lands with a light bounce', () => {
    const peak = Math.max(...Array.from({ length: 60 }, (_, i) => spring(i / 100)));
    expect(peak).toBeGreaterThan(1.02);
    expect(peak).toBeLessThan(1.08);
  });
});

describe('settleFrames', () => {
  const from = { x: 300, y: 120, w: 400, h: 260, rot: 2, scale: 1.035, gx: 20, gy: 18 };
  const last = rect(100, 400, 400, 300);

  it('starts exactly where the hand left the card', () => {
    const [first] = settleFrames(from, last);
    expect(first.offset).toBe(0);
    expect(first.transform).toBe('translate(200.00px, -280.00px) rotate(2.000deg) scale(1.0350)');
    expect(first.width).toBe('400.00px');
    expect(first.height).toBe('260.00px');
  });

  it('ends at rest in the slot, at the slot size', () => {
    const frames = settleFrames(from, last);
    const end = frames[frames.length - 1];
    expect(end.offset).toBe(1);
    expect(end.transform).toBe('translate(0.00px, 0.00px) rotate(0.000deg) scale(1.0000)');
    expect(end.height).toBe('300.00px');
  });
});

describe('pickTarget', () => {
  const slots = [
    { id: 'kpis', rect: rect(0, 0, 1200, 100) },
    { id: 'trend', rect: rect(0, 120, 590, 300) },
    { id: 'balance', rect: rect(610, 120, 590, 300) },
  ];

  it('returns the slot under the point', () => {
    expect(pickTarget(700, 200, slots, 'kpis', null)).toBe('balance');
  });

  it('ignores the dragged widget and the one it just displaced', () => {
    expect(pickTarget(100, 50, slots, 'kpis', null)).toBeNull();
    expect(pickTarget(700, 200, slots, 'kpis', 'balance')).toBeNull();
  });

  it('returns null in the gap between slots', () => {
    expect(pickTarget(600, 200, slots, 'kpis', null)).toBeNull();
  });
});
