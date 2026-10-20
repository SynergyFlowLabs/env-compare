import { useEffect } from 'react';
import type { Toast as ToastState } from '../../state/reducer';

interface ToastProps {
  toast: ToastState | null;
  onDismiss: () => void;
  onUndo: () => void;
}

const DURATION = 6000;

export function Toast({ toast, onDismiss, onUndo }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, DURATION);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="toasts" role="status" aria-live="polite">
      <div className="toast">
        <span>{toast.message}</span>
        {toast.undoable ? (
          <button type="button" className="toast__undo" onClick={onUndo}>
            Undo
          </button>
        ) : null}
      </div>
    </div>
  );
}
