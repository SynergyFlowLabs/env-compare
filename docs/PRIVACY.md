# Privacy

EnvCompare exists to be used with real credentials. That only works if you can satisfy yourself — not take our word — that nothing leaves your browser. This page is the long version of [/privacy](https://env-compare.vercel.app/privacy).

## The short version

| Promise | How it is enforced |
| --- | --- |
| Nothing is uploaded | Fully static site. No backend, no API routes, no server functions. `connect-src 'none'` in the production Content-Security-Policy. |
| Nothing is stored | No `localStorage`, `sessionStorage`, `IndexedDB`, cookies, cache storage, or service worker. `npm run privacy` fails the build if any of those APIs appear in `src/`. |
| No third-party code | No analytics, no fonts CDN, no tag manager, no CAPTCHA. Runtime dependencies are exactly `react` and `react-dom`, and CI asserts it. |
| No shareable links | No URL or hash state. File content cannot end up in a link, a history entry, or an address bar in a screenshot. |
| Masking is real | Masked values are removed from the DOM, not hidden with CSS. There is a test for it. |
| Exports are safe by default | Fix blocks, agent prompts and default reports contain key names only — never a value. |

## Verify it yourself, in 30 seconds

1. Open the tool and press **F12** → **Network**. Clear the list.
2. Paste two files, switch views, edit a value, copy the fix block.
3. Nothing appears. Not one request.

Then **Application → Storage**: Local Storage, Session Storage, IndexedDB and Cookies are all empty. Reload the page: it is empty again, because it was never saved.

To check the build rather than the behaviour, run the guard:

```bash
npm ci
npm run privacy
```

It scans the source for storage and network APIs, checks the runtime dependency allowlist, and scans `dist/` for external scripts, stylesheets, images and `url(http…)` references.

## What we do and do not collect

**Collected: nothing.** There is no server to collect it. The host (Vercel) sees the same thing any static host sees: an IP address and a request for `index.html` and its assets. It cannot see what you type, because typing never produces a request. Vercel's own logs are governed by their policy, not ours.

## Why we deliberately have no features

Each of these was considered and rejected because it would require knowing something about your data:

- **Shareable comparison links.** Would put variable names (and potentially values) in a URL, and in browser history, and in whatever chat app you pasted it into.
- **Saved history / "recent files".** Requires storage. One `localStorage` write turns a verifiable claim into a promise.
- **Team workspaces.** Requires accounts, a backend, and a database of secrets.
- **Analytics.** Even a privacy-friendly counter reports the page you are on. It also makes the source non-auditable by a glance.
- **Crash reporting.** Error reports can contain pasted text.

## Trade-offs we accept

- **Nothing survives a reload.** If you compare three files and then refresh, you start again. This is the price of the guarantee, and it is not negotiable.
- **No theme that persists.** Dark mode follows your operating system's preference, read per render, never stored.
- **Undo is per session.** The history lives in memory and disappears with the tab.

## What we cannot protect you from

- **Your browser extensions.** Anything with permission to read page content can read this page too. This is the most realistic risk when handling real secrets. Consider a separate browser profile, or a window without extensions.
- **Your clipboard.** Copying a value or a report puts it on the system clipboard, where clipboard managers and other apps may keep a log.
- **Downloads.** A downloaded report or file lands on your disk unencrypted.
- **Screen sharing and recording.** The page is on your screen; values are visible unless you mask them.
- **Your own paste.** If you paste into the wrong window, that is outside the app.
- **The network you loaded the page over.** A malicious or compromised DNS/host could serve you a modified copy. Check the certificate, and prefer the build you compiled yourself.
- **A compromised device.** Nothing client-side survives a keylogger.
- **You are still handling secrets.** EnvCompare tells you which keys are missing. It does not give your `.env` file file-system permissions, and it does not rotate a leaked key.

## Threat model

**Assets:** the values in the pasted env files.

**Protectors, in order of importance:**

1. There is no network path. The code has no request function in the app chunk, and the CSP blocks connections at the browser layer even if one appeared.
2. There is no storage path. No storage API is called anywhere in `src/`, and the build fails if one is added.
3. There is no URL path. Paths are static files; nothing is written to history.
4. Masking removes values from the DOM rather than hiding them.
5. Default exports redact values.

**Adversaries considered:**

| Adversary | Outcome |
| --- | --- |
| A malicious contributor adding an exfiltration call | Caught by the guard and by review; a `fetch` cannot succeed under `connect-src 'none'` |
| A compromised npm dependency | Runtime dependency list is two packages and pinned by lockfile; `ignore-scripts=true` in `.npmrc` |
| Someone reading the deployed JavaScript | Bundle contains no endpoints and no keys; only the sample fixtures |
| Network eavesdropping after load | There is no post-load traffic to eavesdrop on |
| A shared or public computer | Reload clears everything; no history to find |

## Reporting a problem

If you find a way to make file content leave the page, that is a security vulnerability — report it privately via the repository's **Security** tab, not a public issue. Please do not include real credentials in the report.
