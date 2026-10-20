# Progress

Implementation tracker for EnvCompare. The plan comes from [docs/PRD.md](docs/PRD.md); this file records **what is actually built, tested, and pushed**.

**Branch:** `arena/b6d6dd02-env-compare` · **Status:** in progress · **Last update:** 2026-10-20

---

## Plan

| # | Step | PRD ref | Status |
| --- | --- | --- | --- |
| 0 | Scaffold: Vite + React 19 + TS, test toolchain, `AGENTS.md`, privacy-first repo config | §14 | ✅ done |
| 1 | Parser core: lossless scanner, dotenv-compatible semantics, diagnostics | §12.1–12.4 | ✅ done |
| 2 | Parser fixture corpus + conformance tests against real `dotenv` | §16.2 | ✅ done |
| 3 | Compare engine: key universe, six states, severity, summary, ordering | §9, §12.5 | ✅ done |
| 4 | Placeholder + secret heuristics | §12.9, §12.10 | ✅ done |
| 5 | Surgical patch engine (edit / add / remove / uncomment) + undo | §12.13 | ✅ done |
| 6 | Exporters: fix block, redacted report, agent prompt | §8.3 | ✅ done |
| 7 | UI: input state, sample data, role detection, swap, clear | §10.2 | ✅ done |
| 8 | UI: summary + table (aligned, ghost cells, filters, states) | §10.3 | ✅ done |
| 9 | UI: raw view, fix panel, report panel, masking | §10.3, §13.6 | ✅ done |
| 10 | Privacy layer: CSP headers, CI guard script, `/privacy` page | §13 | ✅ done |
| 11 | Component + e2e tests, a11y pass | §16 | 🟡 component tests done · e2e written, runs in CI · a11y pass pending |
| 12 | Docs & launch artefacts: README demo, CONTRIBUTING, SECURITY, templates, LICENSE | §15 | 🟡 in progress |

---

## Log

### 2026-10-20 — Step 0: scaffold

