import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAYOUT,
  WIDGET_IDS,
  addWidget,
  availableWidgets,
  defaultWidth,
  moveWidget,
  parseLayout,
  removeWidget,
  sameLayout,
  serializeLayout,
  setWidgetWidth,
  widgetSpan,
  type DashboardLayout,
} from './dashboardLayout';

const ids = (layout: DashboardLayout) => layout.map(item => item.id);

describe('DEFAULT_LAYOUT', () => {
  it('holds every catalog widget once, in catalog order', () => {
    expect(ids(DEFAULT_LAYOUT)).toEqual([...WIDGET_IDS]);
  });

  it("reproduces today's rows: full KPIs, a row of three budget burn-ups, full lists", () => {
    const width = Object.fromEntries(DEFAULT_LAYOUT.map(item => [item.id, item.width]));
    expect(width.kpis).toBe('full');
    expect([width.burnDelivery, width.burnGroceries, width.burnHealth]).toEqual(['third', 'third', 'third']);
    expect([width.pending, width.topBudgets, width.recent, width.incomeHistory]).toEqual(['full', 'full', 'full', 'full']);
    expect(width.trend).toBe('half');
    expect(width.histHealth).toBe('half');
  });
});

describe('widgetSpan', () => {
  it('maps widths onto a 6-track grid', () => {
    expect(widgetSpan('third')).toBe(2);
    expect(widgetSpan('half')).toBe(3);
    expect(widgetSpan('full')).toBe(6);
  });
});

describe('parseLayout', () => {
  it('falls back to the default layout when there is no saved layout', () => {
    expect(parseLayout(null)).toBe(DEFAULT_LAYOUT);
    expect(parseLayout(undefined)).toBe(DEFAULT_LAYOUT);
    expect(parseLayout('')).toBe(DEFAULT_LAYOUT);
  });

  it('falls back to the default layout when the JSON is broken or has another shape', () => {
    expect(parseLayout('{not json')).toBe(DEFAULT_LAYOUT);
    expect(parseLayout('{"v":1}')).toBe(DEFAULT_LAYOUT);
    expect(parseLayout('[1,2]')).toBe(DEFAULT_LAYOUT);
  });

  it('keeps an empty layout: the user removed every widget', () => {
    expect(parseLayout('{"v":1,"items":[]}')).toEqual([]);
  });

  it('drops unknown widgets and keeps the first copy of a repeated one', () => {
    const json = JSON.stringify({
      v: 1,
      items: [
        { id: 'trend', width: 'full' },
        { id: 'retired-widget', width: 'half' },
        { id: 'trend', width: 'third' },
        { id: 'kpis', width: 'full' },
      ],
    });
    expect(parseLayout(json)).toEqual([
      { id: 'trend', width: 'full' },
      { id: 'kpis', width: 'full' },
    ]);
  });

  it("falls back to the widget's default width when the saved width is invalid", () => {
    const json = JSON.stringify({ v: 1, items: [{ id: 'burnHealth', width: 'quarter' }, { id: 'trend' }] });
    expect(parseLayout(json)).toEqual([
      { id: 'burnHealth', width: 'third' },
      { id: 'trend', width: 'half' },
    ]);
  });

  it('round-trips through serializeLayout', () => {
    const layout: DashboardLayout = [
      { id: 'recent', width: 'third' },
      { id: 'kpis', width: 'full' },
    ];
    expect(parseLayout(serializeLayout(layout))).toEqual(layout);
  });
});

describe('moveWidget', () => {
  const layout: DashboardLayout = [
    { id: 'kpis', width: 'full' },
    { id: 'trend', width: 'half' },
    { id: 'balance', width: 'half' },
    { id: 'recent', width: 'full' },
  ];

  it('moves a widget forward and backward', () => {
    expect(ids(moveWidget(layout, 0, 2))).toEqual(['trend', 'balance', 'kpis', 'recent']);
    expect(ids(moveWidget(layout, 3, 1))).toEqual(['kpis', 'recent', 'trend', 'balance']);
  });

  it('returns the same layout for a no-op or an index out of range', () => {
    expect(moveWidget(layout, 1, 1)).toBe(layout);
    expect(moveWidget(layout, -1, 2)).toBe(layout);
    expect(moveWidget(layout, 1, 4)).toBe(layout);
  });

  it('does not mutate the input', () => {
    moveWidget(layout, 0, 3);
    expect(ids(layout)).toEqual(['kpis', 'trend', 'balance', 'recent']);
  });
});

describe('removeWidget / addWidget / availableWidgets', () => {
  it('removes a widget and offers it back in the catalog', () => {
    const layout = removeWidget(DEFAULT_LAYOUT, 'byPayment');
    expect(ids(layout)).not.toContain('byPayment');
    expect(availableWidgets(layout)).toEqual(['byPayment']);
  });

  it('appends an added widget at the end with its default width', () => {
    const layout = addWidget(removeWidget(DEFAULT_LAYOUT, 'burnGroceries'), 'burnGroceries');
    expect(layout[layout.length - 1]).toEqual({ id: 'burnGroceries', width: 'third' });
  });

  it('never adds a widget twice', () => {
    expect(addWidget(DEFAULT_LAYOUT, 'kpis')).toBe(DEFAULT_LAYOUT);
  });

  it('lists available widgets in catalog order', () => {
    const layout = removeWidget(removeWidget(DEFAULT_LAYOUT, 'histHealth'), 'kpis');
    expect(availableWidgets(layout)).toEqual(['kpis', 'histHealth']);
  });
});

describe('setWidgetWidth', () => {
  it('changes only the chosen widget', () => {
    const layout = setWidgetWidth(DEFAULT_LAYOUT, 'trend', 'full');
    expect(layout.find(item => item.id === 'trend')?.width).toBe('full');
    expect(layout.find(item => item.id === 'balance')?.width).toBe(defaultWidth('balance'));
  });

  it('returns the same layout when nothing changes', () => {
    expect(setWidgetWidth(DEFAULT_LAYOUT, 'trend', 'half')).toBe(DEFAULT_LAYOUT);
  });
});

describe('sameLayout', () => {
  it('compares order and widths', () => {
    expect(sameLayout(DEFAULT_LAYOUT, parseLayout(serializeLayout(DEFAULT_LAYOUT)))).toBe(true);
    expect(sameLayout(DEFAULT_LAYOUT, moveWidget(DEFAULT_LAYOUT, 0, 1))).toBe(false);
    expect(sameLayout(DEFAULT_LAYOUT, setWidgetWidth(DEFAULT_LAYOUT, 'kpis', 'half'))).toBe(false);
  });
});
