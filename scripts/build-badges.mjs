#!/usr/bin/env node
/**
 * README badges, generated rather than hand-drawn.
 *
 * Badges that report a number go stale silently: a "383 tests" badge next to a
 * suite of 400 is a small lie that nobody notices. Keeping them in a script
 * with the numbers in one place makes the lie a one-line fix.
 *
 * They are local SVG rather than shields.io URLs on purpose:
 *   - the README renders on GitHub, in forks, offline, and inside editors;
 *   - no third-party request is made when the page is viewed;
 *   - the colours come from our own palette (src/styles/tokens.css).
 *
 * Text is fitted with `textLength` + `lengthAdjust="spacingAndGlyphs"`, so the
 * layout is identical in any renderer, with or without the preferred font.
 *
 * Run: `node scripts/build-badges.mjs`
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'docs', 'assets', 'badges');

/** Palette, mirroring src/styles/tokens.css. */
const LIGHT_VALUE = '#f6f6f3';
const DARK_LABEL = '#2a2f38';

const GREEN = '#2f6b4f';
const INDIGO = '#2c46c8';
const TEAL = '#1f6f8b';
const VIOLET = '#6b4fa1';
const SLATE = '#5a616b';

/**
 * Left label, right value, and the colour. The accessible description is derived
 * from the two so it can never contradict them — a badge that says "383 tests"
 * in its label and "455" in its aria-label is a bug waiting to be shipped.
 */
const BADGES = [
  { file: 'tests', label: 'tests', value: '455 passing', colour: GREEN },
  { file: 'license', label: 'license', value: 'MIT', colour: INDIGO },
  { file: 'privacy', label: 'privacy', value: 'no upload · no storage', colour: GREEN },
  { file: 'files', label: 'compares', value: '2–8 files', colour: TEAL },
  { file: 'deps', label: 'runtime deps', value: '9', colour: VIOLET },
  { file: 'node', label: 'node', value: '22+', colour: SLATE },
];

const HEIGHT = 20;
const PADDING = 9;
/** Width of one character at 11px in a humanist sans; a close-enough average. */
const CHAR = 6.15;

const width = (text) => Math.round(text.length * CHAR + PADDING * 2);

const escape = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function badge({ label, value, colour }) {
  const alt = `${label}: ${value}`;
  const left = width(label);
  const right = width(value);
  const total = left + right;
  const baseline = 14;
  const text = (x, content) =>
    `<text x="${x}" y="${baseline}" fill="${LIGHT_VALUE}" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" font-weight="600" textLength="${width(content) - PADDING * 2}" lengthAdjust="spacingAndGlyphs" text-anchor="middle">${escape(content)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${HEIGHT}" viewBox="0 0 ${total} ${HEIGHT}" role="img" aria-label="${escape(alt)}">
  <title>${escape(alt)}</title>
  <rect width="${total}" height="${HEIGHT}" rx="4" fill="${DARK_LABEL}"/>
  <rect x="${left}" width="${right}" height="${HEIGHT}" rx="4" fill="${colour}"/>
  <rect x="${left}" width="6" height="${HEIGHT}" fill="${colour}"/>
  <text x="${left / 2}" y="${baseline}" fill="${LIGHT_VALUE}" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" font-weight="600" textLength="${left - PADDING * 2}" lengthAdjust="spacingAndGlyphs" text-anchor="middle">${escape(label)}</text>
  ${text(left + right / 2, value)}
</svg>
`;
}

mkdirSync(OUT, { recursive: true });
for (const badgeSpec of BADGES) {
  writeFileSync(join(OUT, `${badgeSpec.file}.svg`), badge(badgeSpec));
  process.stdout.write(`docs/assets/badges/${badgeSpec.file}.svg\n`);
}
