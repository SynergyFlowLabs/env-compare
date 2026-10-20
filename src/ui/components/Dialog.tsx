import type { ReactNode } from 'react';
import { Button } from './ui/button';
import {
  Dialog as DialogRoot,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface DialogProps {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

/**
 * Radix owns the focus trap, the Escape key, the portal and `aria-modal` now;
 * this wrapper only fixes the wording and the button order. The API is kept so
 * call sites read the same as before.
 */
export function Dialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  destructive = false,
}: DialogProps) {
  return (
    <DialogRoot
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-[13px] text-muted-foreground">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
