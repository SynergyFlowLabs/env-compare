import { useCallback } from 'react';
import { Check, Copy, TriangleAlert } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface AgentPromptDialogProps {
  text: string;
  /** True when the prompt was already placed on the clipboard while opening. */
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}

/**
 * The agent prompt, shown as soon as it is requested.
 *
 * Two reasons it is a dialog rather than a toast: the reader needs to see what
 * they are about to hand to an agent, and if the clipboard was blocked the text
 * on screen is the only way out. Copying happens for them (a click that says
 * "copy" should copy), and the state tells the truth when the browser refused.
 */
export function AgentPromptDialog({ text, copied, onCopy, onClose }: AgentPromptDialogProps) {
  /**
   * If the automatic copy was refused, select the prompt so one keyboard copy
   * is enough. Done from the ref callback rather than an effect because Radix
   * mounts the dialog's content a commit later, so on first render there is no
   * element to select yet — and deferred by a tick because Radix then focuses
   * the dialog, and focusing collapses a selection made too early.
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
          <DialogTitle>Prompt for your agent</DialogTitle>
          <DialogDescription>
            Paste this into your coding agent. It names what needs attention and nothing else — no
            values, and nothing from either file is sent anywhere.
          </DialogDescription>
        </DialogHeader>

        <pre
          ref={selectIfRefused}
          className="max-h-[320px] overflow-auto rounded-md border border-border bg-secondary/60 px-3 py-2.5 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap scroll-quiet"
          aria-label="Prompt text"
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
            Copy prompt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
