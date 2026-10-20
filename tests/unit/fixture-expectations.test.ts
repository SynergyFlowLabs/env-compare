import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseEnvFile } from '../../src/core/parse';

const FIXTURE_DIR = join(process.cwd(), 'tests', 'fixtures', 'env');

interface Expectation {
  keys: string[];
  commented: string[];
  diagnostics: string[];
}

const expectations = JSON.parse(
  readFileSync(join(FIXTURE_DIR, 'expectations.json'), 'utf8'),
) as Record<string, Expectation>;

const fixtures: string[] = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith('.env'))
  .sort();

/**
 * Golden expectations: what each fixture should produce, including the
 * diagnostics. Adding a fixture without an expectation here fails on purpose —
 * parsing behaviour is a reviewed decision, not an accident.
 */
describe('fixture expectations', () => {
  it('has an expectation for every fixture', () => {
    expect(fixtures).toEqual(Object.keys(expectations));
  });

  it.each(fixtures)('%s', (name: string) => {
    const expected = expectations[name]!;
    const parsed = parseEnvFile('f', readFileSync(join(FIXTURE_DIR, name), 'utf8'));
    expect(parsed.order).toEqual(expected.keys);
    expect([...parsed.commentedKeys]).toEqual(expected.commented);
    expect(parsed.diagnostics.map((d) => d.code)).toEqual(expected.diagnostics);
  });
});
