import { Wordmark } from '../components/Brand';
import { SkipLink } from '../components/SkipLink';

const SOURCE = 'https://github.com/SynergyFlowLabs/env-compare';

export function Privacy() {
  return (
    <div className="shell">
      <SkipLink />
      <header className="header">
        <div className="header__inner">
          <Wordmark />
          <span className="header__spacer" />
          <nav className="header__nav" aria-label="Site">
            <a href="/">Tool</a>
            <a href="/about">About</a>
          </nav>
        </div>
      </header>

      <main className="shell__main" id="main" tabIndex={-1}>
        <article className="page">
          <h1>Your file never leaves this tab</h1>
          <p>
            EnvCompare is a static page. There is no server of ours to send anything to, and no
            code in the page that could. That is a design decision, not a policy — and you can
            check it yourself in about thirty seconds.
          </p>

          <h2>Three promises, and how they are enforced</h2>
          <ul className="checklist">
            <li>
              <span className="checklist__yes" aria-hidden="true">
                ✓
              </span>
              <span>
                <strong>Nothing is uploaded.</strong> The site is static files. The production
                Content-Security-Policy sets <code>connect-src 'none'</code>, so the browser
                refuses any request the page might attempt. There are no API routes and no
                functions.
              </span>
            </li>
            <li>
              <span className="checklist__yes" aria-hidden="true">
                ✓
              </span>
              <span>
                <strong>Nothing is stored.</strong> No <code>localStorage</code>, no{' '}
                <code>sessionStorage</code>, no <code>IndexedDB</code>, no cookies, no service
                worker. A check in CI fails the build if any of those appear in the source.
              </span>
            </li>
            <li>
              <span className="checklist__yes" aria-hidden="true">
                ✓
              </span>
              <span>
                <strong>No third-party code.</strong> No analytics, no tag manager, no error
                reporter, no CDN fonts. The runtime dependencies are React and React DOM, nothing
                else.
              </span>
            </li>
            <li>
              <span className="checklist__yes" aria-hidden="true">
                ✓
              </span>
              <span>
                <strong>No shareable links.</strong> File names and values never enter the URL or
                the hash, so they cannot end up in browser history, a screenshot of the address
                bar, or a Referer header.
              </span>
            </li>
          </ul>

          <h2>Verify it yourself</h2>
          <ol>
            <li>Open your browser&apos;s developer tools and switch to the Network tab.</li>
            <li>Clear the list, then paste two files and use the tool — edit a value, copy the fix.</li>
            <li>
              Nothing new appears. The only requests are the page and its own static assets, made
              before you pasted anything.
            </li>
            <li>
              Switch to Application → Storage. Local Storage, Session Storage, IndexedDB and
              Cookies are all empty.
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
