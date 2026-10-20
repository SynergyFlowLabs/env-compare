import { Cookie, ShieldOff } from 'lucide-react';
import { THEME_COOKIE } from '../lib/consent';
import { useThemeConsent } from '../lib/theme';
import { Button } from './ui/button';

/**
 * The consent decision, stated in one place and reversible in one click.
 *
 * Consent that cannot be withdrawn is not consent, so this is the counterpart
 * to the dialog: it says what is stored right now, and offers to remove it.
 */
export function ThemeMemory() {
  const { remembered, theme, forget } = useThemeConsent();

  return (
    <div className="mt-3 rounded-md border border-border bg-card px-3.5 py-3">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
        {remembered ? (
          <>
            <Cookie className="size-4 text-muted-foreground" aria-hidden="true" />
            Remembered
          </>
        ) : (
          <>
            <ShieldOff className="size-4 text-muted-foreground" aria-hidden="true" />
            Not remembered
          </>
        )}
      </p>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        {remembered ? (
          <>
            One cookie, <code className="mono">{THEME_COOKIE}={theme}</code>, expires after a year.
            It contains nothing else, and nothing else on this site sets a cookie.
          </>
        ) : (
          <>
            No cookie is set. Your theme lasts until you reload the page, and the default is to
            follow your operating system.
          </>
        )}
      </p>
      {remembered ? (
        <Button type="button" variant="outline" size="sm" className="mt-2.5" onClick={forget}>
          Forget my theme
        </Button>
      ) : null}
    </div>
  );
}
