# EnvCompare

**See what your `.env` is missing — without your secrets leaving your browser.**

Paste your `.env.example` and your `.env`. EnvCompare shows every variable that is missing, empty, still a placeholder, or leftover — side by side, in plain language — and hands you the exact block to paste back into your file.

No upload. No account. No storage. No analytics.

> **Status: PRD / specification stage.** This repository currently contains the product specification, not an implementation. The build starts at [PRD §17](docs/PRD.md#17-delivery-plan). If you want to help shape the API, the parser, or the UI before code exists — that is exactly the right moment.

---

## The problem

AI code editors and agents are deliberately designed **not** to touch `.env` files. So they write a `.env.example` instead, and you fill in the real file by hand.

Then the project grows. The agent adds keys to `.env.example`; your `.env` quietly drifts behind it. Nothing warns you. The app just breaks later with a `401`, a blank page, or a database error — and the cause is one line that is missing from a file you were told not to worry about.

A `diff` does not help. It shows lines, not variables, and it says nothing about the two failures that hurt most:

```bash
OPENAI_API_KEY=          # defined, but empty  → fails at runtime
OPENAI_API_KEY=changeme  # still the example  → fails at runtime
```

Both pass a naive "does the key exist?" check.

## What EnvCompare does

- **Compare** any two (or more) env files against a reference — usually `.env.example`.
- **Classify** every variable per file: missing · empty · placeholder · commented out · set · set differently.
- **Show it four ways:** a plain-language summary, a row-aligned colour-coded table, the raw text, and a copy-ready fix.
- **Give you the fix**, not just the diagnosis: `Copy 3 variables for .env`.
- **Stay safe to use with real secrets:** values can be masked in one click, the shareable report contains key names only, and the app has no way to send your data anywhere.

## Why you can trust the privacy claim

The promise is not a paragraph in a policy. It is enforced and testable:

| Promise | How it is enforced |
| --- | --- |
| Nothing is uploaded | Static site, no backend or API routes; `connect-src 'none'` in the production CSP |
| Nothing is stored | No `localStorage`, `sessionStorage`, `IndexedDB`, cookies, or service worker — a CI check fails the build if those APIs appear in `src/` |
| No third-party code | No analytics, no CDN fonts, no tag managers, and a runtime dependency allowlist (React only) |
| No shareable links | No URL or hash state, so file content can never end up in a link, a history entry, or a screenshot of the address bar |

You can verify it yourself in about 30 seconds: open DevTools → Network, use the tool, and watch zero requests go out. Then check Application → Storage: still empty.

Full framework — threat model, enforcement mechanisms, and what we *cannot* protect you from — is in [PRD §13](docs/PRD.md#13-privacy-and-security-architecture).

## Design principles

1. **Ship the fix, not the diagnosis.** If the user has to retype a key name, the tool failed.
2. **Accuracy over coverage.** A false "you're missing something" destroys trust. Speculative findings are hints, never errors.
3. **Plain language.** "Missing from your `.env`", not "set difference". A non-coder must succeed without help.
4. **Trust is binary.** One analytics script would make the whole product unusable for its main use case.
5. **You are one paste away from done.** No onboarding, no setup, no account, no signup wall.

## Roadmap

| Version | Scope |
| --- | --- |
| **v1.0 (MVP)** | Two files · reference auto-detection · six-state classification · summary, table, raw, fix views · inline editing · add/remove/uncomment · masking · redacted report · copy/download · privacy guards |
| **v1.1** | N-file matrix (3+) · framework presets (Next.js, Vite, Docker Compose, Python) · AI handoff prompt · `# required` annotations |
| **v2 (if demanded)** | Shared core as a CLI · GitHub Action for `.env.example` drift |

The full cut line, acceptance criteria, and non-goals are in the [PRD](docs/PRD.md).

## Contributing

Contributions are welcome — and unusually well-specified, because the spec came first.

- **[docs/PRD.md](docs/PRD.md)** is the source of truth: functional requirements ([§11](docs/PRD.md#11-functional-requirements)), normative parsing rules ([§12](docs/PRD.md#12-parsing-and-comparison-specification-normative)), and the testing strategy ([§16](docs/PRD.md#16-testing-and-qa-strategy)).
- Parsing bugs are the most valuable contribution. The parser has a **60+ fixture conformance suite**; a bug report with a minimal fake reproduction becomes a permanent test.
- The [PRD's non-goals](docs/PRD.md#43-non-goals-hard-constraints) are constitutional. PRs that add analytics, storage, accounts, or a backend will be declined regardless of quality — that is the product, not a preference.

**Never paste real secrets into a GitHub issue.** Use obviously fake values in every reproduction.

## License

To be finalised with the first commit of code (MIT recommended) — see [PRD §19](docs/PRD.md#19-open-questions--decisions-needed).
