# Security policy

## Reporting

Please use GitHub's **private vulnerability reporting** (Security → Report a vulnerability) rather than a public issue.

- Acknowledgement target: 72 hours.
- Please include the version or commit, the browser, and a reproduction.
- **Never include a real secret** in a report. Use an obviously fake value.

## What is in scope

- Anything that causes file content to leave the browser (a request, a storage write, a link, a log).
- A masked value remaining readable in the DOM.
- A generated report, fix block or prompt containing a value it should not.
- Dependency or build-chain issues that could inject code into the bundle.
- XSS through pasted content.

## What is out of scope

- Browser extensions, password managers, OS clipboard managers, or screen recorders reading the page. These are outside the application's control and are documented on `/privacy`.
- Forks or lookalike domains. Verify the address.
- Missing security headers on a self-hosted deployment that overrides `vercel.json`.
- Denial of service against your own browser by pasting an enormous file (there is a 2 MB client-side limit, but it is a UX guard, not a security boundary).

## The promise

EnvCompare is a static page with no backend and no accounts. Its Content-Security-Policy sets `connect-src 'none'`, and CI fails the build if a storage or network API appears in `src/`. If you find a way around that, it is a security bug and we want to hear about it.
