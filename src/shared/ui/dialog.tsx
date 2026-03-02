import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
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
    className={cn('fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0', className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Base
        'fixed z-50 grid bg-[var(--bg-surface)] shadow-xl border border-[var(--border-subtle)] text-[var(--text-primary)] duration-200 overflow-y-auto',
        // Shared animations
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        // Mobile: bottom sheet anchored at bottom
        'bottom-0 left-0 right-0 w-full max-h-[90svh] rounded-t-2xl p-4 pt-8 gap-3',
        'max-sm:data-[state=open]:slide-in-from-bottom',
        'max-sm:data-[state=closed]:slide-out-to-bottom',
        // Desktop: centered modal
        'sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:right-auto',
        'sm:translate-x-[-50%] sm:translate-y-[-50%]',
        'sm:w-[calc(100%-2rem)] sm:max-w-lg sm:max-h-[85dvh]',
        'sm:rounded-2xl sm:p-6 sm:gap-4',
        'sm:data-[state=open]:zoom-in-95',
        'sm:data-[state=closed]:zoom-out-95',
        className,
      )}
      {...props}
    >
      {/* Drag handle — mobile only */}
      <div
        className="sm:hidden absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-[var(--border-medium)]"
        aria-hidden="true"
      />
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-pink-400">
        <X size={16} />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5', className)} {...props} />
);

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold text-[var(--text-primary)]', className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose };
