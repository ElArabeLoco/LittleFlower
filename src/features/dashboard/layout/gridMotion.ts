/**
 * gridMotion — how dashboard widgets move while the layout is edited.
 *
 * Every change is a FLIP: measure each card before the change (capture), let
 * React move the cards, then play the difference back from the old positions
 * (afterRender). Dragging is pointer-driven: the lifted card trails the
 * pointer with some weight and leans with its speed, the others reflow around
 * it, and on release it springs into its slot with a light bounce and a halo.
 *
 * Pure DOM work on the elements DashboardGrid renders (.dash-slot, .dash-card,
 * .dash-hole, .dash-halo). With prefers-reduced-motion, or without the Web
 * Animations API, positions change instantly.
 */

import type { PointerEvent as ReactPointerEvent } from 'react';

export const SETTLE_MS = 560;
const MOTION_ID = 'dash-motion';
const GLIDE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const POP = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const LIFT_SCALE = 1.035;
const FOLLOW = 0.38;
const REORDER_COOLDOWN_MS = 90;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface HitBox extends Box {
  right: number;
  bottom: number;
}

/** Where the hand left the card: unscaled top-left in viewport pixels, size, lean, lift, grab point. */
export interface SettleFrom {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  scale: number;
  gx: number;
  gy: number;
}

export interface GridMotionCallbacks {
  /** Index of a widget in the current layout, -1 when it is not there. */
  indexOf: (id: string) => number;
  /** Number of widgets in the current layout. */
  count: () => number;
  /** The dragged card's centre is over another slot: move the widget to that index. */
  onReorder: (id: string, to: number) => void;
  /** The pointer was released, or the drag was cancelled (Esc, pointercancel). */
  onDrop: (id: string, cancelled: boolean) => void;
}

interface Snapshot {
  rects: Map<string, { card: DOMRect; hole: DOMRect }>;
  dragId: string | null;
}

interface DragState {
  id: string;
  win: Window;
  pointerId: number;
  card: HTMLElement | null;
  raf: number;
  gx: number;
  gy: number;
  px: number;
  py: number;
  x: number;
  y: number;
  vx: number;
  rot: number;
  scale: number;
  skipId: string | null;
  lastMove: number;
}

interface SettleState extends SettleFrom {
  id: string;
  card: HTMLElement | null;
}

