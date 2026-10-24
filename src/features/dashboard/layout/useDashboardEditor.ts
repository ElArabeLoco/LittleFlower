import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  DEFAULT_LAYOUT,
  addWidget,
  moveWidget,
  removeWidget,
  sameLayout,
  serializeLayout,
  setWidgetWidth,
  type DashboardLayout,
  type WidgetId,
  type WidgetWidth,
} from '@/domain/dashboard/dashboardLayout';
import { useI18n } from '@/shared/i18n/I18nContext';
import { GridMotion, type GridMotionCallbacks } from './gridMotion';

const TOAST_MS = 6000;

export interface EditorToast {
  /** Changes on every toast, so a new toast replays its entrance. */
  key: number;
  text: string;
  /** The layout «Deshacer» brings back. */
  undo: DashboardLayout | null;
}

export interface DashboardEditor {
  layout: DashboardLayout;
  editing: boolean;
  dragId: WidgetId | null;
  catalogOpen: boolean;
  toast: EditorToast | null;
  /** Announced by a polite live region: where a moved widget ended up. */
  live: string;
  gridRef: (el: HTMLDivElement | null) => void;
  setEditing: (editing: boolean) => void;
  openCatalog: () => void;
  setCatalogOpen: (open: boolean) => void;
  grab: (id: WidgetId, event: React.PointerEvent<HTMLElement>) => void;
  nudge: (id: WidgetId, event: React.KeyboardEvent<HTMLElement>) => void;
  remove: (id: WidgetId) => void;
  add: (id: WidgetId) => void;
  setWidth: (id: WidgetId, width: WidgetWidth) => void;
  reset: () => void;
  undo: () => void;
  dismissToast: () => void;
}

const indexIn = (layout: DashboardLayout, id: WidgetId) => layout.findIndex(item => item.id === id);

/**
 * Edit-mode state of the dashboard: a local copy of the saved layout that
 * changes at once (and animates), saved on every committed change.
 */
