# Design notes

A short, opinionated record of the visual decisions, so future contributors can extend the interface without guessing. Updated as the UI is built.

## The subject

Environment variables are the boundary between a program and the world: switches, keys, sockets. The audience is half developers, half people who have never opened a terminal. So the interface borrows from **instrument panels and specification sheets** — precise, legible, nothing decorative — rather than from marketing pages or dashboards.

The comparison table is the product. Everything else gets out of its way.

## Constraints that shape the design

1. **No third-party assets.** No web fonts, no icon CDN (PRD NG5, CSP `font-src 'self'`). The type is whatever the OS ships. Character has to come from spacing, scale and colour, not from a download.
2. **States must survive greyscale.** Six states means colour alone can never carry meaning: every state is icon + text + tint.
3. **Density over airiness** in results, airiness in input. The first screen has two boxes and one instruction; the second screen is a work surface.
4. **No dark patterns.** No "upgrade", no banners, no cookie bar, no modal on load.

## Palette

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--paper` | `#F6F6F3` | `#101215` | page background |
| `--surface` | `#FFFFFF` | `#171A1F` | panels, table |
| `--ink` | `#15181C` | `#E8E9E6` | primary text |
| `--ink-soft` | `#5A616B` | `#A0A6AF` | secondary text |
| `--line` | `#D7D8D2` | `#2A2E35` | rules, borders |
| `--accent` | `#2C46C8` | `#7D93FF` | focus, links, primary action |
| `--st-missing` | `#C0392F` | `#FF8A7A` | error / missing |
| `--st-empty` | `#9A5B00` | `#F3B95F` | set but empty |
| `--st-placeholder` | `#6B4FA1` | `#C3A6FF` | still the example value |
| `--st-commented` | `#6A6F76` | `#9AA0A8` | commented out |
| `--st-ok` | `#2F6B4F` | `#6FD3A0` | set |
| `--st-differs` | `#1F6F8B` | `#7DD3E8` | different value |

Each state also has a `-tint` (background wash) and is paired with a glyph: `⊘` missing, `!` empty, `✎` placeholder, `⫽` commented, `✓` set, `≠` different.

## Type

- Sans: the OS UI stack. Sizes 15 / 13 / 12, weights 400 / 500 / 650. Sentence case everywhere.
- Mono: the OS mono stack, used **only** for file content (keys, values, filenames, line numbers) — the place where monospace is information, not styling.
- Display: one line, 40px, tight tracking, no gradient, no accent word.

## Layout

```
┌──────────────────────────────────────────────┐
│  envcompare          [privacy badge]   GitHub│  56px, sticky, 1px rule
├──────────────────────────────────────────────┤
│                                              │
│  See what your .env is missing.              │  left aligned, max 1180px
│  One sentence of explanation.                │
│                                              │
│  ┌─ .env.example ─[reference]─┐ ┌─ .env ────┐│  panes: 1px border, tab-like
│  │  (paste)                   │ │ (paste)   ││  filename bar, mono count line
│  └────────────────────────────┘ └───────────┘│
│  see an example · what gets compared · safe  │
└──────────────────────────────────────────────┘
```

Results replace the input area in place:

```
┌──────────────────────────────────────────────┐
│ ⚠ 3 variables are missing from .env          │  summary sentence, aria-live
│ [Summary] [Table] [Raw] [Fix]    counts →    │
├──────────────────────────────────────────────┤
│ 12 │ DATABASE_URL        │ ✓ Set    │ ✓ Set   │  numeric gutter = line numbers
│ 13 │ STRIPE_SECRET_KEY   │ ✓ Set    │ ⊘ missing│
│ 14 │ RESEND_API_KEY      │ ✓ Set    │ ⊘ missing│
└──────────────────────────────────────────────┘
```

The numeric gutter is the one structural flourish: it is the reference file's line number, which is real information (it is how you would find the variable in your editor), so it earns its place.

**The gap motif.** Missing variables render as an empty *socket*: a dashed outline with a faint tint, sized exactly like a filled cell. Reading down a column, you see the holes in the file. That is the identity of the product, and it comes from the data, not from decoration.

## Motion

Only what answers an action: a 120ms fade for a panel swap, a 160ms slide for a toast, a focus ring that grows from 0 to 3px. No entrance animations, no scroll effects, `prefers-reduced-motion` turns it all off.

## Copy

Plain, active, specific. "Copy 3 for `.env`" not "Generate". Errors explain what happened and what to do, and never apologise. Empty states invite an action. No exclamation marks, no "Oops", no emoji in the product UI.
