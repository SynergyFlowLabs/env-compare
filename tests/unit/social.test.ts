import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The social kit is content, not code — which is exactly why it rots quietly.
 * An image that is never uploaded by a test is still shipped by hand, an alt
 * text is read by people who cannot see the card at all, and a caption quotes
 * the artwork. These checks pin the three together:
 *
 *   - `scripts/build-social.mjs` is the only place the images are defined;
 *   - every card carries a distinct, useful alt text, and `CAPTIONS.md`
 *     reproduces those strings verbatim so the two cannot disagree;
 *   - the committed PNGs exist, are the platform's shape, and are small enough
 *     to upload.
 *
 * Nothing here renders anything: resvg is a Python dependency, and a test that
 * needs a rasteriser is a test that fails on a fresh clone.
 */

const root = process.cwd();
const generator = readFileSync(join(root, 'scripts', 'build-social.mjs'), 'utf8');
const captions = readFileSync(join(root, 'docs', 'social', 'CAPTIONS.md'), 'utf8');

type Card = { name: string; alt: string };

const cards: Card[] = [...generator.matchAll(/name: '([^']+)',\n\s+alt: '((?:[^'\\]|\\.)*)'/g)].map(
  (match) => ({ name: match[1]!, alt: match[2]! }),
);

/** Platform shapes, in the 1× design units the generator draws at. */
const SHAPES: Record<string, { width: number; height: number; dir: string }> = {
  instagram: { width: 1080, height: 1350, dir: 'instagram' },
  linkedin: { width: 1200, height: 1200, dir: 'linkedin' },
  twitter: { width: 1600, height: 900, dir: 'twitter' },
};

/** Read a PNG's pixel size out of the IHDR chunk, without an image library. */
function pngSize(path: string): { width: number; height: number } {
  const buffer = readFileSync(path);
  expect(buffer.subarray(1, 4).toString('ascii'), `${path} is not a PNG`).toBe('PNG');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe('social kit', () => {
  it('defines ten Instagram slides and one card per other platform', () => {
    const instagram = cards.filter((card) => /^\d\d-/.test(card.name));
    expect(instagram).toHaveLength(10);
    expect(instagram.map((card) => card.name)).toEqual([
      '01-cover',
      '02-cause',
      '03-drift',
      '04-invisible',
      '05-diff',
      '06-product',
      '07-states',
      '08-files',
      '09-fix',
      '10-cta',
    ]);
    expect(cards.map((card) => card.name)).toContain('linkedin-card');
    expect(cards.map((card) => card.name)).toContain('x-card');
  });

  it('gives every card its own alt text, long enough to replace the image', () => {
    const seen = new Set<string>();
    for (const card of cards) {
      // Enough words to carry the argument, not just the label.
      expect(card.alt.length, `${card.name} alt is too short`).toBeGreaterThan(60);
      expect(seen.has(card.alt), `${card.name} reuses another card's alt`).toBe(false);
      seen.add(card.alt);
    }
  });

  it('quotes the alt text verbatim in CAPTIONS.md', () => {
    for (const card of cards) {
      expect(captions, `${card.name} alt is missing from CAPTIONS.md`).toContain(card.alt);
    }
  });

  it('ships a PNG for every card, at the platform’s shape', () => {
    for (const card of cards) {
      const platform = card.name.startsWith('linkedin')
        ? SHAPES.linkedin!
        : card.name.startsWith('x-')
          ? SHAPES.twitter!
          : SHAPES.instagram!;
      const file = join(root, 'docs', 'social', platform.dir, `${card.name}.png`);
      const { width, height } = pngSize(file);
      // Rendered at 2×, so the design size is the platform's and this is double.
      expect({ name: card.name, width, height }).toEqual({
        name: card.name,
        width: platform.width * 2,
        height: platform.height * 2,
      });
      // Platforms recompress anyway; a heavy source is a slow first download and
      // risks Instagram's upload ceiling.
      expect(statSync(file).size, `${card.name}.png is too large`).toBeLessThan(9_000_000);
    }
  });

  it('keeps every SVG next to its PNG, so the set can be regenerated', () => {
    const svgs = readdirSync(join(root, 'docs', 'social', 'instagram')).filter((file) =>
      file.endsWith('.svg'),
    );
    expect(svgs).toHaveLength(10);
    expect(readdirSync(join(root, 'docs', 'social', 'linkedin'))).toEqual(
      expect.arrayContaining(['linkedin-card.svg', 'linkedin-card.png']),
    );
    expect(readdirSync(join(root, 'docs', 'social', 'twitter'))).toEqual(
      expect.arrayContaining(['x-card.svg', 'x-card.png']),
    );
  });

  it('writes text as text, never as baked-in bitmaps', () => {
    // The promise in the generator's header: editable with a text editor,
    // searchable, translatable, and cheap to diff. A rasterised `<image>` would
    // end all four. (The logo mark is a `<path>` and always will be — icons are
    // drawings, words are words.)
    for (const card of cards) {
      const dir = card.name.startsWith('linkedin')
        ? 'linkedin'
        : card.name.startsWith('x-')
          ? 'twitter'
          : 'instagram';
      const svg = readFileSync(join(root, 'docs', 'social', dir, `${card.name}.svg`), 'utf8');
      expect(svg, `${card.name}.svg has no text`).toContain('<text');
      expect(svg, `${card.name}.svg embeds a bitmap`).not.toContain('<image');
      expect(svg, `${card.name}.svg inlines binary data`).not.toContain('base64,');
    }
  });
});