export function useDashboardEditor({ saved, save, titleOf }: {
  saved: DashboardLayout;
  save: (layout: DashboardLayout) => Promise<void>;
  titleOf: (id: WidgetId) => string;
}): DashboardEditor {
  const { t } = useI18n();
  const copy = t.dashboardLayout;
  const [layout, setLayout] = useState<DashboardLayout>(saved);
  const [editing, setEditingState] = useState(false);
  const [dragId, setDragId] = useState<WidgetId | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [toast, setToast] = useState<EditorToast | null>(null);
  const [live, setLive] = useState('');

  // Refs give the motion layer's callbacks the latest state between renders.
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const dragRef = useRef(dragId);
  dragRef.current = dragId;
  const originRef = useRef<DashboardLayout>(layout);
  const writesRef = useRef<string[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toastKey = useRef(0);
  const leavingRef = useRef<WidgetId | null>(null);
  const placedText = useRef<(id: WidgetId, layout: DashboardLayout) => string>(() => '');
  placedText.current = (id, list) => copy.placed(titleOf(id), indexIn(list, id) + 1, list.length);

  const persist = useCallback(
    (next: DashboardLayout) => {
      const key = serializeLayout(next);
      writesRef.current.push(key);
      save(next).catch(error => {
        writesRef.current = writesRef.current.filter(write => write !== key);
        console.error('[dashboard] could not save the layout', error);
      });
    },
    [save],
  );

  // One motion layer for the editor's lifetime; its callbacks are refreshed on every render.
  const callbacksRef = useRef<GridMotionCallbacks | null>(null);
  const [motion] = useState(() => new GridMotion(() => callbacksRef.current!));
  callbacksRef.current = {
    indexOf: id => indexIn(layoutRef.current, id as WidgetId),
    count: () => layoutRef.current.length,
    onReorder: (id, to) => {
      const current = layoutRef.current;
      motion.capture(dragRef.current, to);
      setLayout(moveWidget(current, indexIn(current, id as WidgetId), to));
    },
    onDrop: (id, cancelled) => {
      const widget = id as WidgetId;
      const origin = originRef.current;
      const final = cancelled ? origin : layoutRef.current;
      motion.capture(dragRef.current, Math.max(indexIn(final, widget), 0));
      setDragId(null);
      setLayout(final);
      if (!sameLayout(final, origin)) persist(final);
      setLive(cancelled ? copy.returned(titleOf(widget)) : placedText.current(widget, final));
    },
  };

  useLayoutEffect(() => {
    motion.afterRender(dragId);
  });

  useEffect(() => () => {
    motion.destroy();
    clearTimeout(toastTimer.current);
  }, [motion]);

  // Adopt a layout saved elsewhere (another device, the first read) unless it is one of our own writes.
  useEffect(() => {
    const key = serializeLayout(saved);
    const own = writesRef.current.indexOf(key);
    if (own >= 0) {
      writesRef.current.splice(0, own + 1);
      return;
    }
    if (writesRef.current.length > 0 || motion.isDragging()) return;
    if (sameLayout(saved, layoutRef.current)) return;
    setLayout(saved);
  }, [saved, motion]);

  const showToast = useCallback((text: string, undo: DashboardLayout | null) => {
    clearTimeout(toastTimer.current);
    toastKey.current += 1;
    setToast({ key: toastKey.current, text, undo });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const dismissToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  /** Animate, show and save a new layout. */
  const commit = useCallback(
    (next: DashboardLayout, pivot: number, opts: { pulse?: WidgetId; refocus?: WidgetId } = {}) => {
      if (next === layoutRef.current) return;
      motion.capture(dragRef.current, pivot, opts);
      setLayout(next);
      persist(next);
    },
    [motion, persist],
  );

  const setEditing = useCallback(
    (next: boolean) => {
      motion.capture(dragRef.current, 0);
      setEditingState(next);
      if (!next) setCatalogOpen(false);
    },
    [motion],
  );

  const openCatalog = useCallback(() => {
    if (!editing) setEditing(true);
    setCatalogOpen(true);
  }, [editing, setEditing]);

  const grab = useCallback(
    (id: WidgetId, event: React.PointerEvent<HTMLElement>) => {
      if (!editing || !motion.grab(id, event)) return;
      originRef.current = layoutRef.current;
      motion.capture(null, indexIn(layoutRef.current, id));
      setDragId(id);
      setLive(copy.lifted(titleOf(id)));
    },
    [editing, motion, copy, titleOf],
  );

  const nudge = useCallback(
    (id: WidgetId, event: React.KeyboardEvent<HTMLElement>) => {
      const key = event.key;
      const step = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : key === 'ArrowRight' || key === 'ArrowDown' ? 1 : 0;
      if (!step || motion.isDragging()) return;
      event.preventDefault();
      const current = layoutRef.current;
      const from = indexIn(current, id);
      const next = moveWidget(current, from, from + step);
      commit(next, from + step, { pulse: id, refocus: id });
      if (next !== current) setLive(placedText.current(id, next));
    },
    [motion, commit],
  );

  const remove = useCallback(
    (id: WidgetId) => {
      if (leavingRef.current === id) return;
      leavingRef.current = id;
      motion.exit(id, () => {
        leavingRef.current = null;
        const current = layoutRef.current;
        const index = indexIn(current, id);
        if (index < 0) return;
        commit(removeWidget(current, id), index);
        showToast(copy.removed(titleOf(id)), current);
      });
    },
    [motion, commit, showToast, copy, titleOf],
  );

  const add = useCallback(
    (id: WidgetId) => {
      const current = layoutRef.current;
      const next = addWidget(current, id);
      if (next === current) return;
      commit(next, current.length);
      showToast(copy.added(titleOf(id)), current);
    },
    [commit, showToast, copy, titleOf],
  );

  const setWidth = useCallback(
    (id: WidgetId, width: WidgetWidth) => {
      const current = layoutRef.current;
      commit(setWidgetWidth(current, id, width), indexIn(current, id));
    },
    [commit],
  );

  const reset = useCallback(() => {
    const current = layoutRef.current;
    if (sameLayout(current, DEFAULT_LAYOUT)) return;
    commit(DEFAULT_LAYOUT, 0);
    showToast(copy.resetDone, current);
  }, [commit, showToast, copy]);

  const undo = useCallback(() => {
    const previous = toast?.undo;
    if (!previous) return;
    dismissToast();
    commit(previous, 0);
  }, [toast, dismissToast, commit]);

  const gridRef = useCallback((el: HTMLDivElement | null) => motion.setGrid(el), [motion]);

  return {
    layout,
    editing,
    dragId,
    catalogOpen,
    toast,
    live,
    gridRef,
    setEditing,
    openCatalog,
    setCatalogOpen,
    grab,
    nudge,
    remove,
    add,
    setWidth,
    reset,
    undo,
    dismissToast,
  };
}
