import * as React from 'react';
import { cn } from './cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-[10px] border border-[var(--border-field)] bg-[var(--bg-surface)] px-3 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
        // 16px on phones so iOS Safari does not zoom in on focus, 14px from `sm`. Sized through
        // a variable so a caller's own `text-*` size still wins at every breakpoint.
        '[--field-text:1rem] sm:[--field-text:0.875rem] text-[length:var(--field-text)]',
        'transition-[border-color,box-shadow] hover:border-[var(--text-muted)]',
        'focus:outline-hidden focus:border-[var(--color-primary)] focus:ring-[3px] focus:ring-[var(--focus-ring-soft)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
