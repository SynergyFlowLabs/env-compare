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

## Privacy invariants (not negotiable)

The product is only useful because people paste **real secrets** into it. These rules are enforced by `scripts/check-privacy.mjs` and by CI:

1. No storage APIs: `localStorage`, `sessionStorage`, `indexedDB`, cookies, cache storage, service workers. Not even for a theme preference.
2. No network APIs: `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `history.pushState`.
3. No new runtime dependency without a maintainer's `deps-approved` label. Runtime dependencies are exactly `react` and `react-dom`.
4. No file content in a URL, a hash, or a share link.
5. Masked values must not exist in the DOM while masked.
6. Fix blocks, reports (default redaction) and agent prompts must never contain a value. Tests assert this with real-looking strings.

A PR that relaxes any of these will be declined, whatever else it improves.

## Parser changes

The parser is the product's accuracy budget, so changes go test-first:

1. Add a fixture to `tests/fixtures/env/` that reproduces the case. **Use fake values only.**
2. Add its expectation to `tests/fixtures/env/expectations.json` (keys, commented keys, diagnostic codes).
3. Make `tests/unit/dotenv-conformance.test.ts` pass — our parse must equal `dotenv.parse()` for every fixture.
4. Then change the parser.

If the fixture reveals a genuine divergence from dotenv, say so in the PR: a documented divergence is fine, an accidental one is a bug.

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
