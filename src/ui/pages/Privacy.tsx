import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { SiteHeader } from '../components/SiteHeader';
import { SkipLink } from '../components/SkipLink';
import { PROSE } from '../lib/prose';
import { ThemeMemory } from '../components/ThemeMemory';

const SOURCE = 'https://github.com/SynergyFlowLabs/env-compare';

const PROMISES: Array<{ title: string; body: ReactNode }> = [
  {
    title: 'Nothing is uploaded.',
    body: (
      <>
        The site is static files. The production Content-Security-Policy sets{' '}
        <code>connect-src &apos;none&apos;</code>, so the browser refuses any request the page might
        attempt. There are no API routes and no functions.
      </>
    ),
  },
  {
    title: 'Your files are never stored.',
    body: (
      <>
        No <code>localStorage</code>, no <code>sessionStorage</code>, no <code>IndexedDB</code>, no
        service worker, and no cookie ever holds anything you paste. A check in CI fails the build if
        any other part of the source touches those APIs. The one cookie this site can set holds a
        single word — your theme — and only if you ask for it. See{' '}
        <a href="#theme-memory">Theme memory</a> below.
      </>
    ),
  },
  {
    title: 'No third-party code that could report back.',
    body: (
      <>
        No analytics, no tag manager, no error reporter, no CDN fonts. The interface uses shadcn/ui
        components built on Radix primitives, plus a few small utilities — all open source, all
        bundled locally, none of them able to reach the network. CI fails the build if a runtime
        dependency is added without review.
      </>
    ),
  },
  {
    title: 'No shareable links.',
    body: (
      <>
        File names and values never enter the URL or the hash, so they cannot end up in browser
        history, a screenshot of the address bar, or a Referer header.
      </>
    ),
  },
];

export function Privacy() {
  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <SiteHeader current="privacy" />

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-16 sm:px-6" id="main" tabIndex={-1}>
        <article className={PROSE}>
          <h1>Your file never leaves this tab</h1>
          <p>
            EnvCompare is a static page. There is no server of ours to send anything to, and no
            code in the page that could. That is a design decision, not a policy — and you can
            check it yourself in about thirty seconds.
          </p>

          <h2>Four promises, and how they are enforced</h2>
          <ul className="!list-none !pl-0">
            {PROMISES.map((promise) => (
              <li key={promise.title} className="flex gap-2.5">
                <Check className="mt-1 size-4 shrink-0 text-ok" aria-hidden="true" />
                <span>
                  <strong className="text-foreground">{promise.title}</strong> {promise.body}
                </span>
              </li>
            ))}
          </ul>

          <h2 id="theme-memory">Theme memory</h2>
          <p>
            The theme control asks once, the first time you choose Light or Dark, whether it may
            remember your choice in a cookie. It never asks on page load, and saying no costs you
            nothing: the theme still applies, it simply lasts until you reload.
          </p>
          <ThemeMemory />

          <h2>Verify it yourself</h2>
          <ol>
            <li>Open your browser&apos;s developer tools and switch to the Network tab.</li>
            <li>Clear the list, then paste two files and use the tool — edit a value, copy the fix.</li>
            <li>
              Nothing new appears. The only requests are the page and its own static assets, made
              before you pasted anything.
            </li>
            <li>
              Switch to Application → Storage. Local Storage, Session Storage and IndexedDB are
              empty. Under Cookies there is at most one entry, <code className="mono">ec-theme</code>,
              and only if you said yes to remembering it.
            </li>
          </ol>

          <h2>What leaves your browser</h2>
          <p>
            The request for this page and its static files, served by Vercel&apos;s CDN. Like any
            web server, Vercel sees an IP address, a user agent and the path requested. It never
            sees your files, because there is no request that carries them.
          </p>

          <h2>What we cannot protect you from</h2>
          <ul>
            <li>Your browser extensions, password manager, or clipboard history.</li>
            <li>Screen sharing or recording while values are visible — use “Hide values”.</li>
            <li>Anyone with access to your unlocked device.</li>
            <li>
              A copy of this site on another domain. Check the address; the canonical source is{' '}
              <a href={SOURCE}>the GitHub repository</a>.
            </li>
          </ul>

          <h2>The things this tool will never do</h2>
          <p>
            No accounts. No saved projects. No cloud sync. No shareable links containing file
            content. No analytics. No “AI explanation” that would require sending your keys
            somewhere. These are written into the project as non-goals, so a future contributor
            cannot quietly add one.
          </p>

          <h2>Found a problem?</h2>
          <p>
            Security issues: please open a private advisory on the repository rather than a public
            issue. And never paste a real secret into an issue, a chat, or a screenshot — use an
            obviously fake value.
          </p>
        </article>
      </main>
    </div>
  );
}
