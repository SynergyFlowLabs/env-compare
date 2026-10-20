/**
 * First thing in the tab order. Visible only on keyboard focus, so a screen
 * reader or keyboard user can jump past the header without tabbing through it.
 */
export function SkipLink({ target = 'main' }: { target?: string }) {
  return (
    <a
      href={`#${target}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-background"
    >
      Skip to content
    </a>
  );
}
