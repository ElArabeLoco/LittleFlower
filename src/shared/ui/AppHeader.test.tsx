import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AppHeaderView } from './AppHeader';

describe('AppHeaderView', () => {
  it('puts the large title below the bar so it can scroll away', () => {
    render(<AppHeaderView title="Presupuesto" subtitle="Elige tu vista" />);

    expect(within(screen.getByRole('banner')).queryByRole('heading')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Presupuesto' })).toBeInTheDocument();
    expect(screen.getByText('Elige tu vista')).toBeInTheDocument();
  });

  it('keeps the title in the bar on compact pages', () => {
    render(<AppHeaderView title="Vista Anual" compact />);

    expect(within(screen.getByRole('banner')).getByRole('heading', { level: 1, name: 'Vista Anual' })).toBeInTheDocument();
  });
});