/** True when cards should jump instead of move: reduced motion, or no Web Animations API. */
export function prefersCalm(): boolean {
  try {
    return typeof Element.prototype.animate !== 'function'
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

/** Damped spring from 0 to 1 (t in seconds): about 5 % overshoot, at rest after SETTLE_MS. */
export function spring(t: number): number {
  const w = 19;
  const z = 0.7;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}

/** Keyframes that spring a dropped card from where it was released into its slot: position, lean, lift and size together. */
export function settleFrames(from: SettleFrom, last: Box): Keyframe[] {
  const steps = 28;
  const frames: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const k = i === steps ? 0 : 1 - spring(((i / steps) * SETTLE_MS) / 1000);
    frames.push({
      offset: i / steps,
      transform:
        `translate(${((from.x - last.left) * k).toFixed(2)}px, ${((from.y - last.top) * k).toFixed(2)}px) ` +
        `rotate(${(from.rot * k).toFixed(3)}deg) scale(${(1 + (from.scale - 1) * k).toFixed(4)})`,
      width: `${(last.width + (from.w - last.width) * k).toFixed(2)}px`,
      height: `${(last.height + (from.h - last.height) * k).toFixed(2)}px`,
    });
  }
  return frames;
}

/** The slot under a point, skipping the dragged widget and the one it just displaced (so two cards never flicker back and forth). */
export function pickTarget(
  x: number,
  y: number,
  slots: ReadonlyArray<{ id: string; rect: HitBox }>,
  dragId: string,
  skipId: string | null,
): string | null {
  for (const slot of slots) {
    if (slot.id === dragId || slot.id === skipId) continue;
    if (inside(slot.rect, x, y)) return slot.id;
  }
  return null;
}

function inside(r: HitBox, x: number, y: number): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function slotsOf(grid: HTMLElement): HTMLElement[] {
  return Array.from(grid.querySelectorAll<HTMLElement>('.dash-slot[data-widget-id]'));
}

function slotOf(grid: HTMLElement | null, id: string): HTMLElement | null {
  return grid?.querySelector<HTMLElement>(`.dash-slot[data-widget-id="${id}"]`) ?? null;
}

function cardOf(slot: HTMLElement): HTMLElement | null {
  return slot.querySelector<HTMLElement>('.dash-card');
}

const FROZEN = ['position', 'left', 'top', 'width', 'height', 'zIndex', 'transformOrigin'] as const;

function release(slot: HTMLElement): void {
  slot.style.height = '';
  const card = cardOf(slot);
  if (card) for (const prop of FROZEN) card.style[prop] = '';
}

// While a card animates its size it leaves the flow and its slot keeps the final height, so rows never jitter.
function freeze(slot: HTMLElement, card: HTMLElement, last: Box): void {
  slot.style.height = `${last.height}px`;
  card.style.position = 'absolute';
  card.style.left = '0px';
  card.style.top = '0px';
  card.style.width = `${last.width}px`;
  card.style.height = `${last.height}px`;
}

function stopMotion(slot: HTMLElement): void {
  slot.querySelectorAll<HTMLElement>('.dash-hole, .dash-halo, .dash-card').forEach(el => {
    el.getAnimations?.().forEach(a => { if (a.id === MOTION_ID) a.cancel(); });
  });
  release(slot);
}

function glide(
  el: HTMLElement,
  first: Box,
  last: Box,
  opts: { slot?: HTMLElement; delay?: number; duration?: number; front?: boolean },
): void {
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const sized = Math.abs(first.width - last.width) > 1 || Math.abs(first.height - last.height) > 1;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && !sized) return;

  const from: Keyframe = { transform: `translate(${dx}px, ${dy}px)` };
  const to: Keyframe = { transform: 'translate(0px, 0px)' };
  if (sized) {
    if (opts.slot) freeze(opts.slot, el, last);
    Object.assign(from, { width: `${first.width}px`, height: `${first.height}px` });
    Object.assign(to, { width: `${last.width}px`, height: `${last.height}px` });
  }
  if (opts.front) el.style.zIndex = '5';
  const animation = el.animate([from, to], {
    duration: opts.duration ?? 380,
    delay: opts.delay ?? 0,
    easing: GLIDE,
    fill: 'backwards',
    id: MOTION_ID,
  });
  animation.onfinish = () => {
    if (opts.slot) release(opts.slot);
    else el.style.zIndex = '';
  };
}

function halo(slot: HTMLElement, delay: number): void {
  const ring = slot.querySelector<HTMLElement>('.dash-halo');
  if (!ring) return;
  const style = getComputedStyle(slot);
  const strong = style.getPropertyValue('--tactile-halo').trim() || 'rgb(202 47 109 / 0.45)';
  const clear = style.getPropertyValue('--tactile-halo-clear').trim() || 'rgb(202 47 109 / 0)';
  ring.animate(
    [
      { opacity: 1, boxShadow: `0 0 0 0 ${strong}` },
      { opacity: 1, boxShadow: `0 0 0 14px ${clear}` },
    ],
    { duration: 700, delay, easing: GLIDE, id: MOTION_ID },
  );
}

function rise(slot: HTMLElement, card: HTMLElement, delay: number): void {
  card.animate(
    [
      { opacity: 0, transform: 'translateY(18px) scale(0.94)' },
      { opacity: 1, transform: 'translateY(0px) scale(1)' },
    ],
    { duration: 480, delay, easing: POP, fill: 'backwards', id: MOTION_ID },
  );
  halo(slot, delay + 300);
}

