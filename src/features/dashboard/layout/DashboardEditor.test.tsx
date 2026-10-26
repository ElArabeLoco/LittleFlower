import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@/shared/i18n/I18nContext';
import { DEFAULT_LAYOUT, type DashboardLayout, type WidgetId } from '@/domain/dashboard/dashboardLayout';
import { ChartCard } from '../shared';
import { useDashboardEditor } from './useDashboardEditor';
import { DashboardGrid } from './DashboardGrid';
import { WidgetCatalog } from './WidgetCatalog';
import { EditActions, EditHint, UndoToast } from './EditBar';

const TITLES: Partial<Record<WidgetId, string>> = {
  kpis: 'Resumen del mes',
  trend: 'Tendencia',
  balance: 'Balance real mes a mes',
  recent: 'Gastos recientes',
};
const titleOf = (id: WidgetId) => TITLES[id] ?? id;

function Harness({ saved, save, empty = [] }: {
  saved: DashboardLayout;
  save: (layout: DashboardLayout) => Promise<void>;
  empty?: WidgetId[];
}) {
  const editor = useDashboardEditor({ saved, save, titleOf });
  return (
    <>
      <EditActions editor={editor} />
      {editor.editing && <EditHint editor={editor} />}
      <DashboardGrid
        editor={editor}
        titleOf={titleOf}
        renderWidget={id =>
          empty.includes(id) ? null : (
            <ChartCard title={titleOf(id)}>
              <p>Contenido de {titleOf(id)}</p>
            </ChartCard>
          )
        }
      />
      <WidgetCatalog editor={editor} titleOf={titleOf} subtitleOf={() => 'Descripción'} accentOf={() => '#f472b6'} />
      <UndoToast editor={editor} />
    </>
  );
}

const LAYOUT: DashboardLayout = [
  { id: 'kpis', width: 'full' },
  { id: 'trend', width: 'half' },
  { id: 'recent', width: 'full' },
];

function setup(saved: DashboardLayout = LAYOUT, empty: WidgetId[] = []) {
  const save = vi.fn<(layout: DashboardLayout) => Promise<void>>().mockResolvedValue(undefined);
  const view = render(
    <I18nProvider>
      <Harness saved={saved} save={save} empty={empty} />
    </I18nProvider>,
  );
  return { save, user: userEvent.setup(), ...view };
}

const slotIds = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('.dash-slot')).map(slot => slot.dataset.widgetId);

const lastSaved = (save: ReturnType<typeof setup>['save']) => save.mock.calls[save.mock.calls.length - 1][0];

