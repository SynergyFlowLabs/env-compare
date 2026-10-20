import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The palette is the one part of the interface that cannot be checked by
 * rendering: jsdom has no layout, no cascade of custom properties, and no
 * colour maths. So the stylesheet is parsed as text instead.
 *
 * Two things are enforced here, both of which have already gone wrong once:
 *   1. The two dark blocks are identical (they exist because CSS cannot express
 *      "dark, unless the reader explicitly chose light" in one rule).
 *   2. Every foreground/background pair used for text actually meets WCAG AA.
 */

// jsdom's import.meta.url is an http URL, so resolve from the project root.
const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');

type Tokens = Map<string, string>;

function blockAfter(marker: string): Tokens {
  const start = css.indexOf(marker);
  if (start === -1) throw new Error(`Missing block: ${marker}`);
  const open = css.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = css.slice(open + 1, end);
  const tokens: Tokens = new Map();
  for (const match of body.matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(match[1], match[2].trim());
  }
  return tokens;
}

const light = blockAfter(':root {');
const darkOs = blockAfter("@media (prefers-color-scheme: dark) {");
const darkForced = blockAfter(":root[data-theme='dark'] {");

describe('tokens.css', () => {
  it('declares exactly the colour tokens of the light palette in both dark blocks', () => {
    // Fonts, radii, easings and widths are theme-independent, so they live only
    // in :root. Every colour must be redefined, or dark mode inherits a light
    // value and something becomes unreadable.
    const lightColours = [...light.entries()]
      .filter(([name, value]) => value.startsWith('#') && name !== '--shadow-panel')
      .map(([name]) => name)
      .sort();
    const darkNames = (block: Tokens) =>
      [...block.keys()]
        .filter((name) => name !== '--shadow-panel')
        .sort();
    expect(darkNames(darkForced)).toEqual(lightColours);
    expect(darkNames(darkOs)).toEqual(lightColours);

    // Shadows are colours too, just written as functions rather than hex.
    expect(darkForced.get('--shadow-panel')).toBeTypeOf('string');
    expect(darkForced.get('--shadow-panel')).not.toBe(light.get('--shadow-panel'));
  });

  it('keeps the OS dark block and the forced dark block identical', () => {
    expect(Object.fromEntries(darkOs)).toEqual(Object.fromEntries(darkForced));
  });

  it('lets an explicit choice override the operating system', () => {
    // The whole reason the dark block exists twice: `Auto` must follow the OS,
    // `Light` must beat a dark OS, and no plain media query can express that.
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(":root:not([data-theme='light'])");
    expect(css).toMatch(/:root\[data-theme='dark'\] \{[^}]*color-scheme: dark;/);
    expect(css).toMatch(/:root\[data-theme='light'\] \{[^}]*color-scheme: light;/);
    expect(css).toContain('color-scheme: light dark');
  });

  it('has a light and a dark value for every colour token', () => {
    for (const [name, value] of light) {
      if (!value.startsWith('#')) continue; // fonts, radii, easings
      expect(darkForced.get(name), `${name} is missing from the dark palette`).toMatch(/^#[0-9a-f]{6}$/);
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const SURFACES = ['--paper', '--surface', '--surface-sunken'];

describe.each([
  ['light', light],
  ['dark', darkForced],
])('%s palette contrast (WCAG 2.1 AA)', (_name, tokens) => {
  const value = (token: string) => {
    const raw = tokens.get(token);
    if (!raw || !raw.startsWith('#')) throw new Error(`No colour for ${token}`);
    return raw;
  };

  it.each(['--ink', '--ink-soft', '--ink-faint'])('%s is legible on every surface', (token) => {
    for (const surface of SURFACES) {
      expect(contrast(value(token), value(surface)), `${token} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the accent is legible as link and button text', () => {
    for (const surface of SURFACES) {
      expect(contrast(value('--accent'), value(surface)), `--accent on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(value('--accent-ink'), value('--accent-tint'))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['--st-missing', '--st-empty', '--st-placeholder', '--st-commented', '--st-ok', '--st-differs'])(
    '%s is legible as a label and on its own tint',
    (token) => {
      expect(contrast(value(token), value('--surface')), `${token} on --surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(value(token), value(`${token}-tint`)), `${token} on its tint`).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('text drawn on a filled accent or state colour stays readable', () => {
    // Plain #fff on the dark palette's pastel fills is about 2:1 — the bug this
    // token pair exists to prevent.
    expect(contrast(value('--on-accent'), value('--accent'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(value('--on-accent'), value('--accent-ink'))).toBeGreaterThanOrEqual(4.5);
    for (const state of ['--st-missing', '--st-empty', '--st-placeholder', '--st-ok', '--st-differs']) {
      expect(contrast(value('--on-state'), value(state)), `--on-state on ${state}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the focus ring is visible against the page', () => {
    expect(contrast(value('--focus'), value('--paper'))).toBeGreaterThanOrEqual(3);
    expect(contrast(value('--focus'), value('--surface'))).toBeGreaterThanOrEqual(3);
  });

  it('borders are distinguishable from the surface they sit on', () => {
    expect(contrast(value('--line'), value('--surface'))).toBeGreaterThanOrEqual(1.2);
    expect(contrast(value('--line-strong'), value('--surface'))).toBeGreaterThanOrEqual(1.6);
  });
});
