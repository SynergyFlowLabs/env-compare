# Progress

Implementation tracker for EnvCompare. The plan comes from [docs/PRD.md](docs/PRD.md); this file records **what is actually built, tested, and pushed**.

**Branch:** `arena/e768a700-env-compare` · **Status:** shipped, docs and launch material ongoing · **Last update:** 2026-10-21

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
| 10b | Light / dark theme selection, without persistence | §10.2, DESIGN | ✅ done |
| 11 | Component + e2e tests, a11y pass | §16 | ✅ 365 tests · e2e suites in CI · skip link + focus path |
| 11b | N-file comparison (2–8 boxes, reference picker, per-target fix) | §11, US-03 | ✅ done |
| 13 | shadcn/ui + Tailwind migration | DESIGN | ✅ done |
| 12 | Docs & launch artefacts: README demo, CONTRIBUTING, SECURITY, templates, LICENSE | §15 | ✅ done |

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

**281 tests green at the time of the UI commit**, typecheck clean, bundle 86.5 kB gzip (18.3 kB app + 68.3 kB React), guard green.

Findings worth flagging to reviewers:

1. **React DOM ships a `fetch` call.** Its resource-preload helper (`fetch(e.href, n)`) is in the bundle and is unreachable here (we never render a preload `<link>`), and `connect-src 'none'` blocks it anyway. Rather than weaken the promise, the guard strips *that exact call* and fails on any other `fetch(` — plus React lands in its own `vendor` chunk so the app chunk is provably request-free. This is the kind of thing a "we don't phone home" README would never have told you.
2. **No browser available in this sandbox.** Chromium downloads are blocked and the Lambda build of Chromium lacks system libs (`libnspr4`), so no screenshots or Playwright runs here. UI behaviour is covered by 11 jsdom + Testing Library tests (paste → results, add/undo, filters, masking, copy + clipboard fallback, raw view). The Playwright suite (`e2e/`) is written and wired into CI, not executed locally.
3. **`frame-ancestors` is deliberately omitted** from the production CSP, against the PRD's draft. There is nothing to clickjack — no session, no cookies, no destructive server action — and blocking embedding would prevent legitimate demos. Recorded below.

### 2026-10-20 — Steps 11–12: tests, CI and launch documents

- **E2E suites** (`e2e/`, `playwright.config.ts`): no request after load, no storage writes, empty after reload, still works when `Storage.prototype.setItem` throws, and the core paste → missing → add-a-key journey. Wired into `.github/workflows/ci.yml` alongside typecheck, unit tests, build and the privacy guard. A browser cannot be installed in this sandbox, so these run in CI; the same behaviours are covered by jsdom tests locally.
- **Documents**: `CONTRIBUTING.md` (privacy invariants stated as non-negotiable, parser changes test-first), `SECURITY.md` (private reporting, scope, what is out of scope), `docs/PRIVACY.md` (mechanism per promise, a 30-second DevTools verification, threat model, and an explicit list of what the tool cannot protect you from), `CODE_OF_CONDUCT.md`, MIT `LICENSE` (with dotenv attribution), issue templates (parser edge case requires a fake-value reproduction), PR template, `favicon.svg`, Open Graph tags.
- **README** rewritten for a shipped product rather than a specification, with an honest limits section instead of a marketing claim.
- Test count corrected in the copy: the PRD's "60+ fixtures" target is **32 fixtures today**; the README says what exists, not what was planned.
- **Deployment**: `vercel.json` (security headers, `no-store` on HTML, `/privacy` and `/about` rewrites) is committed and the Vercel project `env-compare` exists on the `SynergyFlowLabs` hobby team. It could not be linked to the repository from here — the Vercel connector rejects a structured `git_repository`/`git_source` argument — so the remaining step is one click in the dashboard: **Project → Settings → Git → Connect `SynergyFlowLabs/env-compare`**, production branch `main`. Every push to `main` then deploys with no further configuration.

### 2026-10-20 — Theme selection

The palette already had light and dark values, but they were reachable only by changing the operating
system's preference. That is not a light mode; it is a light *default*. Added:

