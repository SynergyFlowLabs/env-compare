# Design notes

A short, opinionated record of the visual decisions, so future contributors can extend the interface without guessing. Updated as the UI is built.

## The subject

Environment variables are the boundary between a program and the world: switches, keys, sockets. The audience is half developers, half people who have never opened a terminal. So the interface borrows from **instrument panels and specification sheets** — precise, legible, nothing decorative — rather than from marketing pages or dashboards.

The comparison table is the product. Everything else gets out of its way.

## Constraints that shape the design

1. **No third-party assets.** No web fonts, no icon CDN (PRD NG5, CSP `font-src 'self'`). The type is whatever the OS ships. Character has to come from spacing, scale and colour, not from a download.
2. **States must survive greyscale.** Six states means colour alone can never carry meaning: every state is icon + text + tint.
3. **Density over airiness** in results, airiness in input. The first screen has two boxes and one instruction; the second screen is a work surface.
4. **No dark patterns.** No "upgrade", no banners, no cookie bar, no modal on load. The one consent question this product asks appears when the reader changes the theme — at the action, not before it — and "Not now" is as easy to reach as "Remember it".

## Palette

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--paper` | `#F6F6F3` | `#101215` | page background |
| `--surface` | `#FFFFFF` | `#171A1F` | panels, table |
| `--ink` | `#15181C` | `#E8E9E6` | primary text |
| `--ink-soft` | `#5A616B` | `#A0A6AF` | secondary text |
| `--ink-faint` | `#666C75` | `#858D97` | metadata, line numbers |
| `--line` | `#D7D8D2` | `#2A2E35` | rules, borders |
| `--accent` | `#2C46C8` | `#7D93FF` | focus, links, primary action |
| `--st-missing` | `#C0392F` | `#FF8A7A` | error / missing |
| `--st-empty` | `#9A5B00` | `#F3B95F` | set but empty |
| `--st-placeholder` | `#6B4FA1` | `#C3A6FF` | still the example value |
| `--st-commented` | `#666B72` | `#9AA0A8` | commented out |
| `--st-ok` | `#2F6B4F` | `#6FD3A0` | set |
| `--st-differs` | `#1F6F8B` | `#7DD3E8` | different value |

Each state also has a `-tint` (background wash) and is paired with a Lucide line icon:

| State | Icon | Why |
| --- | --- | --- |
| missing | `MinusCircle` | a hole in the set, not a warning sign |
| empty | `CircleAlert` | present but unusable |
| placeholder | `PenLine` | still the example, waiting to be written |
| commented | `Slash` | in the file, out of play |
| set | `Check` | the quiet default |
| different | `EqualNot` | two files disagree, neither is wrong |

Icons replaced the earlier typographic glyphs (`⊘ ! ✎ ⫽ ✓ ≠`): they inherit the text colour, scale with
the row, and do not depend on the reader's font having the character. The rule they serve is unchanged —
every state is icon **and** word, so colour is never the only signal.

Text drawn *on* a filled colour is not white in both themes: `--on-accent` and `--on-state` flip to near-black in dark mode, where the fills are pastel and `#fff` would sit at roughly 2:1. Every text/background pair in this table is asserted against WCAG AA (4.5:1) by `tests/unit/tokens.test.ts`.

### Icons

[Lucide](https://lucide.dev) is the icon set (it is also shadcn's default, so the states and the controls
share one language).

- Import named icons (`import { Copy } from 'lucide-react'`), never a namespace: only the ones used are bundled.
- Decorative icons get `aria-hidden="true"` and `focusable="false"`; the adjacent word carries the meaning.
- Icon-only buttons always carry an `aria-label` (rename, close, reveal).
- Sizes are fixed at `size-3.5` (inline with 12–13px text) and `size-4` (toolbar and status). One stroke
  weight, 1.75, set once for `svg.lucide` in `global.css`.
- No icon is used as the only label for a destructive action, and none spins or animates.

### Stack

The interface is Tailwind v4 with shadcn/ui components under `src/ui/components/ui`. shadcn's semantic
tokens (`background`, `card`, `primary`, `muted`, `border`, `ring`, `destructive`) are mapped onto the
palette above in the `@theme` block of `src/styles/global.css`; the six comparison states keep their own
names (`missing`, `empty`, `placeholder`, `commented`, `ok`, `differs`) because a single "destructive" red
cannot express "commented out" without losing information.

The practical rules that follow:

- A component never contains a hex value. If a colour is missing, add a token.
- Radii are 4 / 6 / 10px, text is 15px on the page, 13px in controls, 12.5px in tables and code.
- shadcn defaults were tuned down (32px control height, 13px control text) to keep the density this
  document asks for; the component APIs are unchanged, so upstream snippets still paste in.

### Theme selection

Three explicit choices in the header — **Auto** (follow the OS, the default), **Light**, **Dark** — as segmented buttons with `aria-pressed`. Not a two-state toggle, because "follow my OS" is a real preference that a toggle silently discards.

The choice is applied immediately. Remembering it is a separate, consented act: the first time someone picks Light or Dark, a dialog offers to store one cookie (`ec-theme`) and explains exactly what it contains. Declining keeps the choice for the session and is remembered as a refusal, so the question is never repeated in that visit. `Auto` writes nothing. `/privacy` states the current status and can forget it.

Mechanically the choice is one attribute, `data-theme` on `<html>`:

- absent → `prefers-color-scheme` decides (Auto);
- `light` / `dark` → force it, even against a dark OS.

CSS cannot express "dark, unless the reader chose light" in a single rule without repeating the declarations, so the dark palette is written twice in `tokens.css`. A test parses the file and fails if the two blocks drift.

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
