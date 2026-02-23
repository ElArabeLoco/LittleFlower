import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:     'bg-pink-400 text-white hover:bg-pink-500 dark:bg-pink-500 dark:hover:bg-pink-400',
        outline:     'border border-pink-300 bg-white text-pink-700 hover:bg-pink-50 dark:border-[var(--border-medium)] dark:bg-[var(--bg-surface)] dark:text-[var(--text-brand)] dark:hover:bg-[var(--bg-hover)]',
        ghost:       'text-pink-700 hover:bg-pink-50 dark:text-[var(--text-brand)] dark:hover:bg-[var(--bg-hover)]',
        destructive: 'bg-red-500 text-white hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-600',
        secondary:   'bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:hover:bg-violet-900/60',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6',
        icon: 'h-10 w-10',
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
