# Progress

Implementation tracker for EnvCompare. The plan comes from [docs/PRD.md](docs/PRD.md); this file records **what is actually built, tested, and pushed**.

**Branch:** `arena/b6d6dd02-env-compare` · **Status:** in progress · **Last update:** 2026-10-20

---

## Plan

| # | Step | PRD ref | Status |
| --- | --- | --- | --- |
| 0 | Scaffold: Vite + React 19 + TS, test toolchain, `AGENTS.md`, privacy-first repo config | §14 | ✅ done |
| 1 | Parser core: lossless scanner, dotenv-compatible semantics, diagnostics | §12.1–12.4 | ⬜ |
| 2 | Parser fixture corpus + conformance tests against real `dotenv` | §16.2 | ⬜ |
| 3 | Compare engine: key universe, six states, severity, summary, ordering | §9, §12.5 | ⬜ |
| 4 | Placeholder + secret heuristics | §12.9, §12.10 | ⬜ |
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

---

## Decisions made during implementation

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-20 | Single `tsconfig.json`, no project references | One build target, fewer moving parts for contributors |
| 2026-10-20 | `vitest/config` `defineConfig` in `vite.config.ts` | Keeps one config file; vitest 5 requires it for the `test` key |
| 2026-10-20 | No UI framework, no icon library, hand-written CSS with design tokens | Dependency policy (§14.2) |
| 2026-10-20 | Only two skills vendored into `.agents/skills` | The full skills pack is 13 MB of unrelated material |

---

## Verification log

| Check | Command | Result |
| --- | --- | --- |
| Types | `npx tsc -p tsconfig.json` | ✅ clean |
| Unit tests | `npm test` | ✅ 1 passed |
| Build | `npx vite build` | ✅ 68.6 kB gzip |
| Privacy guard | `npm run privacy` | ⬜ not implemented yet |

---

## Next step

**Step 1 — parser core.** Lossless scanner producing `VarOccurrence[]` with spans and diagnostics, plus dotenv-compatible value semantics, written as pure TypeScript in `src/core/parse/` with no DOM access.
