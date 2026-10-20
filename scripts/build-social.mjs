#!/usr/bin/env node
/**
 * Social content generator.
 *
 * One design system, three platforms, twelve images:
 *
 *   Instagram  1080×1350 (4:5)  — the tallest size the feed allows, ten slides
 *   LinkedIn   1200×1200 (1:1)  — fills the feed without cropping
 *   X/Twitter  1600×900  (16:9) — summary_large_image, no crop on mobile
 *
 * Rules this file follows, because they are the ones that actually decide
 * whether a carousel works:
 *
 *   - 96px of margin. Anything closer to the edge gets clipped by the safest
 *     UI overlays, and thumbnails read as a solid block.
 *   - Two type sizes per slide, maximum. A slide that needs three does too much.
 *   - One idea per slide, stated in the first four words.
 *   - Text is text, not paths: searchable, translatable, and cheap to edit.
 *   - The palette is the product's, so the feed and the app agree.
 *
 * Run: `node scripts/build-social.mjs`
 * Then render the SVGs to PNG (any renderer works):
 *   python3 scripts/render-social.py       # resvg, what the committed PNGs used
 *   npx @resvg/resvg-js-cli in.svg out.png # or the JS port
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'docs', 'social');

/* ------------------------------------------------------------------ palette */

const C = {
  bg: '#101215',
  panel: '#171a1f',
  panelEdge: 'rgba(255,255,255,0.09)',
  ink: '#f6f6f3',
  soft: '#a7aebb',
  faint: '#6b7280',
  line: 'rgba(255,255,255,0.07)',
  accent: '#2c46c8',
  missing: '#c0392f',
  missingInk: '#e88c84',
  empty: '#9a5b00',
  emptyInk: '#dda85a',
  placeholder: '#6b4fa1',
  placeholderInk: '#b4a0dd',
  commented: '#666b72',
  commentedInk: '#9aa0a8',
  ok: '#2f6b4f',
  okInk: '#7fc39f',
  differs: '#1f6f8b',
  differsInk: '#7fc0d3',
};

const SANS = 'DejaVu Sans, Verdana, Helvetica, Arial, sans-serif';
const MONO = 'DejaVu Sans Mono, Menlo, Consolas, monospace';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ------------------------------------------------------------------ helpers */

/** The shell every slide starts from: background, grid, glow. */
function shell(width, height, { grid = 40 } = {}) {
  return `
  <defs>
    <pattern id="grid" width="${grid}" height="${grid}" patternUnits="userSpaceOnUse">
      <path d="M${grid} 0H0V${grid}" fill="none" stroke="#ffffff" stroke-opacity="0.028" stroke-width="1"/>
    </pattern>
    <radialGradient id="glow" cx="0.12" cy="0.02" r="0.8">
      <stop offset="0" stop-color="${C.accent}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${C.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="${C.bg}"/>
  <rect width="${width}" height="${height}" fill="url(#grid)"/>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>`;
}

/** The mark, at any scale. Same geometry as public/favicon.svg. */
function mark(x, y, size) {
  const s = size / 32;
  const r = (v) => (v * s).toFixed(2);
  return `<g transform="translate(${x} ${y})">
    <rect width="${r(32)}" height="${r(32)}" rx="${r(7)}" fill="#15181c" stroke="${C.panelEdge}"/>
    <rect x="${r(6)}" y="${r(7)}" width="${r(5)}" height="${r(18)}" rx="${r(1.5)}" fill="${C.ink}"/>
    <rect x="${r(21)}" y="${r(7)}" width="${r(5)}" height="${r(6.5)}" rx="${r(1.5)}" fill="${C.ink}" fill-opacity="0.55"/>
    <rect x="${r(21)}" y="${r(18.5)}" width="${r(5)}" height="${r(6.5)}" rx="${r(1.5)}" fill="${C.ink}" fill-opacity="0.55"/>
  </g>`;
}

