# AGENTS.md

Guidance for coding agents and humans working in this repository. Read this before changing code.

## What this project is

A **browser-only** tool that compares `.env` files. The product promise is that file content **never leaves the tab**. Almost every rule below exists to protect that promise.

- Spec: [`docs/PRD.md`](docs/PRD.md) — the source of truth for behaviour. When code and PRD disagree, the PRD wins (or the PRD gets amended, deliberately).
- Tracker: [`PROGRESS.md`](PROGRESS.md) — what is actually built.

## Commands

```bash
npm install          # install (postinstall scripts are disabled via .npmrc)
npm run dev          # vite dev server on http://localhost:5173
npm test             # vitest (unit + component)
npm run build        # tsc --noEmit check, then vite build to dist/
npm run privacy      # privacy guard: forbidden APIs, deps, external origins
npm run check        # test + build + privacy
```

Run `npm test` and `npm run privacy` before every commit. Both are required in CI.

## Hard invariants (do not break these)

These are enforced by `scripts/check-privacy.mjs` and by tests. A PR that breaks one is rejected regardless of quality.

1. **No network.** No `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, or any third-party origin. The production CSP is `connect-src 'none'`.
2. **No storage.** No `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `caches`, or service worker. Not even for a theme preference.
3. **No URL state.** File names or content must never enter the URL, the hash, or history.
4. **No runtime dependencies beyond `react` and `react-dom`.** Ask before adding one (label `deps-approved`).
5. **No telemetry of any kind**, including error reporting services.
6. **Secrets never reach the DOM while masked**, and copied fix blocks never contain values.

## Code layout

```
src/core/       pure TypeScript, no DOM, no React — 100% unit-testable, shared with any future CLI
  parse/        lossless scanner + dotenv-compatible value semantics + diagnostics
  compare/      key universe, states, severity, placeholder and secret heuristics
  patch/        surgical text edits (never rewrite a file wholesale)
  export/       fix block, redacted report, agent prompt
src/state/      one reducer, derived selectors, no persistence
src/ui/         React components, pages, design tokens (src/styles/tokens.css)
tests/          unit/, component/, fixtures/env/ (parser corpus)
e2e/            Playwright: privacy suites that run in CI, not locally by default
```

**Keep `src/core` framework-free.** It is the part with the highest correctness bar and the easiest thing for a contributor to work on.

## Conventions

- TypeScript strict mode; no `any` in `src/core` (use `unknown` + narrowing).
- Values are **strings, always**. Never coerce to number or boolean — dotenv does not.
- Every parser change needs a fixture in `tests/fixtures/env/` **before** the fix, plus its expected JSON.
- Prefer editing functions that take text + return text (surgical patches). Never regenerate a whole file from a model: comments, ordering, and quoting belong to the user.
- Accessibility is a merge requirement: roles/labels first, `data-testid` never as the only query.
- Colour is never the only signal for a state — always icon + text.
- Anything that would store, transmit, or put file content in a URL is out of bounds. `npm run privacy` enforces it; do not add it to the allowlist.
- New UI needs a jsdom test in `tests/component/` and, if it touches a privacy claim, an assertion in `e2e/privacy.spec.ts`.
- Commit messages: `type(scope): summary`, where type ∈ {feat, fix, test, docs, chore, refactor}. Scope is the area (`parser`, `compare`, `ui`, `privacy`).

## Definitions that are easy to get wrong

- A key is **case-sensitive** and never normalised.
- `KEY=` is `empty`; `KEY=changeme` is `placeholder`; `# KEY=` is `commented`; a missing key is `absent`.
- Duplicates: the **last** assignment wins, and a diagnostic reports both lines.
- `#` truncates an unquoted value — `PASSWORD=abc#123` is `abc`. This is surfaced as a warning, not a silent fix.
- `${VAR}` is **not** expanded by dotenv; we only validate that the reference resolves within the same file.

## Verifying a change

```bash
npm run typecheck     # tsc, project-wide
npm test              # 282 unit + component tests
npm run build         # typecheck + production build
npm run privacy       # storage/network/dependency guard
npm run check         # all of the above, in the order CI runs them
```

There is no browser in some sandboxes. If Playwright cannot install, do not silently skip the
verification: write the e2e assertion anyway, state that it is CI-only, and cover the behaviour
in a jsdom component test so the logic is still checked.

## When you are unsure

Read the relevant PRD section (linked from nearly every heading in `PROGRESS.md`'s plan table). If the PRD does not cover the case, prefer the least surprising behaviour for a non-technical user, add a test that documents the choice, and note it in `PROGRESS.md` under "Decisions made during implementation".
