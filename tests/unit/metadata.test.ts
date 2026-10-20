import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Discovery metadata is easy to get wrong and impossible to notice: a wrong
 * OG path, a lost `og:url`, an image that is 1733 px wide. These tests treat
 * `index.html`, the static assets and `vercel.json` as one artifact and fail
 * the build when they disagree with each other.
 */

const root = process.cwd();
const html = readFileSync(join(root, 'index.html'), 'utf8');

const ORIGIN = 'https://envcompare.vercel.app';

const attr = (pattern: RegExp): string | null => {
  const match = html.match(pattern);
  return match?.[1]?.trim() ?? null;
};

const meta = (name: string) =>
  attr(new RegExp(`<meta\\s+(?:property|name)="${name}"\\s+content="([^"]*)"`, 's'));

const pngSize = (path: string) => {
  const buffer = readFileSync(path);
  const signature = buffer.subarray(0, 8).toString('hex');
  expect(signature).toBe('89504e470d0a1a0a');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), bytes: buffer.length };
};

describe('document metadata', () => {
  it('keeps the title short enough to render in a search result', () => {
    const title = attr(/<title>([^<]+)<\/title>/);
    expect(title).toBe('EnvCompare — see what your .env is missing');
    expect(title!.length).toBeLessThanOrEqual(60);
  });

  it('writes a description in the 120–165 character band', () => {
    const description = meta('description');
    expect(description).toBeTruthy();
    expect(description!.length).toBeGreaterThanOrEqual(120);
    expect(description!.length).toBeLessThanOrEqual(165);
    // No keyword stuffing, no shouting.
    expect(description!).not.toMatch(/!{2,}|free free/i);
  });

  it('declares a canonical URL and lets crawlers use large previews', () => {
    expect(attr(/<link rel="canonical" href="([^"]+)"/)).toBe(`${ORIGIN}/`);
    expect(meta('robots')).toBe('index, follow, max-image-preview:large');
  });

  it('sets the Open Graph set that Slack, Discord and LinkedIn read', () => {
    expect(meta('og:type')).toBe('website');
    expect(meta('og:site_name')).toBe('EnvCompare');
    expect(meta('og:url')).toBe(`${ORIGIN}/`);
    expect(meta('og:locale')).toBe('en_US');
    expect(meta('og:title')).toBe(attr(/<title>([^<]+)<\/title>/));
    expect(meta('og:description')!.length).toBeGreaterThanOrEqual(120);
    expect(meta('og:description')!.length).toBeLessThanOrEqual(200);
  });

  it('points the card at an absolute https image with its real dimensions', () => {
    expect(meta('og:image')).toBe(`${ORIGIN}/og-image.png`);
    expect(meta('og:image:type')).toBe('image/png');
    expect(meta('og:image:width')).toBe('1200');
    expect(meta('og:image:height')).toBe('630');
    // Alt text is what a screen reader announces for the link preview.
    expect(meta('og:image:alt')!.length).toBeGreaterThan(40);
  });

  it('sets a large Twitter card, not the small one', () => {
    expect(meta('twitter:card')).toBe('summary_large_image');
    expect(meta('twitter:title')).toBe(meta('og:title'));
    expect(meta('twitter:description')).toBe(meta('og:description'));
    expect(meta('twitter:image')).toBe(meta('og:image'));
  });

  it('never references an insecure or relative preview URL', () => {
    const urls = [...html.matchAll(/(?:og:image|og:url|twitter:image|canonical)[^>]*?(https?:\/\/[^"']+)/g)]
      .map((match) => match[1]!);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url.startsWith('https://')).toBe(true);
  });

  it('ships valid JSON-LD describing a free web application', () => {
    const json = attr(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const data = JSON.parse(json!) as Record<string, unknown>;
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('WebApplication');
    expect(data.applicationCategory).toBe('DeveloperApplication');
    expect(data.isAccessibleForFree).toBe(true);
    expect(data.url).toBe(`${ORIGIN}/`);
    expect(data.codeRepository).toBe('https://github.com/SynergyFlowLabs/env-compare');
  });
});

describe('preview image', () => {
  it('is a 1200×630 PNG under 1 MB', () => {
    const { width, height, bytes } = pngSize(join(root, 'public/og-image.png'));
    expect({ width, height }).toEqual({ width: 1200, height: 630 });
    expect(bytes).toBeLessThan(1_000_000);
  });

  it('keeps the touch icon and manifest icons at their declared sizes', () => {
    expect(pngSize(join(root, 'public/apple-touch-icon.png'))).toMatchObject({
      width: 180,
      height: 180,
    });
    const manifest = JSON.parse(readFileSync(join(root, 'public/site.webmanifest'), 'utf8')) as {
      icons: Array<{ src: string; sizes: string }>;
    };
    for (const icon of manifest.icons) {
      const file = join(root, 'public', icon.src.replace(/^\//, ''));
      expect(statSync(file).isFile()).toBe(true);
      if (icon.sizes !== 'any') {
        const [width, height] = icon.sizes.split('x').map(Number);
        expect(pngSize(file)).toMatchObject({ width, height });
      }
    }
  });
});

describe('crawler files', () => {
  it('points robots.txt at the sitemap on the canonical host', () => {
    const robots = readFileSync(join(root, 'public/robots.txt'), 'utf8');
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });

  it('lists only pages that are served through the rewrites', () => {
    const sitemap = readFileSync(join(root, 'public/sitemap.xml'), 'utf8');
    const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locations).toEqual([`${ORIGIN}/`, `${ORIGIN}/about`, `${ORIGIN}/privacy`]);

    const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as {
      rewrites: Array<{ source: string }>;
    };
    const rewritten = vercel.rewrites.map((rewrite) => rewrite.source);
    for (const location of locations.slice(1)) {
      expect(rewritten).toContain(new URL(location!).pathname);
    }
  });

  it('keeps the CSP untouched by the metadata work', () => {
    const vercel = readFileSync(join(root, 'vercel.json'), 'utf8');
    expect(vercel).toContain("connect-src 'none'");
    expect(vercel).toContain("script-src 'self'");
    // No inline scripts were added; the JSON-LD block is data, not code.
    expect(vercel).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});