function land(slot: HTMLElement, card: HTMLElement, from: SettleFrom, last: Box): void {
  freeze(slot, card, last);
  card.style.zIndex = '60';
  card.style.transformOrigin = `${from.gx}px ${from.gy}px`;
  const animation = card.animate(settleFrames(from, last), { duration: SETTLE_MS, easing: 'linear', id: MOTION_ID });
  animation.onfinish = () => release(slot);
  halo(slot, 200);
}

function clearTransform(card: HTMLElement | null): void {
  if (!card) return;
  card.style.transform = '';
  card.style.transformOrigin = '';
}

export class GridMotion {
  private grid: HTMLElement | null = null;
  private pending: Snapshot | null = null;
  private drag: DragState | null = null;
  private settle: SettleState | null = null;
  private pivot = 0;
  private pulseId: string | null = null;
  private refocusId: string | null = null;
  private readonly callbacks: () => GridMotionCallbacks;

  /** `callbacks` is read on every use, so it can close over the latest React state. */
  constructor(callbacks: () => GridMotionCallbacks) {
    this.callbacks = callbacks;
    this.tick = this.tick.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onCancel = this.onCancel.bind(this);
    this.onKey = this.onKey.bind(this);
  }

  setGrid(grid: HTMLElement | null): void {
    this.grid = grid;
  }

  isDragging(): boolean {
    return this.drag !== null;
  }

  /**
   * Call right before a state change that moves cards. `pivot` is the index the
   * reflow ripples out from; `pulse` makes that widget's halo glow once it lands.
   */
  capture(dragId: string | null, pivot: number, opts: { pulse?: string; refocus?: string } = {}): void {
    this.pivot = pivot;
    if (opts.pulse) this.pulseId = opts.pulse;
    if (opts.refocus) this.refocusId = opts.refocus;
    if (!this.pending) this.pending = this.measure(dragId);
  }

  /** Call from useLayoutEffect after every render: animates the captured change and keeps the lifted card under the pointer. */
  afterRender(dragId: string | null): void {
    const snap = this.pending;
    this.pending = null;
    if (snap) this.flip(snap, dragId);
    if (this.settle) {
      clearTransform(this.settle.card);
      this.settle = null;
    }
    if (this.drag) this.paintDrag();
    if (this.refocusId) {
      const key = slotOf(this.grid, this.refocusId)?.querySelector<HTMLElement>('.dash-grab');
      if (key && key.ownerDocument.activeElement !== key) key.focus({ preventScroll: true });
      this.refocusId = null;
    }
  }

  /** Starts dragging from the widget's «Mover» key. Returns false when the press should not start a drag. */
  grab(id: string, event: ReactPointerEvent<HTMLElement>): boolean {
    if (this.drag) return false;
    if (event.pointerType === 'mouse' && event.button !== 0) return false;
    const key = event.currentTarget;
    const slot = key.closest<HTMLElement>('.dash-slot');
    const card = slot && cardOf(slot);
    if (!slot || !card) return false;
    event.preventDefault();
    this.grid ??= key.closest<HTMLElement>('.dash-grid');

    const r = card.getBoundingClientRect();
    const win = key.ownerDocument.defaultView ?? window;
    this.drag = {
      id,
      win,
      pointerId: event.pointerId,
      card: null,
      raf: 0,
      gx: event.clientX - r.left,
      gy: event.clientY - r.top,
      px: event.clientX,
      py: event.clientY,
      x: r.left,
      y: r.top,
      vx: 0,
      rot: 0,
      scale: 1,
      skipId: null,
      lastMove: 0,
    };
    win.addEventListener('pointermove', this.onMove);
    win.addEventListener('pointerup', this.onUp);
    win.addEventListener('pointercancel', this.onCancel);
    win.addEventListener('keydown', this.onKey);
    win.document.documentElement.classList.add('dash-dragging');
    this.drag.raf = win.requestAnimationFrame(this.tick);
    return true;
  }