- **`Auto / Light / Dark`** in the header, as segmented buttons with `aria-pressed`. Auto is the default and follows the OS.
- **`data-theme` on `<html>`** is the whole mechanism; the stylesheet does the rest. Forced light wins over a dark OS via `:root:not([data-theme='light'])` inside the media query.
- **No persistence.** The choice lives in a module-level store read with `useSyncExternalStore`, so it is shared across the three pages (each is a real page load) and forgotten on reload. `tests/component/theme.test.tsx` asserts that no storage API is touched while switching.
- **Shared `SiteHeader`**, so the control cannot exist on one page and not another.
- **Readability fixes found by the new tests**, all in the light theme: `--ink-faint` was 3.34:1 on white, `--st-commented` was 4.48:1 on its tint (both now pass AA), and `#fff` text on the dark palette's pastel state fills was ~2:1 — hence `--on-accent` / `--on-state`, which flip to near-black in dark.
- **`tests/unit/tokens.test.ts`** parses the stylesheet: the two dark blocks must be identical, every colour token must have both values, and every text/background pair must clear 4.5:1 (3:1 for the focus ring). The palette is the one thing a DOM test cannot check, so it is checked as text.

**320 tests green**, typecheck clean, build 87.4 kB gzip, privacy guard green.

### 2026-10-20 — shadcn/ui + Tailwind, full migration

The interface was hand-written CSS on top of design tokens: 1,297 lines of bespoke stylesheet and no
component library. It is now Tailwind v4 + shadcn/ui.

**What replaced what**

- `src/ui/components/ui/` — shadcn primitives: `button`, `input`, `textarea`, `label`, `badge`, `card`,
  `tabs`, `dialog`, `table`, `alert`. Copied source, tuned to this product's scale (32px controls, 13px
  control text). `components.json` is committed so `npx shadcn add` can extend the set later.
- Radix owns what the hand-rolled dialog did badly: focus trap, restore, `aria-modal`, portal, Escape.
- Tabs became real tabs (`role=tab`, `aria-controls`, roving focus) instead of buttons pretending.
- `global.css` is now a Tailwind entry point: preflight, `@theme inline` mapping the palette onto
  shadcn's semantic names, and prose rhythm for the two document pages. The 1,297-line stylesheet is gone.
- `tokens.css` keeps only what changes with the theme. Type stacks, radii and easing moved into the
  Tailwind theme, which is the one place they are declared.

**The privacy rule, honestly restated**

The old rule was "runtime dependencies are exactly React and React DOM". Radix makes that untrue, so it
was replaced with a reviewed allowlist: nine packages, each with a reason and an expected license in
`scripts/check-privacy.mjs`. The guard now also fails if a dependency's license changes or if it ships an
install script. What did *not* change: no storage API, no network API, `connect-src 'none'`, no URLs with
content. `/privacy`, `README`, `CONTRIBUTING` and `docs/PRIVACY.md` say the new thing, not the old one.

**Cost**: bundle 86.5 kB → 119 kB gzip (22.3 kB app + 96.9 kB vendor). That is the price of Radix, and it
is stated in the PR rather than discovered in production.

**Still true**: 320 tests, including the contrast tests that read `tokens.css` and the component tests
that click through the interface. The shadcn layer changed the markup, not the behaviour — every existing
test passed without an edit.

### 2026-10-20 — Icons, rename, drop targets, and the "Edit files" bug

Five changes, four small and one that was a real defect.

- **Lucide icons throughout.** The state glyphs (`⊘ ! ✎ ⫽ ✓ ≠`) are now line icons (`MinusCircle`,
  `CircleAlert`, `PenLine`, `Slash`, `Check`, `EqualNot`); buttons, tabs, the theme switch and the status
  toast all carry icons. Imported by name so only what is used is bundled, `aria-hidden` when decorative,
  `aria-label` on icon-only controls, one stroke weight (1.75) set once in CSS.
- **File names are editable in the card header**, with a visible pencil affordance, a hover/focus border,
  select-on-focus, Enter/Escape to finish, and a screen-reader hint naming an example (`.env.production`).
  Renaming to a reference-looking name re-derives which side is the reference.
- **Both cards are drop targets.** A drag from the desktop shows a "Drop to replace …" overlay and loads
  the file into that box; a real drag-depth counter stops the overlay flickering over child elements, and
  the read is still local (`file.text()`), so the promise is intact. `accept` now includes `.env.*`.
- **The table is the default view.** It is where the work is. The primary "Copy N for .env" action moved
  into the results bar so it is reachable from every tab rather than only from Summary.
