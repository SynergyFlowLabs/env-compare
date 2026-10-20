import { PrivacyBadge, Wordmark } from './Brand';
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
    <header className="header">
      <div className="header__inner">
        <Wordmark />
        <span className="header__spacer" />
        <nav className="header__nav" aria-label="Site">
          {LINKS.filter((link) => link.page !== current).map((link) => (
            <a key={link.page} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <ThemeSwitch />
        {current === 'tool' ? <PrivacyBadge /> : null}
      </div>
    </header>
  );
}
