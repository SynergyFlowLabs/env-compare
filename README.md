# EnvCompare

**See what your `.env` is missing — without your secrets leaving the browser.**

Paste `.env.example` and `.env`. EnvCompare shows every variable that is missing, empty, still a placeholder, or leftover, and hands you the exact block to paste back into your file.

No upload. No account. No storage. No analytics.

```
.env.example                   .env
─────────────────────────────   ─────────────────────────────
DATABASE_URL      postgres… ✓   DATABASE_URL      postgres… ✓
OPENAI_API_KEY    sk-…      ✓   OPENAI_API_KEY              ⊘
STRIPE_SECRET_KEY changeme  ✎   STRIPE_SECRET_KEY changeme  ✎
RESEND_API_KEY    re_…      ✓   RESEND_API_KEY    re_OLD…   ≠
# SENTRY_DSN                ⫽   SENTRY_DSN                  ⊘

⊘ missing   ✎ placeholder   ⫽ commented out   ✓ set   ≠ set differently
```

## The problem

AI code editors and agents are deliberately designed **not** to touch `.env` files. So they write a `.env.example` instead, and you fill in the real file by hand.

Then the project grows. The agent adds keys to `.env.example`; your `.env` quietly drifts behind it. Nothing warns you. The app breaks later with a `401`, a blank page, or a database error, and the cause is one line missing from a file you were told not to worry about.

A `diff` does not help. It compares lines, not variables, and it says nothing about the two failures that hurt most:

```bash
OPENAI_API_KEY=          # defined, but empty       → fails at runtime
OPENAI_API_KEY=changeme  # still the example value → fails at runtime
```

Both pass a naive "does this key exist?" check.

## What it does

- **Compares** your files against a reference, usually `.env.example`.
- **Classifies** every variable in every file: missing · empty · placeholder · commented out · set · set differently.
- **Shows four views:** a plain-language summary, a row-aligned table with inline editing, the annotated raw text, and a copy-ready fix.
- **Gives you the fix**, not just the diagnosis: `Copy 3 variables for .env`.
- **Stays safe with real secrets:** mask values in one click; reports contain key names only. The only thing this site can remember is your theme, and only with your consent.

Everything happens in a single tab. Close it and the data is gone, because it was never written anywhere.

## Quick start

```bash
git clone https://github.com/SynergyFlowLabs/env-compare.git
cd env-compare
npm install
npm run dev            # http://localhost:5173
```

Requires Node 22.

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm test` | Unit and component tests (vitest + Testing Library) |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run privacy` | The privacy guard (see below) |
| `npm run test:e2e` | Playwright suite; needs `npx playwright install` first |
| `npm run check` | Tests, build and guard — what CI runs |

UI components are [shadcn/ui](https://ui.shadcn.com) source, copied into `src/ui/components/ui` rather than pulled from a package. Tailwind v4 and Radix are the only additions to the front end; the palette still comes from [tokens.css](src/styles/tokens.css), so light and dark stay one source of truth.

## How the guarantees are enforced

The privacy promise is not a paragraph in a policy. Each claim has a mechanism, and each mechanism has a test:

| Promise | Mechanism |
| --- | --- |
| Nothing is uploaded | Static site, no backend. Production CSP sets `connect-src 'none'`. |
| Your files are never stored | No `localStorage`, `sessionStorage`, `IndexedDB`, cache or service worker, and no cookie ever holds anything you paste. `npm run privacy` fails the build if any of those APIs appears in `src/`. |
| One cookie, only if you ask | Choosing Light or Dark once asks whether it may remember the choice in a single cookie, `ec-theme`, whose value is one word. Decline and nothing is written; the guard confines cookie access to one audited file. |
| No third-party code that reports back | Runtime dependencies are a short, reviewed allowlist (React, Radix primitives for the dialog and tabs, and four small utilities) checked by CI. No fonts CDN, no analytics, no tag manager, no error reporter. |
| No shareable links | No URL or hash state, so file content can never reach a link, a history entry, or a screenshot of the address bar. |
| Masking is real | Masked values are removed from the DOM, not hidden with CSS. |
| Exports are safe | Fix blocks, agent prompts and default reports contain key names only. |

Verify it yourself in about thirty seconds: open DevTools → Network, use the tool, and watch nothing go out. Then check Application → Storage: Local Storage, Session Storage and IndexedDB are empty, and the only cookie — if you said yes — is `ec-theme`.

The reasoning, the threat model, and the things we explicitly cannot protect you from (extensions, your clipboard, your screen) are in [docs/PRIVACY.md](docs/PRIVACY.md).

## How it decides

Correctness is the whole product. A false "you're missing something" teaches people to ignore the tool.

- **Parsing matches `dotenv`.** Quotes, `export` prefixes, `#` comments, duplicate keys, multi-line values, CRLF and BOM are parsed the way `dotenv.parse()` parses them, and a conformance test asserts it against every fixture. Where we deliberately differ, we say so in [PRD §12](docs/PRD.md#12-parsing-and-comparison-specification-normative).
- **Six states, one per cell.** Missing, empty, placeholder, commented out, set, set differently. The reference file's own state matters: a key that is commented out in `.env.example` is reported differently from one that was deleted.
- **Only high-confidence placeholders count.** `changeme`, `your-api-key`, `<your-key>`, `sk_test_xxxxxxxxxxxx` do. `test`, `dummy`, `localhost`, `example` and `password` do not: they appear in real values too often. A real JWT is never a placeholder.
- **The fix is a surgical patch.** Edits splice the original text, so comments, ordering and quoting survive untouched. Nothing is reformatted.

## Accessibility

Keyboard path for every action (starting with a skip link), a Light / Dark / Auto theme control that needs no storage, visible focus, labels on every input, colour never the only signal (each state has a glyph and a word), and dialogs that trap and restore focus. If you find a case that fails, it is a bug; please report it.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

- The most valuable contribution is a **parser edge case** with a minimal, fake-value reproduction. It becomes a permanent fixture.
- The [PRD's non-goals](docs/PRD.md) are constitutional: PRs that add analytics, storage, accounts, or a backend will be declined regardless of quality.
- **Never paste real secrets into an issue.** Use obvious placeholders.

Good first issues are labelled [`good first issue`](https://github.com/SynergyFlowLabs/env-compare/labels/good%20first%20issue).

## Repository layout

```
src/core/            parsing, comparison, patches, exporters — pure TypeScript, no DOM
src/state/           one reducer, no persistence
src/ui/components/   product components
src/ui/components/ui shadcn/ui primitives (button, card, dialog, tabs, table…)
src/styles/          tokens.css (the palette) + Tailwind theme
components.json      shadcn configuration
docs/PRD.md     the specification, written before the code
docs/DESIGN.md  palette, type, layout, motion, copy
docs/PRIVACY.md the long version of the privacy claim
e2e/            Playwright: no-network, no-storage, masked-DOM, hostile-storage
tests/          347 unit and component tests, 32 parser fixtures
AGENTS.md       conventions for humans and AI agents
PROGRESS.md     build log and decisions
```

## Roadmap

| Version | Scope |
| --- | --- |
| **v1.0** ✅ | Reference auto-detection · six-state classification · summary, table, raw and fix views · inline editing · add/remove/uncomment with undo · masking · redacted report · copy/download · privacy guard |
| **v1.1** | N-file matrix (3+) · framework presets · richer `# required` annotations |
| **v2 (if demanded)** | Shared core as a CLI · a GitHub Action for `.env.example` drift |

## License

MIT — see [LICENSE](LICENSE). The parser is modelled on [dotenv](https://github.com/motdotla/dotenv) (BSD-2-Clause); attribution is in the license file.
