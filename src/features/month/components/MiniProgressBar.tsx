import { cn } from '@/shared/ui/cn';

export function MiniProgressBar({ pct, over }: { pct: number; over: boolean }) {
  return (
    <div className="h-1 rounded-full bg-[var(--border-subtle)] overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-300', over ? 'bg-red-400' : 'bg-violet-400')}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}
