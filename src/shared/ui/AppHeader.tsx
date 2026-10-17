/**
 * AppHeader — the page header, after Apple's large-title navigation bars.
 *
 * Anatomy:
 *   ┌──────────────────────────────────────────────────────┐
 *   │  (✿ Title, once scrolled)        [actions] (☁ Estado)  │  sticky glass bar
 *   │  (!) sync alert band, only while sync needs a word    │
 *   └──────────────────────────────────────────────────────┘
 *      Title                                            ✿     large title, scrolls away
 *      subtitle (optional)
 *   ┌──────────────────────────────────────────────────────┐
 *   │  toolbar (optional), e.g. the dashboard month switcher │  sticks under the bar
 *   └──────────────────────────────────────────────────────┘
 *
 * The bar is frosted glass: invisible at rest, it blurs whatever scrolls under
 * it. Once the large title has gone under the bar, the bar shows the flower
 * and the title and gains a hairline. Compact pages (data-dense) skip the
 * large title and always show the title in the bar. The sync status button
 * opens the sync console; the alert band can open it too, so the open state
 * lives here.
 *
 * Usage:
 *   <AppHeader
 *     title="Vista Anual"
 *     subtitle="2026"
 *     actions={<Button>...</Button>}
 *   />
 */

import { useEffect, useRef, useState, type RefObject } from 'react';
import { SyncStatusControl, type SyncStatusSlots } from '@/features/sync/SyncStatusControl';
import { cn } from './cn';
import { FlowerMark } from './FlowerMark';

const DEFAULT_MAX_WIDTH = 'max-w-2xl';

interface AppHeaderProps {
  /** Main page title */
  title: string;
  /** Optional subtitle shown below the title in a smaller style */
  subtitle?: string;
  /** Optional slot for action buttons (e.g. "+ Agregar") rendered to the right */
  actions?: React.ReactNode;
  /** Max-width constraint class for the inner content. Default: 'max-w-2xl'. */
  maxWidth?: string;
  /** Data-dense pages: no large title, the title stays in a 48px bar. */
  compact?: boolean;
  /** Optional row under the large title that sticks under the bar (e.g. a period switcher). */
  toolbar?: React.ReactNode;
}

export function AppHeader(props: AppHeaderProps) {
  const [syncOpen, setSyncOpen] = useState(false);

  return (
    <SyncStatusControl
      open={syncOpen}
      onOpenChange={setSyncOpen}
      maxWidth={props.maxWidth ?? DEFAULT_MAX_WIDTH}
    >
      {(sync) => <AppHeaderView {...props} sync={sync} />}
    </SyncStatusControl>
  );
}

interface AppHeaderViewProps extends AppHeaderProps {
  /** Sync status button (end of the bar) and sync alert band (under the bar). */
  sync?: Partial<SyncStatusSlots>;
}

/** The header's markup with the sync slots filled by the caller (AppHeader, or previews). */
export function AppHeaderView({
  title,
  subtitle,
  actions,
  maxWidth = DEFAULT_MAX_WIDTH,
  compact = false,
  toolbar,
  sync,
}: AppHeaderViewProps) {
  const barRef = useRef<HTMLElement>(null);
  const largeTitleRef = useRef<HTMLHeadingElement>(null);
  const barHeight = useElementHeight(barRef);
  const largeTitleGone = useScrolledUnder(largeTitleRef, barHeight);
  const titleInBar = compact || largeTitleGone;

  return (
    <>
      <header
        ref={barRef}
        className={cn(
          'sticky top-0 z-20 border-b bg-[var(--bg-bar)] pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150 transition-colors',
          titleInBar ? 'border-[var(--border-subtle)]' : 'border-transparent',
        )}
      >
        <div className={cn('mx-auto flex items-center gap-2 px-4', compact ? 'h-12' : 'h-14', maxWidth)}>
          {compact ? (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <FlowerMark className="size-6 shrink-0" />
              <div className="min-w-0">
                <h1 className="truncate text-[17px] font-[650] leading-tight tracking-[-0.01em] text-[var(--text-primary)]">
                  {title}
                </h1>
                {subtitle && <p className="truncate text-xs leading-snug text-[var(--text-muted)]">{subtitle}</p>}
              </div>
            </div>
          ) : (
            // A visual echo of the large title, which stays the page's heading.
            <div
              aria-hidden="true"
              className={cn(
                'flex min-w-0 flex-1 items-center gap-2 transition-opacity duration-200',
                largeTitleGone ? 'opacity-100' : 'opacity-0',
              )}
            >
              <FlowerMark className="size-[26px] shrink-0" />
              <span className="truncate text-[17px] font-[650] tracking-[-0.01em] text-[var(--text-primary)]">
                {title}
              </span>
            </div>
          )}

          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}

          {sync?.button}
        </div>

        {sync?.alert}
      </header>

      {!compact && (
        <div className={cn('mx-auto flex w-full items-center gap-3 px-4 pb-4 pt-1.5', maxWidth)}>
          <div className="min-w-0 flex-1">
            <h1
              ref={largeTitleRef}
              className="text-[34px] font-[750] leading-[1.12] tracking-[-0.022em] text-[var(--text-primary)]"
            >
              {title}
            </h1>
            {subtitle && <p className="mt-1 text-[15px] leading-snug text-[var(--text-secondary)]">{subtitle}</p>}
          </div>
          <FlowerMark className="size-14 shrink-0" />
        </div>
      )}

      {toolbar && (
        <div
          className="sticky z-10 border-y border-[var(--border-subtle)] bg-[var(--bg-surface)]"
          style={{ top: barHeight }}
        >
          <div className={cn('mx-auto w-full px-4', maxWidth)}>{toolbar}</div>
        </div>
      )}
    </>
  );
}

/** Live height of an element; 0 until measured. The bar grows with the alert band. */
function useElementHeight(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setHeight(element.getBoundingClientRect().height));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return height;
}

/** Whether the element has scrolled up under the top `offset` pixels of the viewport. */
function useScrolledUnder(ref: RefObject<HTMLElement | null>, offset: number): boolean {
  const [under, setUnder] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || offset === 0 || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setUnder(!entry.isIntersecting && entry.boundingClientRect.top < offset),
      { rootMargin: `-${Math.ceil(offset)}px 0px 0px 0px` },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, offset]);

  return under;
}