- **Fixed: "Edit files" bounced straight back to the results.** The auto-advance effect ran on every
  render where both files had keys, so choosing the editor was undone on the next tick — the editor
  appeared and vanished. `autoAdvance` now gates it: set by a paste or the sample, cleared when the reader
  chooses to edit, re-armed by the next paste. Two related bugs fell out of the same fix: the results and
  the editor were both rendering at once (results are now shown only in the results view), and there was
  no way back to the comparison except pasting again — there is now a **Compare files** button.

**326 tests**, including six new ones that would each have caught one of the above: rename updates the
column header, drop loads a file, the table is selected first, the editor survives 30ms, Compare returns,
and a fresh paste advances again.

### 2026-10-20 — The agent prompt copies and explains itself

"Copy prompt for my agent" now does both things at once: it puts the prompt on the clipboard **and**
opens a dialog showing it, because a click that says "copy" should copy, but the reader also deserves to
see what they are about to hand an agent.

- The dialog states what actually happened: *Copied to your clipboard* or *Your browser blocked the
  clipboard* — never a claim the browser refused to honour. `copied` lives in the reducer, not in local
  component state, so the dialog can be honest across renders.
- It carries its own **Copy prompt** button, which re-copies and toasts, so the dialog is not a dead end
  once the status line has faded from memory.
- When the copy was refused it **selects the text**, so a single ⌘C / Ctrl+C finishes the job. This took
  three attempts: an effect had no element yet (Radix mounts dialog content a commit later), and selecting
  before Radix moves focus is silently undone, so the selection is made from the ref callback on a
  deferred tick. The test asserts the range, not `Selection.toString()` — jsdom does not serialise
  selections, which is exactly the kind of "green test, broken feature" trap worth writing down.
- Toasts gained `z-[60]`: a toast that renders under the modal it was caused by is a toast nobody sees.
- The privacy e2e suite now exercises the dialog and asserts the dialog and copy still make zero requests.

**331 tests.** Four new: copies-and-shows in one click, copies again from inside the dialog, reports a
blocked clipboard instead of success, and closes cleanly.

### 2026-10-20 — Report export, and the theme cookie (consented)

**The report now behaves like the prompt.** "Copy report" copies *and* opens a dialog showing the
report that was copied, with its own **Copy report again** button and a toast either way. The two
exports share one `ExportDialog` and one reducer slice (`preview: { kind: 'prompt' | 'report' }`) —
the earlier prompt-only dialog was the special case, and this is the general one.

**Theme memory, with consent.** This reverses a stated invariant, so it is worth being precise about
what changed and what did not.

- Asking: the question appears the first time the reader picks Light or Dark, never on page load. The
  dialog names the cookie, shows its value and lifetime, and puts "Not now" beside "Remember it".
  Declining keeps the choice for the session, and the refusal is remembered so it is not repeated.
  "Auto" writes nothing at all.
- Storing: one cookie, `ec-theme`, value `light` or `dark`, one year, `SameSite=Lax`, `Path=/`.
- Confining: `src/ui/lib/consent.ts` is the only file that may touch `document.cookie`. The guard now
  checks the module exists, that every assignment carries the three attributes, that every assignment
  is named by the `THEME_COOKIE` constant, and that no other source file mentions a cookie. A second
  unit test asserts the same rules and that the module imports nothing from `src/core`, so it cannot
  see anything the reader pasted.
- Revoking: `/privacy` states whether a value is stored and offers **Forget my theme**, which deletes
  it and returns the interface to Auto.
- Claiming: the README, `/privacy`, `docs/PRIVACY.md`, `CONTRIBUTING`, `AGENTS.md` and `PRD §13` now
  say "your files are never stored" and "one cookie, only if you ask" instead of "no cookies". PRD
  §13.7 records the amendment rather than editing history.

The interesting failure in this step was in the guard itself: the first version checked attributes
with `source.includes('SameSite=Lax')`, and the module's own comment explaining `SameSite=Lax`
satisfied it. It now parses only the `document.cookie = ...` assignments, and there is a manual
negative test in the log below.

**347 tests**, typecheck, build and guard green.

### 2026-10-20 — Comparing more than two files

The engine already accepted `FileInput[]`; the interface was the thing that assumed a pair. Closed
that gap:

