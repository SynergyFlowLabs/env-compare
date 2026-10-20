/**
 * First thing in the tab order. Visible only on keyboard focus, so a screen
 * reader or keyboard user can jump past the header without tabbing through it.
 */
export function SkipLink({ target = 'main' }: { target?: string }) {
  return (
    <a className="skip-link" href={`#${target}`}>
      Skip to content
    </a>
  );
}
