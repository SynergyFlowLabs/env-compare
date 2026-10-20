import { useCallback } from 'react';
import { Check, Copy, TriangleAlert } from 'lucide-react';
import type { ExportKind } from '../../state/reducer';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface ExportDialogProps {
  kind: ExportKind;
  text: string;
  /** True when the text was already placed on the clipboard while opening. */
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}

const COPY: Record<ExportKind, { title: string; description: string; label: string; noun: string }> = {
  prompt: {
    noun: 'prompt',
    title: 'Prompt for your agent',
    description:
      'Paste this into your coding agent. It names what needs attention and nothing else — no values, and nothing from either file is sent anywhere.',
    label: 'Prompt text',
  },
  report: {
    noun: 'report',
    title: 'Report',
    description:
      'Paste this into a PR, a chat, or an issue. The redaction level you chose is already applied — check it before you share.',
    label: 'Report text',
  },
};

/**
 * An export that was just copied, shown so the reader can see what went to the
 * clipboard before pasting it somewhere else.
 *
 * It is a dialog rather than a toast because: the reader should read it, and if
 * the browser refused the copy, this text is the only way to get it out.
 */
export function ExportDialog({ kind, text, copied, onCopy, onClose }: ExportDialogProps) {
  const copy = COPY[kind];

  /**
   * If the automatic copy was refused, select the text so one keyboard copy is
   * enough. Done from the ref callback rather than an effect because Radix
   * mounts the dialog's content a commit later — on first render there is no
   * element yet — and deferred by a tick because Radix then focuses the dialog,
   * and focusing collapses a selection made too early.
   */
  const selectIfRefused = useCallback(
    (node: HTMLPreElement | null) => {
      if (!node || copied) return;
      window.setTimeout(() => {
        const selection = window.getSelection?.();
        if (!selection) return;
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
      }, 0);
    },
    [copied],
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <pre
          ref={selectIfRefused}
          className="max-h-[320px] overflow-auto rounded-md border border-border bg-secondary/60 px-3 py-2.5 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap scroll-quiet"
          aria-label={copy.label}
        >
          {text}
        </pre>

        <p
          className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-ok" aria-hidden="true" />
              Copied to your clipboard. Select the text if you would rather copy it by hand.
            </>
          ) : (
            <>
              <TriangleAlert className="size-3.5 text-empty" aria-hidden="true" />
              Your browser blocked the clipboard. Select the text above and copy it with your
              keyboard.
            </>
          )}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
          <Button onClick={onCopy}>
            <Copy aria-hidden="true" />
            {copied ? `Copy ${copy.noun} again` : `Copy ${copy.noun}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
