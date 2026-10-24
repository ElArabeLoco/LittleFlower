/**
 * Dashboard layout — which widgets a user sees, in what order and how wide.
 *
 * The catalog is fixed: today's dashboard widgets, each at most once. A layout
 * is an ordered list of { id, width } laid on one 6-track grid, so thirds,
 * halves and full rows mix freely. No saved layout means DEFAULT_LAYOUT, which
 * reproduces the dashboard's original rows.
 */

/** Catalog order: the order of the original dashboard and of the catalog list. */
export const WIDGET_IDS = [
  'kpis',
  'trend',
  'balance',
  'byCategory',
  'byPayment',
  'dailyDelivery',
  'dailyGroceries',
  'burnDelivery',
  'burnGroceries',
  'burnHealth',
  'burnCard',
  'burnCash',
  'pending',
  'topBudgets',
  'recent',
  'debtProgress',
  'debtEvolution',
  'incomeHistory',
  'histDelivery',
  'histGroceries',
  'histFiados',
  'histHealth',
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export type WidgetWidth = 'third' | 'half' | 'full';

export const WIDGET_WIDTHS: readonly WidgetWidth[] = ['third', 'half', 'full'];

export interface LayoutItem {
  id: WidgetId;
  width: WidgetWidth;
}

export type DashboardLayout = readonly LayoutItem[];

export type WidgetGroup = 'summary' | 'month' | 'burnUp' | 'debts' | 'history';

export const WIDGET_GROUPS: readonly WidgetGroup[] = ['summary', 'month', 'burnUp', 'debts', 'history'];

export const WIDGET_GROUP: Record<WidgetId, WidgetGroup> = {
  kpis: 'summary',
  trend: 'summary',
  balance: 'summary',
  byCategory: 'month',
  byPayment: 'month',
  dailyDelivery: 'month',
  dailyGroceries: 'month',
  pending: 'month',
  topBudgets: 'month',
  recent: 'month',
  burnDelivery: 'burnUp',
  burnGroceries: 'burnUp',
  burnHealth: 'burnUp',
  burnCard: 'burnUp',
  burnCash: 'burnUp',
  debtProgress: 'debts',
  debtEvolution: 'debts',
  incomeHistory: 'history',
  histDelivery: 'history',
  histGroceries: 'history',
  histFiados: 'history',
  histHealth: 'history',
};

const SPAN: Record<WidgetWidth, number> = { third: 2, half: 3, full: 6 };

/** Grid columns a width takes on the 6-track desktop grid. */
export function widgetSpan(width: WidgetWidth): number {
  return SPAN[width];
}

// The original rows: halves, one row of three budget burn-ups, full-width lists.
const DEFAULT_WIDTH: Partial<Record<WidgetId, WidgetWidth>> = {
  kpis: 'full',
  burnDelivery: 'third',
  burnGroceries: 'third',
  burnHealth: 'third',
  pending: 'full',
  topBudgets: 'full',
  recent: 'full',
  incomeHistory: 'full',
};

export function defaultWidth(id: WidgetId): WidgetWidth {
  return DEFAULT_WIDTH[id] ?? 'half';
}

export const DEFAULT_LAYOUT: DashboardLayout = WIDGET_IDS.map(id => ({ id, width: defaultWidth(id) }));

function isWidgetId(value: unknown): value is WidgetId {
  return typeof value === 'string' && (WIDGET_IDS as readonly string[]).includes(value);
}

function isWidth(value: unknown): value is WidgetWidth {
  return typeof value === 'string' && (WIDGET_WIDTHS as readonly string[]).includes(value);
}

/**
 * Reads a saved layout. Missing or unreadable → DEFAULT_LAYOUT. Unknown ids are
 * dropped (a widget left the catalog), a repeated id keeps its first copy and an
 * invalid width falls back to the widget's default. An empty list is kept.
 */
export function parseLayout(json: string | null | undefined): DashboardLayout {
  if (!json) return DEFAULT_LAYOUT;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return DEFAULT_LAYOUT;
  }
  const items = (parsed as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return DEFAULT_LAYOUT;

  const seen = new Set<WidgetId>();
  const layout: LayoutItem[] = [];
  for (const raw of items) {
    const id = (raw as { id?: unknown } | null)?.id;
    if (!isWidgetId(id) || seen.has(id)) continue;
    seen.add(id);
    const width = (raw as { width?: unknown }).width;
    layout.push({ id, width: isWidth(width) ? width : defaultWidth(id) });
  }
  return layout;
}

export function serializeLayout(layout: DashboardLayout): string {
  return JSON.stringify({ v: 1, items: layout.map(({ id, width }) => ({ id, width })) });
}

/** Moves the widget at `from` to index `to`; out-of-range or equal indexes change nothing. */
export function moveWidget(layout: DashboardLayout, from: number, to: number): DashboardLayout {
  if (from === to || from < 0 || to < 0 || from >= layout.length || to >= layout.length) return layout;
  const next = layout.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function removeWidget(layout: DashboardLayout, id: WidgetId): DashboardLayout {
  return layout.filter(item => item.id !== id);
}

/** Appends a widget at the end with its default width; a widget already shown is not added again. */
export function addWidget(layout: DashboardLayout, id: WidgetId): DashboardLayout {
  if (layout.some(item => item.id === id)) return layout;
  return [...layout, { id, width: defaultWidth(id) }];
}

export function setWidgetWidth(layout: DashboardLayout, id: WidgetId, width: WidgetWidth): DashboardLayout {
  if (!layout.some(item => item.id === id && item.width !== width)) return layout;
  return layout.map(item => (item.id === id ? { id, width } : item));
}

/** Catalog widgets that are not on the dashboard, in catalog order. */
export function availableWidgets(layout: DashboardLayout): WidgetId[] {
  const present = new Set(layout.map(item => item.id));
  return WIDGET_IDS.filter(id => !present.has(id));
}

export function sameLayout(a: DashboardLayout, b: DashboardLayout): boolean {
  return a.length === b.length && a.every((item, i) => item.id === b[i].id && item.width === b[i].width);
}