describe('configurable dashboard editor', () => {
  beforeEach(() => {
    localStorage.setItem('lf:language', 'es');
  });

  it('shows widgets without controls until «Personalizar»', async () => {
    const { user } = setup();
    expect(screen.queryByRole('button', { name: /^Quitar/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Personalizar' }));

    expect(screen.getByRole('button', { name: 'Quitar Tendencia' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Mover Tendencia/ })).toBeInTheDocument();
    expect(screen.getByText('Editando')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Listo' })).toBeInTheDocument();
  });

  it('changes a widget width and saves it', async () => {
    const { user, container, save } = setup();
    await user.click(screen.getByRole('button', { name: 'Personalizar' }));

    const widths = screen.getByRole('group', { name: 'Ancho de Tendencia' });
    await user.click(within(widths).getByRole('button', { name: '1/3: un tercio del ancho' }));

    expect(within(widths).getByRole('button', { name: '1/3: un tercio del ancho' })).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('[data-widget-id="trend"]')).toHaveAttribute('data-width', 'third');
    expect(lastSaved(save)).toContainEqual({ id: 'trend', width: 'third' });
  });

  it('removes a widget and brings it back with «Deshacer»', async () => {
    const { user, container, save } = setup();
    await user.click(screen.getByRole('button', { name: 'Personalizar' }));

    await user.click(screen.getByRole('button', { name: 'Quitar Tendencia' }));

    expect(slotIds(container)).toEqual(['kpis', 'recent']);
    expect(screen.getByText('Quitaste «Tendencia».')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Deshacer' }));

    expect(slotIds(container)).toEqual(['kpis', 'trend', 'recent']);
    expect(lastSaved(save)).toEqual(LAYOUT);
    expect(screen.queryByText('Quitaste «Tendencia».')).toBeNull();
  });

  it('adds a widget from the catalog at the end', async () => {
    const { user, container, save } = setup();
    await user.click(screen.getByRole('button', { name: 'Personalizar' }));
    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    const catalog = screen.getByRole('dialog', { name: 'Catálogo de widgets' });
    expect(within(catalog).getByText('3 de 22 en Gráficas')).toBeInTheDocument();
    await user.click(within(catalog).getByRole('button', { name: 'Agregar Balance real mes a mes' }));

    expect(slotIds(container)).toEqual(['kpis', 'trend', 'recent', 'balance']);
    expect(lastSaved(save)[3]).toEqual({ id: 'balance', width: 'half' });
    expect(within(catalog).getByText('4 de 22 en Gráficas')).toBeInTheDocument();
    expect(within(catalog).queryByRole('button', { name: 'Agregar Balance real mes a mes' })).toBeNull();
  });

  it('moves a widget with the arrow keys and announces where it landed', async () => {
    const { user, container, save } = setup();
    await user.click(screen.getByRole('button', { name: 'Personalizar' }));

    screen.getByRole('button', { name: /^Mover Resumen del mes/ }).focus();
    await user.keyboard('{ArrowDown}');

    expect(slotIds(container)).toEqual(['trend', 'kpis', 'recent']);
    expect(lastSaved(save).map(item => item.id)).toEqual(['trend', 'kpis', 'recent']);
    expect(screen.getByText('«Resumen del mes» quedó en la posición 2 de 3.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Mover Resumen del mes/ })).toHaveFocus();
  });

  it('resets to the original layout with «Restablecer»', async () => {
    const { user, container, save } = setup();
    await user.click(screen.getByRole('button', { name: 'Personalizar' }));

    await user.click(screen.getByRole('button', { name: 'Restablecer' }));

    expect(slotIds(container)).toHaveLength(DEFAULT_LAYOUT.length);
    expect(lastSaved(save)).toEqual(DEFAULT_LAYOUT);
    expect(screen.getByText('Volviste al diseño original.')).toBeInTheDocument();
  });

  it('hides a widget with no data, and shows a placeholder for it in edit mode', async () => {
    const { user, container } = setup(LAYOUT, ['trend']);
    expect(container.querySelector('[data-widget-id="trend"]')).not.toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Personalizar' }));

    const slot = container.querySelector<HTMLElement>('[data-widget-id="trend"]')!;
    expect(slot).toBeVisible();
    expect(within(slot).getByText('Sin datos por ahora. Igual lo puedes mover o quitar.')).toBeInTheDocument();
    expect(within(slot).getByRole('button', { name: 'Quitar Tendencia' })).toBeInTheDocument();
  });

  it('offers the catalog when every widget was removed', async () => {
    const { user } = setup([]);
    expect(screen.getByText('No hay widgets en Gráficas')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Abrir catálogo' }));

    expect(screen.getByRole('dialog', { name: 'Catálogo de widgets' })).toBeInTheDocument();
  });

  it('adopts a layout saved on another device', () => {
    const save = vi.fn<(layout: DashboardLayout) => Promise<void>>().mockResolvedValue(undefined);
    const { container, rerender } = render(
      <I18nProvider>
        <Harness saved={LAYOUT} save={save} />
      </I18nProvider>,
    );
    act(() => {
      rerender(
        <I18nProvider>
          <Harness saved={[{ id: 'recent', width: 'full' }]} save={save} />
        </I18nProvider>,
      );
    });
    expect(slotIds(container)).toEqual(['recent']);
    expect(save).not.toHaveBeenCalled();
  });
});