  /** The card shrinks and fades, then `done` removes it (the others close the gap on the next render). */
  exit(id: string, done: () => void): void {
    const card = slotOf(this.grid, id)?.querySelector<HTMLElement>('.dash-card');
    if (!card || prefersCalm()) {
      done();
      return;
    }
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      done();
    };
    const animation = card.animate(
      [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.92)' },
      ],
      { duration: 220, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards', id: MOTION_ID },
    );
    animation.onfinish = finish;
    animation.oncancel = finish;
  }

  /** Stops a drag in progress without animating (unmount). */
  destroy(): void {
    const drag = this.endDrag();
    clearTransform(drag?.card ?? null);
  }

  private measure(dragId: string | null): Snapshot | null {
    const grid = this.grid;
    if (!grid?.isConnected) return null;
    const rects = new Map<string, { card: DOMRect; hole: DOMRect }>();
    for (const slot of slotsOf(grid)) {
      const card = cardOf(slot);
      const hole = slot.querySelector<HTMLElement>('.dash-hole');
      if (!card || !hole) continue;
      rects.set(slot.dataset.widgetId!, { card: card.getBoundingClientRect(), hole: hole.getBoundingClientRect() });
    }
    return { rects, dragId };
  }

  private flip(snap: Snapshot, dragId: string | null): void {
    const grid = this.grid;
    if (!grid?.isConnected) return;
    const slots = slotsOf(grid);
    slots.forEach(stopMotion);
    if (prefersCalm()) return;

    const settle = this.settle;
    const pulseId = this.pulseId;
    const pivot = this.pivot;
    const dragging = dragId !== null;
    this.pulseId = null;

    // Measure every final position before any card leaves the flow.
    const items = slots.map(slot => ({
      id: slot.dataset.widgetId!,
      slot,
      card: cardOf(slot),
      hole: slot.querySelector<HTMLElement>('.dash-hole'),
      last: slot.getBoundingClientRect(),
    }));

    items.forEach((item, index) => {
      const { id, slot, card, hole, last } = item;
      if (!card) return;
      const before = snap.rects.get(id);
      const reach = Math.abs(index - pivot);

      if (settle && settle.id === id) {
        clearTransform(settle.card);
        this.settle = null;
        land(slot, card, settle, last);
        return;
      }
      if (id === dragId) {
        if (!before) return;
        if (snap.dragId === dragId) {
          // The empty slot travels with the reflow.
          if (hole) glide(hole, before.hole, last, { duration: 300 });
        } else if (Math.abs(before.card.height - last.height) > 1) {
          // Lifted out of a taller row: ease to the card's own height.
          card.animate(
            [{ height: `${before.card.height}px` }, { height: `${last.height}px` }],
            { duration: 240, easing: GLIDE, id: MOTION_ID },
          );
        }
        return;
      }
      if (!before) {
        rise(slot, card, Math.min(reach * 40, 240));
        return;
      }
      glide(card, before.card, last, {
        slot,
        delay: Math.min(reach * (dragging ? 14 : 26), dragging ? 60 : 130),
        duration: dragging ? 300 : 380,
        front: id === pulseId,
      });
      if (id === pulseId) halo(slot, 240);
    });
  }

  private onMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.px = event.clientX;
    drag.py = event.clientY;
  }

  private onUp(event: PointerEvent): void {
    if (this.drag && event.pointerId === this.drag.pointerId) this.drop(false);
  }

  private onCancel(event: PointerEvent): void {
    if (this.drag && event.pointerId === this.drag.pointerId) this.drop(true);
  }

  private onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.drag) {
      event.preventDefault();
      this.drop(true);
    }
  }

  // The card trails the pointer like something with weight and leans into the direction it moves.
  private tick(): void {
    const drag = this.drag;
    if (!drag) return;
    const calm = prefersCalm();
    const follow = calm ? 1 : FOLLOW;
    const nx = drag.x + (drag.px - drag.gx - drag.x) * follow;
    drag.vx = nx - drag.x;
    drag.x = nx;
    drag.y += (drag.py - drag.gy - drag.y) * follow;
    drag.scale += ((calm ? 1 : LIFT_SCALE) - drag.scale) * 0.25;
    const width = drag.card?.offsetWidth ?? 400;
    const lean = Math.min(4, 1200 / Math.max(width, 1));
    const target = calm ? 0 : Math.max(-lean, Math.min(lean, drag.vx * 0.3));
    drag.rot += (target - drag.rot) * 0.18;

    this.paintDrag();
    this.autoScroll(drag);
    this.hitTest(drag);
    drag.raf = drag.win.requestAnimationFrame(this.tick);
  }

  private paintDrag(): void {
    const drag = this.drag;
    if (!drag) return;
    const slot = slotOf(this.grid, drag.id);
    const card = slot && cardOf(slot);
    if (!slot || !card) return;
    if (drag.card && drag.card !== card) clearTransform(drag.card);
    drag.card = card;
    const r = slot.getBoundingClientRect();
    card.style.transformOrigin = `${drag.gx}px ${drag.gy}px`;
    card.style.transform =
      `translate(${drag.x - r.left}px, ${drag.y - r.top}px) rotate(${drag.rot}deg) scale(${drag.scale})`;
  }

  private autoScroll(drag: DragState): void {
    const edge = 72;
    const height = drag.win.innerHeight;
    let speed = 0;
    if (drag.py < edge) speed = -Math.ceil((edge - drag.py) / 5);
    else if (drag.py > height - edge) speed = Math.ceil((drag.py - (height - edge)) / 5);
    if (speed) drag.win.scrollBy(0, speed);
  }

  // The card's centre (capped near the top of tall cards) picks the slot it moves to.
  private hitTest(drag: DragState): void {
    const grid = this.grid;
    if (!grid || !drag.card) return;
    const now = Date.now();
    if (now - drag.lastMove < REORDER_COOLDOWN_MS) return;
    const cx = drag.x + drag.card.offsetWidth / 2;
    const cy = drag.y + Math.min(drag.card.offsetHeight / 2, 160);

    if (drag.skipId) {
      const skip = slotOf(grid, drag.skipId);
      if (!skip || !inside(skip.getBoundingClientRect(), cx, cy)) drag.skipId = null;
    }
    const slots = slotsOf(grid).map(slot => ({ id: slot.dataset.widgetId!, rect: slot.getBoundingClientRect() }));
    const target = pickTarget(cx, cy, slots, drag.id, drag.skipId);

    const cb = this.callbacks();
    let to = target ? cb.indexOf(target) : -1;
    if (to < 0) {
      const add = grid.querySelector<HTMLElement>('.dash-add');
      if (add && inside(add.getBoundingClientRect(), cx, cy)) to = cb.count() - 1;
    }
    if (to < 0 || to === cb.indexOf(drag.id)) return;
    drag.lastMove = now;
    drag.skipId = target;
    cb.onReorder(drag.id, to);
  }

  private endDrag(): DragState | null {
    const drag = this.drag;
    if (!drag) return null;
    drag.win.cancelAnimationFrame(drag.raf);
    drag.win.removeEventListener('pointermove', this.onMove);
    drag.win.removeEventListener('pointerup', this.onUp);
    drag.win.removeEventListener('pointercancel', this.onCancel);
    drag.win.removeEventListener('keydown', this.onKey);
    drag.win.document.documentElement.classList.remove('dash-dragging');
    this.drag = null;
    return drag;
  }

  private drop(cancelled: boolean): void {
    const drag = this.endDrag();
    if (!drag) return;
    if (drag.card) {
      this.settle = {
        id: drag.id,
        card: drag.card,
        x: drag.x,
        y: drag.y,
        w: drag.card.offsetWidth,
        h: drag.card.offsetHeight,
        rot: drag.rot,
        scale: drag.scale,
        gx: drag.gx,
        gy: drag.gy,
      };
    }
    this.callbacks().onDrop(drag.id, cancelled);
  }
}
