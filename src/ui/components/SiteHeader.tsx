import { PrivacyBadge, Wordmark } from './Brand';
import { ThemeConsentDialog } from './ThemeConsentDialog';
import { ThemeSwitch } from './ThemeSwitch';

type Page = 'tool' | 'privacy' | 'about';

const LINKS: Array<{ page: Page; href: string; label: string }> = [
  { page: 'tool', href: '/', label: 'Tool' },
  { page: 'privacy', href: '/privacy', label: 'Privacy' },
  { page: 'about', href: '/about', label: 'About' },
];

/**
 * One header for every page, so the theme control cannot drift between them.
 * The current page is omitted from the nav rather than marked aria-current:
 * the wordmark already links home, and a link to where you are is noise.
 */
export function SiteHeader({ current }: { current: Page }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-[color-mix(in_srgb,var(--paper)_92%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1180px] flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-6">
        <Wordmark />
        <span className="flex-1" />
        <nav className="flex items-center gap-1 text-[13px]" aria-label="Site">
          {LINKS.filter((link) => link.page !== current).map((link) => (
            <a
              key={link.page}
              href={link.href}
              className="rounded-sm px-2.5 py-1.5 text-muted-foreground no-underline transition-colors hover:bg-secondary hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <ThemeSwitch />
        {current === 'tool' ? <PrivacyBadge /> : null}
      </div>
      <ThemeConsentDialog />
    </header>
  );
}
