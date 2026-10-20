# Contributing

Thanks for looking. This project is deliberately small, so most contributions are either a **parser edge case**, a **UI polish**, or a **documentation fix** — all three are welcome.

## Set up

```bash
npm install       # postinstall scripts are disabled in .npmrc
npm run dev       # http://localhost:5173
npm test          # unit + component tests (vitest)
npm run build     # typecheck + production build
npm run privacy   # the privacy guard (see below)
npm run test:e2e  # Playwright; needs `npx playwright install` first
```

Before opening a PR, run `npm run check`: tests, build and the privacy guard.

## Badges and README assets

`README.md` is the front door; its images live in `docs/assets/`. Both the banner and the badges are
SVG with real text (selectable, searchable, no font download), and the badges are generated:

```bash
node scripts/build-badges.mjs
```

Edit the table at the top of that file — label, value, colour — never the SVGs. If you change the
number of tests, change it in the script and in the README prose; `tests/unit/readme.test.ts` fails if
they disagree, if a referenced asset is missing, or if a badge loses its accessible label.

## Privacy invariants (not negotiable)

The product is only useful because people paste **real secrets** into it. These rules are enforced by `scripts/check-privacy.mjs` and by CI:

1. No storage APIs: `localStorage`, `sessionStorage`, `indexedDB`, cache storage, service workers — not even for a preference. **One exception exists and is not a precedent:** `document.cookie`, confined to `src/ui/lib/consent.ts`, holding only the theme, only after the reader consents. The guard enforces the file, the cookie name and its `SameSite`/`Path`/`Max-Age` attributes; another cookie, another file, or another purpose fails the build.
2. No network APIs: `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `history.pushState`.
3. No new runtime dependency without review. The allowlist lives in `scripts/check-privacy.mjs` with a reason and a license per entry, and the guard fails the build on anything else, on a changed license, or on an install script. Adding an entry is a deliberate act: say what it does in the PR.
4. No file content in a URL, a hash, or a share link.
5. Masked values must not exist in the DOM while masked.
6. Fix blocks, reports (default redaction) and agent prompts must never contain a value. Tests assert this with real-looking strings.
7. No inline executable `<script>` and no third-party `<script src>` in the built HTML. A single `<script type="application/ld+json">` data block is allowed for structured data; the guard rejects it if it does not parse as JSON, so it cannot be used to smuggle code. `<link rel="canonical">` is the only external `<link>` permitted, because metadata is not a request.

A PR that relaxes any of these will be declined, whatever else it improves.

## Parser changes

The parser is the product's accuracy budget, so changes go test-first:

1. Add a fixture to `tests/fixtures/env/` that reproduces the case. **Use fake values only.**
2. Add its expectation to `tests/fixtures/env/expectations.json` (keys, commented keys, diagnostic codes).
3. Make `tests/unit/dotenv-conformance.test.ts` pass — our parse must equal `dotenv.parse()` for every fixture.
4. Then change the parser.

If the fixture reveals a genuine divergence from dotenv, say so in the PR: a documented divergence is fine, an accidental one is a bug.

## UI components

The interface is [shadcn/ui](https://ui.shadcn.com) source, copied in rather than installed:

- Primitives live in `src/ui/components/ui/` and are adapted from upstream only to fit this product's scale (13px text, 32px controls). If you need a new one, copy the upstream source and add the dependency it needs to the reviewed allowlist — do not add a design-system package.
- Product components live in `src/ui/components/` and compose the primitives.
- `cn()` from `src/ui/lib/utils.ts` for conditional classes; no ad-hoc template strings.
- Colours come from the tokens in `src/styles/tokens.css` via the Tailwind theme in `src/styles/global.css` (`bg-card`, `text-missing`, `border-ok/25`…). Do not hard-code a hex value in a component: it will not follow the theme, and the contrast test cannot see it.
- shadcn's semantic names (`background`, `card`, `primary`, `muted`, `border`) are mapped onto the palette; the six comparison states keep their own names.

## Code layout

- `src/core/` — pure TypeScript, no DOM, no React. Parsing, comparison, patches, exports. This is where correctness lives; it is also the easiest place to start.
- `src/state/` — one reducer, no persistence.
- `src/ui/` — React components and the design tokens.

Conventions and the definitions that are easy to get wrong (empty vs placeholder vs commented, last-duplicate-wins, `#` truncation) are in [AGENTS.md](AGENTS.md).

## Style

- TypeScript strict. No `any` in `src/core`.
- Accessibility is a merge requirement: labels/roles first, keyboard path, colour never the only signal.
- Commit messages: `type(scope): summary` — e.g. `fix(parser): handle colon without a space`.
- No formatting-only PRs.

## Reporting a parser bug

Use the **Parser edge case** issue template. It asks for a minimal reproduction with fake values, and it blocks submission without one — a parser bug without a reproduction usually becomes a guess.

**Never paste a real secret** into an issue, a PR, a screenshot or a chat. Replace values with something obviously fake.

## Good first issues

Look for the `good first issue` label. Typical ones: a new placeholder pattern plus a fixture, a new diagnostic message, the keyboard shortcut sheet, a dark-mode contrast fix, an empty-state illustration (SVG only, no network).
