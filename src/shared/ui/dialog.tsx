import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useI18n } from '@/shared/i18n/I18nContext';
import { cn } from './cn';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-[rgb(46_28_40/0.45)] dark:bg-black/60',
      'data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const { t } = useI18n();

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // Shared base
          'fixed z-50 grid w-full gap-4 overflow-y-auto border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-[var(--text-primary)] shadow-[var(--shadow-float)]',
          // Mobile default: bottom sheet — anchored to bottom, full width, rounded top corners
          // The sheet fills from its top down to the physical bottom of the screen,
          // covering the area behind the keyboard so no transparent overlay shows through.
          // Bottom padding clears the home indicator; without an inset it stays 1.5rem,
          // which is why desktop needs no `sm:` override (a caller's `p-0` still clears it).
          'bottom-0 left-0 right-0 max-h-[90dvh] rounded-t-[20px] border-b-0 pb-[max(1.5rem,env(safe-area-inset-bottom))]',
          'data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out',
          // Desktop (sm+): centered modal
          'sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:right-auto',
          'sm:translate-x-[-50%] sm:translate-y-[-50%]',
          'sm:max-h-[85dvh] sm:rounded-[20px] sm:border',
          'sm:data-[state=open]:animate-dialog-in sm:data-[state=closed]:animate-dialog-out',
          className,
        )}
        {...props}
      >
        {/* Grab handle: marks the phone layout as a sheet. Decorative only. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-2 h-1 w-9 -translate-x-1/2 rounded-full bg-[var(--border-strong)] sm:hidden"
        />
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-5 inline-flex size-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
          <X size={16} aria-hidden="true" />
          <span className="sr-only">{t.common.close}</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

// Right padding keeps the title clear of the close button.
const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  // min-w-0 lets truncating titles shrink inside the content grid instead of widening it.
  <div className={cn('flex min-w-0 flex-col gap-1.5 pr-10', className)} {...props} />
);

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-xl font-[650] tracking-[-0.01em] leading-tight text-[var(--text-primary)]', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose };
