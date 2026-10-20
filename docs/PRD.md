# EnvCompare — Product Requirements Document

> **Working title:** EnvCompare (`env-compare`)
> **Tagline:** *See what your `.env` is missing — without your secrets leaving your browser.*
> **Document status:** Draft v1.0 — for review
> **Date:** 2026-10-20
> **Owner:** SynergyFlowLabs
> **Repo:** `SynergyFlowLabs/env-compare`
> **Deploy target:** Vercel (static, free tier)
>
> - **License intent:** open source (MIT recommended — see [§19](#19-open-questions--decisions-needed))
> - **Reviewers:** maintainer(s) + the first 3 design partners

---

## Table of contents

1. [TL;DR](#1-tldr)
2. [What changed from the original idea (and why)](#2-what-changed-from-the-original-idea-and-why)
3. [Problem](#3-problem)
4. [Goals and non-goals](#4-goals-and-non-goals)
5. [Success metrics](#5-success-metrics)
6. [Users and jobs to be done](#6-users-and-jobs-to-be-done)
7. [Scope and milestones](#7-scope-and-milestones)
8. [User stories and acceptance criteria](#8-user-stories-and-acceptance-criteria)
9. [Product concept and core model](#9-product-concept-and-core-model)
10. [UX specification](#10-ux-specification)
11. [Functional requirements](#11-functional-requirements)
12. [Parsing and comparison specification (normative)](#12-parsing-and-comparison-specification-normative)
13. [Privacy and security architecture](#13-privacy-and-security-architecture)
14. [Technical architecture](#14-technical-architecture)
15. [Open source and community plan](#15-open-source-and-community-plan)
16. [Testing and QA strategy](#16-testing-and-qa-strategy)
17. [Delivery plan](#17-delivery-plan)
18. [Risks](#18-risks)
19. [Open questions / decisions needed](#19-open-questions--decisions-needed)
20. [Appendices](#20-appendices)

---

## 1. TL;DR

**EnvCompare is a zero-upload, zero-storage web tool that reconciles environment variable files.**

You paste (or drop) your `.env.example` and your real `.env` side by side. EnvCompare shows, instantly and in plain language:

- which variables exist in one file but **not** the other,
- which exist but are **empty** (`KEY=`) or still hold a **placeholder** (`KEY=your-key-here`),
- which are **leftover** in your `.env` and no longer in the example,
- and a **ready-to-paste block** that fixes the gap in one click.

Four views over one shared model: **Summary** (plain language), **Table** (row-aligned, colour-coded, editable), **Raw** (annotated text), and **Fix** (the generated block / report to copy).

**The product is not a diff viewer. It is a reconciliation tool.** A diff tells you what is wrong; a non-coder needs the thing to paste.

**The privacy claim is the product's spine, and it is enforced mechanically, not promised:**

| Promise | Enforcement |
| --- | --- |
| No upload | Static site, no backend, no API routes; `connect-src 'none'` in the production CSP |
| No storage | No `localStorage` / `sessionStorage` / `IndexedDB` / cookies / service worker — a CI check fails the build if these APIs appear in `src/` |
| No third-party code | No analytics, no CDN fonts, no tag managers; dependency allowlist checked in CI |
| No shareable links | No URL or hash state — file content can never leak into a link, a browser history entry, or a screenshot of the address bar |

**MVP = two files, one page, four views, no backend** — roughly 4–5 weeks of part-time work for one maintainer ([§17](#17-delivery-plan)). Multiple-file matrix comparison lands in v1.1; the data model supports it from day one.

---

## 2. What changed from the original idea (and why)

The original idea — *paste two `.env` files, see them side by side in raw and aligned editable tables, highlight what's missing, store nothing* — is sound and stays. These ten refinements are what turn it from a utility into something people bookmark, recommend, and trust.

### R1. From "diff" to "reconciliation" — ship the fix, not the diagnosis

The moment of value is not *seeing* the missing keys; it is having them **in the right file, in the right place, with a sensible default**. EnvCompare therefore generates a copy-ready `.env` block (and a `.env.example` block for the reverse direction). One button: *Copy the 3 missing variables*.

> Design test: if a user has to manually retype a variable name, we have failed.

### R2. From "missing / not missing" to a **six-state** taxonomy

Real-world `.env` bugs are not binary. The most common and most expensive failure is a key that **is present but empty** (`OPENAI_API_KEY=`), or present with the example's placeholder still in it (`OPENAI_API_KEY=your-api-key-here`). Both silently pass a naive "does the key exist?" check and then crash the app with a confusing `401`.

So every variable gets a per-file state: `present` · `empty` · `placeholder` · `commented` · `absent` · (`differs`, when values are compared). See [§9.3](#93-variable-state-taxonomy).

### R3. From "2 files" to **N files with an explicit reference**

`.env.local`, `.env.production`, `.env.staging` are routine. The model is: **one reference file** (the schema — usually `.env.example`) compared against **one or more targets**. Two targets render as aligned side-by-side columns; three or more render as a key × file matrix. The reference file is auto-detected by filename and always switchable in one click.

### R4. Secret-safety is a first-class feature, not a disclaimer

People will paste live secrets into this tool, then screen-share it, screenshot it, and paste the report into ChatGPT. So:

- **Mask values** toggle (default: values visible, one click to mask; never re-rendered into the DOM while masked),
- **Screenshot-safe mode** that hides values and truncates key names' values to bullets,
- **Redacted report export** (keys only by default) — because the report is the artifact most likely to be shared,
- **Secret detection** by key name and value shape (JWT, `sk_live_`, `AKIA…`, PEM, DSNs) to power masking and to warn *"this looks like a live credential — make sure `.env` is in your `.gitignore`."*

### R5. Close the loop back to the AI editor

The audience arrived because an agent wrote a `.env.example`. The tool should hand work back to that agent: a **copy-ready prompt** — *"My `.env` is missing these keys from `.env.example`: … Add them to `.env` with empty values and tell me where to obtain each one."* Keys only, no values, ever. (v1.1.)

### R6. Enforce the privacy promise instead of asserting it

A promise in a README is worth nothing against a `<script>` added in a hurry. See the table in [§1](#1-tldr) and the full mechanism in [§13](#13-privacy-and-security-architecture): CSP, CI greps, an e2e test that fails on any unexpected network request, and a `/privacy` page that shows users how to verify it in 30 seconds with DevTools.

### R7. Two cheap checks with outsized value

- **Broken interpolation:** `${DATABASE_URL}` referencing a key that does not exist in that file. `dotenv` does *not* expand variables (that moved to `dotenvx` / `dotenv-expand`), so this is a silent runtime landmine.
- **Framework prefix lint:** a key in a Vite/Next project that will never reach the browser without `VITE_` / `NEXT_PUBLIC_`. (v1.1, behind a "framework preset" selector.)

### R8. Designed for non-coders, not just for developers

Plain-language labels ("Missing from your `.env`" — not "set difference"), a three-step *What do I do now?* card, an explicit severity order, and zero jargon in error messages. A non-technical founder should succeed without knowing what "dotenv" means.

### R9. Things we deliberately refuse to build

Accounts · cloud sync · saved projects · shareable links · URL-encoded input · history · team workspaces · secret storage · "AI explain my env" (that would require sending keys or values somewhere). Each one would trade the entire trust proposition for a marginal feature. These are recorded as **constitutional non-goals** in [§4.3](#43-non-goals-hard-constraints) so future contributors cannot quietly reverse them.

### R10. Position it as onboarding + drift, not as a text diff

Two distinct jobs, one tool: *"I just cloned/set up this project and my `.env` is wrong"* (onboarding) and *"the app changed, is my `.env` still current?"* (drift). Neither is served by `diff`, an IDE, or a secret manager.

---

## 3. Problem

### 3.1 The workflow that created the gap

1. A developer (often a non-developer) uses an AI code editor or agent to build a project.
2. The agent is instructed — by its own guardrails and by the user — **not to read, write, or modify `.env`**. The agent therefore writes a `.env.example` describing what the project needs.
3. The human must now create `.env` from that example and fill in real values.
4. Weeks later the project grows. The agent adds features and new keys to `.env.example`. Nobody updates `.env`, because agents do not touch it and humans do not re-read a 60-line file they once skimmed.
5. The app fails — usually not with *"missing variable"*, but with a `401`, a `500`, a blank page, or a database connection error. The human has no idea that the cause is a line that is missing from a file they were told not to worry about.

### 3.2 Why the existing options fall short

| Option | Why it fails for this user |
| --- | --- |
| `diff .env .env.example` / IDE compare | Shows raw lines, not variables. Requires both files on disk and a terminal. Reports noise from ordering and comments. Says nothing about *empty* or *placeholder* values. Useless to a non-coder. |
| IDE plugins / linters (dotenv-style CLIs) | Great for CI, developer-oriented output, no visual reconciliation, no "give me the block to paste", no multi-file matrix, requires setup. |
| Secret managers (Doppler/Infisical/1Password-style) | Solve storage and sync. Massive overkill for a one-off five-minute question, and they ask you to adopt an account and a vendor. |
| Online "env diff" web tools | Usually a bare two-textarea diff with no stated data-handling policy. A cautious user cannot tell whether their secrets were POSTed somewhere. Trust is unverifiable, so the tool is unusable for real values — which is the only case that matters. |
| Asking the AI agent | Agents are exactly the actors who refuse to touch `.env`, and pasting secrets into a chat window is a worse idea than pasting them into a local page. |

> The landscape above is described at category level. Before publishing any comparison table on the site, verify each competitor's current behaviour — do not ship unverified claims about third-party tools.

### 3.3 Assumptions to validate (not yet researched)

We should not invent statistics. These are hypotheses, each with a cheap test:

| # | Hypothesis | How we'd validate |
| --- | --- | --- |
| H1 | "Present but empty" is at least as common as "completely missing" | Instrument **locally** (opt-in, aggregate counts only, no content) or run 10 moderated sessions and count manually |
| H2 | Non-technical builders do not know `.env.example` exists or what it is for | 8–12 short interviews in builder communities |
| H3 | Users will not paste real secrets into an unknown web tool | 5-second test of the landing page: does the privacy badge change intent? |
| H4 | The copy-ready block is the single most-valued output | Task-success test: time-to-fix with and without the Fix view |
| H5 | People share the comparison report with their agent/teammate | Track *copy report* clicks — but only via an opt-in aggregate counter; otherwise use interviews |

### 3.4 Problem statement

> **For** developers and non-technical builders who ship projects with AI editors and agents,
> **who** are stuck maintaining a `.env` by hand while `.env.example` silently drifts ahead of it,
> **EnvCompare** is a browser-only comparison and reconciliation tool
> **that** shows every variable that is missing, empty, placeholder, or leftover across files — and hands over the exact block to paste —
> **unlike** CLI diffs, IDE tooling, and secret managers,
> **because** it needs no install, no account, no upload, and no trust in a server: the files never leave the tab.

---

## 4. Goals and non-goals

### 4.1 Product goals

| ID | Goal | Measurable signal |
| --- | --- | --- |
| G1 | Answer "what am I missing?" in under 10 seconds from landing | Median time from first paste to a visible summary; target < 2s of compute, no clicks required |
| G2 | Make the fix take under 30 seconds | ≥ 60% of sessions that reach results copy the generated block or a report |
| G3 | Be trustworthy enough for live secrets | Zero network requests after page load; `/privacy` verification passes in DevTools; no storage APIs in the bundle |
| G4 | Be usable by a non-coder | ≥ 80% task success in unmoderated test with 5 non-developers, no help text needed |
| G5 | Be a healthy open-source project | First external PR merged within 30 days of launch; ≥ 95% of issues triaged within a week |
| G6 | Stay free forever | $0 operating cost on Vercel static hosting; no paid dependencies |

### 4.2 Secondary goals

- Handle the parsing edge cases real projects contain (multiline PEM keys, `export` prefixes, inline comments, CRLF, BOM, duplicates) without silently misreporting.
- Be pleasant: fast, keyboard-friendly, dark mode, mobile-usable, accessible to WCAG 2.2 AA.
- Be forkable: one command to run, one command to deploy, no infrastructure to understand.

### 4.3 Non-goals (hard constraints)

These are **constitutional**. A PR that violates them is rejected regardless of quality. They exist because the product's value is trust, and trust is binary.

| ID | Non-goal | Rationale |
| --- | --- | --- |
| NG1 | Any server-side processing, API route, serverless function, or database | Removes the entire class of "did my secrets get logged?" risk |
| NG2 | Any browser persistence: `localStorage`, `sessionStorage`, `IndexedDB`, cookies, cache storage, service worker, `window.name`, form-value restoration | "We store nothing" must be literally true; mechanically enforced in CI |
| NG3 | Shareable links, URL/hash-encoded content, or deep links containing keys | A URL leaks into history, screenshots, Referer headers, and chat logs |
| NG4 | Accounts, login, saved projects, cloud sync, team features | Not needed for a 5-minute task; adds a breach surface |
| NG5 | Third-party scripts, analytics, error reporting (Sentry/etc.), tag managers, CDN-hosted fonts, embeds | Each is an exfiltration path; each requires trust we cannot ask for |
| NG6 | AI features that transmit file content (no "explain my env") | The prompt generator is **local string templating** over key names only |
| NG7 | Secret storage, rotation, validation-against-provider, or "is this key live?" checks | Different product; would require network calls with credentials |
| NG8 | Reading from the user's filesystem beyond explicit drag-drop/paste of a single file | No directory scanning, no repo access, no `.gitignore` edits |
| NG9 | Value-level "correctness" judgement (types, URL validity, etc.) | Out of scope; we compare, we do not validate integrations |

### 4.4 Explicitly out of scope for v1 (revisit later)

- CLI / npm package (the audience is web-first; a CLI is a different distribution problem).
- VS Code extension (would need the marketplace + a different UX).
- i18n beyond English (but all strings must live in one catalogue from day one).
- Framework presets (v1.1), requirement annotations (v1.1), GitHub Action (v2 candidate).

---

## 5. Success metrics

Because we refuse telemetry ([NG5](#43-non-goals-hard-constraints)), metrics are **manually gathered and explicitly opt-in**. We accept weaker measurement in exchange for a claim users can verify.

### 5.1 North-star (proxy)

**Successful reconciliations**: sessions where the user copied a fix block, a report, or a corrected file.

**v1 measures this without any instrumentation.** There is no counter, no beacon, and no opt-in telemetry, because every version of "just a tiny counter" weakens the one claim the product rests on. Instead:

- qualitative: moderated task tests (n = 5–10) before and after launch,
- proxy: GitHub issues that describe real usage, and replies in the launch threads,
- optional: a **manual** "Did this help?" link to a GitHub Discussion — a click a user consciously makes to a page they can read first, not a silent signal.

If a future maintainer wants a real counter, that is a PRD amendment and a `/privacy` rewrite, not a quiet commit.


### 5.2 Leading indicators (instrumentation-free)

| Metric | Source | Target (first 90 days) |
| --- | --- | --- |
| Unique visitors | Vercel dashboard aggregate request counts (host-level, no user data) | 5,000 |
| GitHub stars | GitHub | 250 |
| External contributors | GitHub | 5 merged PRs from non-maintainers |
| Issues opened (a proxy for real usage) | GitHub | 20 |
| Deploy-your-own forks | GitHub forks + GitHub Discussions thread | 10 reported |
| Return visits | Qualitative / self-report | ≥ 30% say they'd use it again |

### 5.3 Quality guardrails

- Parser conformance: 100% agreement with upstream `dotenv` on the fixture corpus ([§16](#16-testing-and-qa-strategy)).
- Zero network requests after load (automated assertion).
- Lighthouse: performance ≥ 95, accessibility = 100, best-practices = 100.
- Initial JS ≤ 120 KB gzip; compare of 2 × 500 keys < 50 ms.
- No P1 accessibility defects open at release.

### 5.4 Anti-metrics (things we will not optimise)

Time-on-page, page views per session, scroll depth, "engagement". A user who finishes in 40 seconds and leaves is a **success**, not a bounce. Optimise for *exit velocity*.

---

## 6. Users and jobs to be done

### 6.1 Personas

**P1 — "Vibe coder" Nadia (primary).**
Non-technical founder/marketer/designer shipping a Next.js app with Cursor/Claude Code. Understands "the app needs a key", does not understand dotenv, terminals, or diffs. Panics when the app breaks and the console says `Error: Missing OPENAI_API_KEY`. Wants: *tell me what to paste, where.*
Success = she never has to learn what a diff is.

**P2 — "Solo dev" Dani (primary).**
Freelancer juggling 4 client repos and three environments. Knows the problem intimately, has a `diff` alias, still gets burned by empty values and stale keys. Wants speed, keyboard, and a matrix view.
Success = 30 seconds per project, no accidental secret exposure.

**P3 — "Team lead" Tom (secondary).**
Reviews PRs, onboards juniors, keeps `.env.example` honest. Wants a redacted report he can paste into a PR comment or a Slack thread without leaking anything.
Success = the report is safe to share by default.

**P4 — "OSS contributor" Casey (secondary).**
Wants a small, clean, well-tested TS codebase with a real spec to implement against. Finds the repo via Hacker News.
Success = a `good first issue` that is genuinely doable in an hour.

### 6.2 Jobs to be done

| # | When… | I want to… | So I can… |
| --- | --- | --- | --- |
| J1 | I clone a project or my app suddenly breaks | know exactly which variables my `.env` is missing | paste them in and get back to work |
| J2 | I just filled in my `.env` | know which keys are still empty or still hold placeholders | avoid a "silent 401" later |
| J3 | the agent updated `.env.example` | see what's new since I last looked | keep my local setup current |
| J4 | I'm comparing staging vs production config | see a key-by-key state matrix | spot config drift before it causes an incident |
| J5 | I want help from an agent or a teammate | export a report that contains no secrets | share safely |
| J6 | I don't trust web tools with secrets | verify for myself that nothing is uploaded | use the tool at all |

### 6.3 Non-users (deliberately)

CI pipelines (use a linter), secret-management teams (use a vault), people who need to *edit and save* their env files long-term (use their editor).

---

## 7. Scope and milestones

### 7.1 MVP (v1.0) — the cut line

Everything below is **in**. Anything not listed is out.

| Area | Included in v1.0 |
| --- | --- |
| Input | 2 files, each with an editable filename label; paste into a textarea; drag-drop a single file; "Load sample"; "Clear" |
| Detection | Auto-detect reference vs target by filename; manual swap; comparison auto-runs (debounced) |
| Parsing | dotenv-compatible lossless parse with diagnostics (see [§12](#12-parsing-and-comparison-specification-normative)) |
| Analysis | Per-file states: absent / empty / placeholder / commented / present; row-level "set differently"; duplicate detection; interpolation-reference validation; per-file counts |
| Views | **Summary** (plain-language), **Table** (row-aligned, colour-coded, editable), **Raw** (annotated, scroll-synced), **Fix** (generated block) |
| Actions | Copy fix block; copy `.env.example` block; download file (Blob); copy redacted Markdown report; mask values; reveal single value; add missing key to a file; remove stray key; undo |
| Safety | No upload, no storage, no analytics; CSP; `/privacy` verification page; secret-shape detection for masking |
| A11y | WCAG 2.2 AA; colour never the only signal; full keyboard path; screen-reader table semantics |
| Quality | 60+ parser fixtures, unit + component + e2e tests, CI guards |
| OSS | README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue/PR templates, LICENSE, CI, Vercel deploy |

### 7.2 v1.1 — fast follow (2–4 weeks after launch)

- **N-file matrix** (3+ targets), reference switchable per column.
- **Framework presets** (Next.js / Vite / Node-dotenv / Docker Compose / Python) with prefix lint.
- **AI handoff prompt** (keys only) and "report as PR comment" format.
- **Requirement annotations**: honour `# required` / `# optional` comments and `# SECRET` hints in `.env.example`.
- **i18n scaffolding** + one community language.

*Explicitly rejected for v1.1 (do not reopen):* session restore, autosave, "resume where you left off". Every variant requires `sessionStorage`, which [NG2](#43-non-goals-hard-constraints) forbids. Losing your paste on reload is a deliberate cost, and the `beforeunload` warning is the only mitigation we allow.

### 7.3 v2 candidates (only with community demand)

- CLI wrapper sharing the same core (published as a separate package, same parser fixtures).
- GitHub Action: "fail the PR if `.env.example` gained an undocumented required key" (careful: needs repo access; separate product surface).
- Shareable *comparison config* (not content): presets of view settings encoded in a static route.

### 7.4 Release gates

MVP ships only when: all P0 user stories pass; privacy e2e suite is green; `/privacy` is written and verified by hand in three browsers; Lighthouse targets met; README has a 20-second demo GIF; one non-developer completes the task unaided in a moderated test.

---

## 8. User stories and acceptance criteria

Priorities: **P0** = MVP blocker, **P1** = MVP if time permits, **P2** = v1.1.

### 8.1 Input

**US-01 (P0) — Paste two files.**
As a user, I want to paste my `.env.example` and `.env` into two boxes so that I can compare them.
- **Given** an empty page, **when** I paste into either box, **then** the box accepts multi-line text, preserves it exactly, and shows a live count of "N variables · M lines".
- **When** both boxes contain at least one parseable variable, **then** the comparison runs automatically within 300 ms — no "Compare" click is required.
- **When** the text is empty, **then** no comparison UI is shown, only the input guidance and the sample.

**US-02 (P0) — Filenames with auto-role detection.**
As a user, I want the tool to guess which file is the reference so I don't have to understand the concept.
- **Given** filenames `.env.example` and `.env`, **then** the example is the reference and a caption reads "Comparing your `.env` against `.env.example`".
- **Given** ambiguous names, **then** the tool defaults to "first file = reference" and shows a one-line hint with a "Swap" control.
- **When** I click "Swap", **then** roles exchange and the summary re-renders with reversed wording.

**US-03 (P1) — Drop a file.**
- **Given** a file on disk, **when** I drop it onto a drop zone, **then** the file is read with the File API, its name populates the label, and **no network request occurs**.
- **Given** a binary or > 2 MB file, **then** I see "That doesn't look like a text file" / "This file is too large (max 2 MB)" and nothing changes.

**US-04 (P0) — Sample data.**
- **Given** a first-time visitor, **when** I click "See an example", **then** two plausible fake files load (clearly marked as sample, values obviously fake: `sk_test_EXAMPLE…`) and the results are fully interactive.

**US-05 (P1) — Clear everything.**
- **Given** content in one or both boxes, **when** I click "Clear all", **then** a confirmation ("This wipes both files from this tab. It can't be undone.") appears, and on confirm all state, undo history, and DOM text is destroyed and focus returns to the first input.

### 8.2 Results

**US-06 (P0) — Plain-language summary.**
As a non-technical user, I want a sentence that tells me what's wrong.
- **Given** 3 keys missing and 1 empty, **then** the summary reads "3 variables are in `.env.example` but missing from `.env`. 1 variable is set but empty." — file names in monospace, counts emphasised.
- **Given** no differences, **then** "Nothing is missing. Your `.env` matches `.env.example`." plus the count of compared variables and a "Copy report" action.
- **When** the summary updates, **then** it is announced politely to screen readers (`aria-live="polite"`) and never steals focus.

**US-07 (P0) — Per-file counts.**
- **Given** results, **then** each file header shows its own badges: `3 missing · 1 empty · 2 extra`.
- **When** I click a badge, **then** the table filters to that state and a "Clear filter" chip appears.

**US-08 (P0) — Table view, row-aligned.**
As a user, I want to see the two files aligned so gaps are visually obvious.
- **Given** keys in different orders in the two files, **then** rows are aligned by key: the reference file's order first, then leftover keys in the order they appear in their own file.
- **Given** a key absent from one file, **then** that cell renders a dashed "ghost" cell with the label "missing" and an "Add" action — the row still occupies exactly one line in both columns.
- **When** I sort alphabetically, **then** both columns re-sort together (alignment is preserved by construction).

**US-09 (P0) — State is never colour-only.**
- **Given** any row, **then** its state is conveyed by an icon + a text label + a colour; **and** in greyscale (or with `forced-colors`), the state remains distinguishable.
- **Given** colour-blind simulation (deuteranopia), **then** adjacent states remain distinguishable (verified with a palette check in review).

**US-10 (P0) — Edit a value in the table.**
As a user, I want to fix a value without leaving the table.
- **Given** a cell, **when** I click it, **then** it becomes an input with the current raw value selected and the surrounding quote style preserved.
- **When** I commit (blur/Enter) with a new value, **then** the underlying text is patched surgically (only that span changes), the file re-parses, and the summary updates.
- **When** my edit makes the line unparseable (e.g. I typed a `#` into an unquoted value), **then** the tool quotes it automatically or warns inline — the app never silently corrupts the file.
- **When** I press `Escape`, **then** the edit is discarded.
- **Given** I edited something, **when** I press the undo control, **then** the last patch is reverted (in-memory stack, 50 entries max).

**US-11 (P0) — Add a missing key.**
- **Given** a ghost cell for a missing key, **when** I click "Add", **then** `KEY=` (with a trailing comment `# from .env.example`, configurable) is appended to that file, the cell becomes `empty` (amber), and the summary count decrements.
- **When** the same key was `commented` out, **then** the action is "Uncomment" instead, which removes only the leading `#`.

**US-12 (P0) — Remove or keep a leftover key.**
- **Given** a key only present in `.env`, **then** it is labelled "Only in `.env`" and offers "Remove" with a confirm-on-hover/undo toast.
- **Given** I remove it, **then** the line (and any attached comment) is deleted and can be undone.

**US-13 (P1) — Value comparison without exposure.**
- **Given** both files define a key, **then** the tool compares values locally and shows "same" / "different" as a badge, **without** printing either value unless the row's values are already visible.
- **Given** masked mode is on, **then** the badge is still truthful (comparison uses in-memory strings, not rendered text).

**US-14 (P0) — Raw view.**
As a developer, I want to see the original text so I trust the analysis.
- **Given** raw view, **then** each file renders in a monospace pane with line numbers, comments preserved, and no reformatting.
- **Given** a missing key, **then** a non-destructive inline marker appears in the target pane at the position where the key exists in the reference (a visual-only overlay — the text itself is never altered in raw view).
- **When** I scroll one pane, **then** the other follows (toggleable "sync scroll").
- **When** content is trimmed/masked, **then** it is shown in a `<pre>` with wrapping off and horizontal scroll.

**US-15 (P0) — Diagnostics.**
- **Given** a line that does not parse (e.g. `MY KEY=value`), **then** a warning lists `line 14: keys can't contain spaces`, the affected text is underlined in Raw, and the variable is excluded from the comparison with an explicit note ("1 line could not be read").
- **Given** duplicate keys, **then** "`API_URL` is defined twice; the last one wins (line 22)".
- **Given** no diagnostics, **then** no diagnostics panel is rendered (no empty chrome).

### 8.3 Output and handoff

**US-16 (P0) — Copy the fix.**
- **Given** 3 missing variables, **when** I click "Copy 3 variables for `.env`", **then** the clipboard receives exactly:
  ```
  # Added by EnvCompare — fill in the values
  STRIPE_SECRET_KEY=
  RESEND_API_KEY=
  DATABASE_URL=
  ```
  and a toast confirms "Copied — values are left empty on purpose. Fill them in."
- **Given** masked mode, **then** the copied block **never** contains a secret value from another file; values are always blank.
- **Given** the Clipboard API is unavailable, **then** a modal with a pre-selected textarea is shown.

**US-17 (P0) — Download a corrected file.**
- **Given** results, **when** I click "Download `.env`", **then** the patched text is delivered via a `Blob` + object URL (no network), named `env` or the label, and the object URL is revoked after download.

**US-18 (P0) — Redacted report.**
- **Given** results, **when** I click "Copy report", **then** the clipboard receives Markdown: title, timestamp, filenames, counts, a table of key → state per file, and **key names only** (no values, no masked values). A note says "Generated locally by EnvCompare. Contains no values."
- **When** I choose "include masked values", **then** values are replaced with `••••` (revealing length class only: `••••` vs `••••••••`).
- **Given** "include full values" is selected, **then** a confirmation explains the risk, and the action is labelled "Copy anyway".

**US-19 (P1) — AI handoff prompt.**
- **When** I click "Copy prompt for my agent", **then** the clipboard receives a templated instruction listing only the missing key names and the target filename.

### 8.4 Trust

**US-20 (P0) — Privacy is visible and verifiable.**
- **Given** any screen, **then** a persistent, non-modal badge reads "Runs in your browser · nothing is uploaded", linking to `/privacy`.
- **Given** `/privacy`, **then** it lists each guarantee, how it is enforced (with a link to the exact source file/CI check), what we cannot protect against, and a 30-second DevTools verification recipe.

**US-21 (P0) — Mask values.**
- **Given** results, **when** I toggle "Hide values", **then** every value is replaced by `••••` in the DOM (< 200 ms for 2 × 500 rows), the toggle is remembered only for this page session, and turning it off restores the values from in-memory state.
- **Given** masked mode, **then** copying a raw pane copies masked text and warns "You're copying masked values."

**US-22 (P0) — Nothing persists.**
- **Given** I reload the page, **then** both textareas are empty and no dialog restores previous content.
- **Given** DevTools → Application, **then** Local Storage, Session Storage, IndexedDB, and Cookies are empty after a full session of use.
- **Given** I navigate back to the page, **then** no file content is reconstructed from history or URL.

### 8.5 Contribution

**US-23 (P1) — Report a parsing edge case.**
- **Given** a line the tool misreads, **then** a "Report this" link opens a pre-filled GitHub issue containing the *shape* of the line (e.g. `MULTILINE_KEY="-----BEGIN …"`) and the app version — never the user's actual values — plus a prominent warning never to paste real secrets.

---

## 9. Product concept and core model

### 9.1 The four outputs

One shared parsed model drives four views. No view owns state; the **source text is the single source of truth** (invariant I1), and every view is a projection of it.

```
            ┌───────────────────────────────────────────────┐
 text (2+)  │  parse (lossless + semantic)                  │
 ─────────► │    occurrences, spans, diagnostics            │
            └──────────────────┬────────────────────────────┘
                               ▼
            ┌───────────────────────────────────────────────┐
            │  compare → key rows × file cells × states      │
            └───┬───────────┬───────────┬───────────┬────────┘
                ▼           ▼           ▼           ▼
             Summary      Table        Raw         Fix
          (plain words) (aligned,   (annotated)  (copy-ready)
                         editable)
```

### 9.2 Reference file and the key universe

- **Reference**: the "schema" file (normally `.env.example`). Determines *what should exist* and the **row order**.
- **Targets**: one or more files that must satisfy the reference (`.env`, `.env.local`, `.env.production`).
- **Key universe**: reference keys in reference order, then any remaining keys ordered by first appearance across targets (alphabetical tiebreak). A key is identified by its **exact, case-sensitive name** — `api_key` and `API_KEY` are different variables, and the tool says so rather than guessing.

### 9.3 Variable state taxonomy

This is the heart of the product. Every (key, file) pair gets exactly one state.

| State | Meaning | Detection | Severity | Colour token | Icon | Plain-language label |
| --- | --- | --- | --- | --- | --- | --- |
| `absent` | Not in this file at all | no assignment, no commented assignment | error (if the reference requires it) | `--st-missing` rose-600 | `⊘` | "Missing from this file" |
| `empty` | Defined with no value | parsed value `=== ''` (`KEY=`, `KEY=""`, `KEY=  `) | error | `--st-empty` amber-600 | `!` | "Set, but empty" |
| `placeholder` | Defined with a template value | matches placeholder heuristics (§12.9); high confidence only | warning | `--st-placeholder` violet-600 | `✎` | "Still the example value" |
| `commented` | Only a commented-out assignment exists | `# KEY=` line whose content matches the assignment grammar | info | `--st-commented` slate-500 | `//` | "Commented out" |
| `present` | Defined with a real-looking value | everything else | ok | `--st-ok` emerald-600 | `✓` | "Set" |
| `differs` | Both files define it, values differ | string inequality (computed locally, never rendered as text) | info | `--st-differs` sky-600 | `≠` | "Set differently in each file" |

`differs` is a **row-level annotation**, not a per-cell state: it is set when every compared file has a `present` cell and the values are not byte-equal (§12.5, §12.12).

**Precedence when a file has multiple occurrences of one key** (duplicates): the *effective* (last) occurrence decides the state, and a duplicate diagnostic is attached. If a key is both commented and defined, `present`/`empty` wins and the comment is noted.

**Row severity** (what the summary counts and how rows sort) is derived from the *targets* — being absent from the reference file is "extra", not "missing":

| Row condition | Severity | Bucket in summary |
| --- | --- | --- |
| absent from a target, present in reference | error | "Missing" |
| empty or high-confidence placeholder in a target | error / warning | "Needs a value" |
| present only in a target (not in reference) | info | "Only in …" |
| commented out in a target, present in reference | error | "Missing" (action: uncomment) |
| commented in the reference and absent in a target | info | "Commented out" (never an error) |
| present everywhere with equal values | ok | "Matching" |

### 9.4 Comparison algorithm

```
compare(reference, targets[]):
  ref = parse(reference);  tgts = targets.map(parse)

  keys = orderedUnion(ref.order, tgts.map(t => t.order))

  rows = for key in keys:
    cells = {}
    for file in [ref, ...tgts]:
      occ  = file.effective.get(key)          // last occurrence wins
      cells[file.id] = classify(occ, file)     // absent|empty|placeholder|commented|present
    if every file has a present cell and the values are not byte-equal
      → valueDiffers = true (never printed)
    severity = worstSeverity(cells, ref, tgts)
    rows.push({ key, cells, severity, actions })
  return { rows, summary: countBy(rows), diagnostics }
```

Complexity: O(total keys). A 2 × 1,000-key comparison is a few hundred microseconds; rendering is the only real cost (virtualise beyond 300 rows).

**Row-level rule that the per-cell states cannot express:** if the **reference** cell is `commented`, then a target cell of `absent` must **not** be reported as an error. A key documented as `# SENTRY_DSN=` in `.env.example` is an optional integration that is switched off, not a missing requirement. Such a row is `info` → "Commented out", with an "Uncomment" action. Conversely, if the reference cell is `present` and the target is `commented`, the row is `error` → missing (the user has it, but it is disabled).

### 9.5 What counts as a "placeholder"

Conservative, two-tier (full rules in §12.9):

- **High confidence (→ `placeholder`, warning):** `changeme`, `change_me`, `replace_me`, `your_api_key_here`, `your-token`, `<YOUR_KEY>`, `{{API_KEY}}`, `xxx…`, `TODO`, `...`, `your-project-ref`, `sk_test_xxxx`, and values that are exactly `${SOME_KEY}` (an unexpanded reference used as a value).
- **Low confidence (→ `present` + subtle hint, never an error):** `test`, `dummy`, `example`, `dev`. These are legitimate values in real projects; flagging them as errors would destroy trust in the tool's accuracy.

> **Accuracy principle:** a false positive is worse than a false negative. Every "problem" we surface must be something the user agrees is a problem when they look at it. Anything speculative is an `info` hint, never an error.

---

## 10. UX specification

### 10.1 Information architecture

Single page, three regions, two states of the page:

```
/                → the tool (input → results, in-place)
/privacy         → the trust page (static, no JS required)
/about           → short: why, who, how (static)
```

No routing between input and results — results **replace** the input area but keep a compact, collapsible "files" bar so the user can always get back to editing. This avoids a jarring navigation and keeps state trivially in memory.

```mermaid
flowchart LR
  A[Landing<br/>2 textareas + sample] -->|paste both| B[Results<br/>summary + tabs]
  B -->|edit files| A
  B --> C[Table]
  B --> D[Raw]
  B --> E[Fix]
  C -->|copy fix / download| F[Clipboard / Blob]
  E -->|copy report| F
```

### 10.2 Layout — input state (desktop)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ⬢ EnvCompare      Runs in your browser · nothing is uploaded ↗     ◐  ⑂ ★ 3 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   See what your .env is missing.                                             │
│   Paste your .env.example and your .env. We'll show every variable that's     │
│   missing, empty, or leftover — and give you the block to paste.              │
│                                                                              │
│   ┌───────────────────────────────┐  ┌───────────────────────────────┐      │
│   │ .env.example        [reference]│  │ .env                          │      │
│   │ ┌───────────────────────────┐ │  │ ┌───────────────────────────┐ │      │
│   │ │ # Database                │ │  │ │ # Database                │ │      │
│   │ │ DATABASE_URL=postgres...  │ │  │ │ DATABASE_URL=postgres...  │ │      │
│   │ │                           │ │  │ │                           │ │      │
│   │ │ ( paste here )            │ │  │ │ ( paste here )            │ │      │
│   │ └───────────────────────────┘ │  │ └───────────────────────────┘ │      │
│   │ 8 variables · 14 lines        │  │ 6 variables · 11 lines        │      │
│   │ ⤓ drop a file  ⧉ paste  ✕ clear│  │ ⤓ drop a file  ⧉ paste  ✕ clear│      │
│   └───────────────────────────────┘  └───────────────────────────────┘      │
│                                                                              │
│   See an example   ·   What gets compared?   ·   Is this safe?               │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes: the comparison runs as you type once **both** sides have ≥ 1 variable (no submit button — a button implies a round-trip and therefore a server). A quiet line under the boxes reads: *"Nothing is sent anywhere. Close the tab and it's gone."*

### 10.3 Layout — results state (desktop, 2 files)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ⬢ EnvCompare   .env.example ▸ .env   [Edit files]  [Hide values]  [Reset]   │
├──────────────────────────────────────────────────────────────────────────────┤
│  ⚠ 3 variables are in .env.example but missing from .env.  1 is empty.        │  ← aria-live
│  ─────────────────────────────────────────────────────────────────────────   │
│  [ Summary ] [ Table ] [ Raw ] [ Fix ]        Missing 3 · Empty 1 · Extra 2  │
├──────────────────────────────────────────────────────────────────────────────┤
│   KEY                        │ .env.example        │ .env                    │
│  ────────────────────────────┼─────────────────────┼────────────────────────│
│  DATABASE_URL                │ ✓ Set               │ ✓ Set                   │
│  NEXT_PUBLIC_SUPABASE_URL    │ ✓ Set               │ ✓ Set                   │
│  NEXT_PUBLIC_SUPABASE_ANON…  │ ✓ Set               │ ✎ Still the example val…│
│  STRIPE_SECRET_KEY           │ ✓ Set               │ ⊘ Missing   [+ Add]     │
│  RESEND_API_KEY              │ ✓ Set               │ ⊘ Missing   [+ Add]     │
│  SENTRY_DSN                  │ ✓ Set               │ ! Set, but empty        │
│  LEGACY_GA_ID                │ ⊘ Missing  [− Del]  │ ✓ Set                   │
│  OLD_FEATURE_FLAG            │ —                   │ ✓ Set  Only in .env     │
├──────────────────────────────────────────────────────────────────────────────┤
│  What do I do now?   1. Add the 3 missing keys   2. Fill in the empty one     │
│                      3. Remove the 2 leftovers        [ Copy 3 for .env ]     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 10.4 Layout — N-file matrix (v1.1)

```
│  KEY                    │ .env.example │ .env.local │ .env.production │
│  DATABASE_URL           │ ✓            │ ✓          │ ✓               │
│  STRIPE_SECRET_KEY      │ ✓            │ ✓          │ ⊘               │
│  RESEND_API_KEY         │ ✓            │ ⊘          │ ⊘               │
│  DEBUG                  │ —            │ ✓          │ —               │
```

Same component, N columns; the reference column is pinned and marked. On narrow screens the matrix becomes a per-key card with a row of file chips.

### 10.5 Layout — mobile (≤ 640 px)

- Input: stacked textareas with a sticky affordance showing counts.
- Results: summary first, then a **segmented control** (`Summary · Table · Raw · Fix`); the table becomes a **card list**: one card per key, with a file chip per file and its state. This preserves the "which file is which" answer without horizontal scrolling.
- Minimum touch target 44 × 44 px; no hover-only actions (row actions live in an overflow menu).

### 10.6 Component inventory

| Component | Responsibility | Notes |
| --- | --- | --- |
| `AppShell` | Header, privacy badge, theme, footer | Static, no state |
| `FilePane` | Editable label, textarea, drop zone, counts, diagnostics trigger | Controlled; `autoComplete="off"`, `spellCheck={false}`, no `name` attribute |
| `CompareSummary` | Plain-language sentences + counts | `aria-live="polite"`; pure function of the model |
| `ViewTabs` | Summary/Table/Raw/Fix | Roving tabindex, `role="tablist"` |
| `CompareTable` | Aligned rows, sticky header, filters, sort | Real `<table>`; virtualised > 300 rows |
| `StateChip` | Icon + label + colour for a state | Single source of the state visual language |
| `KeyCell` | Value display / inline editor / ghost cell + action | Owns patch generation |
| `RawPane` | Numbered text, marker overlay, sync scroll | `<pre>`, no syntax highlighting in v1 |
| `FixPanel` | Generated blocks, copy/download | Shows exactly what will be copied |
| `ReportPanel` | Redaction level + preview + copy | The preview is what gets copied |
| `DiagnosticsList` | Parse warnings with line links | Links scroll Raw to the line |
| `Toast` | Transient confirmations with undo | Max 1 at a time, 6 s |
| `ConfirmDialog` | Destructive actions | Focus trap, `Escape` cancels |
| `PrivacyBadge` / `PrivacyPage` | Trust surface | Static text, verifiable claims |

### 10.7 Interaction details

| Behaviour | Spec |
| --- | --- |
| Debounce | 250 ms after the last keystroke; immediate on paste/drop |
| When comparison runs | Both sides have ≥ 1 parsed variable, or one side has content and the other is empty (so "everything is missing" is visible) |
| Sorting | Default: reference order. Toggle: alphabetical. Filtering never changes order |
| Filters | By state, per file; multi-select; chip row shows active filters; `Esc` clears |
| Scroll sync (Raw) | Proportional by line index, not pixels; defaults ON for 2 files |
| Undo | In-memory stack of `{fileId, before, after}` (50 entries, 8 MB cap); `Ctrl/Cmd+Z` while editing in the table; visible "Undo" in the toast |
| Copy | Clipboard API, with a manual-select modal as the fallback (no `execCommand`) |
| Masking | Global toggle + per-row reveal (auto re-masks on view change); masked values never enter the DOM |
| Focus | After "Add key", focus moves to the new cell's input; after a view change, focus moves to the tab panel's heading |
| Keyboard | `Alt+1..4` switch views, `Esc` closes dialogs / clears filters, `/` focuses the filter box, `?` opens a shortcut sheet (P1) |
| Before unload | `beforeunload` confirmation only if content exists and nothing was copied or downloaded (never on an untouched page) |
| Destructive | "Clear all" and "Remove key" are undoable; "Clear all" also requires confirmation |

### 10.8 Copy deck (excerpt)

| Context | Copy |
| --- | --- |
| H1 | See what your `.env` is missing. |
| Sub | Paste your `.env.example` and your `.env`. We'll show every variable that's missing, empty, or leftover — and give you the block to paste. |
| Privacy badge | Runs in your browser · nothing is uploaded |
| Input helper | Nothing is sent anywhere. Close the tab and it's gone. |
| Summary, missing | {n} variables are in `.env.example` but missing from `.env`. |
| Summary, empty | {n} set but empty — these usually break at runtime. |
| Summary, placeholder | {n} still have the example value. |
| Summary, extra | {n} are only in `.env` and no longer in `.env.example`. |
| Summary, clean | Nothing is missing. Your `.env` matches `.env.example`. |
| Fix heading | Paste this into `.env` |
| Fix note | Values are left blank on purpose — fill them in with your real credentials. |
| Report note | Contains key names only. No values. Safe to share. |
| Empty state (one side) | Add your `.env` too and we'll tell you exactly what's missing. |
| Parse error | Line {n}: keys can't contain spaces. We skipped this line — fix it and we'll re-check. |
| Duplicate | {KEY} is defined twice. The last one wins (line {n}). |
| Secret warning | This looks like a live credential. Make sure `.env` is listed in `.gitignore`. |
| Clipboard blocked | Your browser blocked the clipboard. Here's the text — select all and copy. |
| Clear confirm | This wipes both files from this tab. It can't be undone. |

### 10.9 Accessibility requirements (WCAG 2.2 AA)

- Every state has icon + text + colour; `forced-colors: active` fallback uses borders and glyphs.
- The table is a real `<table>`: `<th scope="col">` per file, `<th scope="row">` for the key, and `aria-label="DATABASE_URL in .env: missing"` per cell.
- Live regions: summary (`polite`), toasts (`polite`), errors (`assertive`, once per error — never per keystroke).
- Full keyboard path: input → tabs → table → actions; focus ring ≥ 3:1; no focus traps except modals.
- In-place editing: `Enter` commits, `Escape` cancels, `Tab` commits and advances (documented in a help popover).
- `prefers-reduced-motion` disables toast and panel transitions.
- 200% zoom and 320 px width without horizontal page scroll (tables scroll inside their own container).
- `lang="en"`, plain language, no idioms in critical copy.

### 10.10 Visual language

- **Density:** compact but breathable; monospace for keys and values (system mono stack), sans for prose (system sans stack — no web fonts, per NG5).
- **Palette:** neutral surface + six semantic tokens (missing / empty / placeholder / commented / ok / differs), each with light, dark, and AA-contrast variants. Tokens live in CSS custom properties; no colour literals in components.
- **Dark mode:** follows `prefers-color-scheme`; the manual toggle is **in-memory only** (persisting a theme in `localStorage` would violate NG2 — accepted tradeoff, documented in Q4).
- **Motion:** 120–180 ms ease-out, opacity/transform only.
- **Iconography:** inline SVG, 16/20 px, 1.5 px stroke; every icon in the table is paired with text.

---

## 11. Functional requirements

Numbered for traceability. **M** = must (P0), **S** = should (P1), **C** = could (P2).

| ID | Requirement | Pri | Acceptance (short) |
| --- | --- | --- | --- |
| FR-01 | Accept pasted text in two or more file panes, preserving bytes exactly (including CRLF) | M | Downloading an unedited file is byte-identical to the input |
| FR-02 | Editable file labels with sensible defaults | M | Defaults `.env.example` / `.env`; an empty label falls back to `file-1` |
| FR-03 | Auto-detect the reference file by name patterns | M | `.env.example`, `.env.sample`, `.env.template`, `.env.dist`, `example.env`, `*.example` → reference |
| FR-04 | Manual role swap | M | One click; all copy and counts reverse correctly |
| FR-05 | Parse per §12 and expose diagnostics with line numbers | M | 100% agreement with `dotenv` on the fixture corpus |
| FR-06 | Classify every (key, file) into the six states | M | Golden-matrix tests cover every combination in Appendix B |
| FR-07 | Detect duplicate keys, report last-wins | M | Diagnostic shows both line numbers |
| FR-08 | Detect commented-out assignments as `commented` | M | `# KEY=value` → commented, not absent |
| FR-09 | Validate `${VAR}` / `$VAR` references against the same file | S | Unresolved reference → info diagnostic naming the missing key |
| FR-10 | Detect secret-shaped keys and values for masking | M | ≥ 95% recall on the fixture list in §12.10; **zero** false positives on the "not a secret" list |
| FR-11 | Global mask toggle + per-row reveal | M | No value text in the DOM while masked (asserted via `innerText`) |
| FR-12 | Row-aligned table with ghost cells | M | The same key occupies the same visual row in every column |
| FR-13 | Inline editing via surgical text patches | M | Only the edited span changes; comments and formatting elsewhere are untouched |
| FR-14 | Add / uncomment / remove a key | M | All three are undoable and update counts immediately |
| FR-15 | Undo stack (in-memory) | S | 50 entries; survives view switches; cleared on "Clear all" |
| FR-16 | Raw view with line numbers, markers, sync scroll | M | Markers are visual-only; the text is never modified |
| FR-17 | Copy fix block (values blank) | M | Exact block asserted in tests; never includes values |
| FR-18 | Download a corrected file via Blob | M | No network; object URL revoked |
| FR-19 | Redacted Markdown report with three redaction levels | M | The default level contains zero value characters |
| FR-20 | Plain-language summary with counts and `aria-live` | M | Snapshot-tested for every combination in §10.8 |
| FR-21 | Persistent privacy badge + `/privacy` page | M | Every claim maps 1:1 to an enforceable check |
| FR-22 | Zero network after load; zero storage APIs | M | e2e fails on any request; CI grep fails on storage APIs |
| FR-23 | Sample data loader | M | Clearly fake values; asks before overwriting existing content |
| FR-24 | Clear-all with confirmation | M | Wipes state, DOM, and undo stack; focus returns to the first input |
| FR-25 | Diagnostics for oversized input | M | Soft warn > 256 KB or > 2,000 keys; hard block > 2 MB |
| FR-26 | Keyboard shortcuts + shortcut sheet | S | Documented, discoverable, non-conflicting |
| FR-27 | N-file matrix (3+) | C | Reference pinned; per-column counts |
| FR-28 | AI handoff prompt (keys only) | C | Snapshot test asserts no values are present |
| FR-29 | Framework presets + prefix lint | C | Presets only change warnings, never how values are parsed |
| FR-30 | i18n string catalogue | S | All UI strings via `t()`; only `en.ts` in v1 |

---

## 12. Parsing and comparison specification (normative)

Parsing accuracy **is** the product. A tool that misreports a variable is worse than no tool, because it produces confident wrong answers.

### 12.1 Strategy: two layers, one source of truth

| Layer | Purpose | Implementation |
| --- | --- | --- |
| **Lossless layer** | Render raw text, map spans, apply surgical edits, keep comments/formatting/line endings | Hand-written scanner over the source string; emits `VarOccurrence` with absolute `span`, `line`, quote style, `export` flag, trailing comment |
| **Semantic layer** | Decide the actual value with dotenv-compatible semantics | A pinned, vendored copy of the `dotenv` parse rules (BSD-2-Clause, attribution retained), cross-checked against the real `dotenv` package as a devDependency in tests |

Why vendored rather than importing `dotenv`: `dotenv` v18 ships `dist/index.cjs` with `browser: { fs: false }` and is not designed as a browser library; importing it drags Node shims into the bundle and couples the UI to its module layout. Vendoring ~40 lines plus a conformance suite against the upstream package gives us compatibility **and** a dependency-free bundle.

Why not write it from scratch and hope: dotenv's grammar is subtler than it looks (§12.3) and a hand-rolled regex diverges within minutes.

### 12.2 Input normalisation

| Concern | Rule |
| --- | --- |
| Encoding | UTF-8 assumed. A leading BOM (`U+FEFF`) is stripped for parsing but preserved in output |
| Line endings | `\r\n` and `\r` normalised to `\n` **for parsing only**; original endings preserved for output/download |
| Trailing whitespace | Preserved in the text; irrelevant to values |
| Size | Warn > 256 KB or > 2,000 keys; refuse > 2 MB (client-side only) |
| Binary | If the input contains `\u0000`, refuse with "That doesn't look like a text file" |
| Empty input | No variables, no diagnostics, input state shown |

### 12.3 Grammar (dotenv-compatible)

The canonical regex in `dotenv` v18 (classic parser, the default) is:

```
/(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm
```

Consequences we must implement and test:

1. **Key charset:** letters, digits, `_`, `.`, `-` (`[\w.-]`). No spaces, no quoting of keys.
2. **Optional `export ` prefix.**
3. **Separators:** `=` with optional surrounding whitespace, **or** `:` followed by at least one whitespace (`KEY: value` is valid; `KEY:value` is not).
4. **Quoted values:** single, double, or backtick quotes; may span **multiple lines**; an escaped closing quote is allowed (`\'`, `\"`, `` \` ``).
5. **Unquoted values:** everything up to a `#` or the end of the line.
6. **Inline comments:** `#` starts a comment anywhere in an unquoted value (dotenv ≥ 15). A value containing `#` must be quoted — this is the single most common silent `.env` bug (`PASSWORD=abc#123` reaches the app as `abc`), which is why the `SUSPECT_HASH_TRUNCATION` diagnostic exists and why we offer a one-click "quote this value" fix.
7. **Value post-processing:** trim; strip one pair of matching surrounding quotes; in double quotes only, expand `\n` → newline and `\r` → CR.
8. **Duplicates:** a later assignment overwrites an earlier one (last wins).
9. **No expansion:** `${VAR}` is **not** interpolated by `dotenv` (it moved to `dotenvx` / `dotenv-expand`). We must therefore never resolve references when deciding "empty" — we validate them as references (FR-09) and display them literally.
10. **No type coercion:** everything is a string. `KEY=false` and `KEY=0` are non-empty values.

### 12.4 The lossless scanner

Scan line by line, tracking a "current logical line" so a multi-line quoted value produces one occurrence whose span covers all its lines. For each occurrence record:

```ts
interface VarOccurrence {
  key: string;
  keyRaw: string;                 // exactly as written (for diagnostics)
  valueRaw: string;               // between the separator and any trailing comment
  value: string;                  // dotenv-normalised
  quote: 'none' | 'single' | 'double' | 'backtick';
  isExport: boolean;
  line: number;                   // 1-based start line
  endLine: number;
  span: { start: number; end: number };        // absolute char offsets for the whole logical line
  valueSpan: { start: number; end: number };   // for surgical edits
  trailingComment?: string;
  leadingComment?: string;
  refs: string[];                 // ${VAR} and $VAR found in the value
  diagnostics: DiagnosticId[];
}
```

### 12.5 State classification (exact rules)

```
classify(occ, file):
  if occ == null:
      return file.commentedKeys.has(key) ? 'commented' : 'absent'
  if occ.value === '':                        return 'empty'
  if isHighConfidencePlaceholder(occ.value):  return 'placeholder'
  return 'present'
```

`differs` is a row-level annotation (§9.3, §12.12), not a per-cell state. Empty vs present is already captured per cell, so there is nothing to infer.

### 12.6 Key identity

- **Case-sensitive:** `API_KEY` ≠ `api_key`. A P1 hint may say "a key differing only by case exists in the other file" — never a silent merge.
- Whitespace around the key is not part of the key (dotenv matches with `\s*`).
- Dots and dashes are legal (e.g. `sentry.trace-sample-rate`).
- Keys are **never** normalised, lower-cased, or uniquified.

### 12.7 Duplicates

- The effective value is the last occurrence (dotenv semantics).
- Diagnostic: `warning: KEY is defined 2 times (lines 4, 22). The last one wins.`
- Both occurrences remain visible in Raw; the Table shows the effective one with a `×2` badge.

### 12.8 Comments and commented-out keys

- Full-line comments (`# ...`) are preserved verbatim and never treated as variables, **except**: a comment whose content matches the assignment grammar is recorded in `commentedKeys` and surfaced as state `commented` (info).
- That is exactly how real `.env.example` files document optional integrations, so it maps onto a real mental model: "available, but switched off".
- Trailing comments on an assignment are preserved and included in patches — they belong to the line.

### 12.9 Placeholder heuristics (normative)

Case-insensitive. Applied to the parsed value after quote stripping, on `value.trim()`.

**High confidence → `placeholder`:**

| Rule | Examples |
| --- | --- |
| Exact tokens | `changeme`, `change_me`, `replace_me`, `replaceme`, `todo`, `tbd`, `fixme`, `null`, `undefined`, `none`, `...`, `…`, `xxx`, `xxxx`, `****`, `----` |
| Angle/brace template | `^<.*>$`, `^\{\{.*\}\}$`, `^\[.*\]$` where the content is `YOUR` / `INSERT` / `ADD` |
| "Your X" phrasing | `^yours?[-_ ]` followed by `api`, `key`, `token`, `secret`, `password`, `id`, `client`, `project`, `url` |
| Placeholder-in-token | `^sk_(test\|live)_x+$`, `^x{8,}$`, `^0{8,}$`, `your[-_]?project[-_]?ref` |
| Unresolved reference as value | `^\$\{?[A-Z0-9_]+\}?$` (also recorded as a reference) |
| Documented sentinel | `^__.*__$`, `^<ADD_.*>$`, `^INSERT_.*_HERE$` |

**Low confidence → stays `present`, optional info hint:** `test`, `testing`, `dummy`, `fake`, `example`, `dev`, `development`, `localhost`, `127.0.0.1`, `password`, `admin`.

> Rationale: `DATABASE_URL=postgres://localhost/dev` is a completely valid local value. Calling it a placeholder would make the tool cry wolf on the most common setup in existence.

### 12.10 Secret detection (for masking and warnings only)

Never used to change a state — only to drive masking defaults, the "looks like a live credential" hint, and report redaction.

**Key-name signals (case-insensitive):** `SECRET`, `TOKEN`, `PASSWORD`, `PASSWD`, `PWD`, `API_KEY`, `APIKEY`, `PRIVATE_KEY`, `ACCESS_KEY`, `CLIENT_SECRET`, `CREDENTIAL`, `DSN`, `DATABASE_URL`, `CONNECTION_STRING`, `WEBHOOK`, `SIGNING`, `SALT`, `SERVICE_ROLE`, `AUTH`.

**Value-shape signals:** PEM private keys, JWTs (`eyJ…` with two dots), AWS `AKIA[0-9A-Z]{16}`, Stripe `sk_live_` / `sk_test_` / `rk_live_`, GitHub `ghp_` / `gho_` / `github_pat_`, Slack `xox[baprs]-`, Google `AIza[0-9A-Za-z_-]{35}`, OpenAI `sk-proj-` / `sk-`, Anthropic `sk-ant-`, npm `npm_…`, Shopify `shpat_`, SendGrid `SG.…`, Docker `dckr_pat_`, and URLs with embedded credentials (`scheme://user:pass@host`).

**Rules:** detection is local and deterministic; a detection only ever *adds* masking or a warning, never removes data; the fixture suite includes a "definitely not a secret" list to guard against noise (`NODE_ENV=production`, `PORT=3000`, `NEXT_PUBLIC_SITE_URL=https://…`).

### 12.11 Ordering

1. Reference file order (first appearance of each key).
2. Then keys that exist only in targets, ordered by first appearance across targets in file order, tie-broken alphabetically.
3. Optional alphabetical sort (stable; case-insensitive first, then case-sensitive).

### 12.12 Value comparison

- Byte comparison of parsed values (no trimming beyond dotenv's own).
- Never rendered as text unless the value is already visible.
- Multiline values are compared exactly; when masked, display "multiline (N lines)" instead of the content.
- "Different" is `info`, never an error: different values across environments are normal and expected.

### 12.13 Surgical edit model

The table never rewrites the file. It emits patches:

```ts
type TextPatch =
  | { kind: 'replaceValue'; span: Span; nextValue: string; quote: QuoteStyle }
  | { kind: 'insertKey'; afterLine: number; key: string; rawValue?: string; comment?: string }
  | { kind: 'removeKey'; span: Span }          // includes the line's newline
  | { kind: 'uncomment'; line: number };
```

Rules:

- Preserve the original quote style. If the new value contains `#`, leading/trailing whitespace, or newlines, quote it (double quotes preferred, `\n` for newlines) and tell the user in a toast that quoting was added.
- Preserve the line endings of the file being edited.
- `insertKey` appends to the end of the file, after a single blank line if the file does not already end with one, with the comment `# Added by EnvCompare`.
- After any patch: re-parse the affected file only, recompute the comparison (O(n)), push onto the undo stack.

### 12.14 Diagnostics catalogue

| Code | Severity | Message | Effect |
| --- | --- | --- | --- |
| `PARSE_BAD_KEY` | error | Line {n}: keys can't contain spaces or quotes | Line skipped |
| `PARSE_NO_VALUE` | info | Line {n}: no `=` found — treated as a comment | Line ignored |
| `DUP_KEY` | warning | {KEY} is defined twice (lines {a}, {b}); the last one wins | Effective = last |
| `REF_UNRESOLVED` | info | {KEY} references `${OTHER}`, which isn't defined in this file | None (hint only) |
| `SUSPECT_HASH_TRUNCATION` | warning | Line {n}: the value stops at `#`. If your password contains `#`, wrap the value in quotes. | Parsed value shown, plus a "quote it" action |
| `NOT_TEXT` | error | This doesn't look like a text file | File rejected |
| `TOO_LARGE` | error | File is larger than 2 MB | File rejected |
| `MANY_KEYS` | info | {n} keys — comparison may be slow | Virtualisation on |
| `MULTILINE` | info | {KEY} spans lines {a}–{b} | Shown as "multiline" |

### 12.15 Framework compatibility notes

| Runtime | Notes for the v1.1 presets |
| --- | --- |
| Node + `dotenv` | The reference implementation; our baseline grammar |
| Next.js (`@next/env`) | Supports `$VAR` expansion; browser-exposed vars need `NEXT_PUBLIC_` |
| Vite (`dotenv` + `dotenv-expand`) | Expansion supported; browser-exposed vars need `VITE_`; `envPrefix` is configurable |
| Docker Compose `.env` | No `export`; different quoting rules; used for interpolation inside the compose file |
| Python `python-dotenv` | Supports `export`; different multiline handling |
| Ruby `dotenv` | Supports `export` and `KEY: value` |

v1 ships the dotenv superset grammar, plus a note ("this may parse differently in Docker Compose / Python") when a suspicious pattern is detected — only where we are confident.

---

## 13. Privacy and security architecture

### 13.1 Threat model

| ID | Threat | Mitigation | Residual risk |
| --- | --- | --- | --- |
| T1 | Secrets POSTed to our server or a third party | No server, no API routes, no functions; `connect-src 'none'`; no third-party origins in the CSP; an e2e test asserts zero requests after load | None within the app's control |
| T2 | Silent persistence (localStorage, cookies, IndexedDB) | CI grep blocks the APIs; e2e asserts storage is empty; no service worker | Browser-level form restore — mitigated by controlled inputs and `autocomplete="off"` |
| T3 | Secrets in URLs, history, or Referer headers | No content in the URL; `Referrer-Policy: no-referrer`; `no-store` on the document | A user screenshots the address bar of a link they made elsewhere |
| T4 | Third-party scripts or fonts exfiltrate data | No third-party origins at all; system fonts; no analytics or error reporting; dependency allowlist | A compromised build-time dependency — mitigated by a lockfile, `ignore-scripts`, and diff review |
| T5 | Supply-chain attack via a new dependency | Dependency allowlist in CI, `npm ci`, lockfile review, no postinstall scripts, two maintainer approvals for dependency PRs | Maintainer account compromise — mitigated by 2FA and branch protection |
| T6 | Accidental exposure on a screen share or in a screenshot | Mask-values toggle, per-row reveal, redacted report by default, `Alt+H` shortcut | The user's own recorder or OS clipboard history |
| T7 | Browser extensions / password managers reading the DOM | Out of scope; documented on `/privacy`; no `name`/`id` attributes that invite autofill | Extension permissions are outside our control |
| T8 | Clipboard history retains copied secrets | Copy actions prefer keys-only blocks; the Fix block never contains values; documented | OS-level clipboard managers |
| T9 | A malicious fork or lookalike domain captures secrets | README and `/privacy` publish the canonical domain; no third-party embeds make forks auditable | Phishing — mitigated by pointing users at the canonical repo |

### 13.2 Enforcement mechanism 1 — Content Security Policy

Production headers (Vercel `vercel.json`):

```
Content-Security-Policy:
  default-src 'none';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  font-src 'self';
  connect-src 'none';
  form-action 'none';
  base-uri 'none';
  frame-ancestors 'none';
  object-src 'none';
  manifest-src 'self';
  upgrade-insecure-requests
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), usb=(), payment=(), clipboard-write=(self)
X-Content-Type-Options: nosniff
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Notes:

- `style-src 'unsafe-inline'` is required for inline style attributes. It cannot exfiltrate anything on its own and is not a data path.
- **No CSP `report-uri` / `report-to`.** A reporting endpoint would itself be an exfiltration channel *and* a network request. Deliberate omission — document it.
- `connect-src 'none'` blocks `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, and `sendBeacon`. This is the single most important line in the file.
- Dev builds (Vite HMR) need a relaxed CSP. Document that **the production CSP is the guarantee** and that `npm run build && npm run preview` is how to verify locally.
- Optional hardening: `Cache-Control: no-store` on `index.html`.

### 13.3 Enforcement mechanism 2 — CI privacy guard

`scripts/check-privacy.mjs`, run in CI and in `pre-commit`:

1. Scan `src/` for forbidden identifiers: `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `caches`, `serviceWorker`, `sendBeacon`, `XMLHttpRequest`, `new WebSocket`, `new EventSource`, `fetch(`, `window.name`, and `history.pushState` with content.
2. Check `package.json` dependencies against an allowlist (`react`, `react-dom`, plus dev-only tooling). Any addition requires a `deps-approved` maintainer label.
3. After the build, scan `dist/**/*.js` for external origins (`https://`, `http://`, protocol-relative `//`) not in a tiny allowlist of unavoidable literals (e.g. the `http://www.w3.org/2000/svg` namespace). Fail on anything else.
4. Assert `dist/index.html` contains no `<script src>` other than same-origin hashed bundles.
5. Assert there are no inline `<script>` tags (external modules only).

The guard prints a human-readable explanation so contributors understand *why* something is blocked, and links to `docs/PRIVACY.md`.

### 13.4 Enforcement mechanism 3 — tests that would fail if we lied

| Test | Assertion |
| --- | --- |
| `no-network.spec.ts` (Playwright) | Collect every request after `page.goto`; assert all are same-origin static assets, and that zero requests contain any input token |
| `no-storage.spec.ts` | After a full session: `localStorage.length === 0`, `sessionStorage.length === 0`, `indexedDB.databases()` empty, `document.cookie === ''` |
| `storage-hostile.spec.ts` | Override `Storage.prototype.setItem` to throw; the app must still work end to end |
| `csp-violation.spec.ts` | Attempt a `fetch`; assert it is blocked and the app does not report success |
| `reload-empty.spec.ts` | Fill both files, reload, assert both textareas are empty and no restore dialog appears |
| `masked-dom.spec.ts` | Enable masking, assert no secret substring appears in `document.body.innerText` or in any attribute |

### 13.5 What we cannot protect against (published honestly on `/privacy`)

- Your browser, OS, clipboard history, password manager, or extensions.
- Screen sharing or recording while values are visible (mitigated by masking).
- Anyone with access to your unlocked device.
- Vercel's standard access logs (IP, user agent, requested path). They never see file content because there is no request — state this explicitly and do **not** claim "we see nothing at all".
- A fork or a lookalike domain. Verify the URL.

Honesty here increases trust; overclaiming destroys it.

### 13.6 Masking UX details

- **Default: values visible.** The tool must be useful on first use, and masking everything by default makes it look broken. A first-run hint above the table reads: *"Sharing your screen? Click Hide values."*
- Masked rendering: `••••••••` (a fixed eight dots — never a length oracle) for secret-shaped values, `••••` for others. Never the first or last characters.
- Reveal is per row, resets on view change, and auto re-masks after 30 s.
- Copying while masked: the Fix block (already value-free) is unaffected; copying raw text copies masked text and shows a warning toast.
- The report defaults to keys-only regardless of masking.

---

## 14. Technical architecture

### 14.1 Stack decision

**Chosen: Vite + React 19 + TypeScript + Tailwind CSS, static build, no server, deployed to Vercel.**

| Option | Verdict | Why |
| --- | --- | --- |
| **Vite + React + TS (chosen)** | ✅ | No server is possible *by construction* — the strongest form of the privacy claim. Smallest bundle. Fastest local dev. Trivial static export. Anyone can audit `dist/`. |
| Next.js (static export) | ❌ for v1 | Ships a server framework whose defaults (route handlers, RSC, image optimisation, analytics hooks) imply a backend and invite future contributors to add one. Heavier build. Its value here is zero: there are three static routes. |
| Svelte / Vue | ➖ | Fine technically, but React has the largest contributor pool, which matters for an OSS project that accepts PRs. |
| Plain HTML/JS | ➖ | Attractive file layout, unpleasant table/undo/masking logic to maintain and test. |

Tradeoff accepted: no SSR means a brief blank shell on slow connections. Mitigated by tiny JS and inline critical CSS — not by adding a server.

### 14.2 Dependency policy

- **Runtime dependencies: `react` and `react-dom` only.** Everything else (diffing, table virtualisation, clipboard fallback, focus trap, icons) is written in-house or avoided. This is a feature, not a limitation: it makes the privacy claim auditable in one file.
- **Dev dependencies:** `vite`, `typescript`, `@vitejs/plugin-react`, `tailwindcss`, `vitest`, `@testing-library/react`, `@playwright/test`, `eslint`, `prettier`, `@axe-core/playwright`, `dotenv` (test-only, for conformance), `fast-check` (optional).
- `ignore-scripts=true` in `.npmrc`; `npm ci` in CI; committed lockfile.
- Every dependency addition is a PR with the `deps-approved` label and a written justification in the PR body.

### 14.3 Project structure

```
env-compare/
├─ docs/
│  ├─ PRD.md                  # this document
│  ├─ PRIVACY.md              # enforceable guarantees + how to verify
│  └─ adr/                    # 0001-stack.md, 0002-parser.md, 0003-no-storage.md
├─ public/                    # favicon, og image, robots.txt
├─ scripts/
│  └─ check-privacy.mjs       # CI guard (§13.3)
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ core/                   # pure, framework-free, unit-tested
│  │  ├─ parse/
│  │  │  ├─ scanner.ts        # lossless layer
│  │  │  ├─ dotenvCompat.ts   # vendored value semantics
│  │  │  └─ diagnostics.ts
│  │  ├─ compare/
│  │  │  ├─ compare.ts        # key universe, states, severity
│  │  │  ├─ placeholder.ts
│  │  │  ├─ secrets.ts
│  │  │  └─ refs.ts
│  │  ├─ patch/applyPatch.ts  # surgical edits
│  │  └─ export/
│  │     ├─ fixBlock.ts
│  │     ├─ report.ts
│  │     └─ prompt.ts
│  ├─ state/
│  │  ├─ reducer.ts           # one reducer, no persistence
│  │  └─ selectors.ts
│  ├─ ui/
│  │  ├─ components/
│  │  ├─ pages/{Tool,Privacy,About}.tsx
│  │  └─ i18n/en.ts
│  └─ styles/tokens.css
├─ tests/
│  ├─ fixtures/env/           # 60+ .env files + expected JSON
│  ├─ unit/
│  ├─ component/
│  └─ e2e/
├─ vercel.json                # headers, static output
├─ CONTRIBUTING.md
├─ CODE_OF_CONDUCT.md
├─ SECURITY.md
├─ LICENSE
└─ README.md
```

`src/core/` must be importable in Node with no DOM APIs. That keeps tests fast and makes the v2 CLI a thin wrapper rather than a rewrite.

### 14.4 Data model (TypeScript, indicative)

```ts
type Role = 'reference' | 'target';

interface EnvFile {
  id: string;                  // stable, generated — never derived from content
  name: string;                // user-editable label
  text: string;                // single source of truth
  role: Role;
}

type Presence = 'present' | 'empty' | 'placeholder' | 'commented' | 'absent';
type Severity = 'error' | 'warning' | 'info' | 'ok';

interface ParsedFile {
  fileId: string;
  occurrences: VarOccurrence[];          // source order, duplicates included
  effective: Map<string, VarOccurrence>;
  commentedKeys: Set<string>;
  order: string[];                       // first-appearance order of effective keys
  diagnostics: Diagnostic[];
  stats: { lines: number; bytes: number; keyCount: number; duplicateCount: number };
}

interface Cell {
  presence: Presence;
  occurrence?: VarOccurrence;
  isSecret: boolean;
}

interface KeyRow {
  key: string;
  cells: Record<string, Cell>;           // fileId → cell
  severity: Severity;
  valueDiffers: boolean;                 // computed, never displayed as text
  actions: ('add' | 'uncomment' | 'remove' | 'copy-value')[];
}

interface Comparison {
  rows: KeyRow[];
  summary: {
    perFile: Record<string, Record<Presence, number>>;
    missing: number;
    needsValue: number;
    extra: number;
    matching: number;
  };
  diagnostics: Diagnostic[];
}
```

### 14.5 State management

- One `useReducer` in `App`. State: `{ files, comparison, view, maskValues, revealed, filters, sort, undoStack }`.
- Derived data (`Comparison`) lives in a `useMemo` keyed on file texts and roles; it is never authoritative.
- **No middleware, no persistence layer, no storage adapter.** There is deliberately nowhere to add persistence without deleting the guard.
- Reset is `dispatch({ type: 'reset' })`. There is no "save".

### 14.6 Performance

| Concern | Approach | Budget |
| --- | --- | --- |
| Typing latency | 250 ms debounce, `useMemo` on texts, memoised rows | input stays < 16 ms/frame |
| Large tables | Windowed rendering above 300 rows (hand-written, ~40 lines) | 2 × 2,000 keys scroll at 60 fps |
| Parse cost | Single pass, bounded alternation (no catastrophic backtracking) | 2,000 keys < 10 ms |
| Bundle | No UI kit, no icon package (inline SVG), no date lib | ≤ 120 KB gzip initial |
| First paint | Static HTML, inline critical CSS, `system-ui` fonts | LCP < 1.5 s on slow 4G |

### 14.7 Error handling without telemetry

- A React error boundary catches every unexpected throw and shows: "Something broke. Your files are still in this tab." with a "Copy debug info" button (app version + stack, **no file content**) and "Reload".
- Nothing is ever reported anywhere. `console.error` only, with an explicit note in the docs that logging is local to the user's own console.

### 14.8 Build and deploy

| Item | Spec |
| --- | --- |
| Build | `vite build` → `dist/` (static) |
| Vercel config | Framework preset "Vite", output `dist`, headers in `vercel.json`, no functions |
| Deploy flow | `main` → production; every PR gets a preview deployment (useful for visual review) |
| Node version | Pinned via `.nvmrc`, current LTS |
| CI | GitHub Actions: typecheck, lint, unit + component tests, build, privacy guard, Playwright (chromium, firefox, webkit), Lighthouse on PR |
| Branch protection | Required checks, one review, linear history, no force-push to `main` |
| Cost | Static hosting + free tier bandwidth is far beyond expected usage; no paid services |

### 14.9 Browser support

Last two versions of Chrome, Edge, Firefox, and Safari; iOS Safari 16+; Android Chrome. No IE. Feature-detect the Clipboard API and `Intl`; degrade gracefully to the manual-copy modal. Test at 320 px width.

---

## 15. Open source and community plan

### 15.1 License and governance

- **License: MIT** (recommended; the copyright holder line needs confirming — see §19). Rationale: maximum adoption for a utility, compatible with corporate use, and the simplest thing to reason about.
- **Code of Conduct:** Contributor Covenant v2.1.
- **Governance:** maintainer-led ("BDFL-light") with an ADR process for architectural decisions. **The privacy non-goals are constitutional:** they are listed in `README.md` and `CONTRIBUTING.md` as invariants that no PR can relax without a major-version decision by the owner.

### 15.2 Repository artefacts to create at kickoff

| File | Purpose | Key content |
| --- | --- | --- |
| `README.md` | Positioning, demo GIF, quickstart, privacy promise, links | Must answer "what is this / why trust it / how do I run it" above the fold |
| `CONTRIBUTING.md` | Setup, conventions, PR checklist | Includes the **privacy invariants** and the "never paste real secrets in an issue" rule |
| `SECURITY.md` | Responsible disclosure | Private advisories; 72-hour acknowledgement target; explicitly out of scope: browser extensions, forks, clipboard managers |
| `CODE_OF_CONDUCT.md` | Community standards | Contributor Covenant |
| `docs/PRIVACY.md` | Enforceable guarantees, threat model, verification recipe | Mirrors §13 |
| `docs/adr/000{1,2,3}-*.md` | Stack, parser strategy, no-storage policy | Short: decision + consequences |
| `.github/ISSUE_TEMPLATE/*` | `bug.yml`, `parser-edge-case.yml`, `feature.yml`, `config.yml` | The parser template asks for a **minimal fake** reproduction and blocks submission without one |
| `.github/pull_request_template.md` | Checklist | Tests, a11y, bundle size, no new network calls, no new storage APIs, no unapproved deps |
| `CHANGELOG.md` | Keep a Changelog format | Semver |
| `LICENSE` | MIT | Year + holder TBD (Q2) |

### 15.3 Issue and PR conventions

- **Labels:** `good first issue`, `help wanted`, `parser`, `a11y`, `i18n`, `design`, `privacy`, `deps-approved`, `bug`, `enhancement`, `blocked`.
- **Parser bugs require a fixture first:** every parser bug adds a file to `tests/fixtures/env/` plus its expected JSON *before* the fix. This turns the parser into a community-built asset rather than a maintainer bottleneck.
- **Definition of done:** tests added or updated, no privacy-guard violations, keyboard + axe check, bundle delta noted, docs updated for user-visible changes.
- **First `good first issue` candidates:** a new placeholder pattern + fixture; a new diagnostic message; the keyboard-shortcut sheet; CSV export of the report; a dark-mode contrast fix; an empty-state illustration (SVG only — no network).

### 15.4 Community and launch

- **Where:** r/webdev, r/selfhosted (the privacy angle), a "Show HN", a 30-second demo video, and one post aimed at the *non-technical* AI-builder audience, where the pain is sharpest.
- **Messaging order:** the problem first ("your agent won't touch `.env` — here's how to catch what it added"), then the privacy mechanism, then the niceties. Leading with features loses the audience that needs this most.
- **Ongoing:** a monthly "parser bug hunt" thread; `MAINTAINERS.md` as soon as there are three regulars; docs stay in `/docs` (no separate site in v1).

### 15.5 What we will not accept (documented up front)

Analytics or tracking, storage, accounts, a backend "just for sharing", obfuscated builds, or uploading files "temporarily" to make the diff better. Stating this in `CONTRIBUTING.md` prevents the most damaging kind of PR — and the most damaging kind of argument.

---

## 16. Testing and QA strategy

### 16.1 Layers

| Layer | Tool | Scope | Gate |
| --- | --- | --- | --- |
| Parser conformance | Vitest + `dotenv` (devDependency) | For every fixture, our semantic parse must deep-equal `dotenv.parse()` | 100% pass, blocking |
| Parser unit | Vitest | Lossless spans, quotes, comments, multiline, CRLF/BOM, duplicates | ≥ 95% coverage of `src/core/parse` |
| Property-based (optional) | `fast-check` | Round-trip: patch a value, re-parse, get that value; the scanner never throws on random input | 10k cases, no crash |
| Compare unit | Vitest | Every state combination, severity precedence, ordering, summary counts | Golden snapshots |
| Export unit | Vitest | Fix block, report (all redaction levels), prompt — assert the absence of value substrings | Exact string snapshots |
| Component | Testing Library | Table alignment, ghost cells, inline edit, undo, masking, filters | Queries by role/label, never `data-testid` only |
| E2E | Playwright (3 browsers) | Paste → summary → fix → copy; the privacy suite (§13.4); mobile viewport | Blocking |
| Accessibility | axe-core in Playwright + a manual keyboard pass | Zero serious/critical violations; a complete keyboard journey | Blocking |
| Visual | Screenshot diff (optional) | Tokens and table states in light and dark | Advisory |

### 16.2 Fixture corpus (the project's crown jewels)

60+ files under `tests/fixtures/env/`, each with an expected parse JSON:

```
basic.env                      quotes.single.env        quotes.double.env
quotes.backtick.env            export.prefix.env        colon.separator.env
inline.comment.env             hash.in.value.env        multiline.pem.env
crlf.env                       bom.env                  duplicates.env
empty.values.env               placeholder.values.env   commented.keys.env
unicode.keys.env               dots.dashes.env          spaces.in.key.env (invalid)
no.equals.env                  trailing.whitespace.env  dollar.refs.env
docker.compose.style.env       python.dotenv.style.env  large.1000.env
```

Each fixture carries a `why` note (a header comment or sibling `.md`) so a future contributor understands the intent, not just the assertion.

### 16.3 Manual QA checklist before release

- [ ] Paste from macOS Safari, Windows Chrome, and a phone (clipboard behaviour differs).
- [ ] CRLF file: the download is byte-identical.
- [ ] 500-key file: typing stays smooth; the table scrolls at 60 fps.
- [ ] Masked mode: a DevTools search for a known secret substring returns zero results.
- [ ] Network tab after load: zero requests for a whole session, including copy and download.
- [ ] DevTools → Application: all storage empty.
- [ ] Keyboard-only run: paste, compare, edit, copy the fix, open privacy, close.
- [ ] Screen reader (VoiceOver + NVDA): the summary is announced once; the table is navigable by row and column.
- [ ] 200% zoom and 320 px width: no horizontal page scroll.
- [ ] `forced-colors: active`: every state remains distinguishable.

---

## 17. Delivery plan

Solo-maintainer estimate, part-time. Ranges, not promises.

| Phase | Epics | Estimate | Exit criteria |
| --- | --- | --- | --- |
| **P0 — Foundations** | Repo scaffold, CI, Tailwind tokens, `src/core/parse` + fixtures + conformance harness, `compare`, `patch` | 1–1.5 wk | Parser conformance 100%; compare unit tests green |
| **P1 — Core UX** | Input state, roles, summary, table (ghost cells, chips), raw view, fix panel, copy/download, undo | 1.5–2 wk | A user can paste two files and copy the fix; the Playwright happy path is green |
| **P2 — Trust and polish** | Masking, secret detection, report + redaction, diagnostics UI, `/privacy`, CI privacy guard, empty and error states, mobile, a11y pass | 1–1.5 wk | §16.3 checklist green; `/privacy` verified by hand |
| **P3 — Launch** | README, CONTRIBUTING, SECURITY, templates, sample data, demo GIF, deploy, launch posts | 3–5 d | v1.0.0 tagged and deployed; five `good first issue`s filed |
| **P4 — v1.1** | N-file matrix, framework presets, AI prompt, annotations, i18n scaffolding | 2–3 wk | Community feedback triaged; matrix shipped |

**Critical path:** parser → compare → table. Everything else is decoration. If time runs short, cut Raw scroll-sync and the theme toggle long before cutting a single parser fixture.

---

## 18. Risks

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| R1 | **False positives** make users distrust the tool ("it says I'm missing something that isn't") | Medium | High | Accuracy principle (§9.5); high-confidence-only placeholders; conformance tests; a "this is wrong" affordance on every row |
| R2 | Parser divergence from real-world runtimes (Docker/Next/Vite quirks) | High | Medium | Baseline dotenv grammar; v1.1 presets; publish known divergences; never block on a warning |
| R3 | Users paste real secrets, then a future contributor adds analytics "just for page views" | Medium | Fatal to trust | Constitutional non-goals, CI guard, dependency allowlist, documented review rule |
| R4 | The tool is mistaken for a secret manager ("can it store my env?") | Medium | Low | Explicit non-goals + a footer line: "EnvCompare never stores anything. For storage, use a secret manager." |
| R5 | Non-coders still don't know what to do | Medium | High | Three-step action card, plain copy, moderated tests with five non-developers before launch |
| R6 | Scope creep into editing, validating, and linting everything | High | Medium | The MVP cut line (§7.1) and the "no" list (§4.3) are part of the PRD, not vibes |
| R7 | Mobile paste UX is poor | Medium | Medium | Test on real devices; provide drag-drop and file-picker fallbacks; do not over-invest in mobile editing |
| R8 | Nobody finds it | High | Medium | Launch in the two communities where the pain is sharpest; SEO title "compare .env and .env.example"; demo GIF |
| R9 | A lookalike or phishing site appears | Low | High | Publish the canonical domain; no login means no credential-harvesting surface; own a domain we control |
| R10 | Maintainer burnout | Medium | High | Small scope, clear non-goals, a `good first issue` pipeline, and this spec so others can contribute without asking |

### 18.1 Trust-damaging failure modes (what we must never ship)

1. A network request that includes file content — ever, for any reason, including "anonymous usage stats".
2. A shareable link that encodes keys or values.
3. A masked mode that leaves the value in the DOM.
4. A report that silently includes values.
5. An automatic "fix" that copies a value from one environment into another without an explicit click.

---

## 19. Open questions / decisions needed

| # | Question | Recommendation | Owner |
| --- | --- | --- | --- |
| Q1 | Final product name and domain (`envcompare.dev`, `envcompare.app`, `getenvcompare.com`)? | Keep the repo as `env-compare`; secure a domain before launch to reduce phishing risk | Owner |
| Q2 | MIT copyright holder line (`© 2026 SynergyFlowLabs`)? | Yes, use the org name | Owner |
| Q3 | Any analytics at all? | **None for v1.** Revisit only if a privacy-preserving, opt-in, aggregate counter is clearly explained on `/privacy` | Owner |
| Q4 | Persist the dark-mode preference? | No (in-memory + `prefers-color-scheme`), to keep NG2 literal. Document the tradeoff on `/privacy` | Maintainer |
| Q5 | Should `commented` keys count as "missing"? | No — count them separately as "Commented out", with an "Uncomment" action | Product |
| Q6 | Masking on by default at first visit? | No — values visible, plus a one-line "sharing your screen?" hint | Product |
| Q7 | Ship Raw in v1.0 or v1.1? | v1.0 — it is the trust anchor ("show me the original") | Product |
| Q8 | Ship the AI handoff prompt in v1.0? | v1.1 (cheap, but not core); the keys-only template is specified now | Product |
| Q9 | i18n in v1.0? | No, but route every string through `en.ts` from day one | Eng |
| Q10 | Hand-rolled Tailwind components or a UI kit? | Hand-rolled (dependency policy); tokens in `tokens.css` | Eng |
| Q11 | Drag-drop several files at once in v1.0? | Yes if it is trivial (it is a `DataTransfer` loop), but roles must be assignable afterwards | Eng |
| Q12 | Framework preset list for v1.1 | Next.js, Vite, Node-dotenv, Docker Compose, Python-dotenv | Product |

---

## 20. Appendices

### Appendix A — Sample inputs used for demos and tests

`.env.example`

```bash
# --- Database ---
DATABASE_URL=postgresql://user:password@localhost:5432/app

# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=changeme

# --- Payments ---
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=

# --- Email ---
RESEND_API_KEY=re_xxxxxxxxxxxx

# --- Optional ---
# SENTRY_DSN=
```

`.env`

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/app
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example.signature
SUPABASE_SERVICE_ROLE_KEY=changeme
STRIPE_WEBHOOK_SECRET=
LEGACY_GA_ID=UA-000000-2
```

Expected result (this exact case is a golden test):

| Key | `.env.example` | `.env` | Row verdict | Why |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | present | present | matching | identical |
| `NEXT_PUBLIC_SUPABASE_URL` | present | present | different | a different host |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | present | present | different | a real JWT replaced the example value |
| `SUPABASE_SERVICE_ROLE_KEY` | present | placeholder | needs a value (warning) | `changeme` was copied straight across |
| `STRIPE_SECRET_KEY` | present | absent | **missing (error)** | never added to `.env` |
| `STRIPE_WEBHOOK_SECRET` | empty | empty | needs a value (error) | present but empty in both |
| `RESEND_API_KEY` | present | absent | **missing (error)** | never added to `.env` |
| `SENTRY_DSN` | commented | absent | commented out (info) | optional, switched off in the example — **not** an error |
| `LEGACY_GA_ID` | absent | present | only in `.env` (info) | a leftover from an older version of the project |

Summary copy for this case: *"2 variables are in `.env.example` but missing from `.env`. 2 need a value. 1 is only in `.env`."* — plus one "Commented out" row available under the info filter, which is deliberately **not** counted as a problem.

What this fixture proves: a naive diff reports two missing keys and stops. It misses the copied-through `changeme`, misses that `STRIPE_WEBHOOK_SECRET` is empty, and wrongly shouts about `SENTRY_DSN`. That gap is the product.

### Appendix B — State matrix (for implementation tests)

| Reference | Target | Row severity | Summary bucket | Suggested action |
| --- | --- | --- | --- | --- |
| present | absent | error | Missing | Add key |
| present | commented | error | Missing | Uncomment |
| present | empty | error | Needs a value | Fill value |
| present | placeholder | warning | Needs a value | Replace placeholder |
| present | present (equal) | ok | Matching | — |
| present | present (different) | info | Different | — |
| empty | present | ok | Matching | — (the example simply carries no value) |
| placeholder | present (real) | ok | Matching | — (the user did the right thing) |
| absent | present | info | Only in target | Keep / Remove |
| absent | empty | info | Only in target | Keep / Remove |
| commented | absent | info | Commented out | Uncomment or ignore |
| commented | present | ok | Matching | — |
| absent | absent | — | — | (never rendered) |

Rules that fall out of this table: severity is decided by the **target** cell, except when the **reference** cell is `commented` (then a target `absent` is info, never an error). A placeholder in the reference is documentation, not a problem. A placeholder in the target is a problem.

### Appendix C — dotenv grammar reference (verbatim, for the parser author)

```
LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg
```

Post-processing, in order: `value.trim()` → strip one matching outer quote pair → if the opening quote was `"`, replace `\n` with a newline and `\r` with CR → assign (last wins).

Source: `dotenv` v18 `lib/main.js`, BSD-2-Clause. Vendored with attribution and conformance-tested against the package itself.

### Appendix D — `/privacy` page outline

1. **Three guarantees** (no upload, no storage, no third-party code), each linked to its enforcement mechanism.
2. **Verify it yourself in 30 seconds:** DevTools → Network → clear → use the tool → see zero requests. Then Application → Storage → all empty.
3. **What leaves your browser:** only the request for the page and its static assets, served by Vercel's CDN. Vercel sees an IP and a user agent, like any web server. It never sees your files.
4. **What we can't protect you from:** extensions, clipboard history, screen sharing, an unlocked device, a lookalike domain.
5. **Report a problem:** link to `SECURITY.md`; never paste real secrets in an issue.
6. **The oath:** the constitutional non-goals, with a link to the CI check that enforces them.

### Appendix E — Launch checklist

- [ ] Domain secured; canonical URL in the README and on `/privacy`
- [ ] v1.0.0 tagged; CHANGELOG written
- [ ] Demo GIF (≤ 5 MB) recorded with **fake** values only
- [ ] Lighthouse: performance ≥ 95, accessibility = 100, best practices = 100
- [ ] Privacy guard green; Playwright suite green on three browsers
- [ ] Every `/privacy` claim links to the file or check that enforces it
- [ ] CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, and LICENSE published
- [ ] Five `good first issue`s filed with acceptance criteria
- [ ] Deployed to Vercel; the preview deployment verified on a phone
- [ ] Launch posts drafted (HN, two subreddits, one AI-builder community)

---

### Document history

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-10-20 | Initial PRD: refined concept, state taxonomy, parser spec, privacy architecture, delivery plan |
