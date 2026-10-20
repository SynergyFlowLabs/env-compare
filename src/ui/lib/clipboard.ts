/**
 * Copying, with an honest fallback.
 *
 * The Clipboard API is not available in every browser or every context (it
 * needs a secure origin and, in some browsers, a user gesture). We never use
 * `document.execCommand('copy')`: it is deprecated, and when it fails it fails
 * silently, which leaves the user pasting stale clipboard content.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the manual dialog
  }
  return false;
}

/** Download generated text without touching the network. */
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** File names must be safe in a download attribute. */
export function safeFileName(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]+/g, '-');
  return cleaned === '' ? 'env' : cleaned;
}
