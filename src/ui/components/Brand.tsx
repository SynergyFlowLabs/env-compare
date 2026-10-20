/**
 * The mark is the product in miniature: two rails, with a gap in the second one.
 * Missing variables are holes, so the logo is a hole.
 */
export function Wordmark() {
  return (
    <a className="wordmark" href="/">
      <svg
        className="wordmark__mark"
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
      <span className="wordmark__env">env</span>
      <span>compare</span>
    </a>
  );
}

export function PrivacyBadge() {
  return (
    <a className="privacy-badge" href="/privacy" title="How this tool handles your data">
      <span className="privacy-badge__dot" aria-hidden="true" />
      <span className="privacy-badge__text">Runs in your browser · nothing is uploaded</span>
      <span className="sr-only">Read how this works</span>
    </a>
  );
}
