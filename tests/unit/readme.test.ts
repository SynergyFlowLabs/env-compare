import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The README is the front door, and its images are the part that rots first:
 * a renamed badge, a banner path that only worked on the branch it was written
 * on, a badge that claims a test count the suite has outgrown. These checks are
 * cheap and they fail loudly.
 */

const root = process.cwd();
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const badgesDir = join(root, 'docs/assets/badges');

// Both Markdown images (`![alt](path.svg)`, which is how the badges are
// embedded) and plain HTML `src`/`href` — GitHub renders either.
const localImages = [
  ...readme.matchAll(/\]\(((?!https?:)[^)\s]+\.(?:svg|png|jpg|webp))\)/g),
  ...readme.matchAll(/(?:src|href)="((?!https?:)[^"]+\.(?:svg|png|jpg|webp))"/g),
].map((match) => match[1]!);

describe('README', () => {
  it('opens with a banner that exists and describes itself', () => {
    expect(localImages).toContain('docs/assets/banner.svg');
    const banner = readFileSync(join(root, 'docs/assets/banner.svg'), 'utf8');
    expect(banner).toContain('<title>');
    expect(banner).toContain('role="img"');
    expect(banner).toMatch(/viewBox="0 0 1280 320"/);
    // Text must be real text, not paths: it stays selectable, searchable and
    // translatable, and it renders on GitHub without a font download.
    expect(banner).toContain('EnvCompare');
    expect(banner).toContain('is missing');
  });

  it('references only files that exist', () => {
    expect(localImages.length).toBeGreaterThanOrEqual(7);
    for (const image of localImages) {
      expect(existsSync(join(root, image)), `${image} is missing`).toBe(true);
    }
  });

  it('ships a badge per claim, each with an accessible label', () => {
    const badges = readdirSync(badgesDir).filter((file) => file.endsWith('.svg'));
    expect(badges.sort()).toEqual(['deps.svg', 'files.svg', 'license.svg', 'node.svg', 'privacy.svg', 'tests.svg']);
    for (const badge of badges) {
      const svg = readFileSync(join(badgesDir, badge), 'utf8');
      expect(svg).toContain('role="img"');
      expect(svg).toContain('aria-label="');
      expect(svg).toContain('<title>');
      // Fixed text width keeps the layout identical in any renderer.
      expect(svg).toContain('textLength=');
      expect(svg).toContain('lengthAdjust="spacingAndGlyphs"');
    }
  });

  it('does not let the test-count badge drift from the badge script or the README', () => {
    const badge = readFileSync(join(badgesDir, 'tests.svg'), 'utf8');
    const script = readFileSync(join(root, 'scripts/build-badges.mjs'), 'utf8');
    const claimed = badge.match(/aria-label="tests: (\d+) passing"/)?.[1];
    expect(claimed).toBeTruthy();
    expect(script).toContain(`value: '${claimed} passing'`);
    // The README states the same number in prose; both are regenerated together.
    expect(readme).toContain(`${claimed} unit and component tests`);
  });

  it('links the sections it advertises', () => {
    const anchors = [...readme.matchAll(/\]\(#([a-z0-9-]+)\)/g)].map((match) => match[1]!);
    const headings = [...readme.matchAll(/^#{2,3} (.+)$/gm)].map((match) =>
      match[1]!
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-'),
    );
    for (const anchor of new Set(anchors)) {
      expect(headings, `#${anchor} has no heading`).toContain(anchor);
    }
  });

  it('names the maintainer and keeps the promises in the copy', () => {
    expect(readme).toContain('https://github.com/imgul');
    for (const claim of ['no backend', 'connect-src', 'no `localStorage`', 'The fix is a surgical patch']) {
      expect(readme.toLowerCase()).toContain(claim.toLowerCase());
    }
  });
});
