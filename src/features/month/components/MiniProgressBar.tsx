import { cn } from '@/shared/ui/cn';

/**
 * Spend progress: light leaf while within budget, deep brick once over it.
 * The two fills also differ in lightness so the state reads without color vision.
 */
export function MiniProgressBar({ pct, over }: { pct: number; over: boolean }) {
  return (
    <div className="h-1 rounded-full bg-[var(--border-subtle)] overflow-hidden">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-300',
          over ? 'bg-red-700 dark:bg-red-500' : 'bg-green-500 dark:bg-green-400',
        )}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}
