import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PetalMeter, petalFills } from './PetalMeter';

describe('petalFills', () => {
  it('fills petals clockwise, a fifth of the value each', () => {
    expect(petalFills(0.7)).toEqual([1, 1, 1, 0.5, 0]);
  });

  it('leaves every petal empty at zero and fills every petal at one', () => {
    expect(petalFills(0)).toEqual([0, 0, 0, 0, 0]);
    expect(petalFills(1)).toEqual([1, 1, 1, 1, 1]);
  });

  it('clamps values outside 0..1 and treats non-numbers as empty', () => {
    expect(petalFills(1.4)).toEqual([1, 1, 1, 1, 1]);
    expect(petalFills(-0.2)).toEqual([0, 0, 0, 0, 0]);
    expect(petalFills(Number.NaN)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('PetalMeter', () => {
  it('is an image named by its label when it carries meaning', () => {
    render(<PetalMeter value={0.62} label="62% del presupuesto ejecutado" />);

    expect(screen.getByRole('img', { name: '62% del presupuesto ejecutado' })).toBeInTheDocument();
  });

  it('is hidden from assistive technology without a label', () => {
    const { container } = render(<PetalMeter value={0.4} />);

    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
