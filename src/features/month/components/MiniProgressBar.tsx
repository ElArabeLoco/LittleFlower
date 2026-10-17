import { cn } from '@/shared/ui/cn';

/** Spend progress: leaf while within budget, brick once over it. */
export function MiniProgressBar({ pct, over }: { pct: number; over: boolean }) {
  return (
    <div className="h-1 rounded-full bg-[var(--border-subtle)] overflow-hidden">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-300',
          over ? 'bg-red-500 dark:bg-red-400' : 'bg-green-600 dark:bg-green-400',
        )}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}