- Committed the PRD (`docs/PRD.md`) and the public `README.md`.
- Added `AGENTS.md` (agent-facing conventions) and this tracker.
- Toolchain: Vite 8, React 19, TypeScript 7, Vitest 5 + jsdom + Testing Library, `dotenv` as a **dev-only** dependency for parser conformance tests.
- Installed skills from [skills.sh](https://skills.sh) for UI direction (`anthropic/skills · frontend-design`) and browser verification (`webapp-testing`), pruned to those two under `.agents/skills/`.
- Verified: `tsc` clean, `vitest` green, `vite build` produces 68.6 kB gzip.
- Runtime dependencies are **exactly** `react` and `react-dom` — this is enforced later by the privacy guard (§13.3).

### 2026-10-20 — Steps 1–2: parser core + conformance corpus

Built `src/core/parse/`:

- `dotenvCompat.ts` — dotenv v18's grammar (verbatim regex, `d` flag for match indices) and value normalisation: trim → strip one quote pair → expand `\n`/`\r` only in double quotes. CRLF is normalised exactly as dotenv does.
- `scanner.ts` — walks the text with the grammar, then classifies every **uncovered** line so nothing is silently dropped: commented-out assignments become `commentedKeys`, invalid lines become `PARSE_BAD_KEY`, `KEY:value` gets `COLON_NO_SPACE`, and stray text gets `PARSE_NO_VALUE`.
- `lines.ts` — offset-preserving line splitter (`\r\n`, `\n`, `\r`) plus binary-search line lookup. Every occurrence carries absolute `span` / `keySpan` / `valueSpan` offsets, which is what makes surgical table edits possible later.
- Diagnostics: `DUP_KEY` (last wins, both lines reported), `MULTILINE`, `SUSPECT_HASH_TRUNCATION`, `PARSE_*`, `NOT_TEXT`, `TOO_LARGE`, `MANY_KEYS`.
- 32 fixtures in `tests/fixtures/env/` + `expectations.json` golden manifest.
- **65 conformance assertions** (`tests/unit/dotenv-conformance.test.ts`): our `effective` map must deep-equal `dotenv.parse(text)` for every fixture, plus key-order stability.

Two bugs the tests caught, both now fixed and covered:

1. **CRLF inside a multiline quoted value.** dotenv normalises line endings for the whole file before parsing, so `MULTI="one\r\ntwo"` yields `one\ntwo`. Our value kept the `\r`. Fixed in `normalizeValue`; the conformance suite failed loudly, which is exactly its job.
2. **Line numbers drifted on CRLF files.** dotenv's leading `\s*` can consume the *previous* line's terminator, so `match.index` points into the previous line. Line numbers are now derived from the key offset, and `span.start` is snapped to the start of the physical line so a later "remove line" edit cannot eat the preceding newline.

### 2026-10-20 — Steps 3–4: compare engine + heuristics

Built `src/core/compare/`:

- `types.ts` — `Presence`, `Cell`, `KeyRow`, `Comparison`, severity ranking, plain-language presence labels.
- `compare.ts` — key universe (reference order → commented keys → target-only keys in first-appearance order), per-cell classification, row severity/bucket, per-file counts, summary, and per-file diagnostics (parse + unresolved `${REF}`).
- `placeholder.ts` — the two-tier heuristic from §12.9: high confidence only, because a false positive teaches people to ignore warnings.
- `secrets.ts` — key-name and value-shape detection for masking, the live-credential hint, and report redaction.
- `roles.ts` — reference detection for `.env.example` / `.sample` / `.template` / `.dist` / `example.env`.

**226 tests green**, including the full Appendix B state matrix, the Appendix A golden case, and a 2 × 1,200-key comparison in < 50 ms.

Three problems surfaced while writing the tests — all fixed:

1. **Commented keys were invisible in the table.** `SENTRY_DSN` exists only as `# SENTRY_DSN=` in the example, so it never entered the key universe and the row simply did not exist. `commentedKeys` is now a `Map<key, line>` and its keys join the universe right after the reference's real keys, preserving source order. This is what makes "optional integration, switched off" visible instead of silently absent.
2. **Severity ties resolved arbitrarily.** With one target missing a key and another having it empty, both are `error` but the *fix* differs (add vs fill). Rows now tie-break by bucket priority (`missing` > `needsValue` > …) so the report names the most actionable problem.
3. **The PRD's Appendix A contradicted Appendix B.** Appendix A called a real JWT replacing `your-anon-key` a "difference"; Appendix B correctly treats a placeholder-that-got-filled as **matching**. Appendix B is right — flagging every correctly filled row as "different" is noise — so the PRD was corrected, not the code.

### 2026-10-20 — Steps 5–6: patch engine + exporters

Built `src/core/patch/` and `src/core/export/`:

- `applyPatch.ts` — four patch kinds: `replaceValue`, `insertKey`, `removeKey`, `uncomment`. Every edit is a splice against the original text, so comments, blank lines, ordering, quoting and line endings survive. `renderValue` picks a quote style the content cannot collide with, because dotenv does *not* unescape `\\`, `\'` or `\"` — escaping is the last resort and it emits a note when it happens.
- `fixBlock.ts` — the paste-ready block. Always blank values; skips keys the reference only documents as comments.
- `report.ts` — Markdown report with three redaction levels (`keys` default, `masked`, `full`), problem rows only, plus a "N others match" line and parse notes.
- `prompt.ts` — keys-only instruction for the AI agent that wrote the example.

**270 tests green.** Two more real bugs, both in the parser's span data:

1. **`KEY=` pointed its empty value span at the wrong offset.** With no value, `valueSpan` used the end of the *key*, so editing `A=` produced `Afilled=`. The span now starts just past the `=`/`:` separator and any spaces.
2. **Unquoted values swallowed the gap before a trailing comment.** The grammar's value group includes trailing spaces, so `A=old # note` had a span covering `"old "` and an edit produced `A=new# note`. Unquoted value spans are now trimmed; quoted spans are untouched, since spaces there are content.

Both were caught by round-trip tests (`replaceValue` → re-parse → expect the new value), which is the check that matters: the table must never corrupt a file.

Also worth noting for reviewers: the fix block, report and prompt each have a test asserting that **no value substring from either file appears in the output**. That is the privacy promise expressed as an executable check.

### 2026-10-20 — Steps 7–10: interface + privacy enforcement

Built the whole UI (`src/ui`, `src/state`, `src/styles`) against [`docs/DESIGN.md`](docs/DESIGN.md):

- **Landing**: two file panes with editable names, drag-drop and file picker, live `n variables · m lines` counts, sample data, reference detection and swap.
- **Results**: one plain-language sentence, four tabs (Summary / Table / Raw / Fix), per-file counts, filters, sort, an action card with the paste-ready block.
- **Table**: row-aligned, line-number gutter, dashed "sockets" for missing variables, inline editing, Add / Uncomment / Remove, per-row reveal under masking.
- **Raw**: both files with annotated lines and synthetic "missing here" markers placed after the nearest preceding present key — visibly not part of the file.
- **Fix**: fix block, download, report with three redaction levels, agent prompt.
- **Trust**: `/privacy` and `/about` as real page loads (no client router, so no URL state), accessible dialogs, toasts with undo.

Privacy enforcement is now mechanical:

- `vercel.json` sets the production CSP (`connect-src 'none'`, no third-party origins) plus `Referrer-Policy`, `Permissions-Policy`, COOP/CORP, HSTS.
- `npm run privacy` fails the build on: storage/network/tracking APIs in `src/`, a runtime dependency outside `{react, react-dom}`, external `script`/`link`/`url()` in `dist`, inline scripts, and any network-capable API in the bundle.

**281 tests green**, typecheck clean, bundle 86.5 kB gzip (18.3 kB app + 68.3 kB React), guard green.

Findings worth flagging to reviewers:

1. **React DOM ships a `fetch` call.** Its resource-preload helper (`fetch(e.href, n)`) is in the bundle and is unreachable here (we never render a preload `<link>`), and `connect-src 'none'` blocks it anyway. Rather than weaken the promise, the guard strips *that exact call* and fails on any other `fetch(` — plus React lands in its own `vendor` chunk so the app chunk is provably request-free. This is the kind of thing a "we don't phone home" README would never have told you.
2. **No browser available in this sandbox.** Chromium downloads are blocked and the Lambda build of Chromium lacks system libs (`libnspr4`), so no screenshots or Playwright runs here. UI behaviour is covered by 11 jsdom + Testing Library tests (paste → results, add/undo, filters, masking, copy + clipboard fallback, raw view). The Playwright suite (`e2e/`) is written and wired into CI, not executed locally.
3. **`frame-ancestors` is deliberately omitted** from the production CSP, against the PRD's draft. There is nothing to clickjack — no session, no cookies, no destructive server action — and blocking embedding would prevent legitimate demos. Recorded below.

---

## Decisions made during implementation

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-20 | Single `tsconfig.json`, no project references | One build target, fewer moving parts for contributors |
| 2026-10-20 | `vitest/config` `defineConfig` in `vite.config.ts` | Keeps one config file; vitest 5 requires it for the `test` key |
| 2026-10-20 | No UI framework, no icon library, hand-written CSS with design tokens | Dependency policy (§14.2) |
| 2026-10-20 | Only two skills vendored into `.agents/skills` | The full skills pack is 13 MB of unrelated material |
| 2026-10-20 | Fixtures are locked by a golden `expectations.json`, not per-file JSON | One reviewable file; a new fixture without an expectation fails the suite |
| 2026-10-20 | `dotenv` stays a devDependency; grammar is vendored into `src/core` | Keeps the browser bundle free of Node shims while conformance keeps us honest |
| 2026-10-20 | Filling a placeholder counts as `matching`, not `different` | A user who did the right thing must not see a flag on their row |
| 2026-10-20 | Secret detection only ever *adds* masking/warnings | A detector that hides or rewrites data would be a new failure mode |
| 2026-10-20 | The report lists problem rows only, not every row | A 500-row report gets skimmed; a 9-row one gets read |
| 2026-10-20 | `insertKey` appends at the end of the file | Anything smarter means guessing where the user wants it; the table offers Undo instead |
| 2026-10-20 | Paste auto-advances to results; typing does not | Auto-advancing mid-keystroke steals the cursor; a paste is a deliberate act |
| 2026-10-20 | Present cells show a quiet ✓ instead of a full chip | A "Set" label on every row is noise that trains people to stop reading labels |
| 2026-10-20 | No client router; `/privacy` and `/about` are real page loads | No history API means no path by which content could reach a URL |
| 2026-10-20 | `frame-ancestors` omitted from the CSP (PRD draft said `none`) | Nothing to clickjack; embedding is useful, and the promise is unaffected |

---

## Verification log

| Check | Command | Result |
| --- | --- | --- |
| Types | `npx tsc -p tsconfig.json` | ✅ clean |
| Unit + component tests | `npm test` | ✅ 281 passed (9 files) |
| dotenv conformance | `npm test` | ✅ 32 fixtures × 2 assertions |
| Build | `npm run build` | ✅ 86.5 kB gzip (18.3 app + 68.3 vendor) |
| Privacy guard | `npm run privacy` | ✅ green |
| E2E | `npm run test:e2e` | ⏳ written, runs in CI (no browser in this sandbox) |

---

## Next step

**Step 11–12 — tests, docs, CI.** Playwright run in CI, a11y pass, CONTRIBUTING / SECURITY / PRIVACY / LICENSE / issue templates, and the README rewrite.