/** Top-left brand lockup + slide counter. Identical on every slide. */
function header(width, index, total) {
  const pad = width >= 1600 ? 72 : 96;
  return `${mark(pad, pad - 6, width >= 1600 ? 40 : 46)}
  <text x="${pad + (width >= 1600 ? 54 : 62)}" y="${pad + (width >= 1600 ? 21 : 25)}" fill="${C.ink}"
        font-family="${SANS}" font-size="${width >= 1600 ? 20 : 24}" font-weight="700" letter-spacing="-0.2">EnvCompare</text>
  ${
    index
      ? `<text x="${width - pad}" y="${pad + (width >= 1600 ? 21 : 25)}" fill="${C.faint}" text-anchor="end"
        font-family="${MONO}" font-size="20">${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')}</text>`
      : ''
  }`;
}

/** Headline lines. `size` is chosen per slide; two lines maximum. */
function headline(lines, { x, y, size, lineHeight = 1.12, fill = C.ink, weight = 700, align = 'start', width }) {
  return lines
    .map((line, i) => {
      const anchor = align === 'middle' ? ` text-anchor="middle" x="${x}"` : ` x="${x}"`;
      return `<text${anchor} y="${(y + i * size * lineHeight).toFixed(1)}" fill="${fill}"
        font-family="${SANS}" font-size="${size}" font-weight="${weight}" letter-spacing="-${(size * 0.028).toFixed(1)}">${esc(line)}</text>`;
    })
    .join('\n  ');
}

/** A single line of body copy. */
function body(text, { x, y, size = 30, fill = C.soft, mono = false, anchor = 'start' }) {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${mono ? MONO : SANS}" font-size="${size}"
    ${anchor === 'middle' ? 'text-anchor="middle"' : ''}>${esc(text)}</text>`;
}

