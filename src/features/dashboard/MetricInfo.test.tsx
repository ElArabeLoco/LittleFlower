import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Scale } from 'lucide-react';
import { I18nProvider } from '@/shared/i18n/I18nContext';
import { MetricInfo } from './MetricInfo';

function renderInfo() {
  return render(
    <I18nProvider>
      <MetricInfo
        label="Balance real"
        icon={Scale}
        description="Lo que de verdad le queda al hogar este mes."
        formula="Disponible − gastos pagados en efectivo"
      />
    </I18nProvider>,
  );
}

describe('MetricInfo', () => {
  beforeEach(() => {
    localStorage.setItem('lf:language', 'es');
  });

  it('is a button named after the metric it explains', () => {
    renderInfo();

    expect(screen.getByRole('button', { name: 'Qué significa Balance real' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens an overlay with what the metric means and how it is calculated', async () => {
    const user = userEvent.setup();
    renderInfo();

    await user.click(screen.getByRole('button', { name: 'Qué significa Balance real' }));

    const overlay = screen.getByRole('dialog', { name: 'Balance real' });
    expect(overlay).toHaveTextContent('Lo que de verdad le queda al hogar este mes.');
    expect(overlay).toHaveTextContent('Cómo se calcula');
    expect(overlay).toHaveTextContent('Disponible − gastos pagados en efectivo');
  });

  it('closes with Escape', async () => {
    const user = userEvent.setup();
    renderInfo();

    await user.click(screen.getByRole('button', { name: 'Qué significa Balance real' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
