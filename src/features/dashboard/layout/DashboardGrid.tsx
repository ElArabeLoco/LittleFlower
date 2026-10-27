import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import {
  WIDGET_IDS,
  WIDGET_WIDTHS,
  type LayoutItem,
  type WidgetId,
  type WidgetWidth,
} from '@/domain/dashboard/dashboardLayout';
import { useI18n } from '@/shared/i18n/useI18n';
import { cn } from '@/shared/ui/cn';
import { ChartCard } from '../shared';
import { WidgetSlotProvider } from './useWidgetSlot';
import type { DashboardEditor } from './useDashboardEditor';
import './dashboardLayout.css';

const GRIP_DOTS = [0, 1, 2, 3, 4, 5];

/** The widgets of the user's layout on one 6-track grid, with edit controls in edit mode. */
export function DashboardGrid({ editor, renderWidget, titleOf }: {
  editor: DashboardEditor;
  renderWidget: (id: WidgetId) => ReactNode;
  titleOf: (id: WidgetId) => string;
}) {
  const { t } = useI18n();
  const copy = t.dashboardLayout;
  const available = WIDGET_IDS.length - editor.layout.length;

  return (
    <>
      {!editor.editing && editor.layout.length === 0 && (
        <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-10 text-center">
          <p className="text-base font-extrabold text-[var(--text-primary)]">{copy.emptyTitle}</p>
          <p className="text-sm text-[var(--text-secondary)]">{copy.emptyText}</p>
          <button type="button" className="dash-key dash-key-primary mt-1" onClick={editor.openCatalog}>
            {copy.openCatalog}
          </button>
        </div>
      )}

      <div ref={editor.gridRef} className="dash-grid">
        {editor.layout.map(item => (
          <WidgetSlotView
            key={item.id}
            item={item}
            title={titleOf(item.id)}
            editor={editor}
          >
            {renderWidget(item.id)}
          </WidgetSlotView>
        ))}

        {editor.editing && (
          <button type="button" className="dash-well dash-add" onClick={editor.openCatalog}>
            <span className="dash-knob" aria-hidden="true">
              <Plus size={20} strokeWidth={2.4} />
            </span>
            <span className="text-sm font-extrabold">{copy.addWidget}</span>
            <span className="text-xs text-[var(--text-secondary)]">{copy.available(available)}</span>
          </button>
        )}
      </div>

      <span className="sr-only" role="status" aria-live="polite">{editor.live}</span>
    </>
  );
}

function WidgetSlotView({ item, title, editor, children }: {
  item: LayoutItem;
  title: string;
  editor: DashboardEditor;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const hasCard = useRendersCard(ref);
  const lifted = editor.dragId === item.id;
  const controls = editor.editing ? (
    <WidgetControls
      title={title}
      width={item.width}
      lifted={lifted}
      onGrab={event => editor.grab(item.id, event)}
      onNudge={event => editor.nudge(item.id, event)}
      onWidth={width => editor.setWidth(item.id, width)}
      onRemove={() => editor.remove(item.id)}
    />
  ) : null;

  return (
    <div
      ref={ref}
      className={cn('dash-slot', lifted && 'is-dragging')}
      data-widget-id={item.id}
      data-width={item.width}
      // A widget with nothing to show takes no room outside edit mode.
      hidden={!hasCard && !editor.editing}
    >
      <div className="dash-hole" aria-hidden="true">{t.dashboardLayout.dropHere}</div>
      <div className="dash-halo" aria-hidden="true" />
      <WidgetSlotProvider value={{ editing: editor.editing, lifted, controls }}>
        {children}
        {editor.editing && !hasCard && (
          <ChartCard title={title} subtitle={t.dashboardLayout.noDataNow} className="dash-ghost">
            {null}
          </ChartCard>
        )}
      </WidgetSlotProvider>
    </div>
  );
}

/** Whether the widget rendered a card: some widgets render nothing until they have data. */
function useRendersCard(ref: React.RefObject<HTMLDivElement | null>): boolean {
  const [hasCard, setHasCard] = useState(true);
  useLayoutEffect(() => {
    const slot = ref.current;
    if (!slot) return;
    const check = () => setHasCard(slot.querySelector('.dash-card:not(.dash-ghost)') !== null);
    check();
    const observer = new MutationObserver(check);
    observer.observe(slot, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ref]);
  return hasCard;
}

function WidgetControls({ title, width, lifted, onGrab, onNudge, onWidth, onRemove }: {
  title: string;
  width: WidgetWidth;
  lifted: boolean;
  onGrab: (event: React.PointerEvent<HTMLElement>) => void;
  onNudge: (event: React.KeyboardEvent<HTMLElement>) => void;
  onWidth: (width: WidgetWidth) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const copy = t.dashboardLayout;
  return (
    <div className="dash-controls mb-3.5 flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={cn('dash-key dash-key-small dash-grab', lifted && 'is-pressed')}
        aria-label={copy.moveLabel(title)}
        onPointerDown={onGrab}
        onKeyDown={onNudge}
      >
        <span className="dash-grip" aria-hidden="true">
          {GRIP_DOTS.map(dot => <span key={dot} />)}
        </span>
        {lifted ? copy.moving : copy.move}
      </button>
      <span className="flex-1" />
      <div className="dash-track dash-widths" role="group" aria-label={copy.widthGroup(title)}>
        {WIDGET_WIDTHS.map(option => (
          <button
            key={option}
            type="button"
            className="dash-notch"
            aria-pressed={width === option}
            aria-label={`${copy.widths[option]}: ${copy.widthNames[option]}`}
            onClick={() => onWidth(option)}
          >
            {copy.widths[option]}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="dash-key dash-key-small dash-key-danger"
        aria-label={copy.removeLabel(title)}
        onClick={onRemove}
      >
        {copy.remove}
      </button>
    </div>
  );
}