/** A state chip: the product's visual vocabulary, reused as a graphic device. */
function chip({ x, y, label, colour, ink, w = 168, h = 44, size = 22 }) {
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${colour}" fill-opacity="0.18"
          stroke="${colour}" stroke-opacity="0.55"/>
    <circle cx="${x + 22}" cy="${y + h / 2}" r="5" fill="${ink}"/>
    <text x="${x + 38}" y="${y + h / 2 + size * 0.35}" fill="${ink}" font-family="${SANS}"
          font-size="${size}" font-weight="600">${esc(label)}</text>
  </g>`;
}

/** Progress dots, so a carousel announces that there is more. */
function dots({ x, y, total, active, gap = 22, r = 5 }) {
  return Array.from({ length: total }, (_, i) => {
    const fill = i === active - 1 ? C.ink : 'rgba(246,246,243,0.22)';
    return `<circle cx="${x + i * gap}" cy="${y}" r="${i === active - 1 ? r + 1 : r}" fill="${fill}"/>`;
  }).join('');
}

function footer(width, height, text = 'envcompare.vercel.app') {
  const pad = width >= 1600 ? 72 : 96;
  return `<text x="${pad}" y="${height - (width >= 1600 ? 52 : 68)}" fill="${C.faint}" font-family="${MONO}" font-size="${width >= 1600 ? 18 : 21}">${esc(text)}</text>`;
}

const svg = (width, height, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">${inner}</svg>`;

/* ------------------------------------------------------------ shared pieces */

/** A key/value table row, the recurring motif. */
function row({ x, y, w, key, chipLabel, colour, ink, value }) {
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="1" fill="${C.line}"/>
    <text x="${x}" y="${y + 34}" fill="#cfd6e2" font-family="${MONO}" font-size="21">${esc(key)}</text>
    ${
      value
        ? `<text x="${x + 330}" y="${y + 34}" fill="${C.faint}" font-family="${MONO}" font-size="19">${esc(value)}</text>`
        : ''
    }
    <rect x="${x + w - 190}" y="${y + 10}" width="190" height="38" rx="9" fill="${colour}" fill-opacity="0.18"
          stroke="${colour}" stroke-opacity="0.55"/>
    <text x="${x + w - 95}" y="${y + 35}" fill="${ink}" font-family="${SANS}" font-size="19" font-weight="600"
          text-anchor="middle">${esc(chipLabel)}</text>
  </g>`;
}

/** A rounded panel, used for code blocks and mock file cards. */
function panel({ x, y, w, h, label, radius = 18 }) {
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${C.panel}" stroke="${C.panelEdge}"/>
    ${label ? `<text x="${x + 28}" y="${y + 42}" fill="${C.faint}" font-family="${SANS}" font-size="18" font-weight="600" letter-spacing="1.4">${esc(label)}</text>` : ''}
  </g>`;
}

/* ------------------------------------------------------------- the 10 slides */

const W = 1080;
const H = 1350;
const PAD = 96;

/** Every slide, in order. Each returns the SVG body. */
const slides = [
  // 01 — cover
  {
    name: '01-cover',
    alt: 'Dark card reading “Your .env is missing something.” with a comparison table below showing a key marked Missing, and a note: nothing tells you until the app breaks.',
    body: () => `${shell(W, H)}${header(W, 1, 10)}
      ${headline(['Your .env is', 'missing something.'], { x: PAD, y: 430, size: 84 })}
      ${body('And nothing tells you', { x: PAD, y: 690, size: 40, fill: C.ink })}
      ${body('until the app breaks.', { x: PAD, y: 742, size: 40, fill: C.ink })}
      ${panel({ x: PAD, y: 830, w: W - PAD * 2, h: 330, label: '.env.example → .env' })}
      ${row({ x: PAD + 28, y: 908, w: W - PAD * 2 - 56, key: 'DATABASE_URL', chipLabel: 'Match', colour: C.ok, ink: C.okInk })}
      ${row({ x: PAD + 28, y: 968, w: W - PAD * 2 - 56, key: 'OPENAI_API_KEY', chipLabel: 'Missing', colour: C.missing, ink: C.missingInk })}
      ${row({ x: PAD + 28, y: 1028, w: W - PAD * 2 - 56, key: 'STRIPE_SECRET', chipLabel: 'Placeholder', colour: C.placeholder, ink: C.placeholderInk })}
      ${row({ x: PAD + 28, y: 1088, w: W - PAD * 2 - 56, key: 'REDIS_URL', chipLabel: 'Different', colour: C.differs, ink: C.differsInk })}
      ${dots({ x: PAD, y: 1210, total: 10, active: 1 })}
      ${footer(W, H)}`,
  },

  // 02 — the cause
  {
    name: '02-cause',
    alt: 'Two file cards side by side: .env.example marked “written by the agent” and .env marked “filled in by you”, with the note that agents are told never to touch .env.',
    body: () => `${shell(W, H)}${header(W, 2, 10)}
      ${headline(['AI agents won’t', 'touch your .env.'], { x: PAD, y: 400, size: 84 })}
      ${body('They are told not to. So they write', { x: PAD, y: 600, size: 33 })}
      ${body('.env.example and hand you the keys.', { x: PAD, y: 646, size: 33 })}
      ${panel({ x: PAD, y: 760, w: 430, h: 230 })}
      <text x="${PAD + 26}" y="${804}" fill="${C.ink}" font-family="${MONO}" font-size="23">.env.example</text>
      <text x="${PAD + 26}" y="${850}" fill="${C.faint}" font-family="${SANS}" font-size="20">written by the agent</text>
      <text x="${PAD + 26}" y="${900}" fill="#cfd6e2" font-family="${MONO}" font-size="18">OPENAI_API_KEY=</text>
      <text x="${PAD + 26}" y="${930}" fill="#cfd6e2" font-family="${MONO}" font-size="18">DATABASE_URL=</text>
      <text x="${PAD + 26}" y="${960}" fill="#cfd6e2" font-family="${MONO}" font-size="18">STRIPE_SECRET=</text>
      ${panel({ x: W - PAD - 430, y: 760, w: 430, h: 230 })}
      <text x="${W - PAD - 404}" y="${804}" fill="${C.ink}" font-family="${MONO}" font-size="23">.env</text>
      <text x="${W - PAD - 404}" y="${850}" fill="${C.faint}" font-family="${SANS}" font-size="20">filled in by you, by hand</text>
      <text x="${W - PAD - 404}" y="${900}" fill="#cfd6e2" font-family="${MONO}" font-size="18">OPENAI_API_KEY=sk-…</text>
      <text x="${W - PAD - 404}" y="${930}" fill="#cfd6e2" font-family="${MONO}" font-size="17">DATABASE_URL=postgres</text>
      <text x="${W - PAD - 404}" y="${960}" fill="${C.faint}" font-family="${MONO}" font-size="18">—</text>
      ${body('two files, one truth', { x: W / 2, y: 1050, size: 22, fill: C.faint, anchor: 'middle', mono: true })}
      ${dots({ x: PAD, y: 1210, total: 10, active: 2 })}
      ${footer(W, H)}`,
  },

  // 03 — the drift
  {
    name: '03-drift',
    alt: 'A timeline: a new key appears in .env.example while .env stays unchanged, and a red line shows the moment the app starts failing.',
    body: () => `${shell(W, H)}${header(W, 3, 10)}
      ${headline(['Then the example', 'grows.'], { x: PAD, y: 400, size: 92 })}
      ${body('A new key lands in .env.example.', { x: PAD, y: 600, size: 33 })}
      ${body('Your .env never hears about it.', { x: PAD, y: 646, size: 33 })}
      ${panel({ x: PAD, y: 760, w: W - PAD * 2, h: 320 })}
      <circle cx="${PAD + 56}" cy="860" r="9" fill="${C.ok}"/>
      <text x="${PAD + 86}" y="868" fill="#cfd6e2" font-family="${MONO}" font-size="19">.env.example</text>
      <text x="${PAD + 330}" y="868" fill="${C.soft}" font-family="${SANS}" font-size="19">adds RESEND_API_KEY</text>
      <circle cx="${PAD + 56}" cy="960" r="9" fill="${C.missing}"/>
      <text x="${PAD + 86}" y="968" fill="#cfd6e2" font-family="${MONO}" font-size="19">.env</text>
      <text x="${PAD + 330}" y="968" fill="${C.soft}" font-family="${SANS}" font-size="19">unchanged, silently behind</text>
      <line x1="${PAD + 56}" y1="880" x2="${PAD + 56}" y2="940" stroke="${C.faint}" stroke-width="2" stroke-dasharray="6 8"/>
      <rect x="${PAD + 28}" y="1000" width="${W - PAD * 2 - 56}" height="52" rx="8" fill="${C.missing}" fill-opacity="0.14"/>
      <text x="${PAD + 48}" y="1034" fill="${C.missingInk}" font-family="${SANS}" font-size="21">nothing warns you. it fails later, as a 401.</text>
      ${dots({ x: PAD, y: 1210, total: 10, active: 3 })}
      ${footer(W, H)}`,
  },

  // 04 — the invisible failure
  {
    name: '04-invisible',
    alt: 'Two code lines that both pass a naive check: an empty value and a placeholder value, each labelled as failing at runtime.',
    body: () => `${shell(W, H)}${header(W, 4, 10)}
      ${headline(['Two failures a', 'check can’t see.'], { x: PAD, y: 400, size: 84 })}
      ${body('Both keys exist. Neither works.', { x: PAD, y: 590, size: 33 })}
      ${panel({ x: PAD, y: 680, w: W - PAD * 2, h: 170 })}
      <text x="${PAD + 28}" y="${748}" fill="#e6e9ef" font-family="${MONO}" font-size="27">OPENAI_API_KEY=</text>
      <text x="${PAD + 28}" y="${796}" fill="${C.emptyInk}" font-family="${SANS}" font-size="21">defined, but empty → runtime 401</text>
      ${panel({ x: PAD, y: 880, w: W - PAD * 2, h: 200 })}
      <text x="${PAD + 28}" y="${948}" fill="#e6e9ef" font-family="${MONO}" font-size="27">OPENAI_API_KEY=changeme</text>
      <text x="${PAD + 28}" y="${1000}" fill="${C.placeholderInk}" font-family="${SANS}" font-size="21">still the example value → runtime 401</text>
      ${body('“does this key exist?” says yes', { x: PAD, y: 1160, size: 26, fill: C.faint, mono: true })}
      ${dots({ x: PAD, y: 1210, total: 10, active: 4 })}
      ${footer(W, H)}`,
  },

  // 05 — why diff fails
  {
    name: '05-diff',
    alt: 'Two panels compared: a line diff that shows noise because the same keys sit in a different order, versus a row-aligned variable table where the differences are obvious.',
    body: () => `${shell(W, H)}${header(W, 5, 10)}
      ${headline(['A diff compares', 'lines. Not keys.'], { x: PAD, y: 400, size: 82 })}
      ${body('Reordered keys become noise.', { x: PAD, y: 600, size: 32 })}
      ${body('Empty values look like values.', { x: PAD, y: 646, size: 32 })}
      ${panel({ x: PAD, y: 750, w: 430, h: 300, label: 'DIFF' })}
      <text x="${PAD + 26}" y="${860}" fill="${C.missingInk}" font-family="${MONO}" font-size="17">- OPENAI_API_KEY=</text>
      <text x="${PAD + 26}" y="${892}" fill="${C.okInk}" font-family="${MONO}" font-size="17">+ API_KEY=sk-…</text>
      <text x="${PAD + 26}" y="${924}" fill="${C.missingInk}" font-family="${MONO}" font-size="17">- PORT=3000</text>
      <text x="${PAD + 26}" y="${956}" fill="${C.okInk}" font-family="${MONO}" font-size="17">+ PORT=3000</text>
      <text x="${PAD + 26}" y="${1000}" fill="${C.faint}" font-family="${SANS}" font-size="18">2 lines changed, 0 problems shown</text>
      ${panel({ x: W - PAD - 430, y: 750, w: 430, h: 300, label: 'ENVCOMPARE' })}
      ${row({ x: W - PAD - 404, y: 800, w: 380, key: 'OPENAI_API_KEY', chipLabel: 'Missing', colour: C.missing, ink: C.missingInk })}
      ${row({ x: W - PAD - 404, y: 866, w: 380, key: 'PORT', chipLabel: 'Match', colour: C.ok, ink: C.okInk })}
      ${row({ x: W - PAD - 404, y: 932, w: 380, key: 'DATABASE_URL', chipLabel: 'Different', colour: C.differs, ink: C.differsInk })}
      ${body('1 problem, by name', { x: W - PAD - 26, y: 1020, size: 18, fill: C.faint, anchor: 'end' })}
      ${dots({ x: PAD, y: 1210, total: 10, active: 5 })}
      ${footer(W, H)}`,
  },

  // 06 — the product
  {
    name: '06-product',
    alt: 'The EnvCompare comparison table: rows for five variables against three files — .env, .env.local and .env.staging — with every cell labelled match, missing, empty, copy, differs or extra.',
    body: () => `${shell(W, H)}${header(W, 6, 10)}
      ${headline(['Meet EnvCompare.'], { x: PAD, y: 380, size: 84 })}
      ${body('Paste your files. Read the table.', { x: PAD, y: 470, size: 33 })}
      ${body('Copy the block that fixes them.', { x: PAD, y: 516, size: 33 })}
      ${panel({ x: PAD, y: 610, w: W - PAD * 2, h: 500 })}
      ${(() => {
        const cols = ['KEY', '.env', '.env.local', '.env.staging'];
        const xs = [PAD + 28, PAD + 300, PAD + 470, PAD + 650];
        const states = {
          match: [C.ok, C.okInk, 'match'],
          missing: [C.missing, C.missingInk, 'missing'],
          empty: [C.empty, C.emptyInk, 'empty'],
          placeholder: [C.placeholder, C.placeholderInk, 'copy'],
          differs: [C.differs, C.differsInk, 'differs'],
          extra: [C.commented, C.commentedInk, 'extra'],
        };
        const rows = [
          ['DATABASE_URL', ['match', 'match', 'match', 'match']],
          ['OPENAI_API_KEY', ['match', 'missing', 'missing', 'missing']],
          ['STRIPE_SECRET', ['placeholder', 'placeholder', 'empty', 'empty']],
          ['REDIS_URL', ['differs', 'differs', 'extra', 'match']],
          ['FEATURE_FLAG', ['match', 'extra', 'extra', 'extra']],
        ];
        const head = cols
          .map((name, i) => `<text x="${xs[i]}" y="664" fill="${i === 0 ? C.faint : i === 1 ? C.ink : C.faint}" font-family="${MONO}" font-size="16">${name}</text>`)
          .join('');
        const body = rows
          .map(([key, cells], r) => {
            const y = 690 + r * 80;
            const line = `<rect x="${PAD + 28}" y="${y}" width="${W - PAD * 2 - 56}" height="1" fill="${C.line}"/>`;
            const keyText = `<text x="${xs[0]}" y="${y + 34}" fill="#cfd6e2" font-family="${MONO}" font-size="17">${key}</text>`;
            const chips = cells
              .map((state, c) => {
                if (c === 0) return '';
                const [colour, ink, label] = states[state];
                const w = c === 3 ? 150 : 140;
                return `<g>
                  <rect x="${xs[c]}" y="${y + 8}" width="${w}" height="34" rx="7" fill="${colour}" fill-opacity="0.18" stroke="${colour}" stroke-opacity="0.5"/>
                  <text x="${xs[c] + w / 2}" y="${y + 30}" fill="${ink}" font-family="${SANS}" font-size="15" font-weight="600" text-anchor="middle">${label}</text>
                </g>`;
              })
              .join('');
            return line + keyText + chips;
          })
          .join('');
        return head + body;
      })()}
      ${dots({ x: PAD, y: 1210, total: 10, active: 6 })}
      ${footer(W, H)}`,
  },

  // 07 — six states
  {
    name: '07-states',
    alt: 'Six labelled rows, one per state EnvCompare distinguishes — missing, empty, placeholder, commented, different and set — each with a colour dot and a plain-language meaning.',
    body: () => `${shell(W, H)}${header(W, 7, 10)}
      ${headline(['Six states.', 'Not two.'], { x: PAD, y: 390, size: 88 })}
      ${body('“Present” hides four different problems.', { x: PAD, y: 556, size: 30 })}
      ${[
        ['Missing', 'the key is not in the file', C.missing, C.missingInk],
        ['Empty', 'the key is there, the value is not', C.empty, C.emptyInk],
        ['Placeholder', 'still changeme, still your-api-key', C.placeholder, C.placeholderInk],
        ['Commented', 'present, but switched off with #', C.commented, C.commentedInk],
        ['Different', 'set in both, and they disagree', C.differs, C.differsInk],
        ['Set', 'actually configured, actually working', C.ok, C.okInk],
      ]
        .map(([label, meaning, colour, ink], i) => {
          const y = 624 + i * 92;
          return `<g>
            <rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="76" rx="10" fill="${colour}" fill-opacity="0.10"
                  stroke="${colour}" stroke-opacity="0.4"/>
            <circle cx="${PAD + 40}" cy="${y + 38}" r="9" fill="${colour}"/>
            <text x="${PAD + 68}" y="${y + 46}" fill="${ink}" font-family="${SANS}" font-size="26" font-weight="600">${label}</text>
            <text x="${PAD + 300}" y="${y + 46}" fill="${C.soft}" font-family="${SANS}" font-size="24">${meaning}</text>
          </g>`;
        })
        .join('')}
      ${dots({ x: PAD, y: 1210, total: 10, active: 7 })}
      ${footer(W, H)}`,
  },

  // 08 — N files
  {
    name: '08-files',
    alt: 'Five file rows — .env.example, .env, .env.local, .env.staging and .env.production — each with the role it plays, and the note that one file is the reference and every target gets its own column.',
    body: () => `${shell(W, H)}${header(W, 8, 10)}
      ${headline(['Two files is', 'the floor.'], { x: PAD, y: 390, size: 92 })}
      ${body('Real projects keep more. Compare up to eight:', { x: PAD, y: 520, size: 29 })}
      ${[
        ['.env.example', 'reference'],
        ['.env', 'local, untracked'],
        ['.env.local', 'your overrides'],
        ['.env.staging', 'the environment'],
        ['.env.production', 'the one that bills you'],
      ]
        .map(([file, why], i) => {
          const y = 590 + i * 104;
          return `<g>
            <rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="84" rx="12" fill="${C.panel}" stroke="${C.panelEdge}"/>
            <text x="${PAD + 30}" y="${y + 50}" fill="${C.ink}" font-family="${MONO}" font-size="25">${file}</text>
            <text x="${W - PAD - 30}" y="${y + 50}" fill="${C.faint}" font-family="${SANS}" font-size="21" text-anchor="end">${why}</text>
          </g>`;
        })
        .join('')}
      ${body('one reference, every target gets its own column', { x: W / 2, y: 1180, size: 22, fill: C.faint, anchor: 'middle', mono: true })}
      ${dots({ x: PAD, y: 1250, total: 10, active: 8 })}
      ${footer(W, H)}`,
  },

  // 09 — the fix
  {
    name: '09-fix',
    alt: 'A copy-ready block headed “copy 3 variables for .env”, listing three missing keys with blank values, and the note that no values are in the payload.',
    body: () => `${shell(W, H)}${header(W, 9, 10)}
      ${headline(['The fix, not', 'the diagnosis.'], { x: PAD, y: 390, size: 86 })}
      ${body('One button gives you the block that fills', { x: PAD, y: 536, size: 29 })}
      ${body('the gaps. Keys only, blank values, your order.', { x: PAD, y: 578, size: 29 })}
      ${panel({ x: PAD, y: 640, w: W - PAD * 2, h: 390, label: 'COPY 3 VARIABLES FOR .env' })}
      <text x="${PAD + 30}" y="${740}" fill="#e6e9ef" font-family="${MONO}" font-size="23">OPENAI_API_KEY=</text>
      <text x="${PAD + 30}" y="${790}" fill="#e6e9ef" font-family="${MONO}" font-size="23">STRIPE_SECRET_KEY=</text>
      <text x="${PAD + 30}" y="${840}" fill="#e6e9ef" font-family="${MONO}" font-size="23">RESEND_API_KEY=</text>
      <text x="${PAD + 30}" y="${930}" fill="${C.faint}" font-family="${SANS}" font-size="20">no values in the payload — not even the ones you pasted</text>
      ${body('paste → save → restart. done.', { x: PAD, y: 1120, size: 26, fill: C.okInk, mono: true })}
      ${dots({ x: PAD, y: 1210, total: 10, active: 9 })}
      ${footer(W, H)}`,
  },

  // 10 — privacy + CTA
  {
    name: '10-cta',
    alt: 'Closing card: nothing leaves your tab — no upload, no account, no storage, no analytics — with the address envcompare.vercel.app and an invitation to try it.',
    body: () => `${shell(W, H)}${header(W, 10, 10)}
      ${headline(['Nothing leaves', 'your tab.'], { x: PAD, y: 400, size: 92 })}
      ${['No upload.', 'No account.', 'No storage.', 'No analytics.']
        .map((line, i) => body(line, { x: PAD, y: 610 + i * 60, size: 38, fill: C.ink }))
        .join('')}
      ${body('Your .env never becomes a request.', { x: PAD, y: 880, size: 24, fill: C.faint, mono: true })}
      <rect x="${PAD}" y="950" width="${W - PAD * 2}" height="150" rx="16" fill="${C.accent}" fill-opacity="0.16"
            stroke="${C.accent}" stroke-opacity="0.55"/>
      <text x="${W / 2}" y="1022" fill="${C.ink}" font-family="${MONO}" font-size="40" font-weight="700" text-anchor="middle">envcompare.vercel.app</text>
      <text x="${W / 2}" y="1068" fill="${C.soft}" font-family="${SANS}" font-size="24" text-anchor="middle">free · open source · MIT</text>
      ${dots({ x: PAD, y: 1210, total: 10, active: 10 })}
      ${footer(W, H, 'built by @imgul')}`,
  },
];

/* ------------------------------------------------------ LinkedIn & X cards */

const linkedin = {
  name: 'linkedin-card',
  alt: 'Square card: “AI agents won’t touch your .env. So it rots.” Below it, four rows of an env comparison marked Missing, Empty, Placeholder and Match, and the address envcompare.vercel.app.',
  width: 1200,
  height: 1200,
  body: () => {
    const w = 1200;
    const h = 1200;
    const pad = 88;
    return `${shell(w, h, { grid: 48 })}
      ${header(w, null, null)}
      ${headline(['AI agents won’t', 'touch your .env.', 'So it rots.'], {
        x: pad,
        y: 300,
        size: 72,
        lineHeight: 1.18,
      })}
      ${panel({ x: pad, y: 560, w: w - pad * 2, h: 300 })}
      ${row({ x: pad + 28, y: 606, w: w - pad * 2 - 56, key: 'OPENAI_API_KEY', chipLabel: 'Missing', colour: C.missing, ink: C.missingInk, value: '—' })}
      ${row({ x: pad + 28, y: 672, w: w - pad * 2 - 56, key: 'DATABASE_URL', chipLabel: 'Empty', colour: C.empty, ink: C.emptyInk, value: '""' })}
      ${row({ x: pad + 28, y: 738, w: w - pad * 2 - 56, key: 'STRIPE_SECRET', chipLabel: 'Placeholder', colour: C.placeholder, ink: C.placeholderInk, value: 'changeme' })}
      ${row({ x: pad + 28, y: 804, w: w - pad * 2 - 56, key: 'REDIS_URL', chipLabel: 'Match', colour: C.ok, ink: C.okInk, value: 'redis://…' })}
      ${body('Paste 2–8 env files. See every missing,', { x: pad, y: 926, size: 26, fill: C.soft })}
      ${body('empty or placeholder variable — then copy the fix.', { x: pad, y: 962, size: 26, fill: C.soft })}
      <rect x="${pad}" y="1002" width="${w - pad * 2}" height="96" rx="14" fill="${C.accent}" fill-opacity="0.16" stroke="${C.accent}" stroke-opacity="0.5"/>
      <text x="${pad + 32}" y="1060" fill="${C.ink}" font-family="${MONO}" font-size="30" font-weight="700">envcompare.vercel.app</text>
      <text x="${w - pad - 32}" y="1060" fill="${C.soft}" font-family="${SANS}" font-size="21" text-anchor="end">free · MIT</text>
      ${footer(w, h, 'nothing uploaded · nothing stored')}`;
  },
};

const twitter = {
  name: 'x-card',
  alt: 'Wide card: “Your .env is missing something.” with a mini comparison table and the line “Compare 2–8 env files in your browser. Nothing is uploaded.”',
  width: 1600,
  height: 900,
  body: () => {
    const w = 1600;
    const h = 900;
    const pad = 72;
    return `${shell(w, h, { grid: 40 })}
      ${header(w, null, null)}
      ${headline(['Your .env is', 'missing something.'], { x: pad, y: 300, size: 68, lineHeight: 1.18 })}
      ${body('Compare 2–8 env files in your browser.', { x: pad, y: 500, size: 31, fill: C.soft })}
      ${body('Nothing is uploaded.', { x: pad, y: 542, size: 31, fill: C.soft })}
      <rect x="${pad}" y="614" width="410" height="80" rx="14" fill="${C.accent}" fill-opacity="0.18" stroke="${C.accent}" stroke-opacity="0.55"/>
      <text x="${pad + 205}" y="664" fill="${C.ink}" font-family="${MONO}" font-size="27" font-weight="700" text-anchor="middle">envcompare.vercel.app</text>
      ${panel({ x: 880, y: 200, w: 648, h: 500 })}
      <text x="908" y="252" fill="${C.faint}" font-family="${SANS}" font-size="17" font-weight="600" letter-spacing="1.4">.env.example → .env</text>
      ${row({ x: 908, y: 288, w: 592, key: 'DATABASE_URL', chipLabel: 'Match', colour: C.ok, ink: C.okInk })}
      ${row({ x: 908, y: 360, w: 592, key: 'OPENAI_API_KEY', chipLabel: 'Missing', colour: C.missing, ink: C.missingInk })}
      ${row({ x: 908, y: 432, w: 592, key: 'STRIPE_SECRET', chipLabel: 'Placeholder', colour: C.placeholder, ink: C.placeholderInk })}
      ${row({ x: 908, y: 504, w: 592, key: 'REDIS_URL', chipLabel: 'Different', colour: C.differs, ink: C.differsInk })}
      ${row({ x: 908, y: 576, w: 592, key: 'FEATURE_FLAG', chipLabel: 'Extra', colour: C.empty, ink: C.emptyInk })}
      ${footer(w, h, 'open source · MIT · built by @imgul')}`;
  },
};

/* --------------------------------------------------------------------- emit */

function write(dir, name, content) {
  mkdirSync(join(OUT, dir), { recursive: true });
  const file = join(OUT, dir, `${name}.svg`);
  writeFileSync(file, content);
  return file;
}

let count = 0;
for (const slide of slides) {
  write('instagram', slide.name, svg(W, H, slide.body()));
  count += 1;
}
write('linkedin', linkedin.name, svg(linkedin.width, linkedin.height, linkedin.body()));
write('twitter', twitter.name, svg(twitter.width, twitter.height, twitter.body()));
count += 2;

process.stdout.write(`wrote ${count} SVGs to docs/social/\n`);
