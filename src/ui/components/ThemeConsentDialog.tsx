import { Cookie } from 'lucide-react';
import { THEME_COOKIE } from '../lib/consent';
import { useThemeConsent } from '../lib/theme';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

/**
 * Asked once, at the moment it becomes relevant: when the reader picks Light or
 * Dark for the first time, never on page load.
 *
 * That timing is deliberate. A banner on load is the pattern this product was
 * built to avoid; a question asked at the moment of the action can explain
 * itself, and "Not now" costs the reader nothing.
 */
export function ThemeConsentDialog() {
  const { asking, theme, grant, decline } = useThemeConsent();

  if (!asking) return null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) decline();
      }}
    >
      <DialogContent className="max-w-[440px]" aria-describedby="consent-detail">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cookie className="size-4 text-muted-foreground" aria-hidden="true" />
            Remember your theme?
          </DialogTitle>
          <DialogDescription id="consent-detail">
            EnvCompare can store your choice of {theme === 'dark' ? 'dark' : 'light'} in one cookie,
            so it survives a reload.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border border-border bg-secondary/50 px-3 py-2.5 text-[12.5px]">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="mono">{THEME_COOKIE}</dd>
          <dt className="text-muted-foreground">Value</dt>
          <dd className="mono">{theme === 'dark' ? 'dark' : 'light'}</dd>
          <dt className="text-muted-foreground">Lifetime</dt>
          <dd>One year, on this site only</dd>
        </dl>

        <p className="text-[12.5px] text-muted-foreground">
          That is the whole cookie. It never contains a file name, a key, a value, or anything else
          you paste here — and it is the only one this site sets. Saying no keeps the theme for this
          visit only.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={decline}>
            Not now
          </Button>
          <Button onClick={grant}>Remember it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