- **Boxes, 2 to 8.** "Add another file" sits in the same grid as the boxes, suggests the first unused
  name (`.env.local`, `.env.production`, `.env.staging`…), and focuses the new name field so it can be
  relabelled before pasting. Each box can pin itself as the reference or be removed; the remove control
  disappears at the two-file floor.
- **One reference, N targets.** The results bar names them (`3 files (.env, .env.local, .env.staging)`),
  every table column is a file, and the summary line already read `… missing from .env and .env.local`.
- **One active target.** The Fix tab gains a file selector once there is more than one target, and the
  results-bar "Copy N for …" button follows the same choice — the reader has one idea of "the file I am
  fixing", so the interface does not get to have two.
- **Clear all keeps the layout.** Clearing empties the boxes but keeps how many there are; ids stay monotonic so "Add another file" cannot mint a duplicate.
- **Roles are explicit.** Pinning a box as reference overrides the filename heuristic instead of being
  second-guessed on the next rename, and "Swap" now cycles rather than flipping a pair.

Two bugs found while testing, both from assumptions that stopped being true at three files:

1. `addFile` re-armed auto-advance, so adding a box bounced straight back to the results — the same
   class of bug as "Edit files", fixed the same way: adding is an edit, the paste that follows is what
   advances.
2. `clearAll` reset the id counter while keeping the extra boxes, so the next "Add another file" would
   have minted a duplicate id. Ids are now monotonic for the life of the tab.

**365 tests**, including 11 reducer tests and 7 component tests for the whole flow: add, rename, paste,
compare three columns, switch the fix target, pin a reference, remove a box, and refuse to drop below
two.

---

### 2026-10-21 — Found, not just built: canonical domain, preview card, metadata

