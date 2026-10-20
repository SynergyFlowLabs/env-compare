import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A fast mirror of the cookie rules in `scripts/check-privacy.mjs`, so a
 * violation shows up in `npm test` rather than only in the longer guard run.
 */
const ROOT = process.cwd();
const CONSENT_MODULE = 'src/ui/lib/consent.ts';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const sources = walk(join(ROOT, 'src'))
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .map((file) => ({ path: relative(ROOT, file), text: readFileSync(file, 'utf8') }));

describe('cookie policy', () => {
  it('touches document.cookie in exactly one file', () => {
    const offenders = sources
      .filter((file) => /document\s*\.\s*cookie/.test(file.text))
      .map((file) => file.path);
    expect(offenders).toEqual([CONSENT_MODULE]);
  });

  it('sets SameSite, Path and Max-Age on every assignment', () => {
    const consent = sources.find((file) => file.path === CONSENT_MODULE);
    const assignments = consent?.text.match(/document\.cookie\s*=\s*`[^`]*`/g) ?? [];
    expect(assignments.length).toBeGreaterThan(0);
    for (const assignment of assignments) {
      expect(assignment).toContain('Max-Age=');
      expect(assignment).toContain('Path=/');
      expect(assignment).toContain('SameSite=Lax');
      expect(assignment).toContain('${THEME_COOKIE}');
    }
  });

  it('cannot store anything but a theme word', () => {
    const consent = sources.find((file) => file.path === CONSENT_MODULE);
    // The only values written are the two theme strings; there is no parameter
    // that could carry a key or a value from the pasted file.
    expect(consent?.text).toContain("export type StoredTheme = 'light' | 'dark';");
    expect(consent?.text).toMatch(/isStoredTheme\(value\) \? value : null/);
  });

  it('does not import anything from the comparison core', () => {
    const consent = sources.find((file) => file.path === CONSENT_MODULE);
    expect(consent?.text).not.toMatch(/from\s+['"].*core/);
  });
});
