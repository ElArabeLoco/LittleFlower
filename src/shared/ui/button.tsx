import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-semibold transition-colors select-none disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0',
    // `outline-hidden` keeps a transparent outline that forced-colors mode paints, where box-shadow rings disappear.
    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]',
  ],
  {
    variants: {
      variant: {
        default:     'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]',
        outline:     'border border-[var(--border-medium)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-2)]',
        ghost:       'text-[var(--text-brand)] hover:bg-[var(--bg-hover)]',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        secondary:   'bg-violet-50 text-violet-800 hover:bg-violet-100 dark:bg-violet-950/50 dark:text-violet-200 dark:hover:bg-violet-900/50',
      },
      size: {
        default: 'h-10 px-4',
        sm:      'h-8 rounded-lg px-3 text-[13px]',
        lg:      'h-12 rounded-xl px-6 text-[15px]',
        icon:    'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