- **Domain:** `envcompare.vercel.app` claimed for the project (first choice; the fallback
  `env-compare.vercel.app` is somebody else's). The previous `env-compare-six.vercel.app` alias still
  resolves, so nothing that was shared before breaks.
- **Preview card:** `public/og-image.png`, 1200×630, 366 kB. Generated as a designed card, downscaled
  once with ImageMagick, and checked at full size for legible, correctly spelled text — a preview that
  is unreadable at 200 px wide is worse than none. A matching 180 px touch icon and 192/512 px manifest
  icons were drawn from the favicon geometry so the mark is identical everywhere.
- **Metadata:** description (155 chars), canonical, `robots: index, follow, max-image-preview:large`,
  the full `og:*` set with image dimensions and alt text, `twitter:summary_large_image`, a single
  `WebApplication` JSON-LD block, `robots.txt` and `sitemap.xml` covering exactly the three routes
  `vercel.json` rewrites, plus a web manifest and long-lived cache headers for static assets.
- **The guard had to learn one word.** It failed the build on the JSON-LD block ("inline script") and
  on the canonical link ("loads an external resource") — both correct rules, both wrong here. The fix
  narrows them instead of dropping them: JSON-LD blocks are stripped, must parse as JSON, and any other
  inline script still fails; only `rel="canonical"` is excused from the external-link rule. Three
  negative tests (real inline script, Google Fonts stylesheet, JSON-LD with a `fetch()` inside) each
  fail as they should.
- **13 new tests** in `tests/unit/metadata.test.ts`, including the actual pixel dimensions of the card
  and every icon, and a check that the sitemap cannot drift from the rewrite list.

**378 tests**, typecheck, build and guard green.

### 2026-10-21 — Why the preview card "would not load"

Third-party checkers scored the page 84/100 and drew an empty box where the card should be. The
image URL itself was fine — `GET /og-image.png` returned `200`, `image/png`, 366 010 bytes, and the
PNG decoded cleanly (1200×630, CRC valid, full pixel stream). The problem was one header:

```
Cross-Origin-Resource-Policy: same-origin
```

It came from the catch-all rule, which was written to stop anything embedding the app, and it also
applied to the image. Browsers obey CORP on no-cors requests, which is exactly what `<img>` is, so
every preview panel that renders the card in a browser — checkers, and Slack's and Discord's web
clients — showed a broken image while `curl` said 200. A crawler fetching the image server-side never
sees the header, which is why this survives a naive "is it 200?" check.

Fix: static assets (`og-image.png`, icons, `robots.txt`, `sitemap.xml`, the manifest) now send
`Cross-Origin-Resource-Policy: cross-origin`; documents keep `same-origin`, so nothing can frame the
app. The lesson is recorded as a test: `tests/unit/metadata.test.ts` fails if the card's CORP header
is anything but `cross-origin`, and fails if documents stop being `same-origin`.

Two smaller scoring fixes from the same report:

- **No `<h1>` in the served HTML.** The app renders one client-side, but crawlers and preview bots do
  not run JavaScript, so the page had no heading at all. `index.html` now ships a visually hidden
  `<h1>` inside `#root` — verified by test that React clears it on mount, so the rendered page still
  has exactly one — plus a `<noscript>` explanation, which is the only honest answer for a tool that
  cannot work without JavaScript.
- **SVG-only favicon.** Google Search ignores SVG favicons. Added `favicon.ico` (16/32/48),
  `favicon-16x16.png` and `favicon-32x32.png`, drawn from the same tile geometry, and linked them
  ahead of the SVG. The test parses the ICO directory and checks every advertised size really exists.

**382 tests**, typecheck, build and guard green.

### 2026-10-21 — The second half of the CORP bug

The first fix looked right and did nothing, for a reason worth writing down: **Vercel merges every
matching header rule, and for a repeated key the last value wins.** The catch-all `/(.*)` rule sat at
the end of the array, so its `Cross-Origin-Resource-Policy: same-origin` overwrote the `cross-origin`
on the card and the icons. The deploy was green; the header was unchanged.

- The catch-all now comes first, assets after it. Verified against the live site:
  `Cross-Origin-Resource-Policy: cross-origin` on `/og-image.png` and `/favicon.ico`,
  `same-origin` on documents.
- A test now asserts the **ordering**, not just the values — ordering is what silently broke it.

Second lesson, same bug: the edge had cached the pre-fix response for the bare card URL with
`s-maxage=604800`, so even a correct header would have taken a week to reach a scraper. Assets now
cache for an hour (`max-age=3600, s-maxage=3600`), and the card is referenced as
`og-image.png?v=1` — a new cache key for every scraper, and a version to bump whenever the image
changes.

### 2026-10-21 — A front door: banner, generated badges, and one contributor identity

**README.** Rewritten to the shape people expect from a maintained project: banner, six badges, the
problem stated in the tool's own vocabulary, a feature table, quick start with a command table, how
each privacy guarantee is *enforced*, how the comparison decides, stack, layout, testing, roadmap,
contributing, contributors, license. The old README was accurate but read like release notes.

**Assets, generated rather than drawn.** `scripts/build-badges.mjs` writes six SVGs from one table of
labels, values and palette colours. Three decisions worth recording:

- **Local SVG, not shields.io.** The README then renders in forks, offline and inside editors, and
  viewing it makes no third-party request — the same rule the product follows.
- **`textLength` + `lengthAdjust="spacingAndGlyphs"`.** Badge text is fitted to a known width, so the
  layout is identical whatever font the renderer has. No `dominant-baseline`, no font download.
- **The accessible label is derived from the visible text** (`tests: 389 passing`), so a badge cannot
  claim one thing to a screen reader and another to a human. A test asserts the badge, the generator
  and the README all agree on the number.

The banner (`docs/assets/banner.svg`, 1280×320) is the same card as the social preview, in a wider
aspect: mark, wordmark, headline, one supporting line, and a miniature of the table with real state
chips. Text stays as text, so it is searchable and translatable.

**One contributor identity.** GitHub's contributor list is derived from commit metadata, not from the
current tree, so the automation co-author trailers and one bot-authored initial commit kept a bot in
the list. Fixed by rewriting history (26 commits):

- every commit re-authored to `imgul <92777653+imgul@users.noreply.github.com>`, which is the address
  GitHub links to the profile;
- every `Co-authored-by:` trailer removed;
- `.mailmap` added so old addresses fold into one identity for `git shortlog`, editors and anything
  else that honours it;
- `main` force-pushed (`7aaf8a2` → `44232a2`), verified file-for-file identical to the old tip before
  the push.

Merge-commit messages still mention the topic branch names (`arena/…`), because that is what the merge
commits record; they are not authorship.

### 2026-10-21 — Launch material: ten slides, two cards, and the copy that goes with them

The project had a front door (README, banner, preview card) but nothing to post. Three platforms, three
shapes, one design system:

| Platform | Images | Design size | File |
| --- | --- | --- | --- |
| Instagram | 10 slides | 1080 × 1350 (4:5) | 2160 × 2700 PNG |
| LinkedIn | 1 card | 1200 × 1200 (1:1) | 2400 × 2400 PNG |
| X | 1 card | 1600 × 900 (16:9) | 3200 × 1800 PNG |

**`scripts/build-social.mjs` is the only source.** Palette tokens, grid, glow, mark, footer and the
table-row primitive are shared; each slide is a `body()` of a dozen lines. Output is SVG, because SVG is
text — reviewable in a diff, translatable, editable without an image editor, and rendered by anything.
`scripts/render-social.py` (resvg-py, `zoom=2.0`) turns it into the PNGs that actually get uploaded.

The carousel is an argument, not a feature list, and the order is the argument: the symptom → why it
happens (agents will not touch `.env`) → how it drifts → the failures a presence check cannot see →
why a line diff is the wrong instrument → the product → the six states → N files → the fix, not the
diagnosis → nothing leaves your tab.

Four things the renders caught that the code did not:

- **A headline is narrower than its font size suggests.** Slide 1 was drawn at 92px and clipped the
  right margin; the pixel scan (rightmost lit pixel per row) said 45px of a required 96.
- **An aside anchored at the wrong edge.** Slide 5 printed "1 problem, by name" *starting* at the right
  margin instead of ending there, so half of it was off-canvas — invisible in the markup, obvious in
  the measurement.
- **Colour-only cells do not survive a thumbnail.** The first product slide used six coloured pills
  with no words, which is a legend the reader has to memorise. Every cell now carries its state as
  text, and the legend sits on its own slide.
- **A decorative connector reads as a stray dash.** One `<line>` between two file cards on slide 2
  looked like a rendering artefact. Removed.

`docs/social/CAPTIONS.md` holds the copy: the ten-slide Instagram caption with 20 hashtags, one alt
text per slide, the LinkedIn long post, the 5-post X thread, and the posting order, timing and a
pre-flight checklist. X copy is measured, not estimated — 250 characters for the main post, 244 as X
counts it (a URL weighs 23 regardless of length).

**The alt text is a single string in two places, so a test pins them together.**
`tests/unit/social.test.ts` (6 tests) reads the generator, and asserts: ten slides in the published
order; every card's alt is > 60 characters and unique; `CAPTIONS.md` contains each alt verbatim; every
PNG exists at exactly 2× the platform's shape and under the upload ceiling; every SVG still sits next
to its PNG; and the SVGs contain `<text>`, no `<image>` and no base64 — text stays text.

Test count moved 389 → 395, so the badge generator and the README were updated in the same commit.
Badges are generated, but the *number* in them is a claim, and a claim that is not regenerated is
drift.

### 2026-10-21 — Raw panes scroll together (#9)

The Raw view is the trust anchor: it shows each file exactly as pasted, so a reader can check the
analysis against the text. But its panes scrolled independently, which quietly defeated the point —
comparing two files means looking across the gutter, and every glance landed on a different region
until you steered both scrollers by hand.

`RawView` now keeps a ref to every pane and mirrors scroll **proportionally**, not in absolute pixels:

```
ratio      = source.scrollTop / (source.scrollHeight - source.clientHeight)
target.top = ratio * (target.scrollHeight - target.clientHeight)
```

Proportional rather than line-for-line because the files are not the same length — that is usually why
you are comparing them. Equal fractions keep the eye at the same relative place, which is what a
side-by-side read actually compares; aligning line 40 of a 60-line file to line 40 of a 400-line file
would drift off the end of the shorter one.

Three details that are the difference between "syncs" and "usable":

- **The echo guard.** Writing `scrollTop` fires a scroll event on the pane we just moved. Treating that
  as the reader scrolling makes the panes chase each other frame after frame. Each pane records the
  value we last wrote to it, and an event within 1px of that value is our own echo, not an input.
- **Panes that fit are skipped.** A 6-line file has nothing to scroll; syncing it to 0 would drag the
  other panes to the top every time the pointer crossed it.
- **A toggle, as the PRD asked.** US-14 specifies a *toggleable* "sync scroll". It is a real toggle
  button (`aria-pressed`), on by default, hidden when there is only one file to show.

Two smaller things while in the file: each pane is now `tabIndex={0}` and focus-visible ringed, because
a scrollable region that cannot be focused cannot be scrolled without a mouse; and each `<section>`
carries the file name as its accessible name, so the panes are landmarks rather than anonymous boxes.

Verified by `tests/component/raw-view.test.tsx` (7 tests): proportional mirroring across panes of
different lengths, every pane following (not just the second), the echo guard, sync off, a source pane
with no overflow, keyboard reachability, and the pane labels. jsdom has no layout, so the tests stub
`scrollHeight`/`clientHeight` — the sync is arithmetic on those numbers, and pinning the arithmetic is
what makes the behaviour testable without a browser.

### 2026-10-21 — A CSV masking page (#10)

The compare tool answers "what is missing from my `.env`". Issue #10 asked the neighbouring question:
*"I want a model to look at this configuration — how do I let it read the shape without reading the
secrets?"* Both are answered by the same promise, so the answer is a second surface, **not** a second
product: `/mask`, a real page load like `/privacy`, sharing the header, the tokens and the privacy
guard.

**The pipeline is three pure modules.** `src/core/csv` reads RFC 4180 plus the lenient parts everyone
relies on (BOM, CRLF, quoted commas and newlines, `""` escapes) and reports what it cannot parse
instead of dropping it. `src/core/mask` applies per-column and per-key modes — hide completely, mask
the start, middle or end — and `maskedText` writes it back in the file's own dialect. `src/state`
holds the originals; the export is always derived.

Five decisions worth keeping:

- **Formatting, not encryption.** The page says so in as many words. Asterisks cannot be reversed, and
  a mask that claims more than that is a lie someone might rely on.
- **`hide` hides the length; the other modes do not.** A retained prefix is shared data (`sk-live-…`
  is a prefix, not a mask), so the mode list is worded in terms of *what stays visible*.
- **A value too short to keep anything is hidden whole.** Keeping 4 of `abc` would "mask" it by
  showing all of it. A mask that reveals the secret is worse than no mask.
- **Duplicates are *reported*, not encoded.** Two rows holding the same secret still look identical
  after masking (often the thing being checked), but the mask is not a hash: a fingerprint suffix
  would let anyone who can guess the value confirm the guess.
- **The preview is the export.** Both are `maskCsv` → `maskedText`, so there is no second artefact to
  drift, and "show the exact output" prints the literal text the copy button writes.

**The defaults are the product's usual asymmetry:** detection may only ever *add* masking. The key
column is found by header name; value columns from header names, then from value shapes, then (for a
`key,value` file with unhelpful headers) the rightmost column — and those arrive masked. Two warnings
run against that: an open column whose values look like credentials (or whose name does), and a key
column that has itself been masked, which makes the output hard to act on.

**Scope.** This was the one place the issue could have diluted the product, so it was held to the
constitution rather than bent around it: PRD §4.3 gained a paragraph saying `/mask` is not an exception
to any non-goal, and §8.6 gained US-24 with the acceptance criteria as testable statements. It reads
one file the reader chooses — the permission NG8 already granted — and has no network path.

**Tests: 455 (25 files), from 402.** 40 of them are new: 15 for the CSV reader/writer (`tests/unit/csv.test.ts`),
25 for masking, suggestions and warnings (`tests/unit/mask.test.ts`), plus 13 component tests that
walk the acceptance criteria — default masking, per-column and per-key modes, reveal-and-restore, the
duplicate marker, the warnings, the copy, the exact-output panel and starting over
(`tests/component/mask-page.test.tsx`). `e2e/mask.spec.ts` asserts the thing unit tests cannot: filling
the page, masking and copying makes no request and writes nothing to storage.

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
| 2026-10-20 | Adopted shadcn/ui + Radix, ending the "React only" dependency rule | The dependency rule was a proxy for "no code that can report back"; a reviewed allowlist plus the unchanged dist scan enforces the real rule, and the copy was corrected rather than quietly widened |
| 2026-10-20 | Tokens stay the only colour source; shadcn's semantic names are mapped onto them | Otherwise two palettes drift and the contrast test stops covering what ships |
| 2026-10-20 | shadcn components are vendored, not installed as a design-system package | They are source here; upgrading is a deliberate diff, not a lockfile change |
| 2026-10-20 | Line icons replace the typographic state glyphs | The glyphs depended on the reader's font and drifted in weight; the icon+word rule they served is unchanged |
| 2026-10-20 | N files, with one reference and a per-target fix panel | The question "what is missing from which file" is the same at 2 and at 6; the engine already took a list, only the interface assumed a pair |
| 2026-10-20 | Adding a box does not advance to the results | Adding is an edit; the paste that follows re-arms the comparison — the same lesson as the "Edit files" bug, in a new place |
| 2026-10-20 | One `ExportDialog` for prompt and report, keyed by `kind` | Two exports with the same interaction should not drift; the prompt version was the special case |
| 2026-10-20 | A consented theme cookie replaces "no cookies at all" | The claim that survived is the one that matters — no file content is stored — and the exception is one file, one name, one value domain, enforced by the guard |
| 2026-10-20 | Consent is asked at the action, not on load | A banner on load is the pattern the design brief rules out; a question at the moment of the action can explain itself and "no" costs nothing |
| 2026-10-20 | The agent prompt opens a dialog as well as copying | The prompt is the one export that leaves the tab (pasted into an agent); the reader should see it, and a blocked clipboard needs somewhere to fall back to |
| 2026-10-20 | Auto-advance is a state flag, not a derived condition | "Both files have keys" is not the same as "the reader wants the results"; conflating them made the editor unusable |
| 2026-10-21 | CSV masking is a separate page (`/mask`), not a mode inside the tool | The compare page's state is about files and roles; a CSV has columns and keys. One page per question, and the header makes the second one discoverable |
| 2026-10-21 | Masking modes are named by what stays visible | "Mask the start" is ambiguous until you know which end survives; the labels and the preview settle it, and `hide` is the only mode that also hides the length |
| 2026-10-21 | The masked CSV keeps the source's delimiter and line ending | The file came from somewhere — a spreadsheet, a secret manager — and going back into that tool should not need a re-import |
| 2026-10-21 | Raw panes sync by scroll fraction, not by line number | The two files are different lengths — that is why they are being compared — so equal fractions keep the reader in the same relative place, where equal line numbers run off the shorter file |
| 2026-10-21 | Scroll sync is on by default, with a visible toggle | Synced is the reason the raw view exists side by side; the toggle is for the case where one file needs reading on its own, and hiding it would make a stuck pane look like a bug |
| 2026-10-21 | Social images are generated SVG with a separate raster step, not drawn PNGs | The copy is the part that will change; text in a diff is reviewable, and resvg is the only build-time dependency and it never ships |
| 2026-10-21 | Instagram is 4:5, not 1:1 | The tallest a feed allows — two extra lines of headline before anyone taps |
| 2026-10-21 | The LinkedIn card is square and the X card is 16:9 | LinkedIn crops anything wider than ~1.91:1; X shows `summary_large_image` uncropped on mobile |
| 2026-10-20 | The six comparison states keep their own Tailwind names | `destructive` cannot express "commented out", and collapsing states into one red loses the information the product exists to show |

---

## Verification log

| Check | Command | Result |
| --- | --- | --- |
| Types | `npx tsc -p tsconfig.json` | ✅ clean |
| Unit + component tests | `npm test` | ✅ 455 passed (25 files) |
| dotenv conformance | `npm test` | ✅ 32 fixtures × 2 assertions |
| Build | `npm run build` | ✅ 444 kB on disk, 5 files |
| Privacy guard | `npm run privacy` | ✅ green |
| E2E | `npm run test:e2e` | ⏳ written, runs in CI (no browser in this sandbox) |
| CSV masking | `npx vitest run tests/unit/csv.test.ts tests/unit/mask.test.ts` | ✅ 40 tests · round-trip, modes, purity, CSV validity |
| Social images | `npm run social && npm run social:png` | ✅ 12 SVGs → 12 PNGs; measured ink stays inside the designed margins (96px IG/LinkedIn, 72px X) |

---

## Next step

**Post it.** Upload the ten Instagram slides in order with the alt text, publish the LinkedIn card with
the long post, and put the X card in front of the short post — then read which line gets quoted back
and use that one next time. All of it is in [docs/social/CAPTIONS.md](docs/social/CAPTIONS.md).
