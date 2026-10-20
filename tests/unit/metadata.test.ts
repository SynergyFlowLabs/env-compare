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

  it('gives search engines a live heading, because the app renders client-side', () => {
    // Exactly one <h1> in the served HTML, inside #root so React replaces it.
    const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
    expect(headings).toHaveLength(1);
    expect(headings[0]![1].replace(/\s+/g, ' ').trim()).toBe(
      'EnvCompare — see what your .env is missing',
    );
    const rootStart = html.indexOf('<div id="root">');
    expect(html.indexOf('<h1', rootStart)).toBeGreaterThan(rootStart);
    // And a readable fallback for the no-JavaScript case, which is the only
    // reason a static shell is worth having.
    expect(html).toContain('<noscript>');
  });

  it('links .ico and .png favicons, not just the SVG Google ignores', () => {
    const icons = [...html.matchAll(/<link rel="icon"([^>]*)>/g)].map((m) => m[1]!);
    expect(icons.some((tag) => tag.includes('href="/favicon.ico"'))).toBe(true);
    expect(icons.some((tag) => tag.includes('sizes="32x32"') && tag.includes('.png'))).toBe(true);
    expect(icons.some((tag) => tag.includes('sizes="16x16"') && tag.includes('.png'))).toBe(true);
    expect(icons.some((tag) => tag.includes('image/svg+xml'))).toBe(true);
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
    // A version query is deliberate: the edge held a pre-fix response for the
    // bare URL (s-maxage was a week), and every scraper caches by full URL.
    expect(meta('og:image')).toBe(`${ORIGIN}/og-image.png?v=1`);
    expect(meta('twitter:image')).toBe(meta('og:image'));
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

describe('favicons', () => {
  it('ships every icon it advertises, at a size the browser can use', () => {
    const ico = readFileSync(join(root, 'public/favicon.ico'));
    // ICONDIR: reserved=0, type=1, count; then one 16-byte entry per image.
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    const count = ico.readUInt16LE(4);
    expect(count).toBeGreaterThanOrEqual(3);
    const sizes = [];
    for (let index = 0; index < count; index += 1) {
      const offset = 6 + index * 16;
      sizes.push([ico.readUInt8(offset) || 256, ico.readUInt8(offset + 1) || 256]);
    }
    expect(sizes).toEqual(
      expect.arrayContaining([
        [16, 16],
        [32, 32],
        [48, 48],
      ]),
    );
    expect(pngSize(join(root, 'public/favicon-16x16.png'))).toMatchObject({
      width: 16,
      height: 16,
    });
    expect(pngSize(join(root, 'public/favicon-32x32.png'))).toMatchObject({
      width: 32,
      height: 32,
    });
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
    expect(locations).toEqual([`${ORIGIN}/`, `${ORIGIN}/mask`, `${ORIGIN}/about`, `${ORIGIN}/privacy`]);

    const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as {
      rewrites: Array<{ source: string }>;
    };
    const rewritten = vercel.rewrites.map((rewrite) => rewrite.source);
    for (const location of locations.slice(1)) {
      expect(rewritten).toContain(new URL(location!).pathname);
    }
  });

  it('keeps asset cache lifetimes short enough to correct a mistake', () => {
    const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as {
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };
    const rule = vercel.headers.find((entry) => entry.source === '/og-image.png');
    const value = rule?.headers.find((header) => header.key === 'Cache-Control')?.value ?? '';
    expect(value).toContain('s-maxage=3600');
    expect(value).not.toContain('s-maxage=604800');
  });

  it('lets other sites embed the preview card', () => {
    // Browsers block a cross-origin <img> when the response says
    // Cross-Origin-Resource-Policy: same-origin. That is what stopped every
    // preview panel from rendering the card while the URL itself returned 200.
    const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as {
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };
    const ruleFor = (source: string) =>
      vercel.headers.find((rule) => rule.source === source)?.headers ?? [];
    const value = (source: string, key: string) =>
      ruleFor(source).find((header) => header.key === key)?.value;

    expect(value('/og-image.png', 'Cross-Origin-Resource-Policy')).toBe('cross-origin');
    for (const icon of ['/favicon.ico', '/favicon-32x32.png', '/apple-touch-icon.png']) {
      expect(value(icon, 'Cross-Origin-Resource-Policy')).toBe('cross-origin');
    }
    // Documents stay same-origin: nothing should be able to frame or embed the app.
    expect(value('/(.*)', 'Cross-Origin-Resource-Policy')).toBe('same-origin');

    // Order matters: Vercel merges every matching header rule and the LAST value
    // for a repeated key wins. With the catch-all after the assets, its
    // same-origin silently overwrote them — which is exactly what happened.
    const sources = vercel.headers.map((rule) => rule.source);
    expect(sources.indexOf('/(.*)')).toBeLessThan(sources.indexOf('/og-image.png'));
    expect(sources.indexOf('/(.*)')).toBeLessThan(sources.indexOf('/favicon.ico'));
  });

  it('keeps the CSP untouched by the metadata work', () => {
    const vercel = readFileSync(join(root, 'vercel.json'), 'utf8');
    expect(vercel).toContain("connect-src 'none'");
    expect(vercel).toContain("script-src 'self'");
    // No inline scripts were added; the JSON-LD block is data, not code.
    expect(vercel).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});
