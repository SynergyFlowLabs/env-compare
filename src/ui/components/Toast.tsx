import { useEffect } from 'react';
import { CircleCheck, Undo2 } from 'lucide-react';
import type { Toast as ToastState } from '../../state/reducer';
import { Button } from './ui/button';

interface ToastProps {
  toast: ToastState | null;
  onDismiss: () => void;
  onUndo: () => void;
}

const DURATION = 6000;

/**
 * One toast at a time, in the bottom-right corner, with Undo when the action
 * that produced it is reversible. Never blocks the page: it is a status, not a
 * dialog.
 */
export function Toast({ toast, onDismiss, onUndo }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, DURATION);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 bottom-4 z-50 flex max-w-[min(420px,calc(100vw-2rem))] items-center gap-3 rounded-md border border-border bg-popover py-2 pr-2 pl-3.5 text-[13px] text-popover-foreground shadow-[0_8px_24px_rgb(0_0_0/18%)] data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-2"
    >
      <CircleCheck className="size-4 shrink-0 text-ok" aria-hidden="true" focusable="false" />
      <span className="flex-1">{toast.message}</span>
      {toast.undoable ? (
        <Button variant="outline" size="sm" onClick={onUndo}>
          <Undo2 aria-hidden="true" />
          Undo
        </Button>
      ) : null}
    </div>
  );
}
