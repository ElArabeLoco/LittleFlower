import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from './cn';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

/**
 * Floating layer anchored to its trigger: 20px radius and the tinted float
 * shadow, like dialogs. Portaled, so sticky headers never clip it. The height
 * never exceeds the room Radix measures between the trigger and the viewport
 * edge; content that needs more scrolls inside.
 */
const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'end', sideOffset = 8, collisionPadding = 8, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        'z-50 w-[min(24rem,calc(100vw-1rem))] max-h-[min(70dvh,36rem,var(--radix-popover-content-available-height))] overflow-y-auto',
        'rounded-[20px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-float)]',
        // The panel takes focus as a whole; its controls draw their own rings.
        'outline-hidden',
        'data-[state=open]:animate-popover-in data-[state=closed]:animate-popover-out',
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent };
