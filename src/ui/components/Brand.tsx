import { ShieldCheck } from 'lucide-react';

/**
 * The mark is the product in miniature: two rails, with a gap in the second one.
 * Missing variables are holes, so the logo is a hole.
 */
export function Wordmark() {
  return (
    <a
      className="inline-flex items-baseline gap-px text-[17px] leading-none font-semibold tracking-[-0.02em] text-foreground no-underline"
      href="/"
    >
      <svg
        className="mr-2 size-5 self-center"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="2" y="3" width="4" height="14" rx="1" fill="currentColor" opacity="0.85" />
        <rect x="13" y="3" width="4" height="4.5" rx="1" fill="currentColor" opacity="0.85" />
        <rect x="13" y="12" width="4" height="5" rx="1" fill="currentColor" opacity="0.85" />
        <path d="M14 9.5h2" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1.4 1.4" />
      </svg>
      <span className="mono font-medium tracking-[-0.04em]">env</span>
      <span>compare</span>
    </a>
  );
}

export function PrivacyBadge() {
  return (
    <a
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pr-2.5 pl-2 text-[12px] whitespace-nowrap text-muted-foreground no-underline transition-colors hover:border-input hover:text-foreground"
      href="/privacy"
      title="How this tool handles your data"
    >
      <ShieldCheck className="size-3.5 text-ok" aria-hidden="true" />
      <span className="hidden md:inline">Runs in your browser · nothing is uploaded</span>
      <span className="sr-only md:hidden">Runs in your browser. Nothing is uploaded.</span>
      <span className="sr-only">Read how this works</span>
    </a>
  );
}
