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
| 5 | Surgical patch engine (edit / add / remove / uncomment) + undo | §12.13 | ⬜ |
| 6 | Exporters: fix block, redacted report, agent prompt | §8.3 | ⬜ |
| 7 | UI: input state, sample data, role detection, swap, clear | §10.2 | ⬜ |
| 8 | UI: summary + table (aligned, ghost cells, filters, states) | §10.3 | ⬜ |
| 9 | UI: raw view, fix panel, report panel, masking | §10.3, §13.6 | ⬜ |
| 10 | Privacy layer: CSP headers, CI guard script, `/privacy` page | §13 | ⬜ |
| 11 | Component + e2e tests, a11y pass | §16 | ⬜ |
| 12 | Docs & launch artefacts: README demo, CONTRIBUTING, SECURITY, templates, LICENSE | §15 | ⬜ |

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

---

## Verification log

| Check | Command | Result |
| --- | --- | --- |
| Types | `npx tsc -p tsconfig.json` | ✅ clean |
| Unit tests | `npm test` | ✅ 226 passed (6 files) |
| dotenv conformance | `npm test` | ✅ 32 fixtures × 2 assertions |
| Build | `npx vite build` | ✅ 68.6 kB gzip |
| Privacy guard | `npm run privacy` | ⬜ not implemented yet |

---

## Next step

**Step 5 — patch engine.** Surgical text edits (`replaceValue`, `insertKey`, `removeKey`, `uncomment`) that preserve quoting, comments, ordering and line endings, plus the in-memory undo stack from PRD §12.13.
